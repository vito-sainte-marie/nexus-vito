// Toute migration de la promotion est-elle CLASSÉE au manifeste ?
//
// Le critère `manifeste_migrations_a_jour` exige que chaque migration soit
// classée incluse, exclue ou bloquée. Je l'ai vérifié À LA MAIN le 09/09 au
// matin : 21 migrations, 21 citées. Cinq heures plus tard j'en avais ajouté
// cinq, et le manifeste ne le savait pas.
//
// Un contrôle refait à la main ne se refait pas. Celui-ci part des FICHIERS
// à chaque exécution : une migration ajoutée demain est couverte le jour où
// elle apparaît, et le manifeste ne peut plus vieillir en silence.
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const DIR = path.join(__dirname, 'supabase', 'migrations');
const LOT = path.join(__dirname, 'docs', 'handoff', 'lots', 'NEXUS-PRODUCTION-READINESS-1-20260908');
const MANIFESTE = fs.readFileSync(path.join(LOT, 'manifeste-migrations-production-1.md'), 'utf8');

// Dernière migration déjà appliquée en Production, relevée le 08/09/2026 en
// lecture seule. Tout ce qui vient APRÈS est la promotion.
const VERSION_PRODUCTION = '20260904175722';

let n = 0;
function t(nom, fn) { fn(); n++; console.log('OK — ' + nom); }

const migrations = fs.readdirSync(DIR).filter(f => f.endsWith('.sql')).sort();
const promotion = migrations.filter(f => f.split('_')[0] > VERSION_PRODUCTION);

t('la promotion n’est pas vide et part du bon endroit', () => {
  assert.ok(promotion.length > 0, 'aucune migration postérieure : la borne est fausse');
  assert.ok(migrations.some(f => f.split('_')[0] <= VERSION_PRODUCTION),
    'aucune migration antérieure : la borne est fausse dans l’autre sens');
});

t('CHAQUE migration de la promotion est citée au manifeste', () => {
  const absentes = promotion.filter(f => !MANIFESTE.includes(f.replace(/\.sql$/, '')));
  assert.deepStrictEqual(absentes, [],
    `${absentes.length} migration(s) non classée(s) — le manifeste a vieilli :\n  ` + absentes.join('\n  '));
});

t('le manifeste ne cite aucune migration qui n’existe plus', () => {
  // Une entrée orpheline laisse croire qu'un sujet est traité alors que le
  // fichier a été renommé ou supprimé.
  const citees = [...MANIFESTE.matchAll(/`(20\d{12}_[a-z0-9_]+)`/g)].map(m => m[1]);
  const fantomes = [...new Set(citees)].filter(v => !migrations.some(f => f.startsWith(v)));
  assert.deepStrictEqual(fantomes, [], 'migrations citées mais absentes : ' + fantomes.join(', '));
});

t('une migration qui SE DÉCLARE Test/CI est marquée exclue', () => {
  // Première version : je devinais « Test-only » à la présence de mots comme
  // `nexus-station-test`. Elle accusait `20260906020000_garde_ecriture_site`,
  // qui ne fait que citer ce site dans un commentaire et va bien en Production.
  // Même faux positif que trois fois aujourd'hui : on ne déduit pas la nature
  // d'un fichier de ce qu'il MENTIONNE. On lit ce qu'il DÉCLARE.
  const DECLARATION = /à ne PAS appliquer en Production|NON appliquée en Production|Test uniquement/i;
  const declarees = promotion.filter(f => DECLARATION.test(fs.readFileSync(path.join(DIR, f), 'utf8')));
  assert.ok(declarees.length >= 5, 'le dépôt en contient : la détection est fausse');

  for (const f of declarees) {
    const nom = f.replace(/\.sql$/, '');
    // La LIGNE de la migration, pas une fenêtre autour : une fenêtre de 500
    // caractères attrapait le mot « EXCLUE » des lignes VOISINES du tableau,
    // si bien que dé-classer une migration ne faisait pas échouer l'épreuve.
    // L'exclusion peut être portée par la LIGNE ou par le TITRE de la section
    // qui la contient — le manifeste d'origine groupe les exclusions sous un
    // intertitre, ce qui est une convention légitime et lisible.
    // En revanche, pas de fenêtre de N caractères : elle attrapait le mot
    // « EXCLUE » des lignes VOISINES, si bien que dé-classer une migration ne
    // faisait pas échouer l'épreuve.
    const lignes = MANIFESTE.split('\n');
    const iLigne = lignes.findIndex(l => l.includes(nom));
    assert.ok(iLigne >= 0, `${nom} absente du manifeste`);
    let titre = '';
    for (let k = iLigne; k >= 0; k--) {
      if (/^#{1,4}\s/.test(lignes[k])) { titre = lignes[k]; break; }
    }
    const marque = /EXCLUE|exclue|Test\/CI|Test uniquement/i;
    assert.ok(marque.test(lignes[iLigne]) || marque.test(titre),
      `${nom} se déclare Test/CI, mais ni sa ligne ni sa section ne la marquent exclue : `
      + 'elle serait promue par défaut, et échouerait en Production sur un rôle qui n’y existe pas'
      + `\n  ligne   : ${lignes[iLigne].slice(0, 110)}\n  section : ${titre}`);
  }
});

t('toute migration touchant le rôle CI se DÉCLARE Test/CI', () => {
  // L'autre moitié du contrat : la déclaration ne doit pas être facultative,
  // sinon l'épreuve ci-dessus ne couvre que les fichiers bien élevés.
  const DECLARATION = /à ne PAS appliquer en Production|NON appliquée en Production|Test uniquement/i;
  const muettes = promotion.filter(f => {
    const sql = fs.readFileSync(path.join(DIR, f), 'utf8');
    return /nexus_ci_recette/.test(sql) && !DECLARATION.test(sql);
  });
  assert.deepStrictEqual(muettes, [],
    'migrations touchant le rôle CI sans se déclarer Test/CI : ' + muettes.join(', '));
});

console.log(`\n${n}/${n} vérifications passées — un manifeste qui vieillit en silence promeut ce qu’il ignore.`);
