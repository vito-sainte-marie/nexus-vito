// Épreuve — 08/10/2026, mandat consolidé §8 (B6) : relevé paie des écarts
// et des versements de régularisation. Écart initial et corrigé, motif,
// versé, restitué, solde, statut, historique ; vues hebdomadaire (fuseau
// de la station) et mensuelle, excédents et manques séparés ; collectifs
// non imputés ; aucune déduction.
//
// Le vrai nexus-paye-regularisations.js est exécuté sur des fixtures
// fictives, puis muté : chaque mutation doit rougir une vérification.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const DIR = __dirname;
const SRC = fs.readFileSync(path.join(DIR, 'nexus-paye-regularisations.js'), 'utf8');
const ecran = fs.readFileSync(path.join(DIR, 'NEXUS-Analyse-Ecarts-v1.html'), 'utf8');

let n = 0;
function ok(label) { n++; console.log('OK —', label); }

function charger(source) {
  const sandbox = { console, Intl, Date, Math, Number, String, Object, Array, Promise, Error };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox.NexusPayeRegularisations;
}

// Fixtures fictives (aucun nom réel, aucun identifiant réel).
const ECARTS = [
  { id: 'verify-a1-piste', sourceModule: 'verify', date: '2026-10-05', quart: '2', activite: 'piste',
    employeeId: 'e-alpha', employeeNom: 'Alpha Fictif', ecartInitial: -40, ecartFinal: -30, causeCode: 'erreur_rendu_monnaie' },
  { id: 'verify-a1-boutique', sourceModule: 'verify', date: '2026-10-05', quart: '2', activite: 'boutique',
    employeeId: 'e-alpha', employeeNom: 'Alpha Fictif', ecartInitial: 12.5, ecartFinal: 12.5, causeCode: null },
  { id: 'fdj-c9', sourceModule: 'fdj', date: '2026-10-06', quart: '1', activite: 'fdj',
    employeeId: 'e-beta', employeeNom: 'Beta Fictif', ecartInitial: -10, ecartFinal: -10, causeCode: 'a_etablir' },
  { id: 'verify-a2-piste', sourceModule: 'verify', date: '2026-10-07', quart: '2', activite: 'piste',
    employeeId: null, employeeNom: 'Alpha Fictif + Beta Fictif', ecartInitial: -25, ecartFinal: -25, causeCode: null },
  { id: 'verify-a3-piste', sourceModule: 'verify', date: '2026-09-30', quart: '3', activite: 'piste',
    employeeId: 'e-alpha', employeeNom: 'Alpha Fictif', ecartInitial: -5, ecartFinal: -5, causeCode: null },
];
const OPS = {
  versements: [
    // 20 € sur le manque piste du 05/10 : partiellement régularisé.
    { id: 'v1', module_origine: 'verify', audit_id: 'a1', caisse_origine: 'piste', employee_id: 'e-alpha', montant: 20,
      mode_encaissement: 'especes', destination: 'tiroir_verify_piste', encaisse_le: '2026-10-06T14:00:00Z', auteur_id: 'm1' },
    // 10 € annulés par contre-écriture : restent à l'historique, ne comptent pas.
    { id: 'v2', module_origine: 'verify', audit_id: 'a1', caisse_origine: 'piste', employee_id: 'e-alpha', montant: 10,
      mode_encaissement: 'cheque', destination: 'coffre', encaisse_le: '2026-10-06T15:00:00Z', auteur_id: 'm1',
      annule_le: '2026-10-06T16:00:00Z', annule_par: 'm2', motif_annulation: 'chèque saisi deux fois' },
    // FDJ : 15 € pour 10 de manque, restitution de 5 → soldé, sans trop-perçu.
    // Dimanche 11/10 à 23 h 30 en Martinique = lundi 12/10 03 h 30 UTC.
    { id: 'v3', module_origine: 'fdj', fdj_cash_control_id: 'c9', employee_id: 'e-beta', montant: 15,
      mode_encaissement: 'carte_bancaire', destination: 'tiroir_fdj', encaisse_le: '2026-10-12T03:30:00Z', auteur_id: 'm1' },
    // Opération dont l'écart n'est pas chargé : jamais ignorée en silence.
    { id: 'v4', module_origine: 'verify', audit_id: 'zz', caisse_origine: 'boutique', employee_id: 'e-beta', montant: 3,
      mode_encaissement: 'especes', destination: 'coffre', encaisse_le: '2026-10-07T12:00:00Z', auteur_id: 'm1' },
  ],
  restitutions: [
    { id: 'r1', module_origine: 'fdj', fdj_cash_control_id: 'c9', employee_id: 'e-beta', montant: 5,
      mode_restitution: 'especes', source: 'tiroir_fdj', justification: 'trop-perçu restitué', restitue_le: '2026-10-13T12:00:00Z', valide_par: 'm2' },
  ],
};
const FUSEAU = 'America/Martinique';

// Toutes les vérifications, réutilisées par les contre-témoins.
function verifier(R, journal) {
  const etape = label => { if (journal) ok(label); };
  const releve = R.construireReleve(ECARTS, OPS, { fuseau: FUSEAU });
  const par = Object.fromEntries(releve.lignes.map(l => [l.cle, l]));

  // 1. Champs d'une ligne et statut partiel.
  const p = par['verify-a1-piste'];
  assert.strictEqual(p.ecartInitialCentimes, -4000);
  assert.strictEqual(p.ecartCorrigeCentimes, -3000);
  assert.strictEqual(p.motif, 'erreur_rendu_monnaie');
  assert.strictEqual(p.verseCentimes, 2000, 'versement annulé non compté');
  assert.strictEqual(p.restitueCentimes, 0);
  assert.strictEqual(p.soldeCentimes, 1000);
  assert.strictEqual(p.statut, 'PARTIELLEMENT_REGULARISE');
  assert.strictEqual(p.libelleStatut, 'Partiellement régularisé');
  etape('écart initial, corrigé, motif, versé, restitué, solde et statut partiel');

  // 2. Historique chronologique avec contre-écriture.
  assert.strictEqual(JSON.stringify(p.historique.map(h => h.nature)), JSON.stringify(['versement', 'versement', 'annulation_versement']));
  const annule = p.historique.filter(h => h.id === 'v2');
  assert.ok(annule.every(h => h.statut === 'Annulé par contre-écriture'));
  assert.strictEqual(annule[1].montantCentimes, -1000);
  assert.strictEqual(annule[1].motif, 'chèque saisi deux fois');
  assert.strictEqual(p.historique[0].motif, "Versement volontaire de régularisation d'un écart antérieur");
  etape('historique chronologique ; l’annulation est une contre-écriture visible, pas une suppression');

  // 3. Soldé avec restitution ; excédent sans régularisation ; ouvert.
  const f = par['fdj-c9'];
  assert.strictEqual(f.verseCentimes, 1500);
  assert.strictEqual(f.restitueCentimes, 500);
  assert.strictEqual(f.soldeCentimes, 0);
  assert.strictEqual(f.statut, 'SOLDE');
  assert.strictEqual(f.tropPercuCentimes, 0);
  assert.strictEqual(par['verify-a1-boutique'].statut, 'SANS_DEFICIT');
  assert.strictEqual(par['verify-a3-piste'].statut, 'OUVERT');
  etape('soldé après restitution ; excédent sans manque ; manque ouvert');

  // 4. Trop-perçu signalé, jamais restitué automatiquement.
  const sansRestit = R.construireReleve(ECARTS, { versements: OPS.versements, restitutions: [] }, { fuseau: FUSEAU });
  const t = sansRestit.lignes.find(l => l.cle === 'fdj-c9');
  assert.strictEqual(t.soldeCentimes, -500);
  assert.strictEqual(t.tropPercuCentimes, 500);
  assert.strictEqual(t.statut, 'SOLDE');
  assert.strictEqual(t.restitueCentimes, 0, 'aucune restitution inventée');
  etape('trop-perçu signalé (5,00 €) sans restitution automatique');

  // 5. Collectif non imputé.
  const c = par['verify-a2-piste'];
  assert.strictEqual(c.nonImpute, true);
  assert.strictEqual(c.employeeId, null);
  const hebdo = R.vueHebdomadaire(releve);
  const coll = hebdo.filter(g => g.nonImpute);
  assert.strictEqual(coll.length, 1);
  assert.strictEqual(coll[0].manquesCentimes, -2500);
  const alpha = hebdo.filter(g => g.employeeId === 'e-alpha' && g.du === '2026-10-05');
  assert.strictEqual(alpha.length, 1);
  assert.ok(!alpha[0].ecarts.includes('verify-a2-piste'), 'le collectif n’entre pas chez Alpha');
  etape('écart collectif dans sa rubrique, imputé à personne');

  // 6. Fuseau : 23 h 30 dimanche en Martinique reste dans la semaine du 05/10.
  assert.strictEqual(R.jourStation('2026-10-12T03:30:00Z', FUSEAU), '2026-10-11');
  assert.strictEqual(R.jourStation('2026-10-12T04:30:00Z', FUSEAU), '2026-10-12');
  const beta = hebdo.filter(g => g.employeeId === 'e-beta');
  const semaine1 = beta.find(g => g.du === '2026-10-05');
  assert.strictEqual(semaine1.au, '2026-10-11');
  assert.strictEqual(semaine1.verseCentimes, 1500, 'versé le dimanche soir, heure de la station');
  assert.strictEqual(semaine1.manquesCentimes, -1000);
  const semaine2 = beta.find(g => g.du === '2026-10-12');
  assert.strictEqual(semaine2.restitueCentimes, 500);
  assert.throws(() => R.construireReleve(ECARTS, OPS, {}), /Fuseau de la station inconnu/);
  etape('semaine lundi → dimanche au fuseau de la station ; sans fuseau, refus explicite');

  // 7. Semaine précédente : l'écart du mercredi 30/09 est dans la semaine du 28/09.
  assert.strictEqual(R.lundiDe('2026-09-30'), '2026-09-28');
  assert.strictEqual(R.lundiDe('2026-10-05'), '2026-10-05');
  assert.ok(hebdo.some(g => g.du === '2026-09-28' && g.employeeId === 'e-alpha' && g.manquesCentimes === -500));
  etape('semaine ISO calculée sur le calendrier');

  // 8. Mensuel : excédents et manques séparés, jamais compensés.
  const mensuel = R.vueMensuelle(releve);
  const octAlpha = mensuel.find(g => g.periode === '2026-10' && g.employeeId === 'e-alpha');
  assert.strictEqual(octAlpha.excedentsCentimes, 1250);
  assert.strictEqual(octAlpha.manquesCentimes, -3000);
  assert.strictEqual(octAlpha.nbExcedents, 1);
  assert.strictEqual(octAlpha.nbManques, 1);
  assert.ok(!('netCentimes' in octAlpha) && !('compenseCentimes' in octAlpha));
  const sepAlpha = mensuel.find(g => g.periode === '2026-09' && g.employeeId === 'e-alpha');
  assert.strictEqual(sepAlpha.manquesCentimes, -500);
  assert.strictEqual(sepAlpha.verseCentimes, 0);
  assert.ok(mensuel.some(g => g.periode === '2026-10' && g.nonImpute));
  etape('mensuel : +12,50 € et −30,00 € côte à côte, collectifs à part');

  // 9. Opération sans écart chargé : rendue, pas perdue.
  assert.strictEqual(releve.operationsSansEcart.length, 1);
  assert.strictEqual(releve.operationsSansEcart[0].id, 'v4');
  etape('opération orpheline signalée');

  // 10. Aucune déduction : ni champ, ni mot, dans le module.
  const champs = JSON.stringify([releve, hebdo, mensuel]);
  assert.ok(!/deduction|retenue/i.test(champs), 'aucun champ de déduction');
  etape('aucune déduction ni retenue calculée');

  // 11. CSV et HTML.
  const csv = R.exporterCsv(releve);
  const lignesCsv = csv.split('\n');
  assert.strictEqual(lignesCsv[0], 'date;quart;activite;employe;imputation;ecart_initial;ecart_corrige;motif;verse;restitue;solde;statut;historique');
  assert.ok(csv.includes('2026-10-05;2;piste;Alpha Fictif;employé;-40,00;-30,00;erreur_rendu_monnaie;20,00;0,00;10,00;Partiellement régularisé;'));
  assert.ok(csv.includes('Alpha Fictif + Beta Fictif;collectif non imputé'));
  assert.ok(csv.includes('Annulé par contre-écriture'));
  assert.ok(csv.endsWith('Aucune déduction ni retenue sur salaire n’est calculée par ce relevé.'));
  const piege = R.construireReleve([{ ...ECARTS[0], employeeNom: '<img src=x onerror=alert(1)>' }], { versements: [], restitutions: [] }, { fuseau: FUSEAU });
  const html = R.renderLignes(piege);
  assert.ok(!html.includes('<img') && html.includes('&lt;img'), 'HTML échappé');
  const vue = R.renderVue(hebdo, g => `${g.du} → ${g.au}`);
  assert.ok(vue.includes('Collectif — non imputé') && vue.includes('Excédents') && vue.includes('Manques'));
  etape('export CSV et rendu HTML échappé');
}

// Exécution du vrai module.
verifier(charger(SRC), true);

// Contre-témoins : chaque mutation doit rougir.
const MUTATIONS = [
  ['versement annulé compté', "h.nature === 'versement' && !h.annule", "h.nature === 'versement'"],
  ['restitution ignorée dans le solde', 'const net = verse - restitue;', 'const net = verse;'],
  ['collectif imputé', 'nonImpute: !e.employeeId,', 'nonImpute: false,'],
  ['fuseau ignoré (UTC)', "timeZone: fuseau, year", "timeZone: 'UTC', year"],
  ['manques compensés par les excédents', 'g.manquesCentimes += l.ecartCorrigeCentimes; g.nbManques++;', 'g.excedentsCentimes += l.ecartCorrigeCentimes; g.nbManques++;'],
  ['contre-écriture supprimée de l’historique', "if (op.annule_le) {\n        cible.historique.push", "if (false) {\n        cible.historique.push"],
  ['orpheline ignorée', 'if (!cible) { sansEcart.push(entree); return; }', 'if (!cible) { return; }'],
  ['semaine commençant le dimanche', 'const decalage = (d.getUTCDay() + 6) % 7;', 'const decalage = d.getUTCDay();'],
  ['statut partiel confondu avec ouvert', "else if (net > 0) statut = 'PARTIELLEMENT_REGULARISE';", ''],
  ['HTML non échappé', "function esc(s) { return String(s ?? '').replace", "function esc(s) { return String(s ?? ''); }\n  function _x(s) { return String(s ?? '').replace"],
];
for (const [nom, de, vers] of MUTATIONS) {
  const i = SRC.indexOf(de);
  assert.ok(i !== -1 && SRC.indexOf(de, i + 1) === -1, `ancre de mutation non unique : ${nom}`);
  let rouge = false;
  const mute = charger(SRC.replace(de, vers)); // doit se charger : une erreur de syntaxe n'est pas un rouge
  try { verifier(mute, false); } catch (e) { rouge = true; }
  assert.ok(rouge, `contre-témoin muet : ${nom}`);
}
ok(`${MUTATIONS.length} contre-témoins rougissent tous`);

// Intégration : l'écran manager charge le module et affiche le relevé.
{
  assert.ok(/<script src="nexus-paye-regularisations\.js\?v=[^"]+"><\/script>/.test(ecran), 'script chargé');
  const iD = ecran.indexOf('nexus-ecarts-donnees.js?v=');
  const iR = ecran.indexOf('nexus-paye-regularisations.js?v=');
  assert.ok(iD !== -1 && iR > iD, 'après le chargeur d’écarts');
  for (const id of ['sectionRegularisations', 'regulVue', 'listeRegularisations', 'btnExportRegul']) {
    assert.ok(ecran.includes(`id="${id}"`), `élément ${id}`);
  }
  assert.ok(ecran.includes("NexusPayeRegularisations.chargerOperations(nexusClient, SITE_ACTUEL)"), 'lecture limitée au site');
  assert.ok(ecran.includes('fuseau: FUSEAU_STATION'), 'fuseau de la station transmis');
  assert.ok(!/\.(insert|update|upsert|delete|rpc)\(/.test(ecran.slice(ecran.indexOf('// --- Régularisations'), ecran.indexOf('// --- Fin régularisations'))), 'section en lecture seule');
  ok('Analyse des écarts charge le relevé du site, au fuseau de la station, en lecture seule');
}

console.log(`\n${n} vérifications — relevé paie des régularisations conforme.`);
