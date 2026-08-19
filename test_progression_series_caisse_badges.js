// Test — "Mes séries" : badges Série Caisse + points (19/08/2026, cadrage
// NEXUS_Ma_Progression_Series_Recompenses_Cadrage_Developpeur.pdf).
//
// Portée volontairement réduite au moteur PUR (paliersFranchisSerieCaisse /
// prochainPalierSerieCaisse) — la partie "écriture Supabase idempotente"
// (INSERT + contrainte unique) vit dans NEXUS-Progression-v1.html et se
// vérifie en base (déjà confirmé : contraintes uniques employee_id+badge_code
// / employee_id+source_type+source_id posées par la migration). Pas de
// second calcul de série ici : le record utilisé provient toujours de
// N.serieValideeConformeUnifiee, déjà testé ailleurs.
//
// nexus-progression.js est un IIFE écrit pour le navigateur — on stub
// `window` avant de le requérir, comme documenté dans le fichier lui-même.

global.window = global;
require('/sessions/dazzling-compassionate-ride/mnt/image nexus project/nexus-progression.js');
const assert = require('assert');
const N = global.NexusProgression;

// ------------------------------------------------------------
// 1) Catalogue des paliers — doit matcher exactement le cadrage §5.
// ------------------------------------------------------------
assert.deepStrictEqual(N.PALIERS_SERIE_CAISSE.map(p => p.code), ['caisse_x5', 'caisse_x10', 'caisse_x20']);
assert.strictEqual(N.PALIERS_SERIE_CAISSE.find(p => p.code === 'caisse_x5').points, 25);
assert.strictEqual(N.PALIERS_SERIE_CAISSE.find(p => p.code === 'caisse_x10').points, 50);
assert.strictEqual(N.PALIERS_SERIE_CAISSE.find(p => p.code === 'caisse_x20').points, 100);

// ------------------------------------------------------------
// 2) paliersFranchisSerieCaisse — cas simple : record juste franchi, rien
//    d'acquis encore -> uniquement x5.
// ------------------------------------------------------------
{
  const nouveaux = N.paliersFranchisSerieCaisse(5, []);
  assert.strictEqual(nouveaux.length, 1);
  assert.strictEqual(nouveaux[0].code, 'caisse_x5');
}

// ------------------------------------------------------------
// 3) Record en dessous du premier palier -> rien de franchi (PROG-09
//    implicite : pas de badge avant le seuil réel).
// ------------------------------------------------------------
{
  const nouveaux = N.paliersFranchisSerieCaisse(4, []);
  assert.strictEqual(nouveaux.length, 0);
}

// ------------------------------------------------------------
// 4) Idempotence (PROG-11) — un palier déjà dans codesDejaAcquis n'est
//    JAMAIS redonné, même si le record le dépasse toujours.
// ------------------------------------------------------------
{
  const nouveaux = N.paliersFranchisSerieCaisse(7, ['caisse_x5']);
  assert.strictEqual(nouveaux.length, 0);
}

// ------------------------------------------------------------
// 5) Rattrapage d'historique : le record saute directement à 12 sans être
//    passé par NEXUS avant (import, correction...) -> x5 ET x10 doivent
//    être franchis dans le même appel, jamais un seul à la fois puis
//    l'autre "oublié".
// ------------------------------------------------------------
{
  const nouveaux = N.paliersFranchisSerieCaisse(12, []);
  assert.deepStrictEqual(nouveaux.map(p => p.code), ['caisse_x5', 'caisse_x10']);
}

// ------------------------------------------------------------
// 6) Tous les paliers déjà acquis, record au max -> plus rien à franchir,
//    même à un record très élevé.
// ------------------------------------------------------------
{
  const nouveaux = N.paliersFranchisSerieCaisse(50, ['caisse_x5', 'caisse_x10', 'caisse_x20']);
  assert.strictEqual(nouveaux.length, 0);
}

// ------------------------------------------------------------
// 7) Badge x10 acquis "hors ordre" (ex. rattrapage manuel) mais pas x5 —
//    cas limite volontairement permissif : le moteur ne réattribue jamais
//    x10 (déjà dans acquis) et détecte correctement x5 comme encore dû.
// ------------------------------------------------------------
{
  const nouveaux = N.paliersFranchisSerieCaisse(25, ['caisse_x10']);
  assert.deepStrictEqual(nouveaux.map(p => p.code), ['caisse_x5', 'caisse_x20']);
}

// ------------------------------------------------------------
// 8) prochainPalierSerieCaisse — cas nominal : record=3, rien d'acquis.
// ------------------------------------------------------------
{
  const suivant = N.prochainPalierSerieCaisse(3, []);
  assert.strictEqual(suivant.code, 'caisse_x5');
  assert.strictEqual(suivant.manque, 2);
}

// ------------------------------------------------------------
// 9) prochainPalierSerieCaisse — x5 déjà acquis, record=12, x10 pas encore
//    crédité (fenêtre entre le franchissement et l'écriture en base) :
//    doit pointer vers x10 avec manque=0 (annonce imminente, pas une
//    fausse promesse).
// ------------------------------------------------------------
{
  const suivant = N.prochainPalierSerieCaisse(12, ['caisse_x5']);
  assert.strictEqual(suivant.code, 'caisse_x10');
  assert.strictEqual(suivant.manque, 0);
}

// ------------------------------------------------------------
// 10) prochainPalierSerieCaisse — tous acquis -> null ("niveau maximum",
//     jamais un palier fantôme affiché).
// ------------------------------------------------------------
{
  const suivant = N.prochainPalierSerieCaisse(25, ['caisse_x5', 'caisse_x10', 'caisse_x20']);
  assert.strictEqual(suivant, null);
}

// ------------------------------------------------------------
// 11) Record=0 (aucun contrôle validé conforme pour l'instant) — jamais une
//     erreur, jamais un badge fabriqué (Article 5).
// ------------------------------------------------------------
{
  assert.strictEqual(N.paliersFranchisSerieCaisse(0, []).length, 0);
  const suivant = N.prochainPalierSerieCaisse(0, []);
  assert.strictEqual(suivant.code, 'caisse_x5');
  assert.strictEqual(suivant.manque, 5);
}

console.log('test_progression_series_caisse_badges.js : OK (11 assertions)');
