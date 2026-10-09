#!/usr/bin/env node
// Un semis ne doit jamais exiger une colonne que la release APPORTE.
//
// LE DÉFAUT, deux fois de suite le 09/09/2026. La répétition reconstruit Test à
// l'état d'AVANT la release, y sème, puis applique les migrations. Sur cet état
// historique, une colonne ajoutée par la promotion n'existe pas encore :
// `sites.timezone` vient de 20260905131500_fuseau_horaire_par_site.sql. Le
// semis s'est arrêté dessus, je l'ai corrigé — et le jeu PREPROD portait le
// MÊME défaut, que je n'avais pas cherché. J'ai réparé le fichier qui avait
// échoué au lieu de réparer le motif.
//
// CE QUE CETTE GARDE VÉRIFIE : tout fichier de semis qui nomme une colonne
// introduite par une migration POSTÉRIEURE à la borne doit interroger
// `information_schema` avant de l'écrire.
//
// ELLE EST STATIQUE, ET JE LE DIS PLUTÔT QUE DE LE MASQUER. Aucun serveur
// PostgreSQL n'est disponible sur cette machine : impossible d'exécuter le
// semis sur un schéma borné pour l'éprouver vraiment. Une garde statique lit un
// SUBSTITUT du comportement — c'est exactement la faiblesse relevée sept fois
// cette semaine. Elle attrape la récidive exacte des deux cas d'aujourd'hui,
// elle n'attrape pas une adaptativité écrite mais fausse. La preuve
// comportementale, c'est la répétition elle-même qui la donne.

'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

let passes = 0;
function t(nom, fn) {
  try { fn(); passes++; console.log(`  ✓ ${nom}`); }
  catch (e) { console.error(`  ✗ ${nom}\n    ${e.message}`); process.exitCode = 1; }
}

const RACINE = __dirname;
const BORNE = '20260904130807';   // dernière migration servie en Production
const SEMIS = ['outils/semer-recette-test.sql', 'outils/jeu-preprod-cas-production.sql'];

function colonnesDeLaPromotion(borne) {
  const dir = path.join(RACINE, 'supabase', 'migrations');
  const promo = fs.readdirSync(dir).filter(f => f.endsWith('.sql') && f.split('_')[0] > borne);
  const cols = new Map();
  for (const f of promo) {
    const t = fs.readFileSync(path.join(dir, f), 'utf8');
    for (const m of t.matchAll(/add column\s+(?:if not exists\s+)?([a-z_]+)/gi)) {
      if (!cols.has(m[1])) cols.set(m[1], f);
    }
  }
  return cols;
}

t('la borne sépare bien deux ensembles non vides', () => {
  const dir = path.join(RACINE, 'supabase', 'migrations');
  const tous = fs.readdirSync(dir).filter(f => f.endsWith('.sql'));
  const avant = tous.filter(f => f.split('_')[0] <= BORNE).length;
  const apres = tous.filter(f => f.split('_')[0] > BORNE).length;
  assert.ok(avant > 0 && apres > 0,
    `borne inopérante : ${avant} avant, ${apres} après. Sans les deux côtés, cette garde ne mesure rien.`);
});

t('aucun semis n’écrit une colonne de la promotion sans garde', () => {
  const cols = colonnesDeLaPromotion(BORNE);
  assert.ok(cols.size > 0, 'aucune colonne ajoutée par la promotion : la garde tournerait à vide');
  const fautes = [];
  for (const f of SEMIS) {
    const src = fs.readFileSync(path.join(RACINE, f), 'utf8');
    const garde = /information_schema\.columns/.test(src);
    for (const [c, mig] of cols) {
      if (new RegExp(`\\b${c}\\b`).test(src) && !garde) {
        fautes.push(`${f} écrit « ${c} » (ajoutée par ${mig}) sans interroger information_schema`);
      }
    }
  }
  assert.deepStrictEqual(fautes, [],
    'Un semis exige une colonne que la release apporte :\n    ' + fautes.join('\n    '));
});

t('MUTATION : la garde retirée, les deux fichiers sont bien signalés', () => {
  // On rejoue la vérification sur des copies dégardées. Sans cette mutation,
  // l'épreuve passerait aussi bien sur un dépôt où aucun semis n'écrit jamais
  // de colonne récente — et ne prouverait donc rien.
  const cols = colonnesDeLaPromotion(BORNE);
  const signales = [];
  for (const f of SEMIS) {
    const src = fs.readFileSync(path.join(RACINE, f), 'utf8')
      .replace(/information_schema\.columns/g, 'ailleurs');
    for (const [c] of cols) {
      if (new RegExp(`\\b${c}\\b`).test(src)) { signales.push(f); break; }
    }
  }
  assert.deepStrictEqual(signales.sort(), SEMIS.slice().sort(),
    `la mutation devait signaler les deux semis, elle en signale ${signales.length} : ${signales.join(', ')}`);
});

console.log(`\n${passes}/3 vérifications passées — aucun semis n’exige ce que la release apporte.`);
