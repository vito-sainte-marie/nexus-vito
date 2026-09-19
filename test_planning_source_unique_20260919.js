#!/usr/bin/env node
// Une seule interface de consommation du planning — 19/09/2026 (mandat 38).
//
// CE QUI A CHANGÉ EN BASE. Depuis la migration
// `20260919180000_planning_source_officielle_projection_normalisee`, deux
// provenances peuvent occuper la même case de `planning_shifts` : la
// génération NEXUS (`source = 'nexus'`) et l'import Google Sheets
// (`source = 'google_sheets'`). La table rend les deux. Seule la vue
// `v_planning_officiel` rend celle qui faisait foi À CETTE DATE, en
// interrogeant `source_planning_applicable(site, date)`.
//
// LA CONSÉQUENCE, et c'est elle que cette épreuve garde : un écran qui relit
// `planning_shifts` pour savoir ce qui était dû ne se trompe pas bruyamment.
// Il rend DEUX lignes là où il en attendait une, ou la ligne de la mauvaise
// provenance — et calcule un retard, une paye ou une affectation contre un
// planning qui ne faisait pas foi. Aucune erreur, aucun journal : un chiffre
// faux.
//
// D'OÙ DEUX FAMILLES, et elles ne se jugent pas de la même façon :
//
//   · LES CONSOMMATEURS de ce qui fait foi — Pointage, Paye, Mon Planning,
//     nexus-station — lisent la VUE et jamais la table.
//
//   · L'ATELIER du manager — NEXUS-Planning-v1.html — doit au contraire voir
//     les BROUILLONS, que la vue ne cache pas mais que `publie` filtre chez
//     les autres. Il garde donc la table, à une condition stricte : chacun de
//     ses accès est BORNÉ par une provenance explicite. Sans cette borne, sa
//     grille empilerait deux plannings dans le même jour, et son bouton
//     « Publier » rendrait visible à toute l'équipe un import déposé mais pas
//     encore contrôlé — ce que le parcours « Importer → Contrôler → Valider
//     et publier » interdit précisément.
//
// Cette épreuve est STATIQUE : elle lit le source. C'est le bon outil ici,
// parce que ce qu'elle juge EST du texte — un nom de table dans un appel. Sa
// morsure a été vérifiée par mutation, provenance par provenance.

'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const RACINE = __dirname;
let passes = 0;
let echecs = 0;
function t(nom, fn) {
  try { fn(); passes++; console.log(`  ✓ ${nom}`); }
  catch (e) { echecs++; process.exitCode = 1; console.error(`  ✗ ${nom}\n    ${e && e.message}`); }
}
const lire = f => fs.readFileSync(path.join(RACINE, f), 'utf8');

// Les appels PostgREST, repérés par `.from('<relation>')`. On compte les
// occurrences plutôt que de les chercher : une seule suffirait à mentir.
const appels = src => (src.match(/\.from\(\s*'([a-z_]+)'\s*\)/g) || [])
  .map(m => m.replace(/^\.from\(\s*'/, '').replace(/'\s*\)$/, ''));

// ── 1 · Les consommateurs de ce qui fait foi ──────────────────────────────

console.log('\n── 1 · Pointage, Paye, Mon Planning, nexus-station : la vue ──');

const CONSOMMATEURS = [
  ['NEXUS-Pointage-v1.html', 1],
  ['nexus-paye-donnees.js', 1],
  ['NEXUS-Mon-Planning-v1.html', 2],
  ['nexus-station.js', 1],
];

CONSOMMATEURS.forEach(([fichier, attendus]) => {
  t(`${fichier} ne lit jamais planning_shifts`, () => {
    const vus = appels(lire(fichier));
    assert.ok(!vus.includes('planning_shifts'),
      `${fichier} lit encore planning_shifts : il verra les deux provenances`);
  });
  t(`${fichier} lit v_planning_officiel ${attendus} fois`, () => {
    const vus = appels(lire(fichier)).filter(r => r === 'v_planning_officiel');
    assert.strictEqual(vus.length, attendus,
      `${fichier} interroge la vue ${vus.length} fois au lieu de ${attendus}`);
  });
});

// La Paye et Pointage s'ouvrent au manager, à qui la RLS montre aussi les
// brouillons. Sans `publie` explicite, leur chiffre dépendrait du rôle de
// celui qui regarde — le même écran dirait deux choses différentes.
[['nexus-paye-donnees.js', 1], ['NEXUS-Pointage-v1.html', 1]].forEach(([fichier, n]) => {
  t(`${fichier} exige publie explicitement`, () => {
    const src = lire(fichier);
    const m = src.match(/\.eq\(\s*'publie'\s*,\s*true\s*\)/g) || [];
    assert.ok(m.length >= n,
      `${fichier} laisse « publié » à la RLS : un brouillon entrerait dans le calcul d'un manager`);
  });
});

// ── 2 · L'atelier du manager : la table, mais bornée ──────────────────────

console.log('\n── 2 · NEXUS-Planning-v1.html : trois accès, trois bornes ──');

const ATELIER = lire('NEXUS-Planning-v1.html');

// Trois accès, et trois seulement — chacun nommé, parce qu'un quatrième
// apparu sans être discuté serait exactement la manière dont la règle
// « une seule source » se perd :
//   1. la grille du mois, qui doit montrer le brouillon que le manager
//      vient de générer — la vue le lui cacherait ;
//   2. la publication du mois généré par NEXUS ;
//   3. la publication du mois IMPORTÉ depuis Google Sheets (19/09/2026).
//      L'import écrit un brouillon, puis publie en SECONDE écriture : c'est
//      ce qui permet de prévisualiser avant d'engager, et c'est pour cela
//      que l'écriture de publication est ici et pas dans la fonction SQL.
t('l\'atelier garde planning_shifts — il doit voir les brouillons', () => {
  const vus = appels(ATELIER).filter(r => r === 'planning_shifts');
  assert.strictEqual(vus.length, 3,
    `l'atelier interroge la table ${vus.length} fois : le contrat en prévoit 3`);
});

// La publication de l'import ne doit toucher QUE ce que l'import vient
// d'écrire. Sans la borne de provenance, valider un mois Google Sheets
// publierait au passage un brouillon NEXUS laissé en attente ; sans la
// borne de période, elle publierait des mois que personne n'a relus.
t('la publication de l\'import est bornée à sa provenance et à sa période', () => {
  const i = ATELIER.indexOf("rpc('importer_planning_google'");
  assert.ok(i > 0, 'l\'écran n\'appelle plus la fonction d\'import');
  const bloc = ATELIER.slice(i, i + 3000);
  for (const borne of ["eq('source', 'google_sheets')", "gte('date'", "lt('date'", "eq('publie', false)"]) {
    assert.ok(bloc.includes(borne),
      `la publication de l'import ne pose pas la borne ${borne} : elle publierait plus que ce qu'elle a importé`);
  }
});

t('l\'atelier ne lit pas la vue — elle lui cacherait son propre brouillon', () => {
  assert.ok(!appels(ATELIER).includes('v_planning_officiel'),
    'l\'atelier lit la vue : le manager ne verrait plus ce qu\'il vient de générer');
});

t('la grille est bornée à une provenance nommée', () => {
  const bloc = ATELIER.slice(ATELIER.indexOf('async function chargerEtAfficherPlanning'));
  const fin = bloc.indexOf('const conteneur = document.getElementById(\'planningGrille\')');
  assert.ok(fin > 0, 'la grille est introuvable — l\'épreuve ne juge plus rien');
  assert.ok(/\.eq\(\s*'source'\s*,\s*SOURCE_PLANNING\s*\)/.test(bloc.slice(0, fin)),
    'la grille lit la table sans borne de provenance : deux plannings dans le même jour');
});

t('« Publier » ne publie que la provenance en vigueur', () => {
  const i = ATELIER.indexOf("getElementById('btnPublier')");
  assert.ok(i > 0, 'le bouton Publier est introuvable — l\'épreuve ne juge plus rien');
  const bloc = ATELIER.slice(i, i + 1600);
  assert.ok(/\.update\(\s*\{\s*publie:\s*true/.test(bloc),
    'la publication a changé de forme — l\'épreuve ne juge plus rien');
  assert.ok(/\.eq\(\s*'source'\s*,\s*SOURCE_PLANNING\s*\)/.test(bloc),
    'Publier publie toutes provenances confondues : un import non contrôlé deviendrait visible');
});

t('SOURCE_PLANNING vient de station_config, pas d\'un défaut figé', () => {
  assert.ok(/SOURCE_PLANNING\s*=\s*valeur;/.test(ATELIER),
    'SOURCE_PLANNING n\'est jamais réassignée : la borne vaudrait toujours « nexus »');
  const i = ATELIER.indexOf('function appliquerSourcePlanning');
  const j = ATELIER.indexOf('SOURCE_PLANNING = valeur;');
  assert.ok(i > 0 && j > i,
    'SOURCE_PLANNING est affectée hors de appliquerSourcePlanning : la source lue ne serait pas celle du site');
});

// ── 3 · La vue existe vraiment, et avec security_invoker ──────────────────

console.log('\n── 3 · La migration qui porte la vue ──');

const MIGRATION = 'supabase/migrations/20260919180000_planning_source_officielle_projection_normalisee.sql';

t('la migration déclare v_planning_officiel', () => {
  const sql = lire(MIGRATION);
  assert.ok(/create view public\.v_planning_officiel/.test(sql),
    'la vue n\'est plus créée par la migration que les écrans interrogent');
});

t('la vue est security_invoker — sinon elle court-circuiterait la RLS', () => {
  const sql = lire(MIGRATION);
  const m = sql.match(/create view public\.v_planning_officiel[^;]*?;/s);
  assert.ok(m, 'la déclaration de la vue est introuvable');
  assert.ok(/security_invoker\s*=\s*true/.test(m[0]),
    'la vue n\'est pas security_invoker : tout employé lirait le planning de tous les sites, brouillons compris');
});

t('la vue filtre sur la source applicable à la date', () => {
  const sql = lire(MIGRATION);
  const m = sql.match(/create view public\.v_planning_officiel[^;]*?;/s);
  assert.ok(/source_planning_applicable\(\s*ps\.site_id\s*,\s*ps\.date\s*\)/.test(m[0]),
    'la vue ne consulte plus la source applicable : elle rendrait les deux provenances');
});

setTimeout(() => {
  console.log(`\n${passes} réussite(s), ${echecs} échec(s)`);
}, 0);
