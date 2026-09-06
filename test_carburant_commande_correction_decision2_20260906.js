// Test — Correction calendrier/CTA Commande Carburant (06/09/2026)
// Lot CARBURANTS-PERFORMANCE-CORRECTION-COMMANDE-20260906, decision-2.md
// (précision canonique de Frédéric, 06/09/2026) : sépare la notion de
// JOUR COMMANDABLE (config.jours_commande_iso, nouveau, optionnel) de celle
// de JOUR DE LIVRAISON (jours_livraison_iso, inchangé) — un samedi ne doit
// plus jamais projeter un lundi comme commande directement préparable
// (audit CARBURANTS-PERFORMANCE-AUDIT-COMMANDE-20260906, cause racine D).
//
// Couvre la matrice minimale de decision-2.md et de l'audit E2/E3 :
//   1-8  calendrier (commandabilité + cutoff + fériés + livraison)
//   9-12 motif structuré de non-complétion camion + CTA
//   13   compatibilité ascendante stricte (jours_commande_iso absent)
//   14   Cockpit/Directeur (calculerCandidatCommande) respecte le CTA

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

const CONFIG = { cutoff_heure: '11:00', jours_livraison_iso: [1, 2, 3, 4, 5], jours_commande_iso: [1, 2, 3, 4, 5] };

// ------------------------------------------------------------
// 1) Mercredi 10:59 -> commandable maintenant, livraison jeudi.
// ------------------------------------------------------------
{
  const f = M.calculerFenetreLivraison({ dateCommandeISO: '2026-09-09', heureCommandeHHMM: '10:59', config: CONFIG, joursFeriesISO: [] });
  assert.strictEqual(f.commandableMaintenant, true);
  assert.strictEqual(f.motifNonCommandable, null);
  assert.strictEqual(f.dateEffective, '2026-09-09');
  assert.strictEqual(f.livraisonISO, '2026-09-10');
  ok('mercredi 10:59 -> commandable maintenant, livraison jeudi');
}

// ------------------------------------------------------------
// 2) Mercredi 11:00 / 11:01 -> cutoff dépassé, prochain créneau jeudi, livraison vendredi.
// ------------------------------------------------------------
{
  ['11:00', '11:01'].forEach(heure => {
    const f = M.calculerFenetreLivraison({ dateCommandeISO: '2026-09-09', heureCommandeHHMM: heure, config: CONFIG, joursFeriesISO: [] });
    assert.strictEqual(f.commandableMaintenant, false, `heure ${heure}`);
    assert.strictEqual(f.motifNonCommandable, 'cutoff_depasse', `heure ${heure}`);
    assert.strictEqual(f.dateEffective, '2026-09-10', `heure ${heure} -> créneau jeudi`);
    assert.strictEqual(f.livraisonISO, '2026-09-11', `heure ${heure} -> livraison vendredi`);
  });
  ok('mercredi 11:00/11:01 -> prochain créneau jeudi, livraison vendredi (jamais le jour même)');
}

// ------------------------------------------------------------
// 3) Vendredi 10:59 -> commandable, livraison lundi.
// ------------------------------------------------------------
{
  const f = M.calculerFenetreLivraison({ dateCommandeISO: '2026-09-11', heureCommandeHHMM: '10:59', config: CONFIG, joursFeriesISO: [] });
  assert.strictEqual(f.commandableMaintenant, true);
  assert.strictEqual(f.livraisonISO, '2026-09-14');
  ok('vendredi 10:59 -> commandable maintenant, livraison lundi');
}

// ------------------------------------------------------------
// 4) Vendredi 10:59 + lundi férié -> livraison mardi.
// ------------------------------------------------------------
{
  const f = M.calculerFenetreLivraison({ dateCommandeISO: '2026-09-11', heureCommandeHHMM: '10:59', config: CONFIG, joursFeriesISO: ['2026-09-14'] });
  assert.strictEqual(f.commandableMaintenant, true);
  assert.strictEqual(f.livraisonISO, '2026-09-15', 'lundi férié -> livraison mardi');
  ok('vendredi 10:59 + lundi férié -> livraison mardi');
}

// ------------------------------------------------------------
// 5) Samedi -> jamais commandable ; prochain créneau lundi, livraison mardi
//    (LA correction du bug terrain : plus jamais "samedi -> livraison
//    lundi" présenté comme une commande directement préparable).
// ------------------------------------------------------------
{
  const f = M.calculerFenetreLivraison({ dateCommandeISO: '2026-09-12', heureCommandeHHMM: '09:00', config: CONFIG, joursFeriesISO: [] });
  assert.strictEqual(f.commandableMaintenant, false);
  assert.strictEqual(f.motifNonCommandable, 'jour_non_commandable');
  assert.strictEqual(f.dateEffective, '2026-09-14', 'prochain jour de commande = lundi');
  assert.strictEqual(f.livraisonISO, '2026-09-15', 'livraison = mardi, jamais lundi');
  ok('samedi -> non commandable, prochain créneau lundi, livraison mardi (correction du bug terrain Sainte-Marie)');
}

// ------------------------------------------------------------
// 6) Samedi + lundi férié -> prochain créneau mardi, livraison mercredi.
// ------------------------------------------------------------
{
  const f = M.calculerFenetreLivraison({ dateCommandeISO: '2026-09-12', heureCommandeHHMM: '09:00', config: CONFIG, joursFeriesISO: ['2026-09-14'] });
  assert.strictEqual(f.commandableMaintenant, false);
  assert.strictEqual(f.dateEffective, '2026-09-15', 'prochain jour de commande = mardi (lundi férié)');
  assert.strictEqual(f.livraisonISO, '2026-09-16', 'livraison = mercredi');
  ok('samedi + lundi férié -> prochain créneau mardi, livraison mercredi');
}

// ------------------------------------------------------------
// 7) Jour férié en semaine -> jamais commandable ce jour-là, même avant cutoff.
// ------------------------------------------------------------
{
  const f = M.calculerFenetreLivraison({ dateCommandeISO: '2026-09-10', heureCommandeHHMM: '09:00', config: CONFIG, joursFeriesISO: ['2026-09-10'] });
  assert.strictEqual(f.commandableMaintenant, false);
  assert.strictEqual(f.motifNonCommandable, 'jour_non_commandable');
  assert.notStrictEqual(f.dateEffective, '2026-09-10');
  ok('jeudi férié -> jamais commandable ce jour-là, même avant cutoff');
}

// ------------------------------------------------------------
// 8) Aucune heure de livraison fixe inventée — la fenêtre ne porte qu'une
//    DATE ISO de livraison (`livraisonISO`), jamais un horodatage/heure.
// ------------------------------------------------------------
{
  const f = M.calculerFenetreLivraison({ dateCommandeISO: '2026-09-09', heureCommandeHHMM: '09:00', config: CONFIG, joursFeriesISO: [] });
  assert.strictEqual(typeof f.livraisonISO, 'string');
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(f.livraisonISO), 'livraisonISO est une date pure (YYYY-MM-DD), jamais une heure fournisseur');
  assert.strictEqual(Object.prototype.hasOwnProperty.call(f, 'heureLivraison'), false);
  ok('aucune heure de livraison fixe inventée — livraisonISO reste une date pure');
}

// ------------------------------------------------------------
// 9/10) Motif structuré de non-complétion camion (audit E2) — capacité
// insuffisante et plafond anti-surstock, en mode "camion complet".
// ------------------------------------------------------------
{
  // SP95 : capacité disponible tout juste sous la cible, GO : suffisamment
  // de capacité mais son plafond anti-surstock (autonomie) est déjà atteint.
  const parCarburant = {
    sp95: { etat: 'securite', besoinMinimumSecuriteL: 22000, joursAvantBesoin: 0, consommationMoyenneJour: 3000, stockPrevuLivraisonL: 1000 },
    go: { etat: 'securite', besoinMinimumSecuriteL: 8000, joursAvantBesoin: 0, consommationMoyenneJour: 500, stockPrevuLivraisonL: 9500 },
  };
  const capacitesDisponiblesL = { sp95: 22171, go: 15000 };
  const optim = M.optimiserCommandeMultiCarburant({
    parCarburant, minimumCamionL: 10000, maximumCamionL: 36000, capacitesDisponiblesL, viserCamionComplet: true,
  });
  assert.strictEqual(optim.decision, 'commander');
  assert.ok(optim.total < 36000, 'le camion ne complète jamais au-delà de ce que les garde-fous autorisent : ' + optim.total);
  assert.strictEqual(optim.motifsNonCompletion.sp95, 'capacite_insuffisante', 'SP95 plafonné par la capacité physique disponible');
  // GO : autonomie max 20 j * 500 L/j = 10 000 L, déjà 9 500 L prévus à la
  // livraison -> plafond anti-surstock atteint à 500 L près, bien avant sa
  // capacité disponible de 15 000 L.
  assert.strictEqual(optim.motifsNonCompletion.go, 'plafond_anti_surstock', 'GO plafonné par l\'autonomie anti-surstock, pas par la capacité');
  ok('audit E2 — motif structuré de non-complétion (capacité SP95 insuffisante, plafond anti-surstock GO), jamais recalculé côté écran');
}

// ------------------------------------------------------------
// 11) Camion réellement complété à 36 000 L, créneau commandable, aucun
//     arbitrage résiduel -> CTA "préparer".
// ------------------------------------------------------------
{
  const evaluationGlobale = {
    commandeRecommandee: { volumes: { sp95: 20000, go: 16000 }, total: 36000 },
    commandableMaintenant: true,
    optimisation: { decision: 'commander', motifsNonCompletion: {} },
  };
  const cta = M.determinerCtaCommande(evaluationGlobale);
  assert.strictEqual(cta.action, 'preparer');
  assert.strictEqual(cta.motif, null);
  ok('36 000 L atteignable + créneau commandable + aucun arbitrage -> CTA préparation');
}

// ------------------------------------------------------------
// 12) Camion complet mais créneau non commandable (ex. samedi) -> CTA "simuler".
// ------------------------------------------------------------
{
  const evaluationGlobale = {
    commandeRecommandee: { volumes: { sp95: 20000, go: 16000 }, total: 36000 },
    commandableMaintenant: false,
    optimisation: { decision: 'commander', motifsNonCompletion: {} },
  };
  const cta = M.determinerCtaCommande(evaluationGlobale);
  assert.strictEqual(cta.action, 'simuler');
  assert.strictEqual(cta.motif, 'creneau_non_commandable');
  ok('camion complet mais créneau non commandable -> CTA simulation');
}

// Motif d'arbitrage quantité (35 000 L au lieu de 36 000 L) -> CTA "simuler"
// même quand le créneau lui-même est commandable.
{
  const evaluationGlobale = {
    commandeRecommandee: { volumes: { sp95: 22000, go: 13000 }, total: 35000 },
    commandableMaintenant: true,
    optimisation: { decision: 'commander', motifsNonCompletion: { sp95: 'capacite_insuffisante' } },
  };
  const cta = M.determinerCtaCommande(evaluationGlobale);
  assert.strictEqual(cta.action, 'simuler');
  assert.strictEqual(cta.motif, 'arbitrage_quantite');
  ok('35 000 L (arbitrage quantité résiduel) malgré créneau commandable -> CTA simulation');
}

// ------------------------------------------------------------
// 13) Compatibilité ascendante STRICTE — `jours_commande_iso` absent :
//     comportement identique à l'ancienne formule (aucun site existant
//     affecté par ce lot), y compris pour un samedi.
// ------------------------------------------------------------
{
  const configSansCommandabilite = { cutoff_heure: '11:00', jours_livraison_iso: [1, 2, 3, 4, 5] };
  const f = M.calculerFenetreLivraison({ dateCommandeISO: '2026-09-12', heureCommandeHHMM: '09:00', config: configSansCommandabilite, joursFeriesISO: [] });
  assert.strictEqual(f.commandableMaintenant, null, 'commandabilité non configurée -> null, jamais false par défaut');
  assert.strictEqual(f.motifNonCommandable, null);
  assert.strictEqual(f.dateEffective, '2026-09-12', 'comportement historique : samedi reste la date effective de commande');
  assert.strictEqual(f.livraisonISO, '2026-09-14', 'comportement historique inchangé : livraison lundi (ancien calcul, non corrigé pour ce site)');
  ok('compatibilité ascendante — jours_commande_iso absent : formule historique strictement inchangée, y compris samedi->lundi');
}

// ------------------------------------------------------------
// 14) Cockpit/Directeur (calculerCandidatCommande) — jamais "Préparez" quand
//     le CTA structuré vaut "simuler" (aucun second calcul métier côté Cockpit).
// ------------------------------------------------------------
{
  const evaluationSimuler = {
    ok: true, dateISO: '2026-09-12', etatGlobal: 'securite',
    parCarburant: { sp95: { carburant: 'sp95', etat: 'securite', confiance: 'fiable', scenarioMaintenant: { margeJours: -0.5 }, attente: { motif: 'x' } } },
    optimisation: { decision: 'commander', motif: null },
    commandeRecommandee: { volumes: { sp95: 14000 }, total: 14000 },
    commandableMaintenant: false,
    cta: { action: 'simuler', motif: 'creneau_non_commandable' },
  };
  const cSimuler = M.calculerCandidatCommande(evaluationSimuler);
  assert.ok(cSimuler.decision.toLowerCase().includes('simulez'), 'CTA simuler -> jamais "Préparez" : ' + cSimuler.decision);
  assert.ok(!cSimuler.decision.toLowerCase().includes('préparez'), cSimuler.decision);

  const evaluationPreparer = { ...evaluationSimuler, commandableMaintenant: true, cta: { action: 'preparer', motif: null } };
  const cPreparer = M.calculerCandidatCommande(evaluationPreparer);
  assert.ok(cPreparer.decision.toLowerCase().includes('préparez'), cPreparer.decision);

  // Appelant historique qui ne fournit pas `cta` (rétrocompatibilité stricte,
  // voir test_carburant_commande_notification_v2239.js) -> libellé d'origine.
  const evaluationSansCta = { ...evaluationSimuler, cta: undefined };
  const cSansCta = M.calculerCandidatCommande(evaluationSansCta);
  assert.ok(cSansCta.decision.toLowerCase().includes('préparez'), cSansCta.decision);

  ok('Cockpit/Directeur (calculerCandidatCommande) — jamais "Préparez" si ctaCommande.action === "simuler", relit le même état, aucun second calcul');
}

console.log(`\n${n}/${n} tests passés — Correction calendrier/CTA Commande Carburant (decision-2.md, 06/09/2026).`);
