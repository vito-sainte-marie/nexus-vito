// Test — Fiabilité à 6 facteurs (27/08/2026, refonte qualitative, point 15) :
//
// "Chaque recommandation doit avoir un niveau de confiance : Fiabilité :
// élevée / moyenne / faible. La fiabilité dépend de : fraîcheur du
// jaugeage, couverture des ventes, qualité de l'historique, cohérence des
// livraisons, présence d'un point zéro fiable, absence d'anomalie
// majeure. Si données insuffisantes : NEXUS ne doit pas inventer de
// recommandation."
//
// Le niveau à 3 valeurs (fiable/a_confirmer/non_calculable) reste
// EXACTEMENT le même vocabulaire que v2.238 (Article 5 : ne pas casser un
// vocabulaire déjà validé par Frédéric) — ce qui change, c'est le nombre
// de signaux considérés. Portée assumée et testée ci-dessous : les 2
// signaux historiques restent seuls bloquants (non_calculable), et il
// faut AU MOINS 2 signaux secondaires négatifs simultanés pour déclasser
// "fiable" en "a_confirmer" (jamais un seul facteur cosmétique isolé).

const path = require('path');
const vm = require('vm');
const fs = require('fs');
const assert = require('assert');

const PROJET = __dirname;
function charger(sandbox, fichier) {
  const code = fs.readFileSync(path.join(PROJET, fichier), 'utf8');
  vm.runInContext(code, sandbox);
}
let n = 0;
function ok(label) { n++; console.log('OK —', label); }

const sandbox = { console };
vm.createContext(sandbox);
charger(sandbox, 'nexus-carburant-moteur.js');
charger(sandbox, 'nexus-carburant-commande-moteur.js');
const M = sandbox.NexusCarburantCommandeMoteur;

// ------------------------------------------------------------
// 1) jaugeageEstFrais — jour calendaire, jamais un mélange fuseau local/UTC.
// ------------------------------------------------------------
{
  assert.strictEqual(M.jaugeageEstFrais('2026-08-27T06:15:00Z', '2026-08-27'), true, 'jaugeage du jour même -> frais');
  assert.strictEqual(M.jaugeageEstFrais('2026-08-26T06:15:00Z', '2026-08-27'), true, 'jaugeage de la veille -> encore frais (seuil 1 jour)');
  assert.strictEqual(M.jaugeageEstFrais('2026-08-24T06:15:00Z', '2026-08-27'), false, 'jaugeage vieux de 3 jours -> plus frais');
  assert.strictEqual(M.jaugeageEstFrais(null, '2026-08-27'), null, 'aucun jaugeage connu -> inconnu, jamais un false fabriqué');
  ok('jaugeageEstFrais() — comparaison en jours calendaires, jamais un calcul silencieusement faux (fuseau)');
}

// ------------------------------------------------------------
// 2) livraisonEnCoursCoherente — commande en retard non rapprochée.
// ------------------------------------------------------------
{
  assert.strictEqual(M.livraisonEnCoursCoherente(null, '2026-08-27'), true, 'aucune commande en cours -> rien d\'incohérent à signaler');
  assert.strictEqual(M.livraisonEnCoursCoherente('2026-08-28', '2026-08-27'), true, 'livraison prévue demain -> cohérent');
  assert.strictEqual(M.livraisonEnCoursCoherente('2026-08-25', '2026-08-27'), false, 'livraison prévue avant-hier jamais rapprochée -> incohérence réelle');
  ok('livraisonEnCoursCoherente() — signale une livraison en retard non rapprochée, jamais une simple absence de donnée');
}

// ------------------------------------------------------------
// 3) detailQualiteDonneesCommande — les 2 signaux historiques restent
//    SEULS bloquants (non_calculable), comportement v2.238 inchangé.
// ------------------------------------------------------------
{
  const r1 = M.detailQualiteDonneesCommande({ stockFiable: false, previsionConfiance: 'fiable' });
  assert.strictEqual(r1.niveau, 'non_calculable');
  const r2 = M.detailQualiteDonneesCommande({ stockFiable: true, previsionConfiance: 'non_calculable' });
  assert.strictEqual(r2.niveau, 'non_calculable');
  const r3 = M.detailQualiteDonneesCommande({ stockFiable: true, previsionConfiance: 'a_confirmer' });
  assert.strictEqual(r3.niveau, 'a_confirmer');
  ok('detailQualiteDonneesCommande — les 2 signaux historiques (stock/prévision) restent seuls bloquants, comportement v2.238 strictement inchangé');
}

// ------------------------------------------------------------
// 4) Un seul signal secondaire négatif isolé -> reste "fiable" (jamais une
//    alarme disproportionnée pour un site qui n'a simplement jamais eu
//    besoin de point zéro, exemple cité explicitement dans le code).
// ------------------------------------------------------------
{
  const r = M.detailQualiteDonneesCommande({
    stockFiable: true, previsionConfiance: 'fiable',
    jaugeageFrais: true, couvertureVentesComplete: true,
    pointZeroFiable: false, // seul signal négatif
    livraisonsCoherentes: true, anomalieMajeure: false,
  });
  assert.strictEqual(r.niveau, 'fiable');
  assert.strictEqual(r.facteurs.point_zero_fiable, false);
  ok('un seul signal secondaire négatif (ex. aucun point zéro établi) -> reste "fiable", jamais un déclassement disproportionné');
}

// ------------------------------------------------------------
// 5) Deux signaux secondaires négatifs simultanés -> déclassé en
//    "a_confirmer", avec un motif nommant précisément les 2 signaux.
// ------------------------------------------------------------
{
  const r = M.detailQualiteDonneesCommande({
    stockFiable: true, previsionConfiance: 'fiable',
    jaugeageFrais: false, couvertureVentesComplete: true,
    pointZeroFiable: true, livraisonsCoherentes: false, anomalieMajeure: false,
  });
  assert.strictEqual(r.niveau, 'a_confirmer');
  assert.ok(r.raison.includes('jaugeage ancien') && r.raison.includes('retard'), 'motif attendu : ' + r.raison);
  ok('2 signaux secondaires négatifs simultanés (jaugeage ancien + livraison en retard) -> déclassé "a_confirmer", motif nommé précisément');
}

// ------------------------------------------------------------
// 6) Une anomalie majeure détectée compte comme signal négatif — combinée
//    à un 2ᵉ signal, déclasse également.
// ------------------------------------------------------------
{
  const r = M.detailQualiteDonneesCommande({
    stockFiable: true, previsionConfiance: 'fiable',
    jaugeageFrais: true, couvertureVentesComplete: false, anomalieMajeure: true,
  });
  assert.strictEqual(r.niveau, 'a_confirmer');
  assert.ok(r.raison.includes('anomalie majeure détectée'));
  ok('anomalie majeure + ventes non couvertes en totalité -> déclassé, motif nomme l\'anomalie');
}

// ------------------------------------------------------------
// 6bis) (28/08/2026, §23 — scénario explicite de Frédéric parmi les 10
//       tests obligatoires) : "jaugeage incohérent -> confiance dégradée/
//       suspension". Contrairement aux 4 AUTRES signaux secondaires
//       (fraîcheur, couverture ventes, point zéro, cohérence livraison —
//       voir test #4 : un seul isolé ne dégrade jamais), une anomalie
//       majeure est un écart RÉELLEMENT MESURÉ (statut carburant
//       'À corriger', écart physique/théorique au-delà du seuil de
//       tolérance) : elle dégrade SEULE, sans avoir besoin d'un 2ᵉ signal
//       négatif — Frédéric distingue explicitement ce cas des signaux
//       purement cosmétiques.
// ------------------------------------------------------------
{
  const r = M.detailQualiteDonneesCommande({
    stockFiable: true, previsionConfiance: 'fiable',
    jaugeageFrais: true, couvertureVentesComplete: true, pointZeroFiable: true, livraisonsCoherentes: true,
    anomalieMajeure: true, // SEUL signal négatif ici
  });
  assert.strictEqual(r.niveau, 'a_confirmer', 'un jaugeage incohérent (anomalie majeure confirmée) dégrade la confiance À LUI SEUL, contrairement aux 4 signaux cosmétiques');
  assert.ok(r.raison.includes('anomalie majeure détectée'), 'motif attendu : ' + r.raison);
  ok('jaugeage incohérent isolé (§23) -> confiance dégradée en "a_confirmer" sans attendre un 2ᵉ signal négatif, jamais traité comme un simple détail cosmétique');
}

// ------------------------------------------------------------
// 7) Tous les signaux positifs (ou inconnus) -> "fiable", identique au
//    comportement historique quand rien n'est fourni (rétrocompatibilité
//    stricte des appelants existants qui n'envoient que stockFiable/
//    previsionConfiance).
// ------------------------------------------------------------
{
  const r = M.detailQualiteDonneesCommande({ stockFiable: true, previsionConfiance: 'fiable' });
  assert.strictEqual(r.niveau, 'fiable');
  assert.strictEqual(M.qualiteDonneesCommande({ stockFiable: true, previsionConfiance: 'fiable' }), 'fiable', 'qualiteDonneesCommande() garde EXACTEMENT le même type de retour (chaîne), aucun appelant existant cassé');
  ok('appel avec seulement les 2 signaux historiques (rétrocompatibilité stricte) -> "fiable", comme avant ce lot');
}

// ------------------------------------------------------------
// 8) evaluerCarburant() bout en bout — les signaux bruts (jaugeageOuvertureLe,
//    ventesDepuisJaugeageL, pointZeroExiste, commandeEnCoursLivraisonPrevueLe,
//    anomalieMajeure) sont bien pris en compte de bout en bout et exposés
//    sous ev.detailConfiance, sans rien changer à ev.confiance quand ils
//    ne dégradent rien.
// ------------------------------------------------------------
{
  const HISTORIQUE_GO = [
    { date: '2026-08-13', ventes: { go: 3400 } },
    { date: '2026-08-20', ventes: { go: 3600 } },
    { date: '2026-08-06', ventes: { go: 3500 } },
  ];
  const CONFIG = { cutoff_heure: '11:00', jours_livraison_iso: [1, 2, 3, 4, 5], maximum_camion_litres: 36000, minimum_camion_litres: 10000, stock_securite_jours_normal: 2, stock_securite_jours_fin_mois: 1 };
  const ev = M.evaluerCarburant({
    carburant: 'go', maintenantISO: '2026-08-27', heureMaintenantHHMM: '09:00', config: CONFIG, joursFeriesISO: [],
    stockActuelL: 13250, limiteRemplissageL: 29553, consommationMoyenneJour: 3500, historiqueParJour: HISTORIQUE_GO,
    commandeEnCoursVolumeL: 0, stockFiable: true,
    jaugeageOuvertureLe: '2026-08-27T06:15:00.000Z', ventesDepuisJaugeageL: 2690,
    pointZeroExiste: true, anomalieMajeure: false, commandeEnCoursLivraisonPrevueLe: null,
  });
  assert.ok(ev.detailConfiance, 'ev.detailConfiance doit être exposé');
  assert.strictEqual(ev.detailConfiance.facteurs.jaugeage_frais, true);
  assert.strictEqual(ev.detailConfiance.facteurs.couverture_ventes, true);
  assert.strictEqual(ev.detailConfiance.facteurs.point_zero_fiable, true);
  assert.strictEqual(ev.detailConfiance.facteurs.aucune_anomalie_majeure, true);
  assert.strictEqual(ev.detailConfiance.niveau, ev.confiance, 'ev.confiance doit toujours correspondre exactement à ev.detailConfiance.niveau');
  ok('evaluerCarburant() bout en bout — signaux bruts propagés, ev.detailConfiance exposé, ev.confiance cohérent');
}

console.log(`\n${n}/${n} tests passés.`);
