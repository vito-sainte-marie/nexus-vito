// Test — Alléger l'écran du Cockpit (24/08/2026, v2.228, audit
// "NEXUS_Audit_Cockpit_Ameliorations_Developpeur.pdf" §8 "Réduire le bruit
// des grandes listes" et §9 "Replier le Regard du Conseiller" — dernier
// chantier de cet audit choisi par Frédéric, après v2.226 (Boutons
// d'action précis) et v2.227 (Grammaire + déduplication).
//
// §8 — L'audit demande de remplacer "307 produits en baisse" (alarmant,
// mélange tout) par une répartition par sévérité, ex. "18 baisses
// significatives / 5 à vérifier / 2 nécessitent une action". Ce lot
// construit cette répartition SANS inventer de seuil : "nécessite une
// action" réutilise la même détection que filtrerBaisseDejaEnAction
// (v2.227, un article déjà visible comme carte d'action) ; "significative"
// réutilise SEUIL_BAISSE (-30 %, déjà le seuil qui déclenche R2-BAISSE
// dans calculerCandidatsProduits, Article 11 — jamais un deuxième seuil) ;
// "à vérifier" est le reste. Le total affiché (`nb`) reste le total réel
// non filtré (Article 5).
//
// §9 — L'audit demande que le badge "832 analysés · 9 retenus" (déjà
// présent dans le code sous `badgeSelectivite`) devienne le point d'entrée
// de la section "Regard du Conseiller", les cartes détaillées ne
// s'affichant qu'après ouverture. Ce lot réutilise la mécanique .plan-card/
// .open déjà en place pour "carteBaisse" (Article 11) — aucun nouveau
// composant. La ligne de répartition par catégorie de l'audit ("3
// opportunités · 4 anomalies à surveiller...") est reprise dans l'ESPRIT
// (répartition visible avant ouverture) avec le VOCABULAIRE réel de NEXUS
// (les 5 groupes déjà calculés par analyserProduitsStrategiques —
// tarifaire/progressionVolume/regressionVolume/regressionSaisonniere/
// margeEnProgression), jamais les 3 catégories génériques de l'audit qui
// ne correspondent à aucun champ réellement mesuré ici.

const assert = require('assert');

global.window = global;
require(__dirname + '/nexus-conseiller.js');
const C = global.NexusConseiller;

let n = 0;
function ok(label) { n++; console.log('OK —', label); }

// ------------------------------------------------------------
// 1) repartirBaisseParSeverite — §8.
// ------------------------------------------------------------
{
  // SEUIL_BAISSE = -0.30 (vérifié directement, jamais un chiffre recopié
  // à la main qui pourrait diverger silencieusement du vrai seuil).
  assert.strictEqual(C.SEUIL_BAISSE, -0.30);

  const produitsEnBaisse = [
    { article: 'Coca 33cl', categorie: 'Boissons', evolution: -0.45, perte: 50 },  // significative (pas en action)
    { article: 'Sprite 33cl', categorie: 'Boissons', evolution: -0.35, perte: 30 }, // significative aussi
    { article: 'Chips Nature', categorie: 'Snack', evolution: -0.10, perte: 5 },   // à vérifier
    { article: 'Eau 1.5L', categorie: 'Boissons', evolution: -0.02, perte: 1 },    // à vérifier
    { article: 'Bière 33cl', categorie: 'Boissons', evolution: -0.50, perte: 80 }, // déjà en action
  ];
  const actionsVisibles = [{ moteur: 'produits', article: 'Bière 33cl', candidate_id: 'LIVE-R2-x' }];

  const rep = C.repartirBaisseParSeverite(produitsEnBaisse, actionsVisibles);
  assert.strictEqual(rep.necessitentAction, 1, 'Bière 33cl déjà carte visible -> "nécessite une action"');
  assert.strictEqual(rep.significatives, 2, 'Coca (-45%) et Sprite (-35%) <= SEUIL_BAISSE, pas en action -> "significative"');
  assert.strictEqual(rep.aVerifier, 2, 'Chips et Eau, déclin modéré -> "à vérifier"');
  assert.strictEqual(rep.necessitentAction + rep.significatives + rep.aVerifier, produitsEnBaisse.length, 'la répartition couvre exactement tous les articles, aucun perdu ni compté deux fois');
  ok('repartirBaisseParSeverite — répartition exacte sur un cas mixte (action/significative/à vérifier)');

  // Entrées dégénérées — jamais une exception.
  const vide = C.repartirBaisseParSeverite(null, null);
  assert.deepStrictEqual(vide, { necessitentAction: 0, significatives: 0, aVerifier: 0 });
  ok('repartirBaisseParSeverite — entrées null gérées sans exception');
}

// ------------------------------------------------------------
// 2) resumerGroupesStrategiques — §9.
// ------------------------------------------------------------
{
  // Non disponible (pas de paire de périodes comparables) -> null, jamais
  // une chaîne vide silencieuse qui laisserait deviner un bug d'affichage.
  assert.strictEqual(C.resumerGroupesStrategiques({ disponible: false }), null);
  assert.strictEqual(C.resumerGroupesStrategiques(null), null);
  ok('resumerGroupesStrategiques — non disponible ou null -> null explicite');

  // Tous les groupes vides -> null (rien à résumer).
  const psVide = { disponible: true, tarifaire: [], progressionVolume: [], regressionVolume: [], regressionSaisonniere: [], margeEnProgression: [] };
  assert.strictEqual(C.resumerGroupesStrategiques(psVide), null);
  ok('resumerGroupesStrategiques — tous les groupes vides -> null');

  // Seuls les groupes non vides apparaissent (c'est ce qui réduit le
  // bruit) — accord singulier/pluriel correct.
  const ps = {
    disponible: true,
    tarifaire: [{}],
    progressionVolume: [{}, {}],
    regressionVolume: [],
    regressionSaisonniere: [{}, {}, {}],
    margeEnProgression: [],
  };
  const resume = C.resumerGroupesStrategiques(ps);
  assert.strictEqual(resume, '1 alerte tarifaire · 2 progressions · 3 saisonnières');
  assert.ok(!resume.includes('régression'), 'régressionVolume vide -> absent du résumé, jamais un "0 régression" qui ajouterait du bruit');
  assert.ok(!resume.includes('marge'), 'margeEnProgression vide -> absent du résumé');
  ok('resumerGroupesStrategiques — seuls les groupes non vides apparaissent, accord singulier/pluriel correct, ordre stable');
}

// ------------------------------------------------------------
// 3) Reproduction fidèle du rendu Cockpit — teasers §8/§9, sans DOM.
// ------------------------------------------------------------
function teaserBaisseATest(nb, severite) {
  const parts = [
    severite.significatives > 0 ? `${severite.significatives} significative${severite.significatives>1?'s':''}` : null,
    severite.aVerifier > 0 ? `${severite.aVerifier} à vérifier` : null,
    severite.necessitentAction > 0 ? `${severite.necessitentAction} déjà en action` : null,
  ].filter(Boolean).join(' · ');
  return `${nb} référence${nb>1?'s':''} vend${nb>1?'ent':''} moins sur la période${parts ? ' — ' + parts : ''}`;
}
{
  const produitsEnBaisse = [
    { article: 'A', categorie: 'X', evolution: -0.45 },
    { article: 'B', categorie: 'X', evolution: -0.10 },
  ];
  const severite = C.repartirBaisseParSeverite(produitsEnBaisse, []);
  const teaser = teaserBaisseATest(produitsEnBaisse.length, severite);
  assert.strictEqual(teaser, '2 références vendent moins sur la période — 1 significative · 1 à vérifier');
  ok('Rendu Cockpit — teaser "📉 EN BAISSE" reformulé selon l\'audit §8, jamais le seul chiffre brut alarmant');

  // Section vide (aucune baisse) -> comportement historique inchangé
  // (aucun test DOM ici, juste la garde `if (!PRODUITS_EN_BAISSE.length)`
  // déjà présente et non modifiée par ce lot).
}

console.log(`\n${n}/${n} tests passés — Alléger l'écran du Cockpit (v2.228).`);
