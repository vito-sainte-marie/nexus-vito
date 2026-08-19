// Production journalière & Mouvements (cahier "Audit Inventaire - Production,
// mouvements & réceptions", 18/08/2026) — tests des FONDATIONS livrées dans
// ce lot : moteur de recommandation (M2), calcul pâtisserie (M5), registre
// unique des types de mouvement + actions contextuelles par profil (M3/M8).
// L'écriture Supabase (nexus-inventaire-production-donnees.js) n'est pas
// testée ici (nécessite un client réseau) -- couverte par vérification
// manuelle contre le schéma réel (voir Data Dictionary).
//
// Exécution : node test_inventaire_production_journaliere_fondations.js

const path = require('path');
global.window = global;
require(path.join(__dirname, 'nexus-inventaire-moteur.js'));
const M = global.NexusInventaireMoteur;

let total = 0, ok = 0;
function assert(label, condition) {
  total++;
  if (condition) { ok++; console.log(`OK   - ${label}`); }
  else { console.log(`FAIL - ${label}`); }
}

// ------------------------------------------------------------
// 1) contexteCalendaireJour / libelleContexteJour
// ------------------------------------------------------------
assert('2026-08-22 (samedi) -> samedi', M.contexteCalendaireJour('2026-08-22') === 'samedi');
assert('2026-08-23 (dimanche) -> dimanche', M.contexteCalendaireJour('2026-08-23') === 'dimanche');
assert('2026-08-18 (mardi) -> semaine', M.contexteCalendaireJour('2026-08-18') === 'semaine');
assert('Libellé samedi', M.libelleContexteJour('samedi') === 'Samedi');
assert('Libellé contexte inconnu -> repli semaine', M.libelleContexteJour('xyz') === 'Jour de semaine');

// ------------------------------------------------------------
// 2) calculerRecommandationPreparation — priorité §4.1
// ------------------------------------------------------------
const regle = { id: 'r1', valeur_semaine: 8, valeur_samedi: 12, valeur_dimanche: 10, valeur_vacances: 10 };

{
  const r = M.calculerRecommandationPreparation({ dateISO: '2026-08-18', regle, valeurSpeciale: null, jourCalendrierSite: null });
  assert('Priorité 4 — mardi normal => semaine=8', r.contexte === 'semaine' && r.quantiteConseillee === 8);
}
{
  const r = M.calculerRecommandationPreparation({ dateISO: '2026-08-22', regle, valeurSpeciale: null, jourCalendrierSite: null });
  assert('Priorité 3 — samedi => 12', r.contexte === 'samedi' && r.quantiteConseillee === 12);
}
{
  const r = M.calculerRecommandationPreparation({ dateISO: '2026-08-23', regle, valeurSpeciale: null, jourCalendrierSite: null });
  assert('Priorité 3 — dimanche => 10', r.contexte === 'dimanche' && r.quantiteConseillee === 10);
}
{
  const r = M.calculerRecommandationPreparation({ dateISO: '2026-08-18', regle, valeurSpeciale: null, jourCalendrierSite: { type: 'vacances' } });
  assert('Priorité 2 — vacances prioritaire sur semaine => 10', r.contexte === 'vacances' && r.quantiteConseillee === 10);
}
{
  const r = M.calculerRecommandationPreparation({ dateISO: '2026-08-22', regle, valeurSpeciale: null, jourCalendrierSite: { type: 'ferie' } });
  assert('Priorité 2 — férié prioritaire sur week-end => contexte ferie, valeur_vacances', r.contexte === 'ferie' && r.quantiteConseillee === 10);
}
{
  const r = M.calculerRecommandationPreparation({ dateISO: '2026-08-18', regle, valeurSpeciale: { valeur: 14 }, jourCalendrierSite: { type: 'vacances' } });
  assert('Priorité 1 — valeur spéciale prioritaire sur tout => 14', r.contexte === 'special' && r.quantiteConseillee === 14);
}
{
  const r = M.calculerRecommandationPreparation({ dateISO: '2026-08-18', regle: null, valeurSpeciale: null, jourCalendrierSite: null });
  assert('Pas de règle configurée => null, jamais 0 fabriqué (Article 5)', r.quantiteConseillee === null && r.regleId === null);
}
{
  const regleIncomplete = { id: 'r2', valeur_semaine: 8 }; // pas de valeur_samedi
  const r = M.calculerRecommandationPreparation({ dateISO: '2026-08-22', regle: regleIncomplete, valeurSpeciale: null, jourCalendrierSite: null });
  assert('Règle partielle — samedi non configuré => null, pas 0', r.contexte === 'samedi' && r.quantiteConseillee === null);
}

// ------------------------------------------------------------
// 3) resteDepasseSeuilSurveillance
// ------------------------------------------------------------
assert('Reste 5 > seuil 3 => true', M.resteDepasseSeuilSurveillance(5, 3) === true);
assert('Reste 2 <= seuil 3 => false', M.resteDepasseSeuilSurveillance(2, 3) === false);
assert('Reste null => null (jamais un jugement sur donnée absente)', M.resteDepasseSeuilSurveillance(null, 3) === null);
assert('Seuil non configuré => null', M.resteDepasseSeuilSurveillance(5, null) === null);

// ------------------------------------------------------------
// 4) syntheseProductionJournee — reproduit l'exemple exact du cahier (§10)
// ------------------------------------------------------------
{
  const s = M.syntheseProductionJournee({
    prepInitiale: 12, fourneesQ1: [{ quantite: 6 }], resteFinQ1: 5,
    fourneesQ2: [{ quantite: 4 }], resteFinal: 2, retraitsTraces: 0,
  });
  assert('§10 — disponibleQ1 = 18', s.disponibleQ1 === 18);
  assert('§10 — ecoulementQ1 = 13', s.ecoulementQ1 === 13);
  assert('§10 — disponibleQ2 = 9 (reste Q1 transmis + fournée)', s.disponibleQ2 === 9);
  assert('§10 — ecoulementQ2 = 7', s.ecoulementQ2 === 7);
  assert('§10 — productionTotale = 22', s.productionTotale === 22);
  assert('§10 — ecoulementJournee = 20', s.ecoulementJournee === 20);
  assert('§10 — 2 fournées supplémentaires comptées', s.nbFourneesSupplementaires === 2);
}
{
  // Pas encore de reste connu (quart en cours) => écoulement doit rester
  // null, jamais un faux écart avant clôture réelle (Article 5).
  const s = M.syntheseProductionJournee({ prepInitiale: 8, fourneesQ1: [], resteFinQ1: undefined, fourneesQ2: [], resteFinal: undefined, retraitsTraces: 0 });
  assert('Quart en cours — ecoulementQ1 reste null tant que le reste n\'est pas compté', s.ecoulementQ1 === null);
  assert('Quart en cours — ecoulementJournee reste null', s.ecoulementJournee === null);
}
{
  // Aucune préparation initiale connue (produit_id mal formé, cas
  // dégénéré) => tout reste null plutôt qu'un calcul sur une base fausse.
  const s = M.syntheseProductionJournee({ prepInitiale: null, fourneesQ1: [], resteFinQ1: 3, fourneesQ2: [], resteFinal: 1, retraitsTraces: 0 });
  assert('Pas de préparation initiale connue => disponibleQ1 null', s.disponibleQ1 === null);
  assert('Pas de préparation initiale connue => productionTotale null', s.productionTotale === null);
}

// ------------------------------------------------------------
// 5) Registre des types de mouvement (§8, §8.1, §11.1)
// ------------------------------------------------------------
assert('9 types de mouvement enregistrés', M.TYPES_MOUVEMENT.length === 9);
assert('Libellé livraison', M.libelleTypeMouvement('livraison') === 'Marchandise reçue');
assert('Libellé type inconnu => repli générique', M.libelleTypeMouvement('xyz') === 'Mouvement');
assert('§8.1 — transfert n\'impacte jamais le stock global', M.mouvementImpacteStockGlobal('transfert') === false);
assert('§8.1 — livraison impacte le stock global', M.mouvementImpacteStockGlobal('livraison') === true);
assert('§8.1 — production_initiale impacte le stock global', M.mouvementImpacteStockGlobal('production_initiale') === true);
assert('§8.1 — production_additionnelle impacte le stock global', M.mouvementImpacteStockGlobal('production_additionnelle') === true);
assert('Type inconnu => impact global par défaut (prudence, jamais un faux neutre)', M.mouvementImpacteStockGlobal('xyz') === true);

// ------------------------------------------------------------
// 6) actionsMouvementPourProfil (§5) — MOV-09 "choix uniquement contextuels"
// ------------------------------------------------------------
{
  const actions = M.actionsMouvementPourProfil('production_journaliere').map(a => a.value);
  assert('Production journalière — a Nouvelle fournée', actions.includes('production_additionnelle'));
  assert('Production journalière — a retrait/retour/casse', actions.includes('retrait') && actions.includes('retour') && actions.includes('casse'));
  assert('Production journalière — PAS de réception (§5, produit non reçu, produit)', !actions.includes('livraison'));
  assert('Production journalière — PAS de production_initiale (créée par le parcours Q1, pas ce bouton)', !actions.includes('production_initiale'));
}
{
  const actions = M.actionsMouvementPourProfil('continu').map(a => a.value);
  assert('Stock continu — a réception/casse/retour/transfert (§5)', ['livraison', 'casse', 'retour', 'transfert'].every(v => actions.includes(v)));
  assert('Stock continu — PAS de nouvelle fournée', !actions.includes('production_additionnelle'));
}
{
  const actions = M.actionsMouvementPourProfil('consommable').map(a => a.value);
  assert('Consommable — réception + retrait interne (§5)', actions.includes('livraison') && actions.includes('retrait'));
  assert('Consommable — pas de casse (hors périmètre §5)', !actions.includes('casse'));
}
{
  const actions = M.actionsMouvementPourProfil('profil_inconnu_futur').map(a => a.value);
  assert('Profil non reconnu => repli sur le comportement continu (jamais un bouton bloqué)', actions.includes('livraison') && actions.includes('transfert'));
}

// ------------------------------------------------------------
// 7) Régression stricte — fonctions Sprint 1-8 Inventaire 2.0 inchangées
// ------------------------------------------------------------
{
  const plan = M.construirePlanComptage({
    produits: [{ id: 'p1', actif: true }], reglesParProduit: {}, dernierControleParProduit: {},
    produitsAvecAnomalieRecente: [], quart: 'matin', dateISO: '2026-08-18', socleCible: 5, surprisesCible: 0, seed: 'x',
    surprisesRecentesParProduit: [],
  });
  assert('Régression — construirePlanComptage toujours fonctionnel', Array.isArray(plan.items));
}
{
  const r = M.couverturePhysique({ produitsActifs: [{ id: 'p1' }], dernierControleParProduit: {}, dateISO: '2026-08-18', fenetreJours: 7 });
  assert('Régression — couverturePhysique toujours fonctionnel', r.total === 1);
}

console.log(`\n${ok}/${total} assertions passées.`);
process.exit(ok === total ? 0 : 1);
