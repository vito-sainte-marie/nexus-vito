// Correction de recette iOS (Guardian 7113790954) : champs sans débordement, date vide indiquée, code lu seul.
const fs = require('fs'); const assert = require('assert');
const html = fs.readFileSync(`${__dirname}/NEXUS-Dates-Courtes-Releve-v1.html`, 'utf-8');
let ok = 0, ko = 0;
function t(n, f) { try { f(); ok++; console.log('  ok  ' + n); } catch (e) { ko++; console.log('  KO  ' + n + '\n      ' + e.message); } }
const css = html.slice(html.indexOf('<style'), html.indexOf('</style>'));
t('.champ : box-sizing border-box, min-width 0, largeur contenue', () => {
  const r = /\.champ input,\.champ textarea,\.champ select\{([^}]*)\}/.exec(css); assert(r);
  assert(/box-sizing:border-box/.test(r[1]) && /min-width:0/.test(r[1]) && /max-width:100%/.test(r[1]));
});
t('champ date : appearance none et hauteur garantie', () => {
  const r = /\.champ input\[type=date\]\{([^}]*)\}/.exec(css); assert(r);
  assert(/-webkit-appearance:none/.test(r[1]) && /height:48px/.test(r[1]));
});
t('les deux champs date passent par champDate (saisie et Nouvelle date limite)', () => {
  assert(/champDate\('champDate',saisie\.date\)/.test(html) && /champDate\('fNouv',''\)/.test(html));
  assert(!/<input type="date" id="(champDate|fNouv)"/.test(html));
});
t('indication « Touchez pour choisir la date » tant que le champ est vide', () => {
  assert(html.includes('Touchez pour choisir la date'));
  assert(/\.datewrap\.vide \.ph\{display:block\}/.test(css) && /\.datewrap \.ph\{[^}]*display:none/.test(css));
  assert(/pointer-events:none/.test(css));
});
t('la date posée retire l\'indication (écouteurs input et change)', () => {
  assert(/addEventListener\('input'[\s\S]{0,200}toggle\('vide',!t\.value\)/.test(html));
  assert(/addEventListener\('change'[\s\S]{0,200}toggle\('vide',!t\.value\)/.test(html));
});
t('aucune forme enregistrée « · lu : » côté employé', () => { assert(!html.includes("' · lu : '")); });
console.log(`\n${ok} réussis, ${ko} échecs`); process.exit(ko ? 1 : 0);
