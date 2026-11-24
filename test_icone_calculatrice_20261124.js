// Icône de la calculatrice de comptage (lot ICONE-CALCULATRICE, 24/11/2026, commandée par le pilote).
// Contrat gardé : l'icône est déclarée, ses fichiers existent sous les plafonds de poids,
// le bouton de l'Inventaire n'a plus de texte ni d'emoji, garde son aria-label et une cible tactile de 44 px.
// Chaque garde est suivie d'une mutation qui doit la faire rougir.
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const R = __dirname;
const D = path.join(R, 'assets/icones/v2/act-calculatrice');
const lire = f => fs.readFileSync(path.join(R, f), 'utf8');
const HTML = lire('NEXUS-Inventaire-v1.html');
const ICO = lire('nexus-icones.js');
const LISEZ = lire('assets/icones/v2/LISEZMOI.txt');
let ok = 0;
function garde(nom, test, mutation) {
  test(false);
  if (mutation) {
    let rouge = false;
    try { test(true); } catch (e) { rouge = true; }
    assert.ok(rouge, 'la mutation ne fait pas rougir : ' + nom);
  }
  ok++;
  console.log('  ✓ ' + nom);
}
const bouton = src => { const m = src.match(/<button type="button" class="calc-pop-btn"[^>]*>[\s\S]*?<\/button>/); assert.ok(m, 'bouton introuvable'); return m[0]; };
const css = src => { const m = src.match(/\.calc-pop-btn\{[^}]*\}/); assert.ok(m, 'règle introuvable'); return m[0]; };

garde('icône déclarée dans nexus-icones.js', mut => {
  const s = mut ? ICO.replace(/'act-calculatrice':[^\n]*\n/, '') : ICO;
  assert.ok(/'act-calculatrice':\s*\{ libelle: 'Calculatrice' \}/.test(s));
}, true);

garde('tous les fichiers sont présents', mut => {
  const noms = ['act-calculatrice.svg', 'act-calculatrice@1x.webp', 'act-calculatrice@2x.webp', 'act-calculatrice@3x.webp', 'act-calculatrice-24.svg', 'act-calculatrice-24.png'];
  if (mut) noms.push('act-calculatrice-absent.svg');
  noms.forEach(n => assert.ok(fs.existsSync(path.join(D, n)), n + ' manquant'));
}, true);

garde('plafonds de poids : @2x ≤ 15 Ko, @3x ≤ 25 Ko', mut => {
  const p2 = fs.statSync(path.join(D, 'act-calculatrice@2x.webp')).size + (mut ? 20000 : 0);
  const p3 = fs.statSync(path.join(D, 'act-calculatrice@3x.webp')).size + (mut ? 30000 : 0);
  assert.ok(p2 <= 15 * 1024 && p3 <= 25 * 1024);
}, true);

garde('WebP valides et PNG 24 px de 24 × 24', mut => {
  ['@1x', '@2x', '@3x'].forEach(e => {
    const b = fs.readFileSync(path.join(D, 'act-calculatrice' + e + '.webp'));
    assert.ok(b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP');
  });
  const p = fs.readFileSync(path.join(D, 'act-calculatrice-24.png'));
  assert.strictEqual(p.readUInt32BE(16), mut ? 25 : 24);
  assert.strictEqual(p.readUInt32BE(20), 24);
}, true);

garde('le bouton ne porte ni texte ni emoji', mut => {
  const b = bouton(mut ? HTML.replace('ancien: \'Calc.\' }) : \'Calc.\'}', 'ancien: \'Calc.\' }) : \'Calc.\'}Calc.') : HTML);
  const texte = b.replace(/<button[^>]*>/, '').replace(/<\/button>/, '').replace(/\$\{[\s\S]*\}/, '').trim();
  assert.strictEqual(texte, '', 'texte résiduel : ' + texte);
  assert.ok(!/\p{Extended_Pictographic}/u.test(b));
}, true);

garde('le bouton utilise l\'icône simplifiée 24 px, décorative (alt vide)', mut => {
  const b = bouton(mut ? HTML.replace("NexusIcones.img('act-calculatrice', 24,", "NexusIcones.img('mod-aide', 24,") : HTML);
  assert.ok(b.includes("NexusIcones.img('act-calculatrice', 24, { decoratif: true"));
}, true);

garde('aria-label « Ouvrir la calculatrice » conservé', mut => {
  assert.ok(bouton(mut ? HTML.replace(' aria-label="Ouvrir la calculatrice"', '') : HTML).includes('aria-label="Ouvrir la calculatrice"'));
}, true);

garde('cible tactile d\'au moins 44 px', mut => {
  const c = css(mut ? HTML.replace('min-height:44px;', '').replace('height:44px;', 'height:28px;') : HTML);
  assert.ok(/min-width:44px/.test(c) && /min-height:44px/.test(c) && /height:44px/.test(c));
}, true);

garde('LISEZMOI nomme l\'origine commandée par le pilote', mut => {
  const s = mut ? LISEZ.replace(/Calculatrice \(act-calculatrice[^\n]*/, '') : LISEZ;
  assert.ok(/act-calculatrice[^\n]*commandée par le pilote/.test(s));
}, true);

console.log(`\n${ok} vérifications passées.`);
