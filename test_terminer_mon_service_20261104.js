/*
 * « Terminer mon service » — geste 1 du lot FIN-DE-SERVICE (04/11/2026, Guardian #160 6642704579).
 * Quand l'écran dit « Quart terminé » et que le pointage n'est pas actif, un bouton visible clôt le service
 * (par l'écriture unique de clôture, source `employe`) PUIS déconnecte. Un échec ne déconnecte pas en silence.
 * Code client uniquement : aucune migration, aucune lecture directe de `shifts` ajoutée.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const lire = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');

let SOURCE = lire('nexus-auth.js');
let REGLES = lire('nexus-pointage-regles.js');
const PAGE   = lire('nexus-page.js');
let ACCUEIL = lire('nexus-accueil-piste.js');
let APP    = lire('NEXUS-App-v1.html');

let passes = 0;
const file = [];
function verifier(nom, fn) { file.push([nom, fn]); }
function banc({ shifts, erreurSelect, lignesModifiees, erreurUpdate, avecRegles = true }) {
  const journal = { selects: [], updates: [], erreurs: [], infos: [], alertes: [] };
  const client = {
    from(table) {
      const req = { table, filtres: [] };
      const chaine = {
        select(cols) { req.select = cols; return chaine; },
        update(champs) { req.update = champs; return chaine; },
        eq(col, val) { req.filtres.push([col, val]); return chaine; },
        order(col, opt) { req.ordre = [col, opt]; return chaine; },
        limit(n) { req.limite = n; journal.selects.push(req);
                   return Promise.resolve(erreurSelect
                     ? { data: null, error: erreurSelect }
                     : { data: shifts, error: null }); },
        then(res) {                        // fin de chaîne d'un UPDATE
          journal.updates.push(req);
          const n = typeof lignesModifiees === 'function'
            ? lignesModifiees(journal.updates.length) : lignesModifiees;
          return Promise.resolve(erreurUpdate
            ? { data: null, error: erreurUpdate }
            : { data: Array.from({ length: n === undefined ? 1 : n }, () => ({ id: 'x' })), error: null }
          ).then(res);
        },
      };
      return chaine;
    },
    auth: { getSession: async () => ({ data: { session: null } }), signOut: async () => {} },
  };
  const ctx = {
    supabase: { createClient: () => client },
    window: {
      location: { pathname: '/NEXUS-Cockpit-v2.html', search: '', href: '' },
      // decision-8 (23/09/2026) : nexus-auth.js refuse de démarrer sans
      // nexus-config.js. Configuration Test minimale, jamais de vraie clé —
      // `fetch` reste interdit plus bas, aucun réseau n'en découle.
      NEXUS_CONFIG: { environnement: 'test', supabaseUrl: 'https://test.invalid', supabaseCle: 'stub' },
    },
    document: { createElement: () => ({ style: {} }), head: { appendChild() {} }, body: { appendChild() {} },
                addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] },
    console: {
      log() {}, warn: (...a) => journal.alertes.push(a.join(' ')),
      error: (...a) => journal.erreurs.push(a.join(' ')),
      info:  (...a) => journal.infos.push(a.join(' ')),
    },
    setTimeout, clearTimeout, fetch: async () => { throw new Error('réseau interdit'); },
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  // decision-8 §2 : NexusBuild.versionner n'est asserté par aucun test de ce
  // fichier (ni génération de build-id, ni versionnement d'URL) — un stub
  // d'identité neutre est donc autorisé plutôt que de committer un artefact
  // de build. NexusPage, lui, influence réellement le comportement
  // (chargement conditionnel de scripts selon la page) : le vrai fichier est
  // exécuté, jamais réimplémenté.
  ctx.NexusBuild = { versionner: (src) => src }; // stub d'infrastructure neutralisé, non métier
  vm.runInContext(PAGE, ctx);
  // nexus-page.js assigne son API à `window` (ou globalThis si window est
  // absent) : ici `window` est un sous-objet distinct de l'objet global vm,
  // donc l'assignation atterrit sur `ctx.window.NexusPage`. nexus-auth.js lit
  // l'identifiant bare `NexusPage`, comme dans un vrai navigateur où
  // `window === globalThis` — on relie donc les deux plutôt que de dupliquer
  // la logique de nexus-page.js dans ce banc.
  ctx.NexusPage = ctx.window.NexusPage;
  if (avecRegles) vm.runInContext(REGLES, ctx);
  vm.runInContext(SOURCE, ctx);
  return { ctx, journal };
}

const EMPLOYE = { id: 'emp-9', role: 'pompiste', site_id: 'vito-sainte-marie', nom: 'Karim' };
const SERVICE = { id: 'sh-1', role: 'pompiste', quart: 'matin', site_id: 'vito-sainte-marie', statut: 'en_cours' };
const avecCourant = (ctx, rep) => { ctx.nexusServiceCourant = async () => rep; };

verifier('le service courant est clos par l\'écriture unique, source employe, motif fin_de_service', async () => {
  const { ctx, journal } = banc({ shifts: [] });
  avecCourant(ctx, { service: SERVICE });
  const r = await ctx.nexusTerminerMonService(EMPLOYE);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(r)), { ok: true, closes: 1 });
  assert.strictEqual(journal.updates.length, 1);
  const u = journal.updates[0];
  assert.strictEqual(u.table, 'shifts');
  assert.strictEqual(u.update.statut, 'clos_sans_pointage');
  assert.strictEqual(u.update.cloture_source, 'employe');
  assert.strictEqual(u.update.cloture_par, 'emp-9');
  assert.strictEqual(u.update.heure_fin, null, 'aucune heure de fin inventée');
  assert.ok(/Terminer mon service/.test(u.update.cloture_motif));
  assert.deepStrictEqual(u.filtres.map((f) => f[0]).sort(), ['id', 'statut']);
});

verifier('aucun service ouvert : rien n\'est écrit, la déconnexion reste permise', async () => {
  const { ctx, journal } = banc({ shifts: [] });
  avecCourant(ctx, { service: null });
  const r = await ctx.nexusTerminerMonService(EMPLOYE);
  assert.strictEqual(r.ok, true); assert.strictEqual(r.closes, 0);
  assert.strictEqual(journal.updates.length, 0);
});

verifier('lecture du service en erreur : pas d\'écriture, ok=false', async () => {
  const { ctx, journal } = banc({ shifts: [] });
  avecCourant(ctx, { erreur: true });
  assert.strictEqual((await ctx.nexusTerminerMonService(EMPLOYE)).ok, false);
  assert.strictEqual(journal.updates.length, 0);
});

verifier('écriture refusée par la base : ok=false', async () => {
  const { ctx } = banc({ shifts: [], erreurUpdate: { message: 'refus' } });
  avecCourant(ctx, { service: SERVICE });
  assert.strictEqual((await ctx.nexusTerminerMonService(EMPLOYE)).ok, false);
});

verifier('aucune ligne modifiée (déjà clos ailleurs) : ok=false, jamais un faux succès', async () => {
  const { ctx } = banc({ shifts: [], lignesModifiees: 0 });
  avecCourant(ctx, { service: SERVICE });
  const r = await ctx.nexusTerminerMonService(EMPLOYE);
  assert.ok(!(r.ok && r.closes === 1));
});

verifier('sans module de règles ou sans employé : ok=false, aucune écriture', async () => {
  const sans = banc({ shifts: [], avecRegles: false });
  avecCourant(sans.ctx, { service: SERVICE });
  assert.strictEqual((await sans.ctx.nexusTerminerMonService(EMPLOYE)).ok, false);
  assert.strictEqual(sans.journal.updates.length, 0);
  const { ctx } = banc({ shifts: [] });
  assert.strictEqual((await ctx.nexusTerminerMonService(null)).ok, false);
});

verifier('décision invalide ou règles indisponibles : ok=false, rien d\'écrit', async () => {
  const { ctx, journal } = banc({ shifts: [] });
  avecCourant(ctx, { service: SERVICE });
  const R = ctx.NexusPointageRegles;
  let appels = 0;
  ctx.nexusReglesPilote = () => (++appels === 1 ? R : Object.assign({}, R, { SOURCE_CLOTURE_PILOTE: { autre: 'x' } }));
  assert.strictEqual((await ctx.nexusTerminerMonService(EMPLOYE)).ok, false);
  assert.strictEqual(journal.updates.length, 0);
});

verifier('le catalogue porte la source et le motif, et nexus-auth.js n\'en recopie aucun', async () => {
  const { ctx } = banc({ shifts: [] });
  assert.strictEqual(ctx.NexusPointageRegles.SOURCE_CLOTURE_PILOTE.employe, 'employe');
  assert.ok(ctx.NexusPointageRegles.MOTIF_CLOTURE_PILOTE.fin_de_service);
  const corps = SOURCE.slice(SOURCE.indexOf('async function nexusTerminerMonService'));
  const fn = corps.slice(0, corps.indexOf('\n}\n'));
  assert.ok(!/'employe'|from\('shifts'\)/.test(fn));
});

verifier('l\'écran : bouton plein « Terminer mon service » sans pointage actif, « Pointer mon départ » sinon', async () => {
  assert.ok(/id="apTerminerService"[^>]*>Terminer mon service</.test(ACCUEIL));
  assert.ok(/id="apTerminerErreur" hidden/.test(ACCUEIL));
  assert.ok(ACCUEIL.includes('apBoutonDepart') && ACCUEIL.includes('Pointer mon départ'));
});

verifier('le geste ne déconnecte qu\'après un succès, sinon propose Réessayer / Se déconnecter quand même', async () => {
  const i = APP.indexOf("getElementById('apTerminerService')");
  assert.ok(i > 0);
  const bloc = APP.slice(i, i + 1500);
  assert.ok(/await nexusTerminerMonService\(employee\)/.test(bloc));
  assert.ok(/bilan\.ok\)\s*\{\s*nexusLogout\(\); return;/.test(bloc));
  assert.ok(bloc.indexOf('Réessayer') > bloc.indexOf('nexusLogout()'));
  assert.ok(/Se déconnecter quand même/.test(bloc));
  assert.ok(/dataset\.encours/.test(bloc), 'double clic gardé');
});

verifier('aucune nouvelle lecture directe de shifts hors des deux fichiers autorisés', async () => {
  assert.ok(!/from\('shifts'\)/.test(ACCUEIL));
});

const MUTATIONS = [
  ['source recopiée', SOURCE, (s) => s.replace('source: regles.SOURCE_CLOTURE_PILOTE.employe', "source: 'manager'")],
  ['motif non employé', SOURCE, (s) => s.replace('MOTIFS.fin_de_service', 'MOTIFS.manager')],
  ['clôturé par personne', SOURCE, (s) => s.replace('par:    employee.id,', 'par:    null,')],
  ['erreur de lecture ignorée', SOURCE, (s) => s.replace('if(!courant || courant.erreur) return { ok: false };', '')],
  ['refus ignoré', SOURCE, (s) => s.replace('(bilan.refuses && bilan.refuses.length)', 'false')],
  ['indisponible ignoré', SOURCE, (s) => s.replace('bilan.indisponible || bilan.invalide ||', '')],
  ['source non catalogue', REGLES, (s) => s.replace("employe:     'employe',", "employe:     'cycle_pilote',")],
  ['déconnexion sans succès', APP, (s) => s.replace('if (bilan && bilan.ok) { nexusLogout(); return; }', 'nexusLogout(); return;')],
  ['bouton remplacé', ACCUEIL, (s) => s.replace('id="apTerminerService"', 'id="apLogout"')],
];

const reglages = { SOURCE: (v) => { SOURCE = v; }, REGLES: (v) => { REGLES = v; }, ACCUEIL: (v) => { ACCUEIL = v; }, APP: (v) => { APP = v; } };
(async () => {
  for (const [nom, fn] of file) { await fn(); passes++; console.log('OK — ' + nom); }
  for (const [nom, src, mut] of MUTATIONS) {
    const m = mut(src); assert.notStrictEqual(m, src, 'mutation sans effet : ' + nom);
    const cle = src === SOURCE ? 'SOURCE' : src === REGLES ? 'REGLES' : src === ACCUEIL ? 'ACCUEIL' : 'APP';
    reglages[cle](m);
    let tuee = false;
    try { for (const [, fn] of file) await fn(); } catch (e) { tuee = true; }
    reglages[cle](src);
    assert.ok(tuee, 'mutation survivante : ' + nom);
  }
  console.log(`\nOK — ${passes} épreuves, ${MUTATIONS.length} mutations tuées\n`);
})().catch((e) => { console.error('\n✗ ' + (e.message || e) + '\n'); process.exit(1); });
