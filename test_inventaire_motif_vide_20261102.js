// Test — un motif vide (placeholder « Choisir un motif… ») n'est ni affiché ni enregistré comme motif déclaré (défaut B, 02/11).
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const SRC = fs.readFileSync(process.env.SRC_MUTE || path.join(__dirname, 'NEXUS-Inventaire-v1.html'), 'utf8');

function extraire(nom, source) {
  const debut = source.indexOf(`function ${nom}(`);
  assert.ok(debut >= 0, `fonction ${nom} introuvable`);
  let i = source.indexOf('{', debut), n = 0;
  for (let j = i; j < source.length; j++) {
    if (source[j] === '{') n++;
    else if (source[j] === '}' && --n === 0) return source.slice(debut, j + 1);
  }
  throw new Error(`accolade non fermée pour ${nom}`);
}

let ok = 0;
function cas(nom, f) { f(); ok++; console.log('  ✓ ' + nom); }

const debutListe = SRC.indexOf('const MOTIFS_ECART = [');
const finListe = SRC.indexOf('];', debutListe) + 2;
assert.ok(debutListe > 0 && finListe > debutListe, 'liste MOTIFS_ECART introuvable');

function libelle(value) {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(SRC.slice(debutListe, finListe) + '\n' + extraire('libelleMotifEcart', SRC) + '\nthis.r = libelleMotifEcart(' + JSON.stringify(value) + ');', ctx);
  return ctx.r;
}

cas('valeur vide : aucun libellé (jamais le placeholder)', () => {
  assert.strictEqual(libelle(''), null);
});
cas('valeur absente : aucun libellé', () => {
  assert.strictEqual(libelle(undefined), null);
});
cas('motif réel : libellé conservé', () => {
  assert.strictEqual(libelle('casse'), 'Casse');
  assert.strictEqual(libelle('autre'), 'Autre raison');
});
cas('valeur inconnue : aucun libellé', () => {
  assert.strictEqual(libelle('nimporte_quoi'), null);
});

// Chaîne de résolution de validerOuverture : sans motif ni justification, aucune résolution.
function resolutionPour(saisie) {
  const debut = SRC.indexOf('const motifLibelle = libelleMotifEcart(saisie.motifEcart);');
  const fin = SRC.indexOf('// 30/08/2026 (branchement du seuil', debut);
  assert.ok(debut > 0 && fin > debut, 'bloc de résolution introuvable');
  const ctx = { saisie, livraisonDeclaree: null, resolution: null, fmtNum: String };
  vm.createContext(ctx);
  vm.runInContext(SRC.slice(finListeIdx(), finListe) + '\n' + extraire('libelleMotifEcart', SRC) + '\n' + SRC.slice(debut, fin), ctx);
  return ctx.resolution;
}
function finListeIdx() { return debutListe; }

cas('écart sans motif ni justification : aucune résolution (pas de « Motif déclaré… »)', () => {
  assert.strictEqual(resolutionPour({ motifEcart: '', justification: '' }), null);
});
cas('écart avec justification seule : « Justifié par l\'employé »', () => {
  assert.strictEqual(resolutionPour({ motifEcart: '', justification: 'carton cassé' }), 'Justifié par l\'employé : carton cassé');
});
cas('écart avec motif réel : « Motif déclaré par l\'employé : Casse. »', () => {
  assert.strictEqual(resolutionPour({ motifEcart: 'casse', justification: '' }), 'Motif déclaré par l\'employé : Casse.');
});

console.log(`\n${ok} contrôles OK`);
