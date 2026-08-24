// Test — Boutons d'action précis au Cockpit (22/08/2026, v2.226, audit
// "NEXUS_Audit_Cockpit_Ameliorations_Developpeur.pdf" §4, chantier P0
// "Ajouter une vraie couche d'action" — choisi par Frédéric parmi 4 options
// proposées : "L'amélioration prioritaire selon l'audit (P0) : remplacer le
// bouton générique « Valider cette recommandation » par des CTA explicites
// selon le type de signal").
//
// Constat vérifié dans le code avant ce lot : NEXUS-Cockpit-v2.html
// n'affichait qu'UN SEUL bouton générique "✓ Valider cette recommandation"
// pour tout candidat validable (produits/marge), et un lien générique
// "→ Aller vérifier dans {Moteur}" pour tout candidat non validable
// (tempo/advisor/caisse/stock/fdj/coach) — quel que soit le type réel de
// signal. L'audit propose un tableau Signal → Bouton principal → Action
// secondaire (ex. "Écart caisse employé → Contrôler cet écart") ; ce
// tableau est illustratif et ne correspond pas 1:1 au vocabulaire réel de
// NEXUS (9 types de moteur réels, pas la liste de l'audit) — même
// situation déjà rencontrée en v2.224 (le "Cockpit" de l'audit ne
// correspondait pas au Cockpit réel). Ce lot applique l'ESPRIT de l'audit
// (libellés explicites par type de signal, jamais générique) au
// vocabulaire RÉEL des 9 normaliseurs de nexus-conseiller.js, en
// réutilisant les champs `cible` déjà calculés (aucune nouvelle donnée,
// aucun nouveau routage — "visible immédiatement, ne touche pas la
// structure de la page").
//
// Portée non traitée (documentée, pas oubliée) : aucun "précharge de
// contexte" au-delà de ce que `cible` sait déjà faire aujourd'hui (ex.
// produits a déjà ?article=... dans son URL, réutilisé tel quel ; fdj/coach
// n'ont pas d'URL par quart/employé précis, donc pas de libellé qui le
// laisserait croire — Article 5, jamais une fausse précision). Aucun
// "commentaire" ajouté sur les rappels (pas d'infrastructure de commentaire
// aujourd'hui, hors scope de ce lot).

const assert = require('assert');

global.window = global;
require(__dirname + '/nexus-conseiller.js');
const C = global.NexusConseiller;

let n = 0;
function ok(label) { n++; console.log('OK —', label); }

// ------------------------------------------------------------
// 1) Candidats VALIDABLES (produits, marge) — le bouton "✓ Valider..."
//    reste le principal (c'est une vraie validation de décision), mais
//    gagne désormais un libelleActionSecondaire réutilisant `cible`.
// ------------------------------------------------------------
{
  const p = C.normaliserProduit({
    candidate_id: 'LIVE-R4-x', rule_id: 'R4-RENFORT-A', etat: '🔥 À AGIR',
    impact_eur: 100, article: 'Coca 33cl', categorie: 'Boissons',
    verdict: 'V', situation: 'S', impactAttendu: 'IA', impact: 'I',
  });
  assert.strictEqual(p.validable, true);
  assert.strictEqual(p.libelleActionSecondaire, 'Voir le produit');
  assert.ok(p.cible.includes('article=Coca'), 'cible doit rester précisée par article (précharge déjà existante, réutilisée telle quelle)');
  ok('normaliserProduit — libelleActionSecondaire = "Voir le produit", cible réutilisée telle quelle');

  const m = C.normaliserMarge({
    candidate_id: 'LIVE-R5-y', etat: '💡 RECOMMANDATION', impact_eur: 50,
    article: 'Chips', categorie: 'Épicerie', recommandation: 'R', situation: 'S', impact: 'I', analyse: 'A',
  });
  assert.strictEqual(m.validable, true);
  assert.strictEqual(m.libelleActionSecondaire, 'Ouvrir Scanner NEXUS');
  assert.strictEqual(m.cible, 'NEXUS-Scanner-v1.html');
  ok('normaliserMarge — libelleActionSecondaire = "Ouvrir Scanner NEXUS" (libellé repris tel quel du tableau de l\'audit)');
}

// ------------------------------------------------------------
// 2) Candidats NON validables — libelleAction remplace le générique
//    "Aller vérifier dans {Moteur}".
// ------------------------------------------------------------
{
  const tempo = C.normaliserTempo({
    jourCible: { nom: 'jeudi' }, decision: 'D', pourquoi: 'P', impactAttendu: 'IA',
  });
  assert.strictEqual(tempo.libelleAction, "Voir l'analyse Tempo");
  ok('normaliserTempo — libelleAction = "Voir l\'analyse Tempo"');

  const advisorCaisse = C.normaliserAdvisor({ id: 1, domaine: 'caisse', message_text: 'M', priority: 'haute', generated_at: new Date().toISOString() });
  assert.strictEqual(advisorCaisse.libelleAction, 'Contrôler ce point');
  assert.strictEqual(advisorCaisse.cible, 'NEXUS-Verify-v1.html');

  const advisorQualite = C.normaliserAdvisor({ id: 2, domaine: 'qualite', message_text: 'M', priority: 'haute', generated_at: new Date().toISOString() });
  assert.strictEqual(advisorQualite.libelleAction, 'Voir la mission');
  assert.strictEqual(advisorQualite.cible, 'NEXUS-Missions-v1.html');

  const advisorAutre = C.normaliserAdvisor({ id: 3, domaine: 'autre', message_text: 'M', priority: 'haute', generated_at: new Date().toISOString() });
  assert.strictEqual(advisorAutre.libelleAction, 'Voir le détail', 'domaine inconnu -> repli générique honnête, jamais une fausse précision');
  ok('normaliserAdvisor — libelleAction dépend du domaine (caisse/qualite/autre), cohérent avec cible');

  const caisse = C.normaliserCaissePersonne({
    audit_id: 'A1', date: '2026-08-20', cote_dominant: 'piste', montant_dominant: 40, ecart_total: 40,
    statut: 'critique', quart: 'Q1', employee_nom: 'Dylan',
  });
  assert.strictEqual(caisse.libelleAction, 'Contrôler cet écart');
  assert.strictEqual(caisse.cible, 'NEXUS-Verify-v1.html');
  ok('normaliserCaissePersonne — libelleAction = "Contrôler cet écart" (libellé exact du tableau de l\'audit)');

  const stock = C.normaliserStockRayon({ categorie: 'Boissons énergétiques', nbAVerifier: 3, nbASurveiller: 1, nbReferences: 10, risqueEur: 200 });
  assert.strictEqual(stock.libelleAction, 'Lancer ce comptage');
  assert.strictEqual(stock.cible, 'NEXUS-Scanner-Stock-v1.html');
  ok('normaliserStockRayon — libelleAction = "Lancer ce comptage" (libellé exact du tableau de l\'audit)');

  const fdj = C.normaliserFdj({ id: 'FDJ-1', type: 'ecart', niveau: 'critique', titre: 'T', decision: 'D', constat: 'C', impactAttendu: 'IA', preuve: 'P' });
  assert.strictEqual(fdj.libelleAction, "Voir l'analyse FDJ", 'pas "Ouvrir le quart FDJ" — cible ne pointe jamais vers un quart précis, jamais une fausse précision (Article 5)');
  ok('normaliserFdj — libelleAction reste honnête sur ce que cible ouvre réellement');

  const coach = C.normaliserCoach({ id: 'COACH-1', type: 'ecart', niveau: 'attention', titre: 'T', decision: 'D', constat: 'C', impactAttendu: 'IA', preuve: 'P' });
  assert.strictEqual(coach.libelleAction, 'Voir le coaching équipe');
  ok('normaliserCoach — libelleAction = "Voir le coaching équipe"');
}

// ------------------------------------------------------------
// 3) Non-régression — rappel garde son propre bouton dédié, jamais touché
//    par libelleAction/libelleActionSecondaire (branche séparée dans
//    NEXUS-Cockpit-v2.html : p.moteur === 'rappel').
// ------------------------------------------------------------
{
  const rappel = C.normaliserRappel({ id: 'R1', texte: 'Appeler le fournisseur', date_echeance: null });
  assert.strictEqual(rappel.libelleAction, undefined, 'rappel ne doit jamais recevoir libelleAction — il a son propre bouton "Marquer comme fait"');
  assert.strictEqual(rappel.libelleActionSecondaire, undefined);
  assert.strictEqual(rappel.cible, null);
  ok('normaliserRappel — non-régression totale, aucun nouveau champ');
}

// ------------------------------------------------------------
// 4) Reproduction fidèle de la logique de branchement de
//    NEXUS-Cockpit-v2.html (renderPlansAction) — pour vérifier le
//    COMPORTEMENT de rendu attendu sans dépendre du DOM.
// ------------------------------------------------------------
function rendreBoutonsPourTest(p, MOTEUR_LABEL) {
  return p.validable
    ? { principal: '✓ Valider cette recommandation', secondaire: (p.libelleActionSecondaire && p.cible) ? `→ ${p.libelleActionSecondaire}` : null }
    : p.moteur === 'rappel'
      ? { principal: '✓ Marquer comme fait', secondaire: null }
      : { principal: `→ ${p.libelleAction || `Aller vérifier dans ${(MOTEUR_LABEL[p.moteur] || p.cible)}`}`, secondaire: null };
}
{
  const MOTEUR_LABEL = { produits: 'Produits', marge: 'Marge+', tempo: 'Tempo', advisor: 'Signal', caisse: 'Caisse', stock: 'Stock', rappel: 'Rappel' };

  const caisse = C.normaliserCaissePersonne({ audit_id: 'A2', date: '2026-08-20', cote_dominant: null, montant_dominant: 10, ecart_total: 10, statut: 'anomalie', quart: 'Q2', employee_nom: null });
  const rendu = rendreBoutonsPourTest(caisse, MOTEUR_LABEL);
  assert.strictEqual(rendu.principal, '→ Contrôler cet écart');
  ok('Rendu Cockpit (caisse) — "→ Contrôler cet écart", plus jamais "→ Aller vérifier dans Caisse"');

  const produit = C.normaliserProduit({ candidate_id: 'LIVE-R4-z', rule_id: 'R4-RENFORT-A', etat: '🔥 À AGIR', impact_eur: 10, article: 'Eau 1.5L', categorie: 'Boissons', verdict: 'V', situation: 'S', impactAttendu: 'IA', impact: 'I' });
  const renduP = rendreBoutonsPourTest(produit, MOTEUR_LABEL);
  assert.strictEqual(renduP.principal, '✓ Valider cette recommandation');
  assert.strictEqual(renduP.secondaire, '→ Voir le produit');
  ok('Rendu Cockpit (produits) — bouton Valider inchangé + nouveau lien secondaire "→ Voir le produit"');

  // Non-régression : un candidat sans libelleAction (ex. ancien objet
  // construit à la main par un test tiers, sans passer par un normaliser*)
  // retombe sur l'ancien texte générique, jamais une exception.
  const sansLibelle = { validable: false, moteur: 'stock', cible: 'NEXUS-Scanner-Stock-v1.html' };
  const renduSansLibelle = rendreBoutonsPourTest(sansLibelle, MOTEUR_LABEL);
  assert.strictEqual(renduSansLibelle.principal, '→ Aller vérifier dans Stock');
  ok('Rendu Cockpit — candidat sans libelleAction (non migré) retombe sur le texte générique historique, jamais une exception');
}

console.log(`\n${n}/${n} tests passés — Boutons d'action précis (Cockpit, v2.226).`);
