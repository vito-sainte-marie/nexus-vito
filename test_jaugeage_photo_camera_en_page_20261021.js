// Épreuves du lot JAUGEAGE-PHOTO-20261021 (décision de Frédéric, option A) :
// la carte Inventaire mène au jaugeage Veeder-Root des Relevés piste ; ce jaugeage ouvre la
// caméra dans la page (repli natif, champ caché par clip et non display:none), mémorise son
// état sur l'appareil et réduit la photo à 2 000 px / JPEG 85 % avant envoi.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
let n = 0;
function t(nom, f) { f(); n++; console.log('OK ' + nom); }
const lire = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');

const inv = lire('NEXUS-Inventaire-v1.html');
const rel = lire('NEXUS-Releves-Piste-v1.html');

t('Inventaire : la carte jaugeage ne démarre plus la saisie manuelle seule', () => {
  assert.ok(!/carteJaugeage\.addEventListener\('click',\s*demarrerJaugeageOuverture\)/.test(inv));
});
t('Inventaire : la carte mène aux Relevés piste, écran jaugeage', () => {
  assert.ok(/NEXUS-Releves-Piste-v1\.html\?ecran=jauge/.test(inv));
});
t('Inventaire : « impossible » reste accessible depuis la carte', () => {
  assert.ok(inv.includes('lienJaugeageImpossible'));
  assert.ok(/lienJaugeageImpossible[\s\S]{0,400}renderJaugeageImpossible/.test(inv));
});

t('module caméra : dimensions plafonnées à 2000 px, jamais agrandies', () => {
  const C = require('./nexus-camera-page.js');
  assert.strictEqual(C.DIM_MAX, 2000);
  assert.strictEqual(C.QUALITE_JPEG, 0.85);
  assert.deepStrictEqual(C.calculerDimensions(4000, 3000), { w: 2000, h: 1500 });
  assert.deepStrictEqual(C.calculerDimensions(3000, 4000), { w: 1500, h: 2000 });
  assert.deepStrictEqual(C.calculerDimensions(1200, 800), { w: 1200, h: 800 });
  assert.strictEqual(C.calculerDimensions(0, 0), null);
});
t('module caméra : expose redimensionner et ouvrirCamera', () => {
  const C = require('./nexus-camera-page.js');
  assert.strictEqual(typeof C.redimensionnerPhoto, 'function');
  assert.strictEqual(typeof C.ouvrirCamera, 'function');
});

t('Relevés piste : charge le module caméra, épinglé ?v=', () => {
  assert.ok(/<script src="nexus-camera-page\.js\?v=[^"]+"><\/script>/.test(rel));
});
t('Relevés piste : le champ photo natif n\'est plus en display:none', () => {
  const m = rel.match(/<input[^>]*id="jPhoto"[^>]*>/);
  assert.ok(m, 'champ jPhoto présent (repli natif)');
  assert.ok(!/display\s*:\s*none/.test(m[0]));
  assert.ok(/clip:\s*rect\(0/.test(m[0]));
});
t('Relevés piste : la caméra en page est ouverte, le natif sert de repli', () => {
  assert.ok(rel.includes('NexusCameraPage.ouvrirCamera'));
  assert.ok(rel.includes("'repli'"));
});
t('Relevés piste : la photo est redimensionnée avant l\'envoi', () => {
  const i = rel.indexOf('async function envoyerPhoto');
  const corps = rel.slice(i, i + 2500);
  assert.ok(corps.includes('redimensionnerPhoto'));
  assert.ok(corps.indexOf('redimensionnerPhoto') < corps.indexOf('.upload('));
});
t('Relevés piste : état du jaugeage mémorisé sur l\'appareil (clé dédiée, try/catch)', () => {
  assert.ok(/nexus_releves_piste_jauge_\$\{emp\.id\}_\$\{date\}/.test(rel));
  assert.ok(/function sauverJauge/.test(rel) && /function lireJauge/.test(rel));
});
t('Relevés piste : lien profond ?ecran=jauge soumis aux habilitations _q1', () => {
  assert.ok(/get\('ecran'\)/.test(rel));
  assert.ok(/ecran'\)\s*===\s*'jauge'|voulEcran\s*===\s*'jauge'/.test(rel));
});
console.log(`\n${n} épreuves.`);
