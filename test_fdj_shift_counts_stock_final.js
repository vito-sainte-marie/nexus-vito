// Test — régression du bug réel remonté par Frédéric le 15/08/2026 :
// "Carnet en cours" affichait "Aucun" et "Tickets restants" affichait
// "Non calculable" pour TOUS les jeux de NEXUS-FDJ-Manager-v1.html, alors
// qu'un comptage de quart existait bien en base (ex. BANCO 1€, Loane,
// 14/08/2026 quart 2, stock_final=129).
//
// Cause réelle, confirmée en base (Supabase, table fdj_shift_counts) : la
// fonction moteur NexusFdjMoteur.ticketsRestantsCarnetEnCours() lit
// c.stock_final (voir nexus-fdj-moteur.js, garde explicite : ignore toute
// ligne où stock_final est null OU undefined) — mais chargerShiftCountsStock()
// dans NEXUS-FDJ-Manager-v1.html ne sélectionnait PAS cette colonne dans sa
// requête Supabase (`select('shift_id, game_id, appro, ventes_qte, created_at')`).
// Chaque ligne arrivait donc avec stock_final === undefined, et la fonction
// moteur — pourtant correcte, déjà testée en isolation dans
// test_fdj_stock_lecture_manageriale.js — ignorait systématiquement toutes
// les lignes et retournait null dans 100% des cas, quelle que soit la
// donnée réelle en base. Aucun test existant ne pouvait détecter ce bug
// car il s'agit d'une chaîne de caractères (le select SQL), invisible à un
// test unitaire de la fonction moteur pure — d'où ce test dédié, qui
// vérifie la requête HTML elle-même plutôt que la fonction moteur.

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const DIR = '/sessions/dazzling-compassionate-ride/mnt/image nexus project';
const html = fs.readFileSync(path.join(DIR, 'NEXUS-FDJ-Manager-v1.html'), 'utf8');

const m = html.match(/async function chargerShiftCountsStock\(\)[\s\S]*?\n  \}/);
assert.ok(m, 'Fonction chargerShiftCountsStock introuvable');
const corps = m[0];

assert.ok(corps.includes("from('fdj_shift_counts')"), 'Doit interroger fdj_shift_counts');
assert.ok(corps.includes('stock_final'), 'BUG RÉGRESSÉ : le select doit inclure stock_final — sans cette colonne, NexusFdjMoteur.ticketsRestantsCarnetEnCours() ignore systématiquement toutes les lignes (garde explicite sur stock_final null/undefined) et "Carnet en cours"/"Tickets restants" restent bloqués sur "Aucun"/"Non calculable" pour tous les jeux, même quand des comptages de quart existent réellement en base.');
// Les autres colonnes déjà nécessaires (approNonTraceParJeu, rotationCarnetsJeu
// indirectement via created_at) ne doivent pas disparaître à l'occasion du
// correctif.
['shift_id', 'game_id', 'appro', 'ventes_qte', 'created_at'].forEach(col => {
  assert.ok(corps.includes(col), `Colonne "${col}" attendue dans le select (ne doit pas régresser)`);
});

console.log('✓ chargerShiftCountsStock() sélectionne bien stock_final (+ toutes les colonnes déjà nécessaires)');
console.log('\nTest fdj_shift_counts_stock_final passe.');
