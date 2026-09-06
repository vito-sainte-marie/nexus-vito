// Test — Correction minimale Commande Carburant (nexus-carburant-commande-
// moteur.js), 06/09/2026, lot CARBURANTS-PERFORMANCE-CORRECTION-COMMANDE-
// 20260906 (décision `18a89d598c352ab64bb36f8f474b93ea0df6fef6`, conditions
// 1 à 8 : créneau réellement commandable configurable, jamais un
// `if (samedi)` en dur, motif structuré de non-complétion du camion, état
// CTA structuré). Couvre au minimum les cas 1 à 6 de la matrice de recette
// `docs/handoff/lots/CARBURANTS-PERFORMANCE-AUDIT-COMMANDE-20260906/
// audit-1.md` qui portent sur ce périmètre (les cas stock/jaugeage/ventes/
// réserve/réception/fiabilité/garde site restent hors périmètre — condition
// 10, non touchés par ce lot, déjà couverts par test_carburant_commande_
// moteur_v2238.js et consorts).

const path = require('path');
const vm = require('vm');
const fs = require('fs');
const assert = require('assert');

const code = fs.readFileSync(path.join(__dirname, 'nexus-carburant-commande-moteur.js'), 'utf8');
const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const M = sandbox.NexusCarburantCommandeMoteur;

let n = 0;
function ok(label) { n++; console.log('OK —', label); }

// Config nexus-station-test (audit-1.md, section A) — AUCUN `jours_commande_iso`
// : sert à prouver la compatibilité ascendante (condition 3).
const CONFIG_SANS_COMMANDE_ISO = {
  cutoff_heure: '11:00',
  jours_livraison_iso: [1, 2, 3, 4, 5],
  minimum_camion_litres: 3000,
  maximum_camion_litres: 36000,
};

// Config Sainte-Marie/Test — ligne de commande fournisseur fermée le week-end
// (§ audit-1.md, point non prouvé : jamais un `if (samedi)` en dur, ici
// exprimé uniquement par la configuration).
const CONFIG_SAINTE_MARIE = {
  ...CONFIG_SANS_COMMANDE_ISO,
  jours_commande_iso: [1, 2, 3, 4, 5],
};

// ------------------------------------------------------------
// 1) Rétrocompatibilité (condition 3) — sans `jours_commande_iso`, le
//    comportement historique est strictement inchangé : un samedi propose
//    toujours lundi, marqué `commandeDirecte: true` (aucune régression pour
//    les sites qui n'ont pas encore ce champ).
// ------------------------------------------------------------
{
  const fenetre = M.calculerFenetreLivraison({
    dateCommandeISO: '2026-08-22', heureCommandeHHMM: '09:00', config: CONFIG_SANS_COMMANDE_ISO, joursFeriesISO: [],
  });
  assert.strictEqual(fenetre.livraisonISO, '2026-08-24', 'sans jours_commande_iso, samedi -> lundi reste inchangé (legacy)');
  assert.strictEqual(fenetre.commandeDirecte, true, 'sans restriction configurée, le créneau reste "directement commandable" (legacy)');
  ok('rétrocompatibilité — sans jours_commande_iso, comportement historique strictement inchangé (condition 3)');
}

// ------------------------------------------------------------
// 2) Samedi, ligne de commande fermée (Sainte-Marie/Test) — lundi ne doit
//    JAMAIS être présenté comme une commande directement préparée (cas 4 de
//    la matrice audit-1.md).
// ------------------------------------------------------------
{
  const fenetre = M.calculerFenetreLivraison({
    dateCommandeISO: '2026-08-22', heureCommandeHHMM: '09:00', config: CONFIG_SAINTE_MARIE, joursFeriesISO: [],
  });
  assert.strictEqual(fenetre.dateSouhaiteeISO, '2026-08-22', 'la tentative de commande a bien lieu samedi');
  assert.strictEqual(fenetre.dateEffective, '2026-08-24', 'le créneau de commande n\'est réellement ouvert que lundi (jours_commande_iso)');
  assert.strictEqual(fenetre.commandeDirecte, false, 'samedi n\'est pas un jour de commande possible -> jamais "directement commandable"');
  assert.strictEqual(fenetre.livraisonISO, '2026-08-25', 'la livraison bascule sur mardi, jamais lundi, une fois la commande réellement déposable lundi');
  assert.notStrictEqual(fenetre.livraisonISO, '2026-08-24', 'lundi ne doit jamais rester le créneau proposé pour une tentative de commande samedi');
  ok('samedi -> ligne de commande fermée : lundi n\'est plus jamais présenté comme directement préparable (cas 4 audit-1.md)');
}

// ------------------------------------------------------------
// 3) Vendredi avant cutoff, ligne de commande ouverte — lundi reste accepté
//    directement quand le paramétrage fournisseur le permet (cas 5).
// ------------------------------------------------------------
{
  const fenetre = M.calculerFenetreLivraison({
    dateCommandeISO: '2026-08-21', heureCommandeHHMM: '09:30', config: CONFIG_SAINTE_MARIE, joursFeriesISO: [],
  });
  assert.strictEqual(fenetre.commandeDirecte, true, 'vendredi est un jour de commande possible -> directement commandable');
  assert.strictEqual(fenetre.livraisonISO, '2026-08-24', 'lundi reste accepté comme livraison quand le calendrier fournisseur le permet');
  ok('vendredi avant cutoff, ligne de commande ouverte -> lundi accepté directement (cas 5 audit-1.md)');
}

// ------------------------------------------------------------
// 4) Vendredi après cutoff, ligne de commande fermée le week-end — créneau
//    suivant recalculé, jamais lundi (cas 6).
// ------------------------------------------------------------
{
  const fenetre = M.calculerFenetreLivraison({
    dateCommandeISO: '2026-08-21', heureCommandeHHMM: '14:00', config: CONFIG_SAINTE_MARIE, joursFeriesISO: [],
  });
  assert.strictEqual(fenetre.avantCutoff, false);
  assert.strictEqual(fenetre.dateSouhaiteeISO, '2026-08-22', 'après cutoff, la tentative de commande glisse au samedi');
  assert.strictEqual(fenetre.commandeDirecte, false, 'samedi n\'est toujours pas un jour de commande possible');
  assert.strictEqual(fenetre.livraisonISO, '2026-08-25', 'créneau suivant recalculé (mardi), jamais lundi');
  ok('vendredi après cutoff, ligne de commande fermée le week-end -> créneau suivant recalculé, jamais lundi (cas 6 audit-1.md)');
}

// ------------------------------------------------------------
// 5) Jour férié combiné à jours_commande_iso — aucune régression, le report
//    de jour férié continue de fonctionner (cas 7).
// ------------------------------------------------------------
{
  const fenetre = M.calculerFenetreLivraison({
    dateCommandeISO: '2026-08-21', heureCommandeHHMM: '09:00', config: CONFIG_SAINTE_MARIE, joursFeriesISO: ['2026-08-24'],
  });
  assert.strictEqual(fenetre.commandeDirecte, true, 'vendredi reste un jour de commande possible malgré le jour férié à venir');
  assert.strictEqual(fenetre.livraisonISO, '2026-08-25', 'lundi férié -> report mardi, jours_commande_iso ne casse pas le report de jour férié');
  ok('jour férié + jours_commande_iso combinés -> aucune régression du report de jour férié (cas 7 audit-1.md)');
}

// ------------------------------------------------------------
// 6) estJourCommandePossible / premierJourCommandePossibleAPartirDe — unités
//    isolées, jamais un if(samedi) en dur : uniquement pilotées par la
//    config (condition 2).
// ------------------------------------------------------------
{
  assert.strictEqual(M.estJourCommandePossible('2026-08-22', CONFIG_SANS_COMMANDE_ISO), true, 'sans config, tout jour reste commandable');
  assert.strictEqual(M.estJourCommandePossible('2026-08-22', CONFIG_SAINTE_MARIE), false, 'samedi fermé uniquement parce que la config le dit');
  assert.strictEqual(M.premierJourCommandePossibleAPartirDe('2026-08-22', CONFIG_SAINTE_MARIE), '2026-08-24');
  assert.strictEqual(M.premierJourCommandePossibleAPartirDe('2026-08-21', CONFIG_SAINTE_MARIE), '2026-08-21', 'un jour déjà commandable reste inchangé (inclusif)');
  ok('estJourCommandePossible/premierJourCommandePossibleAPartirDe — pilotés uniquement par la config, jamais un if(samedi) en dur (condition 2)');
}

// ------------------------------------------------------------
// 7) Motif structuré de non-complétion — cas réel terrain (06/09/2026) :
//    22 000 L SP95 (plafonné par la capacité disponible) + 13 000 L GO
//    (plafonné par le plafond anti-surstock) = 35 000 L, jamais 36 000 L
//    forcé (condition 1/5, cas 2 et 3 de la matrice audit-1.md).
// ------------------------------------------------------------
{
  const optim = M.optimiserCommandeMultiCarburant({
    parCarburant: {
      sp95: { etat: 'securite', besoinMinimumSecuriteL: 20000, joursAvantBesoin: 0, consommationMoyenneJour: 2000, stockPrevuLivraisonL: 3000 },
      go: { etat: 'securite', besoinMinimumSecuriteL: 13000, joursAvantBesoin: 0, consommationMoyenneJour: 500, stockPrevuLivraisonL: 9500 },
    },
    minimumCamionL: 3000,
    maximumCamionL: 36000,
    capacitesDisponiblesL: { sp95: 22000, go: 20000 },
    viserCamionComplet: true,
  });
  assert.strictEqual(optim.decision, 'commander');
  assert.strictEqual(optim.total, 35000, 'jamais 36 000 L forcé au prix des garde-fous (condition 1)');
  assert.ok(optim.carburantsLimitants && optim.carburantsLimitants.length === 2, 'les deux carburants restent identifiés comme limitants');
  const causes = optim.carburantsLimitants.reduce((acc, x) => { acc[x.carburant] = x.cause; return acc; }, {});
  assert.strictEqual(causes.sp95, 'CAPACITE_PHYSIQUE', 'sp95 est plafonné par la capacité disponible, pas par l\'autonomie');
  assert.strictEqual(causes.go, 'PLAFOND_ANTI_SURSTOCK', 'go est plafonné par le plafond anti-surstock, pas par la capacité');
  ok('optimiserCommandeMultiCarburant — 35 000 L expliqué par deux causes distinctes, jamais un second calcul dupliqué (condition 1/5)');

  const global_ = M.construireEvaluationGlobale({
    evaluationsParCarburant: {
      sp95: { etat: 'securite', besoinMinimumSecuriteL: 20000, joursAvantBesoin: 0, consommationMoyenneJour: 2000, scenarioMaintenant: { margeJours: 2, stockPrevuLivraisonL: 3000, commandeDirecte: true } },
      go: { etat: 'securite', besoinMinimumSecuriteL: 13000, joursAvantBesoin: 0, consommationMoyenneJour: 500, scenarioMaintenant: { margeJours: 2, stockPrevuLivraisonL: 9500, commandeDirecte: true } },
    },
    config: { minimum_camion_litres: 3000, maximum_camion_litres: 36000 },
    capacitesDisponiblesL: { sp95: 22000, go: 20000 },
    viserCamionComplet: true,
  });
  assert.strictEqual(global_.commandeRecommandee.total, 35000);
  assert.ok(global_.motifCamionIncomplet, 'un motif structuré doit exister dès que le camion n\'atteint pas le maximum (E2)');
  assert.strictEqual(global_.motifCamionIncomplet.code, 'PLAFONDS_MULTIPLES', 'deux causes distinctes -> code agrégé explicite');
  assert.ok(/sp95/.test(global_.motifCamionIncomplet.detail) && /go/.test(global_.motifCamionIncomplet.detail), 'le détail nomme les deux carburants concernés');
  assert.strictEqual(global_.ctaCommande.action, 'simuler', 'camion non complet -> CTA Simuler, jamais Préparer affirmatif (condition 4/E3)');
  ok('construireEvaluationGlobale — motifCamionIncomplet + ctaCommande cohérents sur le cas terrain 35 000 L (condition 3/4, E2/E3)');
}

// ------------------------------------------------------------
// 8) Mode "minimum seulement" (fin de mois, viserCamionComplet=false) — le
//    motif distingue explicitement ce régime d'un camion réellement plafonné.
// ------------------------------------------------------------
{
  const global_ = M.construireEvaluationGlobale({
    evaluationsParCarburant: {
      sp95: { etat: 'securite', besoinMinimumSecuriteL: 12000, joursAvantBesoin: 0, consommationMoyenneJour: 1200, scenarioMaintenant: { margeJours: 2, commandeDirecte: true } },
    },
    config: { minimum_camion_litres: 3000, maximum_camion_litres: 36000 },
    capacitesDisponiblesL: { sp95: 28000 },
    viserCamionComplet: false,
  });
  assert.ok(global_.commandeRecommandee.total < 36000);
  assert.strictEqual(global_.motifCamionIncomplet.code, 'MODE_MINIMUM_SEULEMENT', 'hors mode normal du mois, le motif ne doit jamais laisser croire à un plafond physique atteint');
  assert.strictEqual(global_.ctaCommande.action, 'simuler', 'camion non complet -> CTA Simuler même en mode minimum seulement');
  ok('mode minimum seulement (fin de mois) — motif distinct d\'un plafond réellement atteint');
}

// ------------------------------------------------------------
// 9) CTA — camion complet ET créneau directement commandable -> "Préparer
//    ma commande" (condition 4/6, seul cas où le CTA affirmatif est permis).
// ------------------------------------------------------------
{
  const global_ = M.construireEvaluationGlobale({
    evaluationsParCarburant: {
      sp95: { etat: 'securite', besoinMinimumSecuriteL: 36000, joursAvantBesoin: 0, consommationMoyenneJour: 3600, scenarioMaintenant: { margeJours: 2, commandeDirecte: true } },
    },
    config: { minimum_camion_litres: 3000, maximum_camion_litres: 36000 },
    capacitesDisponiblesL: { sp95: 40000 },
    viserCamionComplet: true,
  });
  assert.strictEqual(global_.commandeRecommandee.total, 36000, 'prémisse du test : camion plein');
  assert.strictEqual(global_.motifCamionIncomplet, null, 'camion plein -> rien à expliquer');
  assert.strictEqual(global_.ctaCommande.action, 'preparer', 'camion plein + créneau directement commandable -> CTA Préparer');
  ok('CTA — camion plein et créneau directement commandable -> "Préparer ma commande" (condition 4/6)');
}

// ------------------------------------------------------------
// 10) CTA — camion complet MAIS créneau pas directement commandable
//     (ex. samedi/Sainte-Marie) -> "Simuler ma commande", jamais Préparer,
//     même si la quantité, elle, est déjà optimale (condition 4/6, E3).
// ------------------------------------------------------------
{
  const global_ = M.construireEvaluationGlobale({
    evaluationsParCarburant: {
      sp95: { etat: 'securite', besoinMinimumSecuriteL: 36000, joursAvantBesoin: 0, consommationMoyenneJour: 3600, scenarioMaintenant: { margeJours: 2, commandeDirecte: false } },
    },
    config: { minimum_camion_litres: 3000, maximum_camion_litres: 36000 },
    capacitesDisponiblesL: { sp95: 40000 },
    viserCamionComplet: true,
  });
  assert.strictEqual(global_.commandeRecommandee.total, 36000, 'prémisse du test : camion plein');
  assert.strictEqual(global_.ctaCommande.action, 'simuler', 'créneau non directement commandable -> jamais "Préparer ma commande", même camion plein');
  ok('CTA — camion plein mais créneau non directement commandable -> "Simuler ma commande" (condition 4/6, E3)');
}

// ------------------------------------------------------------
// 11) CTA — aucune commande recommandée -> action "aucune" (jamais de CTA
//     affiché sans recommandation).
// ------------------------------------------------------------
{
  const global_ = M.construireEvaluationGlobale({
    evaluationsParCarburant: {
      sp95: { etat: 'confortable', besoinMinimumSecuriteL: 0, joursAvantBesoin: 10 },
    },
    config: { minimum_camion_litres: 3000, maximum_camion_litres: 36000 },
    capacitesDisponiblesL: { sp95: 28000 },
  });
  assert.strictEqual(global_.commandeRecommandee, null);
  assert.strictEqual(global_.motifCamionIncomplet, null);
  assert.strictEqual(global_.ctaCommande.action, 'aucune');
  ok('CTA — aucune commande recommandée -> action "aucune"');
}

// ------------------------------------------------------------
// 12) Non-régression — construireEvaluationGlobale reste rejouable à
//     l'identique (même discipline que test_carburant_commande_moteur_v2238,
//     bloc "calcul rejoué deux fois").
// ------------------------------------------------------------
{
  const inputRejoue = {
    evaluationsParCarburant: {
      sp95: { etat: 'securite', besoinMinimumSecuriteL: 20000, joursAvantBesoin: 0, consommationMoyenneJour: 2000, scenarioMaintenant: { margeJours: 2, commandeDirecte: true } },
    },
    config: { minimum_camion_litres: 3000, maximum_camion_litres: 36000 },
    capacitesDisponiblesL: { sp95: 22000 },
    viserCamionComplet: true,
  };
  const rejoue1 = M.construireEvaluationGlobale(JSON.parse(JSON.stringify(inputRejoue)));
  const rejoue2 = M.construireEvaluationGlobale(JSON.parse(JSON.stringify(inputRejoue)));
  assert.deepStrictEqual(rejoue1, rejoue2, 'un calcul rejoué à l\'identique doit produire exactement le même résultat, motif/CTA inclus');
  ok('non-régression — motifCamionIncomplet/ctaCommande rejouables à l\'identique, aucune dérive');
}

console.log(`\n${n} bloc(s) de test — Correction minimale Commande Carburant (creneau commandable / motif / CTA) OK.`);
