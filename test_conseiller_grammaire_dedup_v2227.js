// Test — Grammaire unifiée des priorités + déduplication signal → action au
// Cockpit (24/08/2026, v2.227, audit "NEXUS_Audit_Cockpit_Ameliorations_
// Developpeur.pdf" §5 "Unifier la grammaire des priorités" et §6 "Éviter
// les doublons signal → action" — chantier choisi par Frédéric après
// v2.226 (Boutons d'action précis), parmi 2 options restantes (l'autre
// étant "Alléger l'écran").
//
// §5 — Constat vérifié dans le code avant ce lot : les libellés actuels
// ("🔥 À AGIR", "🔴 CRITIQUE", "📦 À COMPTER"...) mélangent urgence et
// nature de l'action dans un seul texte, exactement ce que dénonce
// l'audit. Ce lot sépare les deux dimensions (urgence : Maintenant/
// Aujourd'hui/Cette semaine ; nature : verbe d'action) UNIQUEMENT pour les
// 4 types de moteur réellement consommés par Cockpit aujourd'hui (produits,
// caisse, stock, rappel — vérifié dans construirePlansAction() : marge/
// tempo/advisor/fdj/coach n'y sont pas chargés) — même doctrine
// "prématuré à N consommateurs" déjà appliquée en v2.219/220/222/223 :
// pas de grammaire inventée pour des types de signal que Cockpit ne
// montre pas encore.
//
// §6 — Duplication réelle vérifiée dans le code (pas une supposition) :
// tout article R2-BAISSE (`calculerCandidatsProduits`, seuil évolution
// ≤ -30 %) satisfait mécaniquement le seuil plus large "évolution < 0" de
// `produitsEnBaisse` (`analyserEvolutionsPaire`) — un article déjà affiché
// comme carte d'action pleine taille dans "Plan d'exploitation" pouvait
// donc réapparaître dans le détail de la carte "📉 EN BAISSE", sans lien
// entre les deux visible au manager.
//
// Portée non traitée (documentée, pas oubliée) : la section "Signaux de
// risque" (RISQUES_QUALIFIES_SITE, domaine caisse) N'A PAS été touchée par
// ce lot — investigation menée avant implémentation (nexus-risques-
// donnees.js) : ce signal est une mesure de RÉCURRENCE par quart sur une
// fenêtre de 30 jours (`caisse:quart:${quart}`, écart cumulé + nombre de
// non-conformités), une granularité différente d'un candidat "caisse"
// individuel du Plan d'exploitation (`CAISSE-{audit_id}`, un écart précis
// un jour précis) — pas le même sujet au sens littéral de l'audit (qui
// parle d'un même sujet répété en carte pleine taille), et supprimer ce
// signal agrégé perdrait une information réellement différente et utile
// (tendance vs incident). Même discipline d'investigation qu'en v2.224
// (ne pas forcer un correctif sur un scénario qui ne correspond pas à
// l'architecture réelle).

const assert = require('assert');

global.window = global;
require(__dirname + '/nexus-conseiller.js');
const C = global.NexusConseiller;

let n = 0;
function ok(label) { n++; console.log('OK —', label); }

// ------------------------------------------------------------
// 1) urgence/nature — les 4 normaliseurs réellement consommés par Cockpit.
// ------------------------------------------------------------
{
  const r4 = C.normaliserProduit({ candidate_id: 'LIVE-R4-a', rule_id: 'R4-RENFORT-A', etat: '🔥 À AGIR', impact_eur: 10, article: 'Eau', categorie: 'Boissons', verdict: 'V', situation: 'S', impactAttendu: 'IA', impact: 'I' });
  assert.strictEqual(r4.urgence, 'Maintenant');
  assert.strictEqual(r4.nature, 'Réassortir', 'catégorie "Boissons" -> type de rayon "facing" (défaut) -> nature "Réassortir"');
  ok('normaliserProduit (R4-RENFORT-A, facing) — urgence "Maintenant", nature "Réassortir"');

  const r3 = C.normaliserProduit({ candidate_id: 'LIVE-R3-b', rule_id: 'R3-HAUSSE', etat: '📈 OPPORTUNITÉ', impact_eur: 10, article: 'Chips', categorie: 'Snack', verdict: 'V', situation: 'S', impactAttendu: 'IA', impact: 'I' });
  assert.strictEqual(r3.urgence, 'Cette semaine');
  ok('normaliserProduit (R3-HAUSSE) — urgence "Cette semaine"');

  const r2 = C.normaliserProduit({ candidate_id: 'LIVE-R2-c', rule_id: 'R2-BAISSE', etat: '🟡 À SURVEILLER', impact_eur: 10, article: 'Gaz', categorie: 'Gaz butane', verdict: 'V', situation: 'S', impactAttendu: 'IA', impact: 'I', analyse: 'A', consequence: 'C' });
  assert.strictEqual(r2.urgence, "Aujourd'hui");
  assert.strictEqual(r2.nature, 'Vérifier', 'catégorie "Gaz butane" -> type de rayon "stock" -> nature "Vérifier"');
  ok('normaliserProduit (R2-BAISSE, catégorie gaz) — urgence "Aujourd\'hui", nature "Vérifier"');

  const production = C.normaliserProduit({ candidate_id: 'LIVE-R4-d', rule_id: 'R4-RENFORT-A', etat: '🔥 À AGIR', impact_eur: 10, article: 'Croissant', categorie: 'Viennoiserie', verdict: 'V', situation: 'S', impactAttendu: 'IA', impact: 'I' });
  assert.strictEqual(production.nature, 'Commander', 'catégorie "Viennoiserie" -> type de rayon "production" -> nature "Commander"');
  ok('normaliserProduit (catégorie production) — nature "Commander"');

  const caisseCritique = C.normaliserCaissePersonne({ audit_id: 'A1', date: '2026-08-20', cote_dominant: 'piste', montant_dominant: 36.65, ecart_total: 36.65, statut: 'critique', quart: 'Q1', employee_nom: 'Dylan' });
  assert.strictEqual(caisseCritique.urgence, 'Maintenant');
  assert.strictEqual(caisseCritique.nature, 'Contrôler', 'libellé exact de l\'exemple donné par l\'audit ("MAINTENANT - Contrôler")');
  const caisseAnomalie = C.normaliserCaissePersonne({ audit_id: 'A2', date: '2026-08-20', cote_dominant: null, montant_dominant: 10, ecart_total: 10, statut: 'anomalie', quart: 'Q2', employee_nom: null });
  assert.strictEqual(caisseAnomalie.urgence, "Aujourd'hui");
  ok('normaliserCaissePersonne — urgence dépend de statut (critique/anomalie), nature toujours "Contrôler" (exemple exact de l\'audit)');

  const stock = C.normaliserStockRayon({ categorie: 'Produits Capillaires', nbAVerifier: 1, nbASurveiller: 0, nbReferences: 5, risqueEur: 0 });
  assert.strictEqual(stock.urgence, "Aujourd'hui");
  assert.strictEqual(stock.nature, 'Compter', 'libellé exact de l\'exemple donné par l\'audit ("AUJOURD\'HUI - Compter")');
  ok('normaliserStockRayon — urgence "Aujourd\'hui", nature "Compter" (exemple exact de l\'audit)');

  const rappelEnRetard = C.normaliserRappel({ id: 'R1', texte: 'Appeler le fournisseur', date_echeance: '2020-01-01' });
  assert.strictEqual(rappelEnRetard.urgence, 'Maintenant');
  assert.strictEqual(rappelEnRetard.nature, 'Traiter');
  const rappelNormal = C.normaliserRappel({ id: 'R2', texte: 'Commander des gobelets', date_echeance: null });
  assert.strictEqual(rappelNormal.urgence, 'Cette semaine');
  ok('normaliserRappel — urgence dépend du retard, nature "Traiter" (honnête : NEXUS ne connaît pas la vraie nature d\'un texte libre)');
}

// ------------------------------------------------------------
// 2) Non-régression — marge/tempo/advisor/fdj/coach, non consommés par
//    Cockpit aujourd'hui, n'ont volontairement PAS reçu urgence/nature
//    dans ce lot (doctrine "prématuré à N consommateurs").
// ------------------------------------------------------------
{
  const marge = C.normaliserMarge({ candidate_id: 'LIVE-R5-x', etat: '💡 RECOMMANDATION', impact_eur: 10, article: 'X', categorie: 'Y', recommandation: 'R', situation: 'S', impact: 'I', analyse: 'A' });
  assert.strictEqual(marge.urgence, undefined);
  assert.strictEqual(marge.nature, undefined);
  ok('normaliserMarge — pas d\'urgence/nature (Cockpit ne consomme pas ce moteur aujourd\'hui), non-régression volontaire');
}

// ------------------------------------------------------------
// 3) filtrerBaisseDejaEnAction — déduplication signal → action.
// ------------------------------------------------------------
{
  const produitsEnBaisse = [
    { article: 'Coca 33cl', categorie: 'Boissons', evolution: -0.45, perte: 50 },
    { article: 'Chips Nature', categorie: 'Snack', evolution: -0.10, perte: 5 },
    { article: 'Eau 1.5L', categorie: 'Boissons', evolution: -0.05, perte: 2 },
  ];

  // Aucune action visible ne recoupe la liste -> rien de filtré.
  const r1 = C.filtrerBaisseDejaEnAction(produitsEnBaisse, []);
  assert.strictEqual(r1.liste.length, 3);
  assert.strictEqual(r1.nbExclus, 0);
  ok('filtrerBaisseDejaEnAction — aucune action visible, aucune exclusion');

  // "Coca 33cl" a une carte d'action visible (R2-BAISSE) -> exclu du détail.
  const actionsVisibles = [
    { moteur: 'produits', article: 'Coca 33cl', candidate_id: 'LIVE-R2-x' },
    { moteur: 'caisse', article: null, candidate_id: 'CAISSE-1' }, // moteur non-produits, jamais pris en compte
  ];
  const r2 = C.filtrerBaisseDejaEnAction(produitsEnBaisse, actionsVisibles);
  assert.strictEqual(r2.liste.length, 2);
  assert.strictEqual(r2.nbExclus, 1);
  assert.ok(!r2.liste.some(p => p.article === 'Coca 33cl'), 'Coca 33cl déjà en action -> absent du détail "En baisse"');
  ok('filtrerBaisseDejaEnAction — article avec carte d\'action visible exclu du détail, comptabilisé dans nbExclus');

  // Un candidat "produits" visible mais pour un article qui n'est PAS dans
  // produitsEnBaisse (ex. une opportunité R3-HAUSSE) ne doit rien exclure
  // à tort.
  const r3 = C.filtrerBaisseDejaEnAction(produitsEnBaisse, [{ moteur: 'produits', article: 'Article inconnu' }]);
  assert.strictEqual(r3.liste.length, 3);
  assert.strictEqual(r3.nbExclus, 0);
  ok('filtrerBaisseDejaEnAction — action visible sur un article hors liste, aucune exclusion à tort');

  // Entrées dégénérées — jamais une exception.
  assert.deepStrictEqual(C.filtrerBaisseDejaEnAction(null, null), { liste: [], nbExclus: 0 });
  assert.deepStrictEqual(C.filtrerBaisseDejaEnAction(produitsEnBaisse, null).liste.length, 3);
  ok('filtrerBaisseDejaEnAction — entrées null/undefined gérées sans exception');
}

// ------------------------------------------------------------
// 4) Reproduction fidèle du rendu Cockpit (badge grammaire + carte
//    "En baisse" dédupliquée) — sans dépendance DOM.
// ------------------------------------------------------------
function badgePourTest(p) {
  return p.urgence && p.nature ? `${p.urgence.toUpperCase()} · ${p.nature}` : p.etat;
}
{
  const caisse = C.normaliserCaissePersonne({ audit_id: 'A3', date: '2026-08-20', cote_dominant: null, montant_dominant: 36.65, ecart_total: 36.65, statut: 'critique', quart: 'Q1', employee_nom: null });
  assert.strictEqual(badgePourTest(caisse), 'MAINTENANT · Contrôler');
  ok('Rendu Cockpit — badge caisse critique = "MAINTENANT · Contrôler" (grammaire cohérente, exemple exact de l\'audit)');

  // Non-régression : un candidat sans urgence/nature (ex. marge/tempo/
  // advisor, non migrés dans ce lot) retombe sur l'ancien texte `etat`.
  const sansMigration = { etat: '💡 RECOMMANDATION' };
  assert.strictEqual(badgePourTest(sansMigration), '💡 RECOMMANDATION');
  ok('Rendu Cockpit — candidat non migré retombe sur l\'ancien badge `etat`, jamais une exception');
}

console.log(`\n${n}/${n} tests passés — Grammaire + déduplication (Cockpit, v2.227).`);
