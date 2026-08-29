// Test — v2.286 (29/08/2026, demande de Frédéric après le P0 v2.285) :
// "les employés doivent voir le même événement que le manager, pas un
// second calcul indépendant". Vérifié avant ce lot (Article 5) :
// nexus-progression.js (statutCaisseJour/statutActivite) comparait le
// montant validé à un seuil fixe de 2€ (SEUIL_ECART_CONFORME), sans jamais
// regarder si le manager avait réellement corrigé l'écart à zéro ou
// seulement documenté sa cause — une divergence réelle avec
// nexus-ecarts-moteur.js (deriverStatutEcart), déjà utilisé par "Analyse
// des écarts" manager (nexus-ecarts-donnees.js). Ce fichier teste :
//   1. statutEcartActiviteVerify (le nouveau pont) isolément, y compris son
//      repli défensif si le moteur n'est pas chargé.
//   2. La convergence RÉELLE : le scénario exact du P0 v2.285 (17/08/2026
//      Quart 2, vito-sainte-marie, Ruddy/Piste -36,65€) doit produire, côté
//      Progression (nexus-progression.js), EXACTEMENT le même statut et le
//      même montant que côté manager (nexus-ecarts-donnees.js) — la preuve
//      concrète que la demande de Frédéric est satisfaite pour ce cas réel.
//
// nexus-progression.js est un IIFE écrit pour le navigateur — on stub
// `window` avant de le requérir, comme documenté dans le fichier lui-même.

global.window = global;
const path = require('path');
const assert = require('assert');
const DIR = '/sessions/dazzling-compassionate-ride/mnt/image nexus project';
require(path.join(DIR, 'nexus-ecarts-moteur.js'));
require(path.join(DIR, 'nexus-progression.js'));
require(path.join(DIR, 'nexus-ecarts-donnees.js'));
const N = global.NexusProgression;
const M = global.NexusEcartsMoteur;
const D = global.NexusEcartsDonnees;

let n = 0;
function ok(label) { n++; console.log('OK —', label); }

// ------------------------------------------------------------
// 1) statutEcartActiviteVerify — cas isolés (fonction pure).
// ------------------------------------------------------------
{
  // Régularisé : corrigé à zéro pile, cause connue ou non (peu importe une
  // fois à zéro, cf. deriverStatutEcart).
  assert.strictEqual(N.statutEcartActiviteVerify(36.65, 0, 'erreur_saisie'), 'validee_conforme', 'corrigé à zéro pile -> conforme, quel que soit le montant initial');
  assert.strictEqual(N.statutEcartActiviteVerify(36.65, 0, null), 'validee_conforme', 'corrigé à zéro pile même sans cause déclarée -> conforme');

  // Clôturé non expliqué : montant persistant, pas de cause -> écart, MÊME
  // SI le montant est petit (fin du seuil de 2€ qui n'existe plus ici).
  assert.strictEqual(N.statutEcartActiviteVerify(-1.5, -1.5, null), 'validee_ecart', 'écart de -1,50€ clôturé SANS cause -> écart retenu, jamais "conforme" par tolérance');
  assert.strictEqual(N.statutEcartActiviteVerify(-1.5, -1.5, 'non_explique'), 'validee_ecart', '"non_explique" compte comme cause NON connue (même règle que le moteur manager)');

  // Clôturé expliqué : montant persistant, cause connue -> toujours un
  // écart retenu (une cause connue n'efface jamais le montant, seule une
  // correction à zéro le fait — règle du moteur, déjà en vigueur côté
  // manager depuis le v2.269).
  assert.strictEqual(N.statutEcartActiviteVerify(-36.65, -36.65, 'carte_carburant_non_comptee'), 'validee_ecart', 'cause connue mais montant non corrigé -> reste un écart retenu, jamais "conforme"');

  // Aucun écart réel (final nul, initial nul/inconnu) -> conforme.
  assert.strictEqual(N.statutEcartActiviteVerify(null, 0, null), 'validee_conforme', 'aucun écart réel -> conforme');
  assert.strictEqual(N.statutEcartActiviteVerify(0, 0, null), 'validee_conforme', 'écart initial et final nuls -> conforme');

  ok('statutEcartActiviteVerify — régularisé (zéro pile) vs clôturé expliqué/non expliqué correctement distingués, jamais une tolérance en euros');
}

// ------------------------------------------------------------
// 2) Repli défensif — si NexusEcartsMoteur n'est pas chargé, retombe sur
//    l'ancien seuil de 2€ (comportement d'avant v2.286), jamais une
//    exception qui casserait l'écran.
// ------------------------------------------------------------
{
  const sauvegarde = global.NexusEcartsMoteur;
  delete global.NexusEcartsMoteur;
  assert.strictEqual(N.statutEcartActiviteVerify(-36.65, -1.5, null), 'validee_conforme', 'repli défensif : -1,50€ reste sous l\'ancien seuil de 2€ -> conforme (comportement historique préservé)');
  assert.strictEqual(N.statutEcartActiviteVerify(-36.65, -36.65, null), 'validee_ecart', 'repli défensif : -36,65€ dépasse l\'ancien seuil -> écart');
  global.NexusEcartsMoteur = sauvegarde;
  ok('statutEcartActiviteVerify — repli défensif fonctionnel si nexus-ecarts-moteur.js n\'est pas chargé (jamais un écran cassé)');
}

// ------------------------------------------------------------
// 3) Convergence réelle — scénario EXACT du P0 v2.285 (17/08/2026 Quart 2,
//    vito-sainte-marie), déjà vérifié par requête SQL directe sur le
//    projet Supabase avant d'écrire test_ecarts_attribution_caisse_v2285.js.
//    Ruddy (Piste, seul sur ce poste, -36,65€, clôturé SANS cause connue)
//    doit voir dans SA Progression exactement ce que le manager voit dans
//    "Analyse des écarts" pour la même ligne.
// ------------------------------------------------------------
{
  const auditReel = {
    id: '2e9d25ae-9242-446f-8a31-862d21cd8f2b', date: '2026-08-17', quart: '2',
    employee_id: '21fb5e59-5a10-4831-a2ff-b5a4549e0bed', // Audrey — auteure du contrôle, PAS un employé de caisse
    employes_piste: ['f98c64f6-9585-4437-a4a1-36265406207b'], // Ruddy, seul sur Piste
    employes_boutique: ['d0656292-f1a2-4dd6-9518-00231b37c6e2'], // loane
    ecart_piste: -36.65, ecart_piste_origine: -36.649999999999636, ecart_piste_valide: -36.649999999999636,
    valide_le: '2026-08-17T09:29:00Z', valide_le_piste: '2026-08-17T09:29:00Z', valide_par_piste: '21fb5e59-5a10-4831-a2ff-b5a4549e0bed',
    cause_code_piste: null, // non résolu -> "clôturé non expliqué"
    ecart_boutique: 0.38, ecart_boutique_origine: 0.3799999999996544, ecart_boutique_valide: 0.3799999999996544,
    valide_le_boutique: '2026-08-17T09:29:00Z', valide_par_boutique: '21fb5e59-5a10-4831-a2ff-b5a4549e0bed', cause_code_boutique: null,
  };
  const RUDDY_ID = 'f98c64f6-9585-4437-a4a1-36265406207b';
  const nomParEmploye = { [RUDDY_ID]: 'Ruddy', 'd0656292-f1a2-4dd6-9518-00231b37c6e2': 'loane', '21fb5e59-5a10-4831-a2ff-b5a4549e0bed': 'Audrey' };
  const roleParEmploye = { [RUDDY_ID]: 'pompiste', 'd0656292-f1a2-4dd6-9518-00231b37c6e2': 'caissier', '21fb5e59-5a10-4831-a2ff-b5a4549e0bed': 'manager' };

  // Côté MANAGER — nexus-ecarts-donnees.js ("Analyse des écarts").
  const lignesManager = D.normaliserAuditsVerify([auditReel], nomParEmploye, roleParEmploye);
  const ligneManagerPiste = lignesManager.find(l => l.activite === 'piste');
  assert.strictEqual(ligneManagerPiste.statut, 'cloture_non_explique');
  assert.strictEqual(ligneManagerPiste.ecartFinal, -36.65);

  // Côté EMPLOYÉ — nexus-progression.js ("Ma Progression" / "Mes Caisses").
  const servicesRuddy = N.construireServicesCaisse([auditReel], RUDDY_ID);
  assert.strictEqual(servicesRuddy.length, 1);
  const serviceRuddy = servicesRuddy[0];
  assert.strictEqual(serviceRuddy.soloPiste, true, 'Ruddy est bien seul sur Piste ce quart-là');

  const statutProgressionPiste = N.statutActivite(serviceRuddy, 'piste');
  const ligneUnifieePiste = N.ligneActiviteCaisse(serviceRuddy, 'piste');

  // La preuve demandée par Frédéric : le statut ET le montant concordent.
  assert.strictEqual(statutProgressionPiste, 'validee_ecart', 'Progression classe ce contrôle comme un écart retenu, exactement comme le manager (cloture_non_explique)');
  assert.strictEqual(ligneUnifieePiste.montant, ligneManagerPiste.ecartFinal, 'même montant final affiché des deux côtés (-36,65€)');
  assert.strictEqual(ligneUnifieePiste.montant, -36.65);

  // Le statut global du service (statutCaisseJour) doit lui aussi refléter
  // l'écart (au moins un poste en validee_ecart -> service en validee_ecart).
  assert.strictEqual(N.statutCaisseJour(serviceRuddy), 'validee_ecart');

  ok('Convergence réelle (17/08/2026 Q2, Ruddy/Piste) — Progression et Analyse des écarts affichent désormais le même statut et le même montant pour le même événement source');
}

// ------------------------------------------------------------
// 4) Même scénario, mais RÉGULARISÉ par le manager (correction à zéro,
//    cause trouvée) — les deux vues doivent converger vers "conforme"/
//    "régularisé" tout aussi fidèlement.
// ------------------------------------------------------------
{
  const auditRegularise = {
    id: 'audit-regul-test', date: '2026-08-20', quart: '1',
    employee_id: 'manager-x',
    employes_piste: ['emp-ruddy-2'], employes_boutique: [],
    ecart_piste: 0, ecart_piste_origine: 12.30, ecart_piste_valide: 0,
    valide_le: '2026-08-21T09:00:00Z', valide_le_piste: '2026-08-21T09:00:00Z', valide_par_piste: 'manager-x',
    cause_code_piste: 'erreur_saisie',
    ecart_boutique: null,
  };
  const nomParEmploye = { 'emp-ruddy-2': 'Testeur' };
  const roleParEmploye = { 'emp-ruddy-2': 'pompiste' };

  const lignesManager = D.normaliserAuditsVerify([auditRegularise], nomParEmploye, roleParEmploye);
  const ligneManagerPiste = lignesManager.find(l => l.activite === 'piste');
  assert.strictEqual(ligneManagerPiste.statut, 'regularise');

  const services = N.construireServicesCaisse([auditRegularise], 'emp-ruddy-2');
  const statutProgression = N.statutActivite(services[0], 'piste');
  assert.strictEqual(statutProgression, 'validee_conforme', 'un écart régularisé par le manager doit apparaître "conforme" côté employé, jamais encore "écart"');

  ok('Convergence réelle (cas régularisé) — Progression et Analyse des écarts convergent aussi sur un écart corrigé à zéro par le manager');
}

console.log(`\n${n} tests passés.`);
