// Test — Préchargement de contexte dans les CTA du Cockpit (24/08/2026,
// v2.229, audit "NEXUS_Audit_Cockpit_Ameliorations_Developpeur.pdf" §4.1
// "Boutons et orchestration" — chantier choisi explicitement par Frédéric
// après v2.226/v2.227/v2.228, qui avaient clos le reste de cet audit.
//
// L'audit : "Le bouton ne doit pas seulement naviguer : il doit
// idéalement précharger le contexte. Exemple : « Lancer ce comptage »
// ouvre le module Inventaire/Scanner Stock avec les références concernées
// déjà sélectionnées. « Contrôler cet écart » ouvre directement le
// contrôle Verify ciblé." Et le test d'acceptation §14 : "Un écart Verify
// prioritaire ouvre directement le contrôle ciblé. Un comptage proposé
// ouvre le module avec les références concernées déjà sélectionnées."
//
// Constat vérifié avant implémentation — 3 des 4 types de candidat
// consommés par Cockpit ont un `cible` :
//  - produits : `cible` contenait DÉJÀ `?article=...` depuis longtemps
//    (v2.226 l'a juste rendu visible via "Voir le produit"), et
//    NEXUS-Produits-v1.html sait déjà le lire (deep-link du 26/07/2026,
//    "Deep-link depuis le Conseiller NEXUS"). Rien à faire ici.
//  - caisse : `cible` valait juste "NEXUS-Verify-v1.html" (aucun
//    préchargement) alors que NEXUS-Verify-v1.html possède DÉJÀ un
//    deep-link `?ouvrir_date=&ouvrir_quart=` (13/08/2026, construit pour
//    un autre appelant — Carburants) — vérifié directement contre la
//    définition SQL de v_caisse_ecart_a_traiter (source de
//    normaliserCaissePersonne) que `date`/`quart` viennent de la même
//    colonne audits_caisse que celle utilisée par le deep-link Verify :
//    aucune conversion de format nécessaire, réutilisation Article 11.
//  - stock : `cible` valait juste "NEXUS-Scanner-Stock-v1.html" (aucun
//    préchargement), et NEXUS-Scanner-Stock-v1.html n'avait AUCUN
//    deep-link existant — nouveau paramètre `?categorie=` créé pour ce
//    lot, en réutilisant le geste déjà établi par Verify (ouvrir +
//    surligner + scroller le groupe correspondant, jamais une saisie
//    automatique).
//  - rappel : `cible` reste `null` (pas de module cible — un rappel est
//    un texte libre, rien à précharger).
//
// Ce fichier teste la partie moteur pure (les URLs `cible` construites
// par les normaliseurs). Le comportement DOM de NEXUS-Scanner-Stock-v1.html
// (ouverture/surlignage du groupe) n'est pas testable sans navigateur —
// voir la section "Non vérifié en conditions réelles" du Data Dictionary.

const assert = require('assert');

global.window = global;
require(__dirname + '/nexus-conseiller.js');
const C = global.NexusConseiller;

let n = 0;
function ok(label) { n++; console.log('OK —', label); }

// ------------------------------------------------------------
// 1) Caisse — réutilise le deep-link Verify existant.
// ------------------------------------------------------------
{
  const caisse = C.normaliserCaissePersonne({
    audit_id: 'A1', date: '2026-08-20', cote_dominant: 'piste', montant_dominant: 36.65,
    ecart_total: 36.65, statut: 'critique', quart: '1', employee_nom: 'Dylan',
  });
  assert.strictEqual(caisse.cible, 'NEXUS-Verify-v1.html?ouvrir_date=2026-08-20&ouvrir_quart=1');
  ok('normaliserCaissePersonne — cible précharge date + quart via le deep-link Verify existant');

  // Encodage correct si le quart ou la date contenaient un caractère à
  // encoder (défense en profondeur — les vraies valeurs sont propres,
  // mais la fonction ne doit jamais produire une URL cassée).
  const caisseEncodage = C.normaliserCaissePersonne({
    audit_id: 'A2', date: '2026-08-20', cote_dominant: null, montant_dominant: 10,
    ecart_total: 10, statut: 'anomalie', quart: 'quart 2', employee_nom: null,
  });
  assert.strictEqual(caisseEncodage.cible, 'NEXUS-Verify-v1.html?ouvrir_date=2026-08-20&ouvrir_quart=quart%202');
  ok('normaliserCaissePersonne — quart avec espace correctement encodé dans l\'URL');
}

// ------------------------------------------------------------
// 2) Stock — nouveau paramètre ?categorie=.
// ------------------------------------------------------------
{
  const stock = C.normaliserStockRayon({ categorie: 'Boissons énergétiques', nbAVerifier: 3, nbASurveiller: 1, nbReferences: 10, risqueEur: 200 });
  assert.strictEqual(stock.cible, 'NEXUS-Scanner-Stock-v1.html?categorie=Boissons%20%C3%A9nerg%C3%A9tiques');
  ok('normaliserStockRayon — cible précharge la catégorie exacte (accents/espaces encodés)');
}

// ------------------------------------------------------------
// 3) Non-régression — produits (déjà préchargé avant ce lot) et rappel
//    (pas de module cible) restent inchangés.
// ------------------------------------------------------------
{
  const produit = C.normaliserProduit({ candidate_id: 'LIVE-R4-a', rule_id: 'R4-RENFORT-A', etat: '🔥 À AGIR', impact_eur: 10, article: 'Eau 1.5L', categorie: 'Boissons', verdict: 'V', situation: 'S', impactAttendu: 'IA', impact: 'I' });
  assert.strictEqual(produit.cible, 'NEXUS-Produits-v1.html?article=Eau%201.5L');
  ok('normaliserProduit — cible déjà préchargée, non-régression confirmée (v2.229 ne la touche pas)');

  const rappel = C.normaliserRappel({ id: 'R1', texte: 'Appeler le fournisseur', date_echeance: null });
  assert.strictEqual(rappel.cible, null);
  ok('normaliserRappel — cible reste null, aucun module à précharger pour un texte libre');
}

console.log(`\n${n}/${n} tests passés — Préchargement de contexte (Cockpit, v2.229).`);
