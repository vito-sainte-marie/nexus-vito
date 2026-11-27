'use strict';
// Garde (Guardian 7135547642, lot 1) : un script local injecté dynamiquement doit passer par NexusBuild.versionner.
// Sans cela, la page charge une version du script différente de celle du reste de la page (générations mélangées).
// Périmètre : tous les nexus-*.js et toutes les pages HTML qui créent un <script> ou en écrivent un par document.write.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const D = __dirname;
let n = 0;
function t(nom, f) { f(); n++; console.log('OK ' + nom); }

// Affectations de .src tolérées sans versionner : script externe (URL absolue) ou variable alimentée
// uniquement par des appels versionner (nexus-auth.js : tableaux de NexusBuild.versionner(...)).
const TOLERES = [
  { fichier: 'NEXUS-Dates-Courtes-Releve-v1.html', motif: /s\.src\s*=\s*ZXING_URL/ },
  { fichier: 'nexus-auth.js', motif: /s\.src\s*=\s*src\b/ },
  { fichier: 'nexus-charger-pdf.js', motif: /s\.src\s*=\s*src\b/ }
];

function fautes(fichier, source) {
  const sortie = [];
  const cree = /createElement\(\s*['"]script['"]\s*\)/.test(source);
  source.split('\n').forEach((ligne, i) => {
    if (cree) {
      const re = /\.src\s*=\s*([^;]+)/g; let m;
      while ((m = re.exec(ligne))) {
        if (/versionner\s*\(/.test(m[1])) continue;
        if (TOLERES.some(x => x.fichier === fichier && x.motif.test(ligne))) continue;
        sortie.push(fichier + ':' + (i + 1) + ' .src sans versionner : ' + m[0].trim().slice(0, 80));
      }
    }
    const w = /document\.write\(\s*['"]<script[^>]*src=/.exec(ligne);
    if (w && !/versionner\s*\(/.test(ligne)) sortie.push(fichier + ':' + (i + 1) + ' document.write de script sans versionner');
  });
  return sortie;
}

const fichiers = fs.readdirSync(D).filter(f => /^nexus-.*\.js$/.test(f) || /\.html$/.test(f));

t('aucun .src de script local n\'est affecté sans versionner', () => {
  const tout = [];
  fichiers.forEach(f => tout.push(...fautes(f, fs.readFileSync(path.join(D, f), 'utf8'))));
  assert.deepStrictEqual(tout, [], tout.join('\n'));
});

t('le périmètre couvre les injections connues', () => {
  ['nexus-inventaire-mission-rules-donnees.js', 'nexus-header-nav.js', 'nexus-desktop.js', 'nexus-auth.js']
    .forEach(f => assert.ok(fichiers.includes(f), f + ' hors périmètre'));
});

// Mutation : remettre une chaîne nue à la place de l'appel versionner doit rougir la garde.
t('mutation : script injecté sans versionner détecté', () => {
  const f = 'nexus-inventaire-mission-rules-donnees.js';
  const src = fs.readFileSync(path.join(D, f), 'utf8');
  const ancre = "NexusBuild.versionner('nexus-inventaire-fluidite.js')";
  assert.ok(src.includes(ancre), 'ancre absente : adapter la mutation');
  assert.strictEqual(fautes(f, src).length, 0);
  assert.strictEqual(fautes(f, src.replace(ancre, "'nexus-inventaire-fluidite.js'")).length, 1);
});
t('mutation : document.write sans versionner détecté', () => {
  const f = 'nexus-carburant-commande-donnees.js';
  const src = fs.readFileSync(path.join(D, f), 'utf8');
  const ancre = "NexusBuild.versionner('nexus-carburant-commande-coherence-v1.js')";
  assert.ok(src.includes(ancre), 'ancre absente : adapter la mutation');
  assert.strictEqual(fautes(f, src.replace(ancre, "'nexus-carburant-commande-coherence-v1.js'")).length >= 1, true);
});
console.log(n + ' épreuves OK');
