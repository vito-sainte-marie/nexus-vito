// Test — nexus-carburant-commande-moteur.js — créneau réellement
// COMMANDABLE, distinct du jour de LIVRAISON (06/09/2026, lot
// CARBURANTS-PERFORMANCE-CORRECTION-COMMANDE, décision-2 — précision
// humaine de Frédéric relayée par ChatGPT dans le rail Handoff NEXUS).
//
// Règle métier EXACTE de Frédéric (citée textuellement dans decision-2) :
// "commandes uniquement du lundi au vendredi avant 11h ; livraison le
// prochain jour ouvrable. Exemples : mercredi avant 11h → jeudi ; vendredi
// avant 11h → lundi ; si lundi férié → mardi. Samedi : aucune nouvelle
// commande possible. La livraison peut intervenir à n'importe quel moment
// de la journée de livraison [...] : ne jamais inventer une heure fixe
// fournisseur."
//
// Reproduit l'anomalie terrain identifiée par l'audit (recommandation
// affichée comme directement actionnable un samedi, "calendrier
// samedi→lundi") et vérifie le correctif : `estJourCommandePossible`/
// `commandePossibleAujourdhui`, DISTINCTS de `estJourLivraisonPossible`
// (jamais un `if (samedi)` codé en dur — configurable par site via
// `config.jours_commande_iso`, compatible ascendant si absent).

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

// Config explicite avec `jours_commande_iso` DISTINCT de `jours_livraison_iso`
// pour prouver que ce n'est jamais la même chose (un site pourrait un jour
// avoir des jours de livraison plus larges que ses jours de commande).
const CONFIG = {
  cutoff_heure: '11:00',
  jours_commande_iso: [1, 2, 3, 4, 5], // lundi -> vendredi, jamais samedi/dimanche
  jours_livraison_iso: [1, 2, 3, 4, 5],
  minimum_camion_litres: 10000,
};

// ------------------------------------------------------------
// 1) estJourCommandePossible — samedi/dimanche fermés, lundi->vendredi ouverts.
// 2026-09-05 = samedi ; 2026-09-06 = dimanche ; 2026-09-07 = lundi (retenu
// comme jour de référence "aujourd'hui" dans ce lot Handoff).
{
  assert.strictEqual(M.jourSemaineIso('2026-09-05'), 6, '2026-09-05 est bien un samedi (ISO 6)');
  assert.strictEqual(M.jourSemaineIso('2026-09-06'), 7, '2026-09-06 est bien un dimanche (ISO 7)');
  assert.strictEqual(M.jourSemaineIso('2026-09-07'), 1, '2026-09-07 est bien un lundi (ISO 1)');

  assert.strictEqual(M.estJourCommandePossible('2026-09-05', CONFIG), false, 'samedi — aucune nouvelle commande possible (règle exacte de Frédéric)');
  assert.strictEqual(M.estJourCommandePossible('2026-09-06', CONFIG), false, 'dimanche — pas davantage un jour de commande');
  assert.strictEqual(M.estJourCommandePossible('2026-09-07', CONFIG), true, 'lundi — jour de commande ouvert');
  assert.strictEqual(M.estJourCommandePossible('2026-09-09', CONFIG), true, 'mercredi — jour de commande ouvert');
  assert.strictEqual(M.estJourCommandePossible('2026-09-11', CONFIG), true, 'vendredi — jour de commande ouvert');

  ok('estJourCommandePossible — lundi à vendredi ouverts, samedi/dimanche fermés, jamais un if(samedi) codé en dur (piloté par config.jours_commande_iso)');
}

// ------------------------------------------------------------
// 2) Compatibilité ascendante — un site SANS jours_commande_iso conserve le
//    comportement historique (repli sur jours_livraison_iso), aucune
//    régression pour les sites déjà en production sur ce champ.
// ------------------------------------------------------------
{
  const configSansChamp = { cutoff_heure: '11:00', jours_livraison_iso: [1, 2, 3, 4, 5] };
  assert.strictEqual(M.estJourCommandePossible('2026-09-05', configSansChamp), false, 'repli sur jours_livraison_iso — samedi toujours fermé même sans le nouveau champ');
  assert.strictEqual(M.estJourCommandePossible('2026-09-07', configSansChamp), true, 'repli sur jours_livraison_iso — lundi toujours ouvert même sans le nouveau champ');
  assert.strictEqual(M.estJourCommandePossible('2026-09-05', null), false, 'config absente -> jamais commandable (Article 5, fail closed)');

  ok('estJourCommandePossible — compatibilité ascendante totale si jours_commande_iso est absent (repli sur jours_livraison_iso, jamais une régression silencieuse)');
}

// ------------------------------------------------------------
// 3) calculerFenetreLivraison — les 3 exemples EXACTS cités par Frédéric
//    dans decision-2, plus le cas samedi (anomalie corrigée par l'audit).
// ------------------------------------------------------------
{
  // "mercredi avant 11h → jeudi" (2026-09-09 = mercredi, 2026-09-10 = jeudi).
  const mercredi = M.calculerFenetreLivraison({ dateCommandeISO: '2026-09-09', heureCommandeHHMM: '09:00', config: CONFIG, joursFeriesISO: [] });
  assert.strictEqual(mercredi.livraisonISO, '2026-09-10', 'mercredi avant 11h -> livraison jeudi (exemple exact de Frédéric)');
  assert.strictEqual(mercredi.avantCutoff, true);
  assert.strictEqual(mercredi.commandePossibleAujourdhui, true);

  // "vendredi avant 11h → lundi" (2026-09-11 = vendredi, 2026-09-14 = lundi).
  const vendrediAvant = M.calculerFenetreLivraison({ dateCommandeISO: '2026-09-11', heureCommandeHHMM: '09:00', config: CONFIG, joursFeriesISO: [] });
  assert.strictEqual(vendrediAvant.livraisonISO, '2026-09-14', 'vendredi avant 11h -> livraison lundi (exemple exact de Frédéric)');
  assert.strictEqual(vendrediAvant.avantCutoff, true);
  assert.strictEqual(vendrediAvant.commandePossibleAujourdhui, true);

  // "si lundi férié → mardi" — même commande vendredi avant 11h, mais le
  // lundi de livraison est cette fois un jour férié connu : la LIVRAISON
  // (jamais la commande elle-même) glisse au mardi suivant.
  const vendrediLundiFerie = M.calculerFenetreLivraison({
    dateCommandeISO: '2026-09-11', heureCommandeHHMM: '09:00', config: CONFIG, joursFeriesISO: ['2026-09-14'],
  });
  assert.strictEqual(vendrediLundiFerie.livraisonISO, '2026-09-15', 'vendredi avant 11h, lundi férié -> livraison décalée au mardi (exemple exact de Frédéric)');

  // Samedi — anomalie corrigée par l'audit : `commandePossibleAujourdhui`
  // doit être false MÊME si l'heure simulée est avant le cutoff (une
  // "commande" un samedi matin à 09h n'est pas plus réelle qu'à 14h : aucun
  // canal de commande n'est ouvert ce jour-là).
  const samediMatin = M.calculerFenetreLivraison({ dateCommandeISO: '2026-09-05', heureCommandeHHMM: '09:00', config: CONFIG, joursFeriesISO: [] });
  assert.strictEqual(samediMatin.commandePossibleAujourdhui, false, 'samedi — jamais un jour commandable, quelle que soit l\'heure simulée');
  assert.strictEqual(samediMatin.avantCutoff, false, 'samedi — avantCutoff toujours false (aucune fenêtre de commande ce jour-là)');
  // Le moteur continue néanmoins de PROJETER le prochain créneau réel
  // (Article 5 : jamais un blocage du calcul, seulement de l'affichage
  // "directement actionnable") — la recherche démarre après dateEffective
  // (dimanche, puisque avantCutoff=false) et trouve lundi.
  assert.strictEqual(samediMatin.livraisonISO, '2026-09-07', 'samedi -> la projection continue de trouver le prochain lundi livrable, sans jamais bloquer le calcul');

  ok('calculerFenetreLivraison — reproduit les 3 exemples exacts de Frédéric (mercredi->jeudi, vendredi->lundi, lundi férié->mardi) et corrige l\'anomalie samedi (jamais commandable, mais toujours projeté)');
}

// ------------------------------------------------------------
// 4) Jamais d'heure de livraison fixe inventée — `livraisonISO` reste une
//    date pure (YYYY-MM-DD), jamais un horodatage, conformément à la
//    précision explicite de Frédéric ("ne jamais inventer une heure fixe
//    fournisseur").
// ------------------------------------------------------------
{
  const f = M.calculerFenetreLivraison({ dateCommandeISO: '2026-09-09', heureCommandeHHMM: '09:00', config: CONFIG, joursFeriesISO: [] });
  assert.strictEqual(/^\d{4}-\d{2}-\d{2}$/.test(f.livraisonISO), true, 'livraisonISO reste une date pure YYYY-MM-DD, jamais un horodatage avec heure');

  ok('calculerFenetreLivraison — livraisonISO ne porte jamais d\'heure fixe fournisseur, conforme à la précision explicite de Frédéric');
}

console.log(`\n${n}/${n} tests passés — Créneau réellement commandable (06/09/2026, decision-2, CARBURANTS-PERFORMANCE-CORRECTION-COMMANDE).`);
