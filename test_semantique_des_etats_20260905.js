// NEXUS — « aucune donnée », « donnée incohérente » et « requête échouée »
// sont trois états distincts (05/09/2026).
//
// Audit A4-bis : 928 `console.error` dans le code applicatif, contre 8
// `console.warn` et 10 `console.info`. NEXUS n'avait pratiquement qu'un seul
// niveau de gravité — et un système qui journalise tout au même niveau ne
// permet plus de distinguer ce qui doit réveiller quelqu'un de ce qui décrit
// un état normal.
//
// Le motif le plus coûteux n'était pas le bruit, c'était la PERTE DE
// DIAGNOSTIC :
//
//     if (error || !data || !data.length) { console.error('Chargement products:', error); … }
//
// Une base tombée et une table vide produisaient la même ligne. Et quand
// c'était l'absence qui déclenchait, `error` valait null : la console
// affichait « Chargement products: null ». Devant cela, personne ne peut dire
// si Supabase est en panne ou si le commerce n'a pas encore importé ses
// ventes.
//
// LA RÈGLE que ce test garde :
//   requête échouée / exception            → console.error
//   requête réussie, 0 donnée, état normal  → console.info (ou silence)
//   données présentes mais incohérentes     → console.warn
//
// Ce test porte sur le MOTIF, jamais sur des numéros de ligne.
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const RACINE = __dirname;
let ok = 0;
function verifier(libelle, condition) {
  console.log(`${condition ? 'OK  ' : 'ÉCHEC'} — ${libelle}`);
  assert.ok(condition, libelle);
  ok++;
}

// Le vocabulaire d'erreur de NEXUS est francophone et local : `erreurUpload`,
// `errSeuil`, `eSnap`, `e10`, `sourceError`… Mon premier passage d'audit ne
// reconnaissait que `error`/`err` et classait 195 appels corrects comme
// « non classés ». Un test qui se trompe de vocabulaire produit du bruit, et
// le bruit finit par être ignoré.
const ALIAS_ERREUR = /\b(error|err|erreur\w*|e[A-Z]\w*|e\d+|e)\b/;
const VACUITE = /!\s*\w*(data|rows|res|liste|items|Brut)\b|\.length\s*(===?\s*0|<\s*1)|!\w+\.length|==\s*null|=== null/;
const MODULE_ABSENT = /non charg|non install|indisponible/;

function analyser() {
  const resultats = { technique: 0, vacuiteSeule: [], mixte: [] };
  for (const f of fs.readdirSync(RACINE)) {
    if (!/\.(js|html)$/.test(f) || f.startsWith('test_') || f === 'run-tests.js') continue;
    const lignes = fs.readFileSync(path.join(RACINE, f), 'utf8').split('\n');
    lignes.forEach((l, i) => {
      if (l.trim().startsWith('//') || !l.includes('console.error(')) return;
      let condition = null;
      for (let j = i; j > Math.max(-1, i - 4); j--) {
        const m = [...lignes[j].matchAll(/\bif\s*\(([^{]*?)\)\s*\{?|\bcatch\s*\(/g)];
        if (m.length) { condition = m[m.length - 1][1] !== undefined ? m[m.length - 1][1] : 'catch'; break; }
      }
      const appel = l.slice(l.indexOf('console.error('), l.indexOf('console.error(') + 160);
      const surErreur = condition === 'catch' || ALIAS_ERREUR.test(condition || '')
        || new RegExp('console\\.error\\([^,]+,\\s*' + ALIAS_ERREUR.source).test(appel);
      const surVacuite = VACUITE.test(condition || '');
      const repere = `${f}:${i + 1}  ${l.trim().slice(0, 100)}`;
      if (MODULE_ABSENT.test(appel)) resultats.technique++;
      else if (surErreur && surVacuite) resultats.mixte.push(repere);
      else if (surErreur) resultats.technique++;
      else if (surVacuite) resultats.vacuiteSeule.push(repere);
      else resultats.technique++;   // garde locale non reconnue : traitée comme technique
    });
  }
  return resultats;
}

const r = analyser();

// ── La règle, et rien d'autre ────────────────────────────────────────────
if (r.vacuiteSeule.length) {
  console.error('\nconsole.error déclenchés par une absence de données :');
  r.vacuiteSeule.forEach(x => console.error('  ✘ ' + x));
}
verifier(`aucun console.error sous une garde de vacuité seule (${r.vacuiteSeule.length})`,
  r.vacuiteSeule.length === 0);

if (r.mixte.length) {
  console.error('\nconditions mêlant erreur technique et absence de données :');
  r.mixte.forEach(x => console.error('  ✘ ' + x));
  console.error('\n  Séparer les deux cas : `if (error)` → console.error ;');
  console.error('  `if (!data || !data.length)` → console.info. Sans quoi une panne');
  console.error('  de base et une table vide produisent la même ligne de journal.');
}
verifier(`aucune condition ne mêle erreur et vacuité dans un console.error (${r.mixte.length})`,
  r.mixte.length === 0);

// ── Contrôle de dérive, PAS une cible ────────────────────────────────────
// Le nombre d'erreurs techniques n'est pas une vérité architecturale : il a
// vocation à croître quand on ajoute de vraies gardes. Ce plancher n'existe
// que pour repérer une extinction massive — quelqu'un qui ferait taire les
// journaux pour « nettoyer la console ». Il ne doit jamais devenir un seuil
// qu'on ajuste à chaque ajout légitime.
verifier(`les gardes d'erreur technique n'ont pas été massivement retirées (${r.technique})`,
  r.technique >= 850);

// ── Les trois niveaux existent bel et bien ───────────────────────────────
function compter(motif) {
  let n = 0;
  for (const f of fs.readdirSync(RACINE)) {
    if (!/\.(js|html)$/.test(f) || f.startsWith('test_')) continue;
    for (const l of fs.readFileSync(path.join(RACINE, f), 'utf8').split('\n')) {
      if (!l.trim().startsWith('//')) n += (l.match(motif) || []).length;
    }
  }
  return n;
}
const infos = compter(/console\.info\(/g);
const avertissements = compter(/console\.warn\(/g);
verifier(`l'absence normale se journalise en info (${infos})`, infos >= 15);
verifier(`l'incohérence métier se journalise en avertissement (${avertissements})`, avertissements >= 12);

// ── Les messages disent ce qu'ils constatent ─────────────────────────────
const lireTout = f => fs.readFileSync(path.join(RACINE, f), 'utf8');
verifier('l’anomalie « période inexploitable » dit que des lignes existent',
  ['NEXUS-Cockpit-v2.html', 'NEXUS-Produits-v1.html', 'NEXUS-Scanner-v1.html']
    .every(f => /console\.warn\('products[^']*des lignes existent mais aucune période exploitable/.test(lireTout(f))));
verifier('l’anomalie « pas de prise de poste » se dit incohérence de contexte, pas panne',
  /console\.warn\('Sauvegarde progression[^']*incohérence de contexte métier, pas une panne technique/
    .test(lireTout('NEXUS-Missions-v1.html')));
verifier('plus aucun message hybride ne journalise une erreur nulle',
  !/console\.error\('Chargement products:', error\)/.test(lireTout('nexus-conseiller-donnees.js')));

console.log(`\n${ok} vérifications passées — ${r.technique} gardes techniques, ${infos} infos, ${avertissements} avertissements.`);
