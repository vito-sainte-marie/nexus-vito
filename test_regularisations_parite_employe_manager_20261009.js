// Épreuve — 09/10/2026, complément G3 (Frédéric) : « Un employé doit voir les
// mêmes montants que son manager pour ses propres écarts. Il ne doit exister
// ni formule différente, ni calcul parallèle, ni décalage inexpliqué entre les
// deux interfaces. »
//
// L'employé ne va jamais dans Verify : il lit « Mes régularisations » dans
// NEXUS-Progression-v1.html, alimenté par `mes_regularisations()`. Le manager
// lit Analyse des écarts filtrée sur l'employé. Ici, sur les mêmes lignes
// sources fictives :
//   - côté manager : lignes brutes → normaliseurs → filtre employé → synthèse ;
//   - côté employé : la fonction `chargerMesRegularisations` EXTRAITE de la
//     page, exécutée avec les modules que la page charge réellement, sur la
//     projection que rend `mes_regularisations()` (contrat SQL ; la fonction
//     SQL elle-même est éprouvée par outils/epreuve-mes-regularisations-20261009).
// Seule différence admise : l'écart non clôturé (« en attente ») n'est pas
// montré à l'employé (arbitrage du 16/09), et les noms des tiers et managers
// sont des sentinelles. Chaque montant affiché doit être identique.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const DIR = __dirname;
const lire = f => fs.readFileSync(path.join(DIR, f), 'utf8');
const MODULES = {
  'nexus-ecarts-moteur.js': lire('nexus-ecarts-moteur.js'),
  'nexus-ecarts-donnees.js': lire('nexus-ecarts-donnees.js'),
  'nexus-paye-regularisations.js': lire('nexus-paye-regularisations.js'),
};
const PAGE = lire('NEXUS-Progression-v1.html');

let n = 0;
function ok(label) { n++; console.log('OK —', label); }

function bac(sources) {
  const sandbox = { console: { log() {}, error() {}, warn() {} }, Intl, Date, Math, Number, String, Object, Array, Promise, Error, TypeError, Set, Map, JSON, RegExp };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  for (const [nom, src] of Object.entries(sources)) vm.runInContext(src, sandbox, { filename: nom });
  return sandbox;
}

const FUSEAU = 'America/Martinique';
const X = 'e-x', Y = 'e-y';
const NOMS = { [X]: 'Alpha Fictif', [Y]: 'Bravo Fictif', 'e-z': 'Zoulou Fictif' };
const ROLES = { [X]: 'employe', [Y]: 'employe', 'e-z': 'employe' };

// ---------------------------------------------------------------------------
// Lignes sources fictives, telles que le manager les lit.
// ---------------------------------------------------------------------------
const AUDITS = [
  // Septembre : écart de X, versé en partie en octobre.
  { id: 'a0', date: '2026-09-28', quart: '1', ecart_boutique: -25, valide_le_boutique: '2026-09-28T21:00:00Z', employes_boutique: [X] },
  // Lundi : −50 de X (piste) ; boutique tenue à deux = collectif, imputé à personne.
  { id: 'a1', date: '2026-10-05', quart: '1', ecart_piste: -50, valide_le_piste: '2026-10-05T21:00:00Z', employes_piste: [X],
    ecart_boutique: 10, valide_le_boutique: '2026-10-05T21:00:00Z', employes_boutique: [X, Y] },
  // Mardi : écart de X non clôturé — le manager le voit en attente, l'employé non.
  { id: 'a2', date: '2026-10-06', quart: '2', ecart_piste: -15, employes_piste: [X] },
  // Mercredi : écart de Y.
  { id: 'a3', date: '2026-10-07', quart: '1', ecart_piste: -7, valide_le_piste: '2026-10-07T21:00:00Z', employes_piste: [Y] },
];
const FDJ = [
  { date: '2026-10-07', quart: '2', employee_id: X,
    fdj_cash_controls: { id: 'c1', ecart: -12, resultat_controle: 'valide', motif_ecart: null, valide_le: '2026-10-07T22:00:00Z', valide_par: 'mgr-uuid' } },
  { date: '2026-10-07', quart: '2', employee_id: Y,
    fdj_cash_controls: { id: 'c2', ecart: -9, resultat_controle: 'valide', motif_ecart: null, valide_le: '2026-10-07T22:00:00Z', valide_par: 'mgr-uuid' } },
];
const V = (o) => Object.assign({ mode_encaissement: 'especes', auteur_id: 'mgr-uuid', annule_le: null, annule_par: null, motif_annulation: null }, o);
const OPERATIONS = {
  versements: [
    V({ id: 'v4', module_origine: 'verify', audit_id: 'a0', caisse_origine: 'boutique', employee_id: X, montant: 10, destination: 'tiroir_verify_boutique', encaisse_le: '2026-10-02T14:00:00Z' }),
    V({ id: 'v1', module_origine: 'verify', audit_id: 'a1', caisse_origine: 'piste', employee_id: X, montant: 30, destination: 'tiroir_verify_piste', encaisse_le: '2026-10-08T15:00:00Z' }),
    V({ id: 'v2', module_origine: 'fdj', fdj_cash_control_id: 'c1', employee_id: 'e-z', montant: 5, mode_encaissement: 'carte_bancaire', destination: 'tiroir_fdj', encaisse_le: '2026-10-09T14:00:00Z' }),
    V({ id: 'v5', module_origine: 'fdj', fdj_cash_control_id: 'c1', employee_id: X, montant: 10, destination: 'coffre', encaisse_le: '2026-10-10T14:00:00Z' }),
    V({ id: 'v3', module_origine: 'verify', audit_id: 'a3', caisse_origine: 'piste', employee_id: Y, montant: 7, destination: 'tiroir_verify_piste', encaisse_le: '2026-10-08T16:00:00Z' }),
  ],
  restitutions: [
    { id: 'r1', module_origine: 'fdj', fdj_cash_control_id: 'c1', employee_id: X, montant: 3, mode_restitution: 'especes', source: 'tiroir_fdj',
      restitue_le: '2026-10-12T14:00:00Z', valide_par: 'mgr-uuid', annule_le: null, annule_par: null, motif_annulation: null },
  ],
};

// ---------------------------------------------------------------------------
// Ce que rend `mes_regularisations()` à X pour ces lignes (contrat de
// 20261009120000) : postes dont X est seul détenteur ET contrôlés, quarts FDJ
// à verdict, opérations rattachées ; sentinelles 'manager' et 'tiers'.
// ---------------------------------------------------------------------------
const sentinelle = op => Object.assign({}, op, {
  employee_id: op.employee_id === X ? X : 'tiers',
  auteur_id: op.auteur_id ? 'manager' : null,
  valide_par: op.valide_par ? 'manager' : undefined,
  annule_par: op.annule_par ? 'manager' : null,
});
const PROJECTION = {
  audits: [
    { id: 'a0', date: '2026-09-28', quart: '1', ecart_boutique: -25, ecart_boutique_valide: null, ecart_boutique_origine: null,
      valide_le_boutique: '2026-09-28T21:00:00Z', cause_code_boutique: null, employes_boutique: [X] },
    { id: 'a1', date: '2026-10-05', quart: '1', ecart_piste: -50, ecart_piste_valide: null, ecart_piste_origine: null,
      valide_le_piste: '2026-10-05T21:00:00Z', cause_code_piste: null, employes_piste: [X] },
  ],
  fdj: [
    { date: '2026-10-07', quart: '2', employee_id: X,
      fdj_cash_controls: { id: 'c1', ecart: -12, ecart_origine: null, resultat_controle: 'controle', motif_ecart: null, valide_le: '2026-10-07T22:00:00Z' } },
  ],
  versements: OPERATIONS.versements.filter(v => ['v4', 'v1', 'v2', 'v5'].includes(v.id)).map(sentinelle),
  restitutions: OPERATIONS.restitutions.map(sentinelle),
};

// ---------------------------------------------------------------------------
// Côté manager : le pipeline d'Analyse des écarts, filtré sur X.
// ---------------------------------------------------------------------------
const M = bac(MODULES);
const R = M.NexusPayeRegularisations, D = M.NexusEcartsDonnees;
const TOUTES = [...D.normaliserAuditsVerify(AUDITS, NOMS, ROLES), ...D.normaliserControlesFdj(FDJ, NOMS, ROLES)];
const UNIVERS_X = D.appliquerFiltresEcarts(TOUTES, { employeeId: X });
const OPS_X = R.operationsDeLUnivers(UNIVERS_X, OPERATIONS);
function htmlManager(du, au) {
  return R.renderSynthese(R.syntheseRegularisationsPeriode(UNIVERS_X, OPS_X, { fuseau: FUSEAU, dateDebut: du, dateFin: au }),
    { nomEmploye: id => NOMS[id] || null });
}

// ---------------------------------------------------------------------------
// Côté employé : la fonction de la page, exécutée telle qu'écrite.
// ---------------------------------------------------------------------------
function scriptsDeLaPage(html) {
  return [...html.matchAll(/<script src="([^"?]+)\?v=[^"]*"><\/script>/g)].map(m => m[1]);
}
function fonctionDeLaPage(html) {
  const debut = html.indexOf('  async function chargerMesRegularisations(moi) {');
  const fin = html.indexOf('\n  nexusRequireAuth().then(', debut);
  assert.ok(debut !== -1 && fin !== -1, 'chargerMesRegularisations introuvable dans la page');
  return html.slice(debut, fin);
}
function element() {
  const e = { innerHTML: '', value: '', ecouteurs: {} };
  e.addEventListener = (t, f) => { e.ecouteurs[t] = f; };
  return e;
}
async function ecranEmploye(html, periodes) {
  const charges = scriptsDeLaPage(html);
  const sources = {};
  for (const f of ['nexus-ecarts-moteur.js', 'nexus-ecarts-donnees.js', 'nexus-paye-regularisations.js']) {
    if (charges.includes(f)) sources[f] = MODULES[f];
  }
  const S = bac(sources);
  if (charges.includes('nexus-station.js')) S.NexusStation = { fuseauDeLaStation: async () => ({ timezone: FUSEAU }) };
  S.nexusClient = { rpc: async nom => nom === 'mes_regularisations' ? { data: JSON.parse(JSON.stringify(PROJECTION)), error: null } : { data: null, error: new Error('rpc inconnue ' + nom) } };
  const els = { mesRegularisations: element(), regulDu: element(), regulAu: element() };
  S.document = { getElementById: id => els[id] || null };
  vm.runInContext(fonctionDeLaPage(html) + '\nthis.__charger = chargerMesRegularisations;', S);
  await S.__charger({ id: X, nom: NOMS[X], site_id: 'site-fictif' });
  const rendus = {};
  for (const [nom, [du, au]] of Object.entries(periodes)) {
    els.regulDu.value = du; els.regulAu.value = au;
    if (els.regulAu.ecouteurs.change) els.regulAu.ecouteurs.change();
    rendus[nom] = els.mesRegularisations.innerHTML;
  }
  return { rendus, els };
}

function mesures(html) {
  const out = {};
  for (const m of html.matchAll(/data-mesure="([^"]+)">(?:<div class="edg-label">[^<]*<\/div><div class="edg-valeur[^"]*">)?([^<]*)/g)) out[m[1]] = m[2].trim();
  return out;
}

const PERIODES = {
  lundi: ['2026-10-05', '2026-10-05'],
  jeudi: ['2026-10-08', '2026-10-08'],
  semaine: ['2026-10-05', '2026-10-11'],
  octobre: ['2026-10-01', '2026-10-31'],
};

async function verifier(html, journal) {
  const etape = l => { if (journal) ok(l); };
  const { rendus } = await ecranEmploye(html, PERIODES);
  for (const [nom, [du, au]] of Object.entries(PERIODES)) {
    const e = mesures(rendus[nom]), m = mesures(htmlManager(du, au));
    assert.ok(Object.keys(e).length >= 3, `${nom} : l'écran employé n'affiche aucune mesure (${rendus[nom].slice(0, 120)})`);
    const memes = Object.keys(m).filter(k => k !== 'en-attente');
    assert.deepStrictEqual(Object.keys(e).sort(), memes.sort(), `${nom} : mêmes rubriques des deux côtés`);
    for (const k of memes) assert.strictEqual(e[k], m[k], `${nom} : « ${k} » employé ${e[k]} ≠ manager ${m[k]}`);
  }
  etape('lundi, jeudi, semaine, octobre : chaque montant affiché à l’employé est celui du manager');

  const s = PERIODES;
  const em = k => mesures(rendus[k]);
  assert.strictEqual(em('lundi')['ecarts-manques'], '−50,00 €');
  assert.strictEqual(em('lundi')['regularisations'], '0,00 €');
  assert.strictEqual(em('jeudi')['ecarts-manques'], '0,00 €', 'aucun écart artificiel le jeudi');
  assert.strictEqual(em('jeudi')['regularisations'], '+30,00 €');
  etape('scénario de référence côté employé : lundi −50 / 0, jeudi 0 / +30');

  // Ligne du lundi : −50 initial intact, 30 versés, −20 restant (relevé commun).
  const ecartsEmp = R.ecartsDeLaProjection(PROJECTION, { id: X, nom: NOMS[X] });
  const l = R.construireReleve(ecartsEmp, R.operationsDeLUnivers(ecartsEmp, PROJECTION), { fuseau: FUSEAU }).lignes.find(x => x.date === '2026-10-05');
  assert.strictEqual(l.ecartCorrigeCentimes, -5000, "écart retenu intact");
  assert.strictEqual(l.verseCentimes, 3000);
  assert.strictEqual(l.soldeCentimes, 2000);
  etape('écart du lundi : −50 initial, +30 versés, −20 restant ; le versement ne modifie pas l’écart');

  // Mois : le solde n'est pas « écarts du mois − versements du mois ».
  const so = R.syntheseRegularisationsPeriode(ecartsEmp, R.operationsDeLUnivers(ecartsEmp, PROJECTION),
    { fuseau: FUSEAU, dateDebut: s.octobre[0], dateFin: s.octobre[1], aujourdhui: '2026-10-15' });
  assert.strictEqual(so.constates.manquesCentimes, -6200);
  assert.strictEqual(so.encaissements.netCentimes, 5200, 'inclut le versement d’octobre pour l’écart de septembre, moins la restitution');
  assert.strictEqual(so.soldeFinPeriode.resteDuCentimes, 3500);
  assert.notStrictEqual(-so.soldeFinPeriode.resteDuCentimes, so.constates.manquesCentimes + so.encaissements.netCentimes);
  etape('octobre : −62 constatés, +52 encaissés, solde −35 au 31/10 (≠ −62 + 52 : l’écart de septembre compte)');

  // Différences voulues, et elles seules.
  const mo = mesures(htmlManager(...s.octobre));
  assert.ok('en-attente' in mo && !('en-attente' in em('octobre')), 'l’écart non clôturé n’est montré qu’au manager');
  assert.ok(!rendus.octobre.includes('Bravo') && !rendus.octobre.includes('Zoulou') && !rendus.octobre.includes('mgr-uuid'), 'aucun tiers nommé à l’employé');
  etape('seules différences : écart en attente réservé au manager, tiers et managers anonymisés');
}

const MUTATIONS_PAGE = [
  ['moteur non chargé', '<script src="nexus-ecarts-moteur.js?v=', '<script src="nexus-ecarts-moteur-absent.js?v='],
  ['autre RPC', "nexusClient.rpc('mes_regularisations')", "nexusClient.rpc('mes_ecarts_caisse')"],
  ['opérations ignorées', 'R.operationsDeLUnivers(ecarts, projection)', 'R.operationsDeLUnivers(ecarts, {})'],
  ['période ignorée', 'dateDebut: du.value', "dateDebut: ''"],
];
const MUTATIONS_MODULE = [
  ['garde moteur retirée', "    if (!global.NexusEcartsMoteur) throw new Error('NexusEcartsMoteur absent : la synthèse employé ne peut pas être calculée.');\n", ''],
];

(async () => {
  await verifier(PAGE, true);

  // Câblage statique : la vue employé charge la section, la vue manager renvoie à Analyse.
  assert.ok(PAGE.includes('if (!vueManager) chargerMesRegularisations(cible);'), 'section chargée pour l’employé');
  assert.ok(/vueManager\s*\n?\s*\?\s*`<div class="coach-card"><div class="caisses-sub">Écarts, versements et solde de \$\{cible\.nom\} : voir <a [^>]*href="NEXUS-Analyse-Ecarts-v1\.html"/.test(PAGE), 'vue manager : renvoi à Analyse des écarts, aucun calcul');
  const corps = fonctionDeLaPage(PAGE);
  assert.ok(!/reduce\(|\+=|ecartFinal|montant/.test(corps), 'aucun calcul propre à la page');
  ok('câblage : section employé, renvoi manager vers Analyse, aucun calcul dans la page');

  // Sans moteur, la projection lève au lieu de rendre des zéros.
  const sansMoteur = bac({ 'nexus-ecarts-donnees.js': MODULES['nexus-ecarts-donnees.js'], 'nexus-paye-regularisations.js': MODULES['nexus-paye-regularisations.js'] });
  assert.throws(() => sansMoteur.NexusPayeRegularisations.ecartsDeLaProjection(PROJECTION, { id: X, nom: 'A' }), /NexusEcartsMoteur absent/);
  ok('moteur absent : refus explicite, jamais 0 €');

  for (const [nom, de, vers] of MUTATIONS_PAGE) {
    const i = PAGE.indexOf(de);
    assert.ok(i !== -1 && PAGE.indexOf(de, i + 1) === -1, `ancre de mutation non unique : ${nom}`);
    let rouge = false;
    try { await verifier(PAGE.replace(de, vers), false); } catch (e) { rouge = true; }
    assert.ok(rouge, `mutation de page non détectée : ${nom}`);
  }
  for (const [nom, de, vers] of MUTATIONS_MODULE) {
    const src = MODULES['nexus-paye-regularisations.js'];
    const i = src.indexOf(de);
    assert.ok(i !== -1 && src.indexOf(de, i + 1) === -1, `ancre de mutation non unique : ${nom}`);
    const S = bac({ 'nexus-ecarts-donnees.js': MODULES['nexus-ecarts-donnees.js'], 'nexus-paye-regularisations.js': src.replace(de, vers) });
    let rouge = false;
    try { assert.throws(() => S.NexusPayeRegularisations.ecartsDeLaProjection(PROJECTION, { id: X, nom: 'A' }), /NexusEcartsMoteur absent/); } catch (e) { rouge = true; }
    assert.ok(rouge, `mutation de module non détectée : ${nom}`);
  }
  ok(`${MUTATIONS_PAGE.length + MUTATIONS_MODULE.length} contre-témoins rougissent tous`);
  console.log(`\n${n} vérifications — parité employé / manager tenue.`);
})().catch(e => { console.error('ÉCHEC —', e.message); process.exit(1); });
