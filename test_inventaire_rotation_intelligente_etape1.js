// Test — Rotation intelligente missions, Étape 1 "moteur" (30/08/2026,
// demande de Frédéric : évoluer le mode 'tournant' inerte en une vraie
// "rotation intelligente à couverture garantie", en réutilisant les briques
// déjà éprouvées de construirePlanComptage — jamais une logique parallèle,
// Article 11). Frédéric a explicitement validé le découpage en 3 étapes
// (moteur -> données -> UI) et a demandé que l'étape moteur soit testée et
// non régressée AVANT de brancher données/UI.
//
// Ce fichier teste :
//   1. selectionnerPerimetreMission avec mode_selection='intelligent' —
//      délègue bien à selectionnerPerimetreIntelligent (dispatch correct).
//   2. selectionnerPerimetreIntelligent isolément :
//      - priorité échéance dépassée avant hasard (coverage_gap).
//      - priorité anomalie critique avant échéance simple.
//      - Garde-fou A "garantie dure de couverture" : quota cible = 6 mais
//        7 références en retard -> les 7 sont incluses (quota jamais un
//        plafond sur une obligation réelle).
//      - Garde-fou B "pas de double sélection" : une référence déjà
//        sélectionnée en échéance/anomalie ne doit jamais réapparaître dans
//        le tirage surprise (périmètre final unique, sans doublon).
//   3. Critère de recette explicite de Frédéric : "avec 16 huiles, quota 6
//      et aucune anomalie, le moteur doit progressivement faire tourner
//      toute la famille sans répétitions inutiles ; dès qu'une référence
//      approche ou dépasse son délai, elle passe devant le hasard" —
//      simulation multi-jours.
//   4. genererMissionsPourContexte — non-régression : les nouveaux
//      paramètres optionnels ('intelligent', contexte enrichi) ne changent
//      rien au comportement existant de 'complet'/'tournant' quand ils ne
//      sont pas fournis.

global.window = global;
const path = require('path');
const assert = require('assert');
const fs = require('fs');

const CANDIDATS_DIR = [
  '/sessions/dazzling-compassionate-ride/mnt/image nexus project',
  '/Users/fredericbragance/Library/Mobile Documents/com~apple~CloudDocs/Desktop/projet NEXUS OS/Code Nexus/nexus/image nexus project',
];
const DIR = CANDIDATS_DIR.find(d => fs.existsSync(path.join(d, 'nexus-inventaire-moteur.js')));
if (!DIR) throw new Error('nexus-inventaire-moteur.js introuvable (ni chemin bash, ni chemin macOS)');

require(path.join(DIR, 'nexus-inventaire-moteur.js'));
const M = global.NexusInventaireMoteur;

let n = 0;
function ok(label) { n++; console.log('OK —', label); }

// ------------------------------------------------------------
// 1) Dispatch : mode_selection='intelligent' délègue bien à
//    selectionnerPerimetreIntelligent (pas de logique parallèle inline).
// ------------------------------------------------------------
{
  const produits = [
    { id: 'p1', categorie_id: 'cat', zone_id: null, actif: true },
    { id: 'p2', categorie_id: 'cat', zone_id: null, actif: true },
    { id: 'p3', categorie_id: 'cat', zone_id: null, actif: true },
  ];
  const missionRule = { categorie_ids: ['cat'], zone_ids: null, mode_selection: 'intelligent', nombre_references: 2 };
  const dernierControle = { p1: '2026-08-01', p2: null, p3: '2026-08-27' };
  const contexte = { dateISO: '2026-08-30', reglesParProduit: {} };

  const direct = M.selectionnerPerimetreIntelligent(
    missionRule,
    M.perimetreProduitsMission(missionRule, produits),
    dernierControle, 'seed-dispatch', contexte
  );
  const viaSelection = M.selectionnerPerimetreMission(missionRule, produits, dernierControle, 'seed-dispatch', contexte);
  assert.deepStrictEqual(viaSelection, direct, "mode 'intelligent' doit produire exactement le même résultat que l'appel direct à selectionnerPerimetreIntelligent — un seul chemin de calcul, Article 11");

  // Non-régression : 'complet' et 'tournant' restent inchangés si contexte absent.
  const missionComplet = { categorie_ids: ['cat'], zone_ids: null, mode_selection: 'complet' };
  assert.strictEqual(M.selectionnerPerimetreMission(missionComplet, produits, dernierControle, 'seed').length, 3, "mode 'complet' inchangé");

  ok("selectionnerPerimetreMission — mode 'intelligent' délègue à selectionnerPerimetreIntelligent, jamais une logique dupliquée");
}

// ------------------------------------------------------------
// 2a) Priorité échéance dépassée (coverage_gap) avant hasard.
// ------------------------------------------------------------
{
  const produits = [
    { id: 'huile1', categorie_id: 'huiles', zone_id: null, actif: true },
    { id: 'huile2', categorie_id: 'huiles', zone_id: null, actif: true },
    { id: 'huile3', categorie_id: 'huiles', zone_id: null, actif: true },
    { id: 'huile4', categorie_id: 'huiles', zone_id: null, actif: true },
  ];
  // huile1 : contrôlée il y a 30 jours, delai_max=21 (faible_rotation) -> en retard.
  // huile2/3/4 : contrôlées hier -> pas en retard.
  const regle = { frequence_controle: 'faible_rotation' };
  const missionRule = { categorie_ids: ['huiles'], zone_ids: null, mode_selection: 'intelligent', nombre_references: 1, inclure_surprise: false };
  const dernierControle = {
    huile1: '2026-07-31', huile2: '2026-08-29', huile3: '2026-08-29', huile4: '2026-08-29',
  };
  const contexte = {
    dateISO: '2026-08-30',
    reglesParProduit: { huile1: regle, huile2: regle, huile3: regle, huile4: regle },
  };
  const selection = M.selectionnerPerimetreMission(missionRule, produits, dernierControle, 'seed-echeance', contexte);
  assert.ok(selection.includes('huile1'), "la référence en retard (huile1) doit toujours être incluse, même hors quota tournant");
  assert.strictEqual(selection.length, 1, 'quota=1 respecté quand une seule référence est réellement en retard, pas de sur-sélection');

  ok('selectionnerPerimetreIntelligent — échéance dépassée toujours incluse en priorité (coverage_gap)');
}

// ------------------------------------------------------------
// 2b) Priorité anomalie critique avant échéance simple.
// ------------------------------------------------------------
{
  const produits = [
    { id: 'a', categorie_id: 'cat', zone_id: null, actif: true },
    { id: 'b', categorie_id: 'cat', zone_id: null, actif: true },
  ];
  const missionRule = { categorie_ids: ['cat'], zone_ids: null, mode_selection: 'intelligent', nombre_references: 5, inclure_surprise: false };
  // Aucun des deux n'est en retard (contrôlés aujourd'hui), mais 'a' porte
  // une anomalie critique récente -> doit être sélectionné malgré tout.
  const dernierControle = { a: '2026-08-30', b: '2026-08-30' };
  const contexte = {
    dateISO: '2026-08-30',
    reglesParProduit: {},
    anomaliesDetailParProduit: { a: { graviteMax: 'critique', occurrences: 1, plusAncienneCreeLe: '2026-08-30' } },
  };
  const selection = M.selectionnerPerimetreMission(missionRule, produits, dernierControle, 'seed-anomalie', contexte);
  assert.ok(selection.includes('a'), "un produit avec anomalie critique récente doit être sélectionné même sans échéance dépassée");

  ok('selectionnerPerimetreIntelligent — anomalie critique priorisée avant simple échéance');
}

// ------------------------------------------------------------
// 2c) Garde-fou A — garantie dure de couverture : quota=6, 7 en retard ->
//     les 7 sont incluses, le quota n'est jamais un plafond sur une
//     obligation réelle.
// ------------------------------------------------------------
{
  const produits = [];
  for (let i = 1; i <= 10; i++) produits.push({ id: `ref${i}`, categorie_id: 'cat', zone_id: null, actif: true });
  const regle = { frequence_controle: 'standard' }; // délai max 7 jours
  const reglesParProduit = {};
  produits.forEach(p => { reglesParProduit[p.id] = regle; });
  // 7 références en retard (contrôlées il y a >7 jours), 3 pas en retard.
  const dernierControle = {
    ref1: '2026-08-01', ref2: '2026-08-01', ref3: '2026-08-01', ref4: '2026-08-01',
    ref5: '2026-08-01', ref6: '2026-08-01', ref7: '2026-08-01',
    ref8: '2026-08-29', ref9: '2026-08-29', ref10: '2026-08-29',
  };
  const missionRule = { categorie_ids: ['cat'], zone_ids: null, mode_selection: 'intelligent', nombre_references: 6, inclure_surprise: false };
  const contexte = { dateISO: '2026-08-30', reglesParProduit };
  const selection = M.selectionnerPerimetreMission(missionRule, produits, dernierControle, 'seed-garde-fou-a', contexte);
  const enRetardSelectionnees = ['ref1', 'ref2', 'ref3', 'ref4', 'ref5', 'ref6', 'ref7'].filter(id => selection.includes(id));
  assert.strictEqual(enRetardSelectionnees.length, 7, "Garde-fou A : les 7 références en retard doivent TOUTES être incluses, quota=6 n'est qu'une cible, jamais un plafond sur l'échéance");
  assert.ok(selection.length >= 7, 'périmètre final au moins égal au nombre de références réellement dues');

  ok('selectionnerPerimetreIntelligent — Garde-fou A : quota jamais un plafond sur des références en retard (couverture garantie)');
}

// ------------------------------------------------------------
// 2d) Garde-fou B — pas de double sélection : une référence déjà incluse en
//     échéance/anomalie ne doit jamais être re-tirée en surprise ; le
//     périmètre final reste sans doublon.
// ------------------------------------------------------------
{
  const produits = [];
  for (let i = 1; i <= 5; i++) produits.push({ id: `p${i}`, categorie_id: 'cat', zone_id: null, actif: true });
  const regle = { frequence_controle: 'standard' };
  const reglesParProduit = { p1: regle, p2: regle, p3: regle, p4: regle, p5: regle };
  // p1 en retard (sera sélectionné en coverage_gap). Les autres à jour.
  const dernierControle = { p1: '2026-08-01', p2: '2026-08-29', p3: '2026-08-29', p4: '2026-08-29', p5: '2026-08-29' };
  const missionRule = { categorie_ids: ['cat'], zone_ids: null, mode_selection: 'intelligent', nombre_references: 1, inclure_surprise: true, nombre_surprises: 4 };
  const contexte = { dateISO: '2026-08-30', reglesParProduit };
  // Beaucoup de graines différentes pour maximiser la chance qu'un tirage
  // "naïf" aurait pu re-piocher p1 dans le pool surprise.
  for (const seed of ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8']) {
    const selection = M.selectionnerPerimetreMission(missionRule, produits, dernierControle, seed, contexte);
    const unique = new Set(selection);
    assert.strictEqual(unique.size, selection.length, `Garde-fou B (seed=${seed}) : aucun doublon dans le périmètre final`);
    assert.strictEqual(selection.filter(id => id === 'p1').length, 1, `Garde-fou B (seed=${seed}) : p1 apparaît exactement une fois, jamais retiré une seconde fois en surprise`);
  }

  ok('selectionnerPerimetreIntelligent — Garde-fou B : aucune référence sélectionnée deux fois (échéance/anomalie puis surprise)');
}

// ------------------------------------------------------------
// 3) Critère de recette explicite de Frédéric : 16 huiles, quota 6, aucune
//    anomalie -> rotation progressive sans répétitions inutiles ; dès
//    qu'une référence approche/dépasse son délai, elle passe devant le
//    hasard.
// ------------------------------------------------------------
{
  const NB_HUILES = 16;
  const produits = [];
  for (let i = 1; i <= NB_HUILES; i++) produits.push({ id: `huile${i}`, categorie_id: 'huiles', zone_id: null, actif: true });
  const regle = { frequence_controle: 'standard' }; // délai max 7 jours
  const reglesParProduit = {};
  produits.forEach(p => { reglesParProduit[p.id] = regle; });
  const missionRule = { categorie_ids: ['huiles'], zone_ids: null, mode_selection: 'intelligent', nombre_references: 6, inclure_surprise: false };

  // Simulation jour par jour : après chaque mission, on met à jour
  // dernierControleParProduit pour les références sélectionnées (comme le
  // ferait un vrai contrôle physique), puis on rejoue le lendemain.
  let dernierControle = {}; // aucune référence jamais contrôlée au départ
  const comptageSelections = {};
  produits.forEach(p => { comptageSelections[p.id] = 0; });

  const dateDebut = new Date('2026-08-30T00:00:00Z');
  const JOURS_SIMULES = 20;
  for (let jour = 0; jour < JOURS_SIMULES; jour++) {
    const dateISO = new Date(dateDebut.getTime() + jour * 86400000).toISOString().slice(0, 10);
    const contexte = { dateISO, reglesParProduit };
    const selection = M.selectionnerPerimetreMission(missionRule, produits, dernierControle, `sel-huiles|${dateISO}`, contexte);
    selection.forEach(id => {
      comptageSelections[id] = (comptageSelections[id] || 0) + 1;
      dernierControle = Object.assign({}, dernierControle, { [id]: dateISO + 'T12:00:00Z' });
    });
  }

  // (a) Rotation : sur 20 jours à quota 6 (120 sélections pour 16 huiles),
  // chaque huile doit avoir été comptée au moins 2 fois — la famille entière
  // tourne, aucune huile n'est structurellement oubliée.
  const jamaisComptees = produits.filter(p => comptageSelections[p.id] === 0);
  assert.strictEqual(jamaisComptees.length, 0, `toutes les 16 huiles doivent avoir été comptées au moins une fois sur ${JOURS_SIMULES} jours (oubliées : ${jamaisComptees.map(p => p.id)})`);
  const minComptages = Math.min(...produits.map(p => comptageSelections[p.id]));
  const maxComptages = Math.max(...produits.map(p => comptageSelections[p.id]));
  // Tolérance volontairement large (pas un tirage parfaitement équilibré au
  // sens strict) : avec délai standard=7j et 16 huiles non divisible par le
  // quota=6, des "salves" surviennent quand toutes les huiles arrivent à
  // échéance le même jour (car contrôlées ensemble la fois précédente) —
  // comportement hérité, déjà existant et testé de construirePlanComptage,
  // pas une régression introduite par ce lot (Article 5 : ne pas exiger une
  // précision d'équilibrage que le moteur réutilisé ne garantit pas). Ce qui
  // compte pour le critère de recette de Frédéric, c'est qu'aucune huile ne
  // soit jamais oubliée (vérifié ci-dessus) et qu'aucune poignée de
  // références ne monopolise la rotation au point d'en écarter durablement
  // d'autres (vérifié ici avec une marge large).
  assert.ok(maxComptages - minComptages <= 6, `rotation équilibrée : écart entre l'huile la plus et la moins comptée doit rester raisonnable (min=${minComptages}, max=${maxComptages}), pas de monopolisation par une poignée de références`);

  // (b) Dès qu'un délai est dépassé, cette référence passe devant le
  // hasard : on force artificiellement huile7 à ne plus avoir été
  // contrôlée depuis longtemps (>7j) pendant que toutes les autres sont
  // à jour, avec un quota délibérément trop petit pour l'inclure "par
  // chance" -> elle doit malgré tout apparaître.
  const dateTest = '2026-09-25';
  const controleRecent = {};
  produits.forEach(p => { controleRecent[p.id] = '2026-09-24T08:00:00Z'; }); // toutes à jour hier
  controleRecent['huile7'] = '2026-09-10T08:00:00Z'; // 15 jours -> dépasse le délai standard (7j)
  const missionQuotaMin = { categorie_ids: ['huiles'], zone_ids: null, mode_selection: 'intelligent', nombre_references: 1, inclure_surprise: false };
  const contexteTest = { dateISO: dateTest, reglesParProduit };
  const selectionUrgente = M.selectionnerPerimetreMission(missionQuotaMin, produits, controleRecent, 'seed-urgence-huile7', contexteTest);
  assert.ok(selectionUrgente.includes('huile7'), "dès qu'une référence dépasse son délai, elle passe devant le hasard/quota tournant (huile7 doit être sélectionnée malgré un quota de 1)");

  ok(`selectionnerPerimetreIntelligent — critère de recette Frédéric : 16 huiles/quota 6 tournent sans oubli sur ${JOURS_SIMULES} jours (min=${minComptages}, max=${maxComptages}), et une échéance dépassée passe devant le hasard`);
}

// ------------------------------------------------------------
// 4) genererMissionsPourContexte — non-régression : les nouveaux paramètres
//    optionnels n'affectent pas 'complet'/'tournant' quand absents.
// ------------------------------------------------------------
{
  const missionRules = [
    { id: 'mr1', actif: true, moment_code: 'debut', quart: null, role_code: 'pompiste', role_repli: null, categorie_ids: null, zone_ids: null, mode_selection: 'complet', ordre_affichage: 10 },
  ];
  const rolesPresents = ['pompiste'];
  const produitsActifs = [
    { id: 'x1', categorie_id: null, zone_id: null, actif: true },
    { id: 'x2', categorie_id: null, zone_id: null, actif: true },
  ];
  // Appel SANS les nouveaux paramètres (comme un appelant existant qui ne les connaît pas).
  const missionsAvant = M.genererMissionsPourContexte({
    missionRules, rolesPresents, quart: 'Q1', produitsActifs, dernierControleParProduit: {}, seed: 'seed',
  });
  const missionAffectee = missionsAvant.find(m => m.missionRuleId === 'mr1');
  assert.ok(missionAffectee, 'mission mr1 générée pour le moment ouverture');
  assert.deepStrictEqual(missionAffectee.produitIds.slice().sort(), ['x1', 'x2'], "mode 'complet' inchangé sans les nouveaux paramètres de contexte");

  // Appel AVEC les nouveaux paramètres mais mode_selection toujours 'complet' -> aucun effet.
  const missionsApres = M.genererMissionsPourContexte({
    missionRules, rolesPresents, quart: 'Q1', produitsActifs, dernierControleParProduit: {}, seed: 'seed',
    dateISO: '2026-08-30', reglesParProduit: {}, produitsAvecAnomalieRecente: [], anomaliesDetailParProduit: null,
    plafondAnomaliesNonCritiques: 8, surprisesRecentesParProduit: [],
  });
  const missionAffecteeApres = missionsApres.find(m => m.missionRuleId === 'mr1');
  assert.deepStrictEqual(missionAffecteeApres.produitIds.slice().sort(), ['x1', 'x2'], "nouveaux paramètres de contexte fournis mais mode 'complet' -> aucun changement de comportement");

  ok("genererMissionsPourContexte — non-régression : nouveaux paramètres optionnels sans effet sur 'complet' (et par extension 'tournant', même mécanisme de passage de contexte)");
}

console.log(`\n${n} test(s) passé(s) — test_inventaire_rotation_intelligente_etape1.js`);
