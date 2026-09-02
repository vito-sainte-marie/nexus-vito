// Test — v2.269-1 (28/08/2026), retour de Frédéric après test réel du P0
// "Analyse des écarts" : nexus-ecarts-moteur.js — arrondi centimes robuste,
// montant retenu (jamais de compensation excédent/manque, §7), activité
// inhabituelle (§5/§6).

const path = require('path');
const assert = require('assert');
require(path.join(__dirname, 'nexus-ecarts-moteur.js'));
const M = globalThis.NexusEcartsMoteur;

let n = 0;
function ok(label) { n++; console.log('OK —', label); }

// ------------------------------------------------------------
// 1) arrondiCentimes — corrige les dérives flottantes classiques.
// ------------------------------------------------------------
{
  assert.strictEqual(M.arrondiCentimes(0.1 + 0.2), 0.3, '0.1+0.2 doit devenir exactement 0.3, pas 0.30000000000000004');
  assert.strictEqual(M.arrondiCentimes(190.045), 190.05);
  assert.strictEqual(M.arrondiCentimes(-0.0049), -0);
  assert.strictEqual(M.arrondiCentimes(null), null, 'null préservé, jamais fabriqué');
  ok('arrondiCentimes — corrige les dérives flottantes, préserve null');
}

// ------------------------------------------------------------
// 2) calculerMontantRetenuLigne — règle §7 : jamais de compensation.
// ------------------------------------------------------------
{
  assert.strictEqual(M.calculerMontantRetenuLigne({ statut: 'a_verifier', ecartFinal: 12 }), 0, 'pas encore résolu -> rien de retenu');
  assert.strictEqual(M.calculerMontantRetenuLigne({ statut: 'regularise', ecartFinal: 0 }), 0, 'régularisé -> 0');
  assert.strictEqual(M.calculerMontantRetenuLigne({ statut: 'cloture_non_explique', ecartFinal: 15 }), 0, 'excédent restant, même non expliqué -> jamais transformé en crédit');
  assert.strictEqual(M.calculerMontantRetenuLigne({ statut: 'cloture_explique', ecartFinal: 15 }), 0, 'excédent restant expliqué -> retenu = 0 quand même');
  assert.strictEqual(M.calculerMontantRetenuLigne({ statut: 'cloture_non_explique', ecartFinal: -13 }), -13, 'manque restant non expliqué -> retenu = le montant négatif');
  assert.strictEqual(M.calculerMontantRetenuLigne({ statut: 'cloture_explique', ecartFinal: -8 }), -8, 'manque restant expliqué -> retenu quand même (un manque reste un manque réel)');
  ok('calculerMontantRetenuLigne — excédent restant jamais retenu, manque restant toujours retenu, régularisé/en attente = 0');
}

// ------------------------------------------------------------
// 3) calculerKpisEcarts — cas réel exact du retour de Frédéric : le
// "Volume d'écarts" doit être 271,95 €, pas 271,96 €. Solde
// opérationnel/montant retenu jamais confondus (exemple exact du §7 :
// +35/-13 -> opérationnel +22, retenu -13).
// ------------------------------------------------------------
{
  const lignes = [
    { ecartFinal: 190.05, statut: 'cloture_non_explique' },
    { ecartFinal: -81.90, statut: 'cloture_non_explique' },
  ];
  const k = M.calculerKpisEcarts(lignes);
  assert.strictEqual(k.volume, 271.95, 'volume exact (cas réel du retour de Frédéric), plus de dérive flottante : ' + k.volume);
  assert.strictEqual(k.soldeOperationnel, 108.15, 'solde opérationnel = 190.05-81.90 exact : ' + k.soldeOperationnel);
  assert.strictEqual(k.soldeNet, 108.15, 'alias soldeNet conservé pour rétrocompatibilité');
  assert.strictEqual(k.montantRetenu, -81.90, 'montant retenu = seulement le manque non expliqué, jamais compensé par l\'excédent : ' + k.montantRetenu);

  const exempleCadrage = [
    { ecartFinal: 35, statut: 'cloture_non_explique' },
    { ecartFinal: -13, statut: 'cloture_non_explique' },
  ];
  const k2 = M.calculerKpisEcarts(exempleCadrage);
  assert.strictEqual(k2.soldeOperationnel, 22, 'exemple exact du cadrage §7 : solde opérationnel +22');
  assert.strictEqual(k2.montantRetenu, -13, 'exemple exact du cadrage §7 : montant retenu -13, jamais +22');

  // Somme sur une longue liste : aucune dérive flottante ne doit
  // s'accumuler quel que soit le nombre de lignes.
  const longueListe = [];
  for (let i = 0; i < 50; i++) longueListe.push({ ecartFinal: 0.1, statut: 'cloture_non_explique' });
  const k3 = M.calculerKpisEcarts(longueListe);
  assert.strictEqual(k3.soldeOperationnel, 5, '50 x 0,10 € = 5,00 € exact, jamais 4.999999999999998 : ' + k3.soldeOperationnel);

  ok('calculerKpisEcarts — volume exact sans dérive flottante, solde opérationnel et montant retenu strictement séparés (jamais compensés)');
}

// ------------------------------------------------------------
// 4) agregerEcartsParEmploye — refonte §9 : excédents/manques constatés
// jamais compensés, montant retenu distinct, employeeRole transmis.
// ------------------------------------------------------------
{
  // Cas Fred (§9, manager) : +120,38 € constatés, jamais régularisés,
  // encore restants -> montant retenu = 0 (excédent).
  const lignesFred = [
    { employeeId: 'fred', employeeNom: 'Fred', employeeRole: 'manager', ecartInitial: 120.38, ecartFinal: 120.38, statut: 'cloture_non_explique' },
  ];
  const aggFred = M.agregerEcartsParEmploye(lignesFred)[0];
  assert.strictEqual(aggFred.excedentsConstates, 120.38);
  assert.strictEqual(aggFred.manquesConstates, 0);
  assert.strictEqual(aggFred.regularises, 0);
  assert.strictEqual(aggFred.montantRetenu, 0, 'excédent non régularisé -> montant retenu 0, jamais 120.38 : ' + aggFred.montantRetenu);
  assert.strictEqual(aggFred.employeeRole, 'manager');

  // Cas Dylan (§9, employé) : +30 excédent, -12 manque -> opérationnel
  // +18, retenu -12 (jamais compensés).
  const lignesDylan = [
    { employeeId: 'dylan', employeeNom: 'Dylan', employeeRole: 'caissier', ecartInitial: 30, ecartFinal: 30, statut: 'cloture_non_explique' },
    { employeeId: 'dylan', employeeNom: 'Dylan', employeeRole: 'caissier', ecartInitial: -12, ecartFinal: -12, statut: 'cloture_non_explique' },
  ];
  const aggDylan = M.agregerEcartsParEmploye(lignesDylan)[0];
  assert.strictEqual(aggDylan.excedentsConstates, 30);
  assert.strictEqual(aggDylan.manquesConstates, -12);
  assert.strictEqual(aggDylan.soldeOperationnel, 18);
  assert.strictEqual(aggDylan.montantRetenu, -12, 'jamais +18 retenu : ' + aggDylan.montantRetenu);

  ok('agregerEcartsParEmploye — exemples exacts du retour de Frédéric (Fred/Dylan) : excédents/manques jamais compensés, rôle transmis');
}

// ------------------------------------------------------------
// 5) roleCaisseInhabituelle — manager/gérant = signal, jamais une
// exclusion (§5) ni une accusation automatique (§6).
// ------------------------------------------------------------
{
  assert.strictEqual(M.roleCaisseInhabituelle('manager'), true);
  assert.strictEqual(M.roleCaisseInhabituelle('gerant'), true);
  assert.strictEqual(M.roleCaisseInhabituelle('caissier'), false);
  assert.strictEqual(M.roleCaisseInhabituelle('pompiste'), false);
  assert.strictEqual(M.roleCaisseInhabituelle('vacataire'), false);
  assert.strictEqual(M.roleCaisseInhabituelle(null), false, 'rôle inconnu -> jamais fabriqué comme inhabituel');
  ok('roleCaisseInhabituelle — manager/gérant signalés, tous les autres rôles réels du site jamais signalés');
}

console.log(`\n${n} tests passés.`);
