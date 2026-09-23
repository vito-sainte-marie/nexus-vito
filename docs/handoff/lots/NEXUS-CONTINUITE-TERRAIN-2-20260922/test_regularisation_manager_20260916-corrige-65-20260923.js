/*
 * Le manager régularise plusieurs services obsolètes en une action.
 * ============================================================================
 * L'EXIGENCE, 16/09/2026, mot pour mot : « le manager peut régulariser
 * plusieurs services obsolètes en une action ». Elle accompagne cinq autres
 * règles du pilote, et une interdiction : ne pas inventer d'heure de fin.
 *
 * CE QUI DISTINGUE CETTE ÉPREUVE DE `test_cloture_services_obsoletes`. Celle-là
 * éprouve la clôture que NEXUS décide SEUL, au retour dans l'application, sur
 * le service de l'employé connecté. Celle-ci éprouve la clôture qu'un HUMAIN
 * décide, sur les services des AUTRES. Les deux passent par la même écriture —
 * c'est délibéré, et vérifié ici — mais elles ne se ressemblent que là :
 *
 *   ce que NEXUS décide seul   → cloture_source = 'cycle_pilote', cloture_par NULL
 *   ce qu'un manager décide    → cloture_source = 'manager',      cloture_par = lui
 *
 * Cette distinction n'est pas décorative. Elle est ce que le pilote mesure :
 * combien de services l'équipe ferme elle-même, combien NEXUS ferme à sa
 * place, combien un manager a dû reprendre à la main. Un journal qui les
 * confondrait ne mesurerait plus rien.
 *
 * Comme l'autre épreuve, celle-ci EXÉCUTE : le module est chargé dans un
 * contexte isolé avec un faux client qui note chaque requête. Ce sont les
 * écritures réellement émises qui sont examinées, jamais leur ressemblance.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const SOURCE  = fs.readFileSync(path.join(__dirname, 'nexus-auth.js'), 'utf8');
const REGLES  = fs.readFileSync(path.join(__dirname, 'nexus-pointage-regles.js'), 'utf8');
const COCKPIT = fs.readFileSync(path.join(__dirname, 'NEXUS-Cockpit-v2.html'), 'utf8');

// File d'attente, puis `await` : une assertion posée après une écriture
// asynchrone non attendue passe au vert avant que l'écriture n'ait lieu.
let passes = 0;
const file = [];
function verifier(nom, fn) { file.push([nom, fn]); }
function titre(t) { file.push([t, null]); }

// ── Le banc d'essai ────────────────────────────────────────────────────────
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
    window: { location: { pathname: '/NEXUS-Cockpit-v2.html', search: '', href: '' },
              NEXUS_CONFIG: { environnement: 'test', supabaseUrl: 'https://test.supabase.co', supabaseCle: 'anon-test' } },
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
  if (avecRegles) vm.runInContext(REGLES, ctx);
  vm.runInContext(SOURCE, ctx);
  return { ctx, journal };
}

const MANAGER  = { id: 'mgr-1', role: 'manager', site_id: 'vito-sainte-marie', nom: 'Fred' };
const GERANT   = { id: 'ger-1', role: 'gerant',  site_id: 'vito-sainte-marie', nom: 'Angélique' };
const CAISSIER = { id: 'emp-9', role: 'caissier', site_id: 'vito-sainte-marie', nom: 'Loane' };

const HIER = new Date(Date.now() - 36 * 3600 * 1000).toISOString();
const ouvert = (o) => Object.assign({
  id: 'sh-1', employee_id: 'emp-9', quart: 'matin', role: 'caissier',
  site_id: 'vito-sainte-marie', statut: 'en_cours', heure_debut: HIER,
  employees: { nom: 'Loane' },
}, o);

// Trois services obsolètes, tels que `servicesObsoletes` les rend.
const TROIS = [
  { service: { id: 'sh-fred' },     motif: 'jour_precedent' },
  { service: { id: 'sh-angelique' }, motif: 'jour_precedent' },
  { service: { id: 'sh-loane' },    motif: 'quart_termine'  },
];

titre('── 1 · La source de clôture est un catalogue, pas une chaîne recopiée ──');
verifier('les deux sources vivent dans le module de règles', async () => {
  const { ctx } = banc({ shifts: [] });
  const S = ctx.NexusPointageRegles.SOURCE_CLOTURE_PILOTE;
  assert.strictEqual(S.automatique, 'cycle_pilote');
  assert.strictEqual(S.manager, 'manager');
  // Les deux valeurs doivent être connues de `shifts_cloture_source_check` ;
  // la migration P-3 a ajouté `cycle_pilote`, `manager` y était déjà.
  assert.ok(fs.existsSync(path.join(__dirname, 'supabase/migrations/20260916195000_cloture_source_cycle_pilote.sql')),
    'la migration qui autorise cycle_pilote doit exister dans le dépôt');
});

verifier('nexus-auth.js ne recopie aucune de ces deux valeurs', async () => {
  const code = SOURCE.split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  assert.ok(!/'cycle_pilote'/.test(code),
    'la source automatique doit être lue dans le catalogue, jamais écrite ici');
  // 'manager' apparaît dans nexus-auth.js comme RÔLE (nexusEstManager) — ce
  // qui est légitime. Ce qui ne le serait pas : l'écrire dans un `update`.
  const ecriture = code.slice(code.indexOf("async function nexusAppliquerCloturePilote"));
  assert.ok(!/cloture_source:\s*'/.test(ecriture),
    'cloture_source doit venir de la décision reçue, jamais d’un littéral');
});

titre('── 2 · La lecture d’équipe : bornée au site, sans garde de rôle ──');
verifier('elle lit les services en_cours du site, et nomme sa contrainte de jointure', async () => {
  const { ctx, journal } = banc({ shifts: [ouvert()] });
  const r = await ctx.nexusServicesOuvertsDuSite(MANAGER);
  assert.strictEqual(journal.selects.length, 1);
  const req = journal.selects[0];
  assert.strictEqual(req.table, 'shifts');
  assert.deepStrictEqual(req.filtres, [['site_id', 'vito-sainte-marie'], ['statut', 'en_cours']]);
  // `shifts` référence `employees` DEUX fois (employee_id, cloture_par) :
  // sans nommer la contrainte, PostgREST refuse la relation comme ambiguë.
  assert.ok(/employees!shifts_employee_id_fkey\(nom\)/.test(req.select),
    'la jointure doit nommer shifts_employee_id_fkey');
  assert.strictEqual(r.services[0].nom, 'Loane', 'le nom est remonté à plat pour l’écran');
});

verifier('un employé qui appelle cette lecture n’est pas refusé par le code', async () => {
  // Volontaire. La barrière est `select_shifts`, qui rend à un employé ses
  // seuls services. Redoubler la RLS ici créerait une seconde règle d'accès,
  // qui divergerait — c'est exactement la faute du 14/09 (sept copies).
  const { ctx, journal } = banc({ shifts: [] });
  const r = await ctx.nexusServicesOuvertsDuSite(CAISSIER);
  assert.strictEqual(journal.selects.length, 1, 'la requête part : c’est la base qui borne');
  assert.strictEqual(r.erreur, undefined);
});

verifier('un site indéterminé ne se remplace pas par un site par défaut', async () => {
  const { ctx, journal } = banc({ shifts: [] });
  const r = await ctx.nexusServicesOuvertsDuSite({ id: 'x', role: 'manager' });
  assert.strictEqual(r.erreur, true);
  assert.strictEqual(journal.selects.length, 0, 'aucune requête sans site');
  assert.ok(journal.erreurs.some(e => /site/.test(e)));
});

verifier('une liste au plafond est annoncée comme peut-être tronquée', async () => {
  const plein = Array.from({ length: 200 }, (_, i) => ouvert({ id: 'sh-' + i }));
  const { ctx, journal } = banc({ shifts: plein });
  await ctx.nexusServicesOuvertsDuSite(MANAGER);
  assert.strictEqual(journal.selects[0].limite, 200);
  assert.ok(journal.alertes.some(a => /tronqu/.test(a)),
    'un plafond atteint est un résultat tronqué, pas un résultat');
});

verifier('une erreur de lecture ne rend pas une liste vide silencieuse', async () => {
  const { ctx, journal } = banc({ shifts: null, erreurSelect: { message: 'boom' } });
  const r = await ctx.nexusServicesOuvertsDuSite(MANAGER);
  assert.strictEqual(r.erreur, true, 'sinon l’écran conclurait « aucun service ouvert »');
  // `deepStrictEqual` compare aussi les prototypes : un tableau construit
  // dans le contexte `vm` n'est pas `Array` du realm de ce fichier.
  assert.strictEqual(r.services.length, 0, 'aucun service rendu quand la lecture a échoué');
  assert.ok(journal.erreurs.some(e => /impossible/.test(e)));
});

titre('── 3 · Une action, plusieurs services ──');
verifier('trois services obsolètes sont refermés par un seul appel', async () => {
  const { ctx, journal } = banc({ shifts: [] });
  const bilan = await ctx.nexusRegulariserServicesObsoletes(MANAGER, TROIS);
  assert.strictEqual(bilan.closes, 3, 'c’est l’exigence du 16/09 : une action, plusieurs services');
  assert.strictEqual(bilan.tentees, 3);
  assert.strictEqual(bilan.refuses.length, 0);
  assert.strictEqual(journal.updates.length, 3);
  assert.deepStrictEqual(journal.updates.map(u => u.filtres[0][1]),
    ['sh-fred', 'sh-angelique', 'sh-loane']);
});

verifier('aucune heure de fin n’est inventée, pour aucun des trois', async () => {
  const { ctx, journal } = banc({ shifts: [] });
  await ctx.nexusRegulariserServicesObsoletes(MANAGER, TROIS);
  for (const u of journal.updates) {
    assert.strictEqual(u.update.statut, 'clos_sans_pointage');
    assert.ok('heure_fin' in u.update, 'écrite explicitement, pas omise');
    assert.strictEqual(u.update.heure_fin, null, 'NULL est la forme de « nous ne savons pas »');
  }
});

verifier('le journal nomme le manager qui a tranché', async () => {
  const { ctx, journal } = banc({ shifts: [] });
  await ctx.nexusRegulariserServicesObsoletes(MANAGER, TROIS);
  for (const u of journal.updates) {
    assert.strictEqual(u.update.cloture_source, 'manager');
    assert.strictEqual(u.update.cloture_par, 'mgr-1');
    assert.ok(u.update.cloture_le && !Number.isNaN(Date.parse(u.update.cloture_le)));
  }
});

verifier('le motif dit « régularisation par le manager », même pour un quart terminé', async () => {
  // Le critère qui a RENDU le service obsolète n'est pas ce qui l'a refermé.
  // `sh-loane` est obsolète parce que son quart est fini ; il est refermé
  // parce qu'un humain l'a décidé. Le journal doit dire le second.
  const { ctx, journal } = banc({ shifts: [] });
  await ctx.nexusRegulariserServicesObsoletes(MANAGER, TROIS);
  const attendu = ctx.NexusPointageRegles.MOTIF_CLOTURE_PILOTE.manager;
  assert.ok(/régularisation par le manager/.test(attendu));
  for (const u of journal.updates) assert.strictEqual(u.update.cloture_motif, attendu);
});

verifier('chaque écriture reste bornée à son service ET au statut en_cours', async () => {
  const { ctx, journal } = banc({ shifts: [] });
  await ctx.nexusRegulariserServicesObsoletes(MANAGER, TROIS);
  for (const u of journal.updates) {
    assert.strictEqual(u.filtres.length, 2);
    assert.strictEqual(u.filtres[0][0], 'id');
    assert.deepStrictEqual(u.filtres[1], ['statut', 'en_cours'],
      'sans lui, deux managers réécriraient une clôture déjà posée');
  }
});

verifier('un service refusé n’arrête pas les autres, et il est nommé', async () => {
  // Le deuxième UPDATE ne modifie aucune ligne : un autre écran vient de le
  // refermer, ou la RLS l'a refusé. Les deux autres doivent aboutir.
  const { ctx, journal } = banc({ shifts: [], lignesModifiees: n => (n === 2 ? 0 : 1) });
  const bilan = await ctx.nexusRegulariserServicesObsoletes(MANAGER, TROIS);
  assert.strictEqual(journal.updates.length, 3, 'la boucle ne s’interrompt pas');
  assert.strictEqual(bilan.closes, 2);
  assert.deepStrictEqual([...bilan.refuses], ['sh-angelique'],
    'le service resté ouvert doit être nommé, pas seulement compté');
});

verifier('un gérant régularise aussi', async () => {
  const { ctx, journal } = banc({ shifts: [] });
  const bilan = await ctx.nexusRegulariserServicesObsoletes(GERANT, TROIS);
  assert.strictEqual(bilan.closes, 3);
  assert.strictEqual(journal.updates[0].update.cloture_par, 'ger-1');
});

titre('── 4 · Ce qu’un non-manager ne peut pas faire écrire ──');
verifier('un caissier ne régularise pas — et rien n’est tenté', async () => {
  const { ctx, journal } = banc({ shifts: [] });
  const bilan = await ctx.nexusRegulariserServicesObsoletes(CAISSIER, TROIS);
  assert.strictEqual(bilan.refuse, true);
  assert.strictEqual(bilan.closes, 0);
  assert.strictEqual(journal.updates.length, 0,
    'la RLS refuserait aussi — mais cloture_par nommerait déjà un non-manager');
  assert.ok(journal.erreurs.some(e => /manager|gérant/.test(e)));
});

verifier('nexusEstManager est LA réponse, et elle n’est écrite qu’une fois', async () => {
  const { ctx } = banc({ shifts: [] });
  assert.strictEqual(ctx.nexusEstManager(MANAGER), true);
  assert.strictEqual(ctx.nexusEstManager(GERANT), true);
  assert.strictEqual(ctx.nexusEstManager(CAISSIER), false);
  assert.strictEqual(ctx.nexusEstManager(null), false);
  assert.strictEqual(ctx.nexusEstManager({}), false);
  const code = SOURCE.split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  const copies = (code.match(/role\s*===\s*'manager'/g) || []).length;
  assert.strictEqual(copies, 1,
    'la règle de rôle ne doit exister qu’à un seul endroit de ce fichier');
});

titre('── 5 · Une décision de clôture invalide est refusée AVANT la première écriture ──');
verifier('une source inconnue ne part pas jusqu’à la base', async () => {
  const { ctx, journal } = banc({ shifts: [] });
  const bilan = await ctx.nexusAppliquerCloturePilote(TROIS, {
    source: 'inventée', par: 'mgr-1', motifPour: (o, M) => M.manager,
  });
  assert.strictEqual(bilan.invalide, true);
  assert.strictEqual(journal.updates.length, 0,
    'shifts_cloture_source_check refuserait — mais après le clic, service par service');
  assert.ok(journal.erreurs.some(e => /invalide/.test(e)));
});

verifier('sans le module de règles, aucune régularisation n’est improvisée', async () => {
  const { ctx, journal } = banc({ shifts: [], avecRegles: false });
  const bilan = await ctx.nexusRegulariserServicesObsoletes(MANAGER, TROIS);
  assert.strictEqual(bilan.indisponible, true);
  assert.strictEqual(journal.updates.length, 0);
  assert.ok(journal.erreurs.some(e => /nexus-pointage-regles\.js/.test(e)));
});

verifier('un service sans identifiant est ignoré, jamais compté comme fermé', async () => {
  const { ctx, journal } = banc({ shifts: [] });
  const bilan = await ctx.nexusRegulariserServicesObsoletes(MANAGER,
    [{ service: null, motif: 'manager' }, TROIS[0]]);
  assert.strictEqual(journal.updates.length, 1);
  assert.strictEqual(bilan.closes, 1);
  assert.strictEqual(bilan.tentees, 2, 'le bilan dit ce qui a été demandé, pas ce qui a marché');
});

verifier('les deux chemins de clôture passent par la MÊME écriture', async () => {
  // Une seule requête UPDATE sur `shifts` dans tout le fichier. Deux
  // écritures parallèles divergeraient : l'une garderait `heure_fin = null`,
  // l'autre finirait par « rendre service » et poser un `now()`.
  const code = SOURCE.split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  const updates = code.split("from('shifts')").slice(1)
    .map(a => a.slice(0, 600)).filter(a => /\.update\(/.test(a));
  assert.strictEqual(updates.length, 1, 'une seule écriture sur shifts dans nexus-auth.js');
  for (const f of ['nexusCloturerServicesObsoletes', 'nexusRegulariserServicesObsoletes']) {
    const corps = code.slice(code.indexOf('async function ' + f));
    assert.ok(/nexusAppliquerCloturePilote\(/.test(corps.slice(0, corps.indexOf('\n}'))),
      f + ' doit déléguer l’écriture, pas la refaire');
  }
});

titre('── 6 · L’écran qui porte l’action ──');
verifier('le Cockpit charge nexus-station.js — sans quoi le critère « quart terminé » ne s’applique jamais', async () => {
  assert.ok(/src="nexus-station\.js\?v=/.test(COCKPIT),
    'le Cockpit est le seul écran qui peut voir un quart du matin fini le jour même');
  assert.ok(/src="nexus-pointage-regles\.js\?v=/.test(COCKPIT));
  // Une seule chaîne de version dans tout le dépôt.
  const versions = new Set((COCKPIT.match(/\?v=[0-9-]+/g) || []));
  assert.strictEqual(versions.size, 1, 'une seule chaîne de version : ' + [...versions].join(', '));
});

verifier('le seuil de bascule est résolu, jamais approximé', async () => {
  assert.ok(/NexusStation\.seuilDeBascule\(/.test(COCKPIT));
  assert.ok(/NexusStation\.fuseauDeLaStation\(/.test(COCKPIT),
    'le seuil exige le fuseau du commerce — il n’a pas de valeur par défaut');
  // Le seuil n'est posé dans le contexte QUE s'il est un nombre. Un seuil
  // approximatif fermerait des services encore en cours.
  assert.ok(/Number\.isFinite\(seuil\.minutes\)\s*\)\s*ctx\.seuilBascule/.test(COCKPIT),
    'seuilBascule ne doit être posé que sur un nombre');
});

verifier('l’écran n’écrit rien lui-même et ne recopie aucun motif', async () => {
  const script = COCKPIT.slice(COCKPIT.lastIndexOf('<script>'));
  assert.ok(!/from\('shifts'\)/.test(script),
    'toute écriture sur shifts passe par nexus-auth.js');
  assert.ok(!/Fin non enregistrée —/.test(COCKPIT),
    'le libellé du motif n’existe qu’à un seul endroit du dépôt');
  assert.ok(/nexusRegulariserServicesObsoletes\(/.test(script));
  assert.ok(/NexusPointageRegles\.servicesObsoletes\(/.test(script),
    'la décision de ce qui est obsolète appartient au module de règles');
});

verifier('la section est réservée au manager et n’affiche aucune durée', async () => {
  const script = COCKPIT.slice(COCKPIT.lastIndexOf('<script>'));
  const rendu = script.slice(script.indexOf('function renderServicesOuverts'));
  const corps = rendu.slice(0, rendu.indexOf('\n    }\n'));
  assert.ok(/nexusEstManager\(employee\)/.test(corps), 'garde d’affichage absente');
  assert.ok(/fin non enregistrée/.test(corps), 'le fait doit être écrit, pas déduit');
  assert.ok(!/dureeServiceMs|heure_fin/.test(corps),
    'aucune durée ni heure de fin ne doit apparaître : NEXUS ne les connaît pas');
});

(async () => {
  for (const [nom, fn] of file) {
    if (fn === null) { console.log('\n' + nom); continue; }
    await fn();
    passes++;
    console.log('OK — ' + nom);
  }
  console.log(`\n${passes} vérifications passées — le manager régularise, et NEXUS écrit qui a décidé.\n`);
})().catch(e => { console.error('\n✗ ' + (e.message || e) + '\n'); process.exit(1); });
