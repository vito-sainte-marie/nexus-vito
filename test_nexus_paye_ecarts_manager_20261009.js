'use strict';
// NEXUS PAYE — cockpit manager du cahier des charges du 09/10/2026.
//
// Épreuve des §5.4, §7 et §9 : la saisie d'un retard, la rubrique « Écarts
// Verify / Planning » et l'horaire exceptionnel. Trois exigences y sont
// vérifiées plutôt que trois écrans :
//
//   1. §7 — aucun retard n'est déduit d'un pointage ni d'un écart ; par
//      défaut il vaut 0, et seule une saisie du manager le fait exister.
//   2. §9 — les écarts se lisent à part des heures calculées, chaque
//      information nomme sa source, et leur traitement NE TOUCHE PAS aux
//      heures : ni quantité, ni montant, ni impact paie.
//   3. §5.4 — un horaire exceptionnel recalcule la durée nette, conserve
//      la valeur initiale, et ne modifie pas les paramètres de la station.
//
// L'écran est exécuté pour de vrai dans un `vm` contre le VRAI moteur :
// un rapport fabriqué à la main prouverait le rendu, pas la règle.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, 'NEXUS-Paye-v1.html'), 'utf8');
const script = html.match(/<body>[\s\S]*?<script>\n([\s\S]*?)\n<\/script><\/body>/);
assert.ok(script, 'script inline de l’écran PAYE introuvable');
const donnees = fs.readFileSync(path.join(__dirname, 'nexus-paye-donnees.js'), 'utf8');

let ok = 0;
function verifier(libelle, condition) {
  console.log(`${condition ? 'OK  ' : 'ÉCHEC'} — ${libelle}`);
  assert.ok(condition, libelle);
  ok++;
}
async function verifierAsync(libelle, fn) {
  let valeur = false;
  try { valeur = await fn(); } catch (e) { console.log(`ÉCHEC — ${libelle} (${e && e.message})`); throw e; }
  verifier(libelle, valeur);
}

// ── Un écran rendu pour de vrai ──────────────────────────────────────────
const rendu = {};
function element(id) {
  return {
    id, hidden: true, textContent: '', value: '', checked: false, disabled: false,
    dataset: {}, style: {}, classList: { toggle() {}, add() {}, remove() {} },
    set innerHTML(v) { rendu[id] = v; this._h = v; },
    get innerHTML() { return this._h || ''; },
    querySelector: () => element('sous'), querySelectorAll: () => [],
    appendChild() {}, focus() {}, scrollIntoView() {},
    addEventListener() {}, removeEventListener() {},
  };
}
const ctx = {
  console: { log() {}, warn() {}, error() {} },
  document: {
    getElementById: element, querySelector: () => element('q'), querySelectorAll: () => [],
    createElement: () => element('cree'), body: { appendChild() {} },
    addEventListener() {}, removeEventListener() {},
  },
  navigator: {}, nexusClient: {},
  nexusRequireAuth: () => ({ then: () => ({ catch: () => {} }) }),
};
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'nexus-paye-moteur.js'), 'utf8'), ctx);
vm.runInContext(donnees, ctx);
vm.runInContext(script[1], ctx);

// Recette : Camille tient la piste. Le planning prévoit 7 h le jeudi ; la
// durée de référence du jeudi est de 8 h. L'écart doit être nommé, et les
// 8 h retenues (§3 et §11, scénario 4).
const JOURS = ['2026-08-03', '2026-08-06'];
ctx.__donnees = {
  periode: '2026-08-01',
  employees: [{ id: 'e1', nom: 'Camille', role: 'pompiste', actif: true }],
  settings: [{ employee_id: 'e1', inclus_paye: true, mode_presence: 'automatique', confirme_le: '2026-01-02T08:00:00Z' }],
  planning: JOURS.map(date => ({ employee_id: 'e1', date, quart: 'quart1', statut: 'travail_normal', duree_heures: 7, tache: 'piste' })),
  pointages: JOURS.map(date => ({ employee_id: 'e1', date, type: 'arrivee', retard_min: 0 })),
  indisponibilites: [], audits: [], items: [], ecarts: [],
  config: { jours_feries: [] },
};
const amorce = `
  MOIS = '2026-08-01'; SITE = 'vito-sainte-marie';
  EMPLOYEE = { id: 'manager-1', role: 'manager' };
  RAPPORT = NexusPayeMoteur.construireRapport(__donnees);
  RAPPORT.periodeEnregistree = null;
  RAPPORT.planningOfficiel = { source: 'nexus', url: null };
`;
vm.runInContext(amorce + 'render();', ctx);
const lire = expr => vm.runInContext(expr, ctx);

// ── §3 et §11 : la durée de référence chiffre le jour, pas le planning ──
verifier('le jeudi est retenu à 8 h alors que le planning en prévoyait 7',
  lire('RAPPORT.employes[0].heuresConfirmees') === 15);
verifier('l’écart de concordance est produit, et il est unique',
  lire('RAPPORT.ecartsVerifyPlanning.length') === 1);
verifier('l’écart ne modifie aucune heure',
  lire('RAPPORT.ecartsVerifyPlanning[0].impactPaye') === false);
verifier('l’écart ne compte pas comme bloqueur du mois',
  lire('RAPPORT.bloqueurs.length') === 0);

// ── §9 : les écarts quittent le fourre-tout « informations » ─────────────
verifier('la rubrique des écarts est nommée dans l’écran',
  rendu.app.includes('Écarts Verify / Planning'));
verifier('le filtre « informations » exclut la rubrique des écarts',
  /i\.statut==='information'[^;]*\)\.filter\(i=>i\.rubrique!==NexusPayeMoteur\.RUBRIQUE_ECART\)/.test(script[1]));
verifier('l’écran lit le nom de la rubrique dans le moteur, il ne le recopie pas',
  !/'ecart_verify_planning'/.test(script[1]) && /NexusPayeMoteur\.RUBRIQUE_ECART/.test(script[1]));
verifier('l’écran lit les libellés de poste dans le moteur, il ne les recopie pas',
  /NexusPayeMoteur\.LIBELLE_POSTE\[/.test(script[1]) && !/caissier:'boutique'/.test(script[1]));
verifier('le moteur exporte bien ces deux structures',
  lire('typeof NexusPayeMoteur.RUBRIQUE_ECART') === 'string'
  && lire('typeof NexusPayeMoteur.LIBELLE_POSTE') === 'object');

// Les huit informations que le §9 exige sur chaque anomalie.
const carte = rendu.app.slice(rendu.app.indexOf('data-ecart='));
for (const [libelle, motif] of [
  ['le salarié', /class="review-name">Camille</],
  ['la date', /jeudi 6 août/],
  ['la fonction prévue et sa source', /Fonction prévue<\/span><b>piste<\/b><span[^>]*>source : Planning officiel/],
  ['la fonction constatée et sa source', /Fonction constatée<\/span><b>piste<\/b><span[^>]*>source : /],
  ['les heures retenues et leur source', /Heures retenues<\/span><b>8 h<\/b><span[^>]*>source : Durée de référence de la station/],
  ['les heures prévues au planning', /Heures au planning<\/span><b>7 h</],
  ['la différence constatée', /Différence constatée<\/span><b>\+1 h</],
  ['le statut de traitement', /· information · aucune heure modifiée/],
]) verifier(`l’écart nomme ${libelle}`, motif.test(carte));

verifier('aucune source ne s’affiche sous forme de clé technique brute',
  !/source : duree_reference|source : horaire_exceptionnel|source : undefined/.test(rendu.app));

// ── §9 : la ventilation des heures par origine ───────────────────────────
for (const t of ['Heures de caisse', 'Heures de piste', 'Heures de renfort', 'Dont corrections du manager', 'Écarts à examiner'])
  verifier(`la fiche salarié ventile « ${t} »`, rendu.app.includes(t));
verifier('les heures de piste valent le total, la caisse reste à zéro',
  /Heures de piste<\/span>[\s\S]{0,80}?15 h/.test(rendu.app) && /Heures de caisse<\/span>[\s\S]{0,80}?0 h/.test(rendu.app));
verifier('l’écart non traité est compté comme « à examiner », sans retirer d’heure',
  /Écarts à examiner<\/span>[\s\S]{0,60}?>1</.test(rendu.app));
// Les heures corrigées par le manager comptent une fois dans le total et se
// lisent aussi sous leur poste : la tuile doit dire « dont », sinon le
// manager additionnerait deux fois la même journée.
verifier('la tuile des corrections annonce qu’elle ne s’ajoute pas aux trois précédentes',
  /Dont corrections du manager/.test(rendu.app)
  && !/>Corrections du manager</.test(rendu.app));

// ── §5.4 et §9 : rien n’est proposé que l’écran ne puisse enregistrer ───
verifier('sans la migration, le formulaire d’horaire exceptionnel n’est pas proposé',
  !rendu.app.includes('id="addHoraire"'));
verifier('sans la migration, aucun bouton de marquage n’est proposé',
  !rendu.app.includes('ecart-marquer'));
verifier('sans la migration, l’écran dit pourquoi, au lieu de se taire',
  rendu.app.includes('attendent la migration du 09/10/2026'));

vm.runInContext('SAISIES_MANAGER = true; render();', ctx);
verifier('avec la migration, le formulaire d’horaire exceptionnel apparaît',
  rendu.app.includes('id="addHoraire"'));
verifier('avec la migration, les trois marquages apparaissent',
  ['data-statut="examine"', 'data-statut="corrige"', 'data-statut="justifie"'].every(m => rendu.app.includes(m)));
verifier('le formulaire ne demande aucune durée : seulement début, fin et pause',
  rendu.app.includes('id="hxDebut"') && rendu.app.includes('id="hxFin"') && rendu.app.includes('id="hxPause"')
  && !/id="hxHeures"|id="hxDuree"/.test(rendu.app));
verifier('les horaires proposés viennent des paramètres station, pas d’une constante de l’écran',
  /RAPPORT\.regles&&RAPPORT\.regles\.renfortDebut/.test(script[1]));
verifier('le formulaire rappelle que les paramètres standards ne changent pas',
  rendu.app.includes('Les paramètres standards de la station ne changent pas.'));

// ── §7 : le retard n’existe que si le manager le saisit ─────────────────
verifier('« retard » est un type de variable saisissable à la main',
  /TYPES_VARIABLE_MANUELLE=\[[^\]]*'retard'/.test(script[1]));
verifier('un retard sans minutes est refusé, et le message dit pourquoi',
  /typeItem==='retard'&&!\(Number\(min\)>0\)/.test(script[1])
  && /Par défaut il est de 0/.test(script[1]));
verifier('l’écran dit qu’aucun retard ne se déduit d’un pointage ni d’un écart',
  rendu.app.includes('Un retard n’est jamais déduit d’un pointage ni d’un écart avec le planning'));
verifier('le moteur ne déduit aucun retard d’un pointage',
  !/retard_min/.test(fs.readFileSync(path.join(__dirname, 'nexus-paye-moteur.js'), 'utf8')));
verifier('aucun retard n’est calculé sur ce mois, bien que des pointages existent',
  lire('NexusPayeMoteur.variablesComptables(RAPPORT.employes[0]).retards.minutes') === 0);

// ── La couche données : ce qui part en base, et rien de plus ─────────────
function clientFaux(options) {
  const o = options || {};
  const trace = { upserts: [], selects: [] };
  const client = {
    trace,
    from(table) {
      return {
        select(cols) {
          trace.selects.push({ table, cols });
          return { limit: () => Promise.resolve(o.erreurSonde ? { error: { message: o.erreurSonde } } : { data: [], error: null }) };
        },
        upsert(ligne, conf) {
          trace.upserts.push({ table, ligne, conf });
          return Promise.resolve(o.erreurEcriture ? { error: { message: o.erreurEcriture } } : { error: null });
        },
        update() { trace.upserts.push({ table, interdit: 'update' }); return { eq: () => Promise.resolve({ error: null }) }; },
      };
    },
  };
  return client;
}
const D = lire('NexusPayeDonnees');

(async () => {
  // La sonde.
  await verifierAsync('la sonde répond vrai quand la colonne detail existe',
    async () => (await D.sonderSaisiesManager(clientFaux())) === true);
  await verifierAsync('la sonde répond faux sur colonne inconnue, sans jeter',
    async () => (await D.sonderSaisiesManager(clientFaux({ erreurSonde: 'column nexus_paye_items.detail does not exist' }))) === false);
  await verifierAsync('la sonde interroge la colonne, pas la contrainte',
    async () => { const c = clientFaux(); await D.sonderSaisiesManager(c); return c.trace.selects.length === 1 && c.trace.selects[0].cols === 'detail'; });

  // Le marquage d'une anomalie.
  const ecart = lire('RAPPORT.ecartsVerifyPlanning[0]');
  const quantiteAvant = ecart.quantiteMinutes;
  await verifierAsync('le marquage n’écrit ni montant ni impact paie, et laisse la quantité inchangée',
    async () => {
      const c = clientFaux();
      await D.marquerTraitementAnomalie(c, { siteId: 's', employeeId: 'e1', periode: '2026-08-01', item: ecart, statut: 'justifie', justification: 'renfort convenu de vive voix', actorId: 'manager-1' });
      const l = c.trace.upserts[0].ligne;
      return c.trace.upserts.length === 1 && l.impact_paye === false
        && l.montant_centimes === undefined && l.quantite_minutes === quantiteAvant
        && l.statut === 'justifie' && l.note === 'renfort convenu de vive voix';
    });
  await verifierAsync('le marquage conserve la clé de source, donc se rattache à la même journée',
    async () => {
      const c = clientFaux();
      await D.marquerTraitementAnomalie(c, { siteId: 's', employeeId: 'e1', periode: '2026-08-01', item: ecart, statut: 'examine', actorId: 'manager-1' });
      return c.trace.upserts[0].ligne.source_cle === ecart.sourceCle
        && c.trace.upserts[0].conf.onConflict === 'site_id,periode,employee_id,source_cle';
    });
  for (const statut of ['valide', 'exclu', 'a_verifier', 'supprime'])
    await verifierAsync(`le marquage refuse le statut « ${statut} », qui n’est pas un traitement d’anomalie`,
      async () => {
        try { await D.marquerTraitementAnomalie(clientFaux(), { siteId: 's', employeeId: 'e1', periode: '2026-08-01', item: ecart, statut, actorId: 'm' }); return false; }
        catch (e) { return /Statut de traitement inconnu/.test(e.message); }
      });
  await verifierAsync('un marquage qui échoue en base remonte l’erreur, sans rien avaler',
    async () => {
      try { await D.marquerTraitementAnomalie(clientFaux({ erreurEcriture: 'réseau coupé' }), { siteId: 's', employeeId: 'e1', periode: '2026-08-01', item: ecart, statut: 'examine', actorId: 'm' }); return false; }
      catch (e) { return /réseau coupé/.test(e.message); }
    });

  // L'horaire exceptionnel.
  const base = { siteId: 's', employeeId: 'e1', periode: '2026-08-01', date: '2026-08-06', debut: '09:00', fin: '17:00', pauseMinutes: 60, motif: 'inventaire', heuresInitiales: 8, actorId: 'manager-1' };
  await verifierAsync('la durée nette est recalculée, jamais saisie : 9 h à 17 h moins 1 h font 7 h',
    async () => {
      const c = clientFaux();
      const nette = await D.enregistrerHoraireExceptionnel(c, base);
      const l = c.trace.upserts[0].ligne;
      return nette === 7 && l.quantite_minutes === 420 && l.type_item === 'horaire_exceptionnel';
    });
  await verifierAsync('la valeur initiale, le motif et l’auteur sont conservés dans le detail',
    async () => {
      const c = clientFaux();
      await D.enregistrerHoraireExceptionnel(c, base);
      const d = c.trace.upserts[0].ligne.detail;
      return d.heures_initiales === 8 && d.motif === 'inventaire' && d.auteur === 'manager-1'
        && d.debut === '09:00' && d.fin === '17:00' && d.pause_minutes === 60 && typeof d.saisi_le === 'string';
    });
  await verifierAsync('l’horaire exceptionnel n’a aucun impact paie : les heures passent par le calcul du jour',
    async () => {
      const c = clientFaux();
      await D.enregistrerHoraireExceptionnel(c, base);
      return c.trace.upserts[0].ligne.impact_paye === false && c.trace.upserts[0].ligne.statut === 'valide';
    });
  await verifierAsync('l’horaire exceptionnel ne touche à aucune table de paramètres',
    async () => {
      const c = clientFaux();
      await D.enregistrerHoraireExceptionnel(c, base);
      return c.trace.upserts.every(u => u.table === 'nexus_paye_items' && !u.interdit);
    });
  await verifierAsync('un horaire sans motif est refusé',
    async () => {
      try { await D.enregistrerHoraireExceptionnel(clientFaux(), Object.assign({}, base, { motif: '' })); return false; }
      catch (e) { return /motif/.test(e.message); }
    });
  // Une fin antérieure au début est lue comme un service de nuit : le moteur
  // enroule à 24 h, et c'est voulu pour les renforts qui passent minuit. On
  // mesure ce comportement tel qu'il est, sans le corriger ici : savoir si
  // un horaire exceptionnel de 15 h doit alerter le manager est un choix
  // métier, et il est déclaré comme point à arbitrer.
  await verifierAsync('un horaire qui passe minuit est compté comme un service de nuit, non comme une erreur',
    async () => {
      const c = clientFaux();
      const nette = await D.enregistrerHoraireExceptionnel(c, Object.assign({}, base, { debut: '17:00', fin: '09:00' }));
      return nette === 15 && c.trace.upserts[0].ligne.quantite_minutes === 900;
    });
  await verifierAsync('une pause plus longue que le service est refusée, et ne rend pas une durée négative',
    async () => {
      try { await D.enregistrerHoraireExceptionnel(clientFaux(), Object.assign({}, base, { pauseMinutes: 600 })); return false; }
      catch (e) { return /fin doit suivre/.test(e.message); }
    });

  // ── §10 : la saisie reste réservée au manager ──────────────────────────
  verifier('l’écran PAYE reste fermé aux rôles autres que manager et gérant',
    /\['manager','gerant'\]\.includes\(employee\.role\)/.test(script[1]));
  verifier('aucune boîte native du navigateur n’a été réintroduite',
    !/\b(prompt|alert|confirm)\s*\(/.test(html));

  console.log(`\nNEXUS PAYE — cockpit manager du 09/10/2026 : ${ok}/${ok} vérifications passent.`);
})().catch(e => { console.error(e); process.exit(1); });
