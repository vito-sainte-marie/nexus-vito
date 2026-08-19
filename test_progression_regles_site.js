// Test — "Mes séries" : Paramètres manager (P8 du plan d'implémentation,
// 20/08/2026). Portée : resoudreReglesProgressionSite, la fonction pure qui
// transforme une ligne (ou l'absence de ligne) de progression_site_settings
// en un objet de règles toujours complet et sûr — jamais une erreur, jamais
// un palier fabriqué à moitié (Article 5), jamais une 2e vérité qui diverge
// des constantes par défaut sans raison (Article 11).
//
// nexus-progression.js est un IIFE écrit pour le navigateur — on stub
// `window` avant de le requérir, comme documenté dans le fichier lui-même.

global.window = global;
require('/sessions/dazzling-compassionate-ride/mnt/image nexus project/nexus-progression.js');
const assert = require('assert');
const N = global.NexusProgression;

// ------------------------------------------------------------
// 1) Aucune ligne site (null) -> repli intégral sur les constantes par
//    défaut, comportement strictement identique à avant ce lot.
// ------------------------------------------------------------
{
  const regles = N.resoudreReglesProgressionSite(null);
  assert.strictEqual(regles.caisseActif, true);
  assert.deepStrictEqual(regles.caissePaliers, N.PALIERS_SERIE_CAISSE);
  assert.strictEqual(regles.inventaireActif, true);
  assert.strictEqual(regles.inventaireDelaiGraceJours, N.DELAI_GRACE_SERIE_INVENTAIRE_JOURS);
  assert.deepStrictEqual(regles.inventairePaliers, N.PALIERS_SERIE_INVENTAIRE);
}

// ------------------------------------------------------------
// 2) undefined (même cas que null, ex. .maybeSingle() sans ligne) -> même
//    repli, jamais une erreur.
// ------------------------------------------------------------
{
  const regles = N.resoudreReglesProgressionSite(undefined);
  assert.deepStrictEqual(regles.caissePaliers, N.PALIERS_SERIE_CAISSE);
}

// ------------------------------------------------------------
// 3) Ligne complète et valide -> les valeurs du site remplacent les
//    défauts, champ par champ.
// ------------------------------------------------------------
{
  const ligne = {
    series_caisse_actif: false,
    series_caisse_paliers: [{ code: 'caisse_x3', seuil: 3, points: 10 }],
    series_inventaire_actif: true,
    series_inventaire_delai_grace_jours: 3,
    series_inventaire_paliers: [{ code: 'inventaire_x3', seuil: 3, points: 10 }],
  };
  const regles = N.resoudreReglesProgressionSite(ligne);
  assert.strictEqual(regles.caisseActif, false);
  assert.deepStrictEqual(regles.caissePaliers, ligne.series_caisse_paliers);
  assert.strictEqual(regles.inventaireDelaiGraceJours, 3);
  assert.deepStrictEqual(regles.inventairePaliers, ligne.series_inventaire_paliers);
}

// ------------------------------------------------------------
// 4) delai_grace_jours = 0 est une valeur légitime (déjà couvert côté
//    qualifierQuartsInventaireEmploye) -> ne doit PAS être confondu avec
//    "absent" et retomber sur 7 (piège classique du `|| defaut`).
// ------------------------------------------------------------
{
  const regles = N.resoudreReglesProgressionSite({ series_inventaire_delai_grace_jours: 0 });
  assert.strictEqual(regles.inventaireDelaiGraceJours, 0);
}

// ------------------------------------------------------------
// 5) Paliers malformés (tableau vide, champ manquant, seuil négatif,
//    points non numérique) -> repli sur les défauts pour CE champ, jamais
//    un badge à seuil 0 ou négatif fabriqué en silence.
// ------------------------------------------------------------
{
  assert.deepStrictEqual(N.resoudreReglesProgressionSite({ series_caisse_paliers: [] }).caissePaliers, N.PALIERS_SERIE_CAISSE);
  assert.deepStrictEqual(N.resoudreReglesProgressionSite({ series_caisse_paliers: 'pas un tableau' }).caissePaliers, N.PALIERS_SERIE_CAISSE);
  assert.deepStrictEqual(N.resoudreReglesProgressionSite({ series_caisse_paliers: [{ code: 'x', seuil: -5, points: 10 }] }).caissePaliers, N.PALIERS_SERIE_CAISSE);
  assert.deepStrictEqual(N.resoudreReglesProgressionSite({ series_caisse_paliers: [{ code: 'x', points: 10 }] }).caissePaliers, N.PALIERS_SERIE_CAISSE);
  assert.deepStrictEqual(N.resoudreReglesProgressionSite({ series_inventaire_paliers: [{ code: 'y', seuil: 5, points: 'beaucoup' }] }).inventairePaliers, N.PALIERS_SERIE_INVENTAIRE);
}

// ------------------------------------------------------------
// 6) delai_grace_jours invalide (négatif, non numérique, null) -> repli sur
//    le défaut, jamais NaN propagé plus loin dans le moteur.
// ------------------------------------------------------------
{
  assert.strictEqual(N.resoudreReglesProgressionSite({ series_inventaire_delai_grace_jours: -1 }).inventaireDelaiGraceJours, N.DELAI_GRACE_SERIE_INVENTAIRE_JOURS);
  assert.strictEqual(N.resoudreReglesProgressionSite({ series_inventaire_delai_grace_jours: 'sept' }).inventaireDelaiGraceJours, N.DELAI_GRACE_SERIE_INVENTAIRE_JOURS);
  assert.strictEqual(N.resoudreReglesProgressionSite({ series_inventaire_delai_grace_jours: null }).inventaireDelaiGraceJours, N.DELAI_GRACE_SERIE_INVENTAIRE_JOURS);
}

// ------------------------------------------------------------
// 7) Les règles résolues doivent rester directement utilisables par les
//    fonctions déjà testées (paliersFranchis / prochainPalier /
//    qualifierQuartsInventaireEmploye) — pas de second format à traduire.
// ------------------------------------------------------------
{
  const regles = N.resoudreReglesProgressionSite({ series_caisse_paliers: [{ code: 'caisse_x3', seuil: 3, points: 10 }] });
  const nouveaux = N.paliersFranchis(regles.caissePaliers, 3, []);
  assert.strictEqual(nouveaux.length, 1);
  assert.strictEqual(nouveaux[0].code, 'caisse_x3');
}

console.log('test_progression_regles_site.js : OK (13 assertions)');
