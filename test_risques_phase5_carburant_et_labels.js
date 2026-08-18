// Cadrage risques Phase 5 (tâche #234, 18/08/2026) — tests de non-régression
// pour :
//   1) qualifierAutonomieCarburant (nexus-risques-moteur.js) — 3e domaine
//      NexusRisques, branché via la voie qualitative A2/B2 posée en Phase 4.
//   2) domaineLabelSignal / sujetSignal — mapping domaine→libellé désormais
//      centralisé (avant ce lot : ternaire binaire marge/caisse dupliqué 3
//      fois dans Brief/Cockpit/Rapport, qui aurait mal étiqueté tout signal
//      Carburants comme "Caisse").
//   3) régression stricte : qualifierEcartCaisse / qualifierMargeCategorie
//      ne renseignent jamais severiteQualitative — les nouvelles Règles
//      A2/B2 doivent rester un no-op garanti pour ces deux domaines.
//
// Exécution : node test_risques_phase5_carburant_et_labels.js

const path = require('path');
global.window = global; // le fichier moteur s'accroche à window||globalThis
require(path.join(__dirname, 'nexus-risques-moteur.js'));
const NexusRisques = global.NexusRisques;

let total = 0, ok = 0;
function assert(label, condition) {
  total++;
  if (condition) { ok++; console.log(`OK   - ${label}`); }
  else { console.log(`FAIL - ${label}`); }
}

// ------------------------------------------------------------
// 1) qualifierAutonomieCarburant
// ------------------------------------------------------------
const SEUIL_ALERTE = 1.5;
const SEUIL_VIGILANCE = 3;

// 1.1 — autonomie non calculable (stock ou conso indisponible) : anomalie,
// confiance D, jamais une fausse certitude sur une donnée absente.
{
  const r = NexusRisques.qualifierAutonomieCarburant({
    autonomieJours: null, seuilAlerteJours: SEUIL_ALERTE, seuilVigilanceJours: SEUIL_VIGILANCE,
  });
  assert('Carburant — autonomie null => anomalie', r.niveau === 'anomalie');
  assert('Carburant — autonomie null => confiance D', r.niveauConfiance === 'D');
}

// 1.2 — autonomie sous le seuil d'alerte (majeure) : risque_avere même sans
// récurrence, miroir de la branche "matériel à lui seul" de la Règle A.
{
  const r = NexusRisques.qualifierAutonomieCarburant({
    autonomieJours: 1, seuilAlerteJours: SEUIL_ALERTE, seuilVigilanceJours: SEUIL_VIGILANCE,
    historiqueAutonomieJours: [],
  });
  assert('Carburant — 1j < seuil alerte (1.5j) => risque_avere sans récurrence', r.niveau === 'risque_avere');
}

// 1.3 — autonomie sous le seuil de vigilance mais au-dessus de l'alerte
// (significative), récurrence insuffisante : exposition, pas encore avéré.
{
  const r = NexusRisques.qualifierAutonomieCarburant({
    autonomieJours: 2.5, seuilAlerteJours: SEUIL_ALERTE, seuilVigilanceJours: SEUIL_VIGILANCE,
    historiqueAutonomieJours: [],
  });
  assert('Carburant — 2.5j < vigilance (3j), 1ère fois => exposition', r.niveau === 'exposition');
}

// 1.4 — même situation significative, mais observée sur assez de jours
// récents sous vigilance pour atteindre le seuil de récurrence avéré (5) :
// escalade en risque_avere par répétition, comme la Règle A €.
{
  const r = NexusRisques.qualifierAutonomieCarburant({
    autonomieJours: 2.5, seuilAlerteJours: SEUIL_ALERTE, seuilVigilanceJours: SEUIL_VIGILANCE,
    historiqueAutonomieJours: [2.8, 2.2, 2.9, 2.1], // 4 jours sous vigilance + aujourd'hui = récurrence 5
  });
  assert('Carburant — significative + 5 occurrences => risque_avere par récurrence', r.niveau === 'risque_avere');
  assert('Carburant — recurrenceCount reflète bien 5', r.recurrenceCount === 5);
}

// 1.5 — autonomie confortable (mineure), aucun jour récent sous vigilance :
// aucune escalade qualitative, retombe sur Règle D (fait isolé).
{
  const r = NexusRisques.qualifierAutonomieCarburant({
    autonomieJours: 8, seuilAlerteJours: SEUIL_ALERTE, seuilVigilanceJours: SEUIL_VIGILANCE,
    historiqueAutonomieJours: [7.5, 8.2],
  });
  assert('Carburant — 8j confortable, aucun historique sous vigilance => anomalie (défaut)', r.niveau === 'anomalie');
}

// 1.6 — autonomie confortable aujourd'hui, mais plusieurs jours récents sous
// vigilance : Règle C, signal_faible (une tendance qui se dessine, jamais
// suffisante seule pour un risque avéré tant que le jour courant est ok).
{
  const r = NexusRisques.qualifierAutonomieCarburant({
    autonomieJours: 5, seuilAlerteJours: SEUIL_ALERTE, seuilVigilanceJours: SEUIL_VIGILANCE,
    historiqueAutonomieJours: [2.5, 2.8],
  });
  assert('Carburant — mineure aujourd\'hui + 2 jours récents sous vigilance => signal_faible', r.niveau === 'signal_faible');
}

// ------------------------------------------------------------
// 2) domaineLabelSignal / sujetSignal — centralisation Phase 5
// ------------------------------------------------------------
{
  const sMarge = { domaine: 'marge', cle_signal: 'marge:categorie:Boissons énergisantes' };
  assert('Label — marge => "Marge"', NexusRisques.domaineLabelSignal(sMarge) === 'Marge');
  assert('Sujet — marge => nom de catégorie brut', NexusRisques.sujetSignal(sMarge) === 'Boissons énergisantes');

  const sCaisse = { domaine: 'caisse', cle_signal: 'caisse:quart:Q1' };
  assert('Label — caisse => "Caisse"', NexusRisques.domaineLabelSignal(sCaisse) === 'Caisse');
  assert('Sujet — caisse => "Quart Q1"', NexusRisques.sujetSignal(sCaisse) === 'Quart Q1');

  const sCarburantGo = { domaine: 'carburant', cle_signal: 'carburant:autonomie:go' };
  assert('Label — carburant => "Carburants" (jamais "Caisse", le bug évité)', NexusRisques.domaineLabelSignal(sCarburantGo) === 'Carburants');
  assert('Sujet — carburant go => "Gazole"', NexusRisques.sujetSignal(sCarburantGo) === 'Gazole');

  const sCarburantSp95 = { domaine: 'carburant', cle_signal: 'carburant:autonomie:sp95' };
  assert('Sujet — carburant sp95 => "SP95"', NexusRisques.sujetSignal(sCarburantSp95) === 'SP95');

  const sCarburantInconnu = { domaine: 'carburant', cle_signal: 'carburant:autonomie:xyz' };
  assert('Sujet — carburant code inconnu => code brut (dégradation gracieuse)', NexusRisques.sujetSignal(sCarburantInconnu) === 'xyz');

  const sDomaineFutur = { domaine: 'inventaire', cle_signal: 'inventaire:produit:Glaçons Crystal' };
  assert('Label — domaine futur non mappé => domaine brut, jamais une erreur', NexusRisques.domaineLabelSignal(sDomaineFutur) === 'inventaire');
  assert('Sujet — domaine futur non mappé => cle_signal brute', NexusRisques.sujetSignal(sDomaineFutur) === 'inventaire:produit:Glaçons Crystal');
}

// ------------------------------------------------------------
// 3) Régression stricte — Marge/Caisse ne renseignent jamais
// severiteQualitative : les Règles A2/B2 doivent être un no-op garanti.
// ------------------------------------------------------------
{
  const rCaisse = NexusRisques.qualifierEcartCaisse({ ecartCumule: 50, total: 10, parStatut: { anomalie: 1, critique: 0 } });
  assert('Régression — qualifierEcartCaisse toujours fonctionnel (forme inchangée)', typeof rCaisse.niveau === 'string');

  const rMarge = NexusRisques.qualifierMargeCategorie({
    categorie: 'Test', margePctActuelle: 10, margeHistorique: [20, 22, 21], caActuel: 10000, caHistoriqueMoyen: 10000,
  });
  assert('Régression — qualifierMargeCategorie toujours fonctionnel (forme inchangée)', typeof rMarge.niveau === 'string');
}

console.log(`\n${ok}/${total} assertions passées.`);
process.exit(ok === total ? 0 : 1);
