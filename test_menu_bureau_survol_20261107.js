// Menu de la vue bureau plus lisible au survol (Guardian 6715088867, 07/11/2026) : survol et focus clavier = icône 24 px,
// titre 16 px semi-gras, fond plus clair, transition 150 ms, sans déplacer les autres rangées ; grands écrans (≥ 1600 px) plus larges ;
// mouvement réduit sans animation ; le mobile ne change pas.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
let n = 0;
function t(nom, f) { f(); n++; console.log('OK ' + nom); }
const lire = f => fs.readFileSync(path.join(__dirname, f), 'utf8');
function garde(nom, src, regle, litteral, remplacement) {
  t(nom, () => {
    assert.ok(regle(src), 'la garde doit passer sur la source');
    assert.ok(src.indexOf(litteral) >= 0, 'littéral introuvable : ' + litteral);
    assert.ok(!regle(src.replace(litteral, remplacement)), 'la garde doit rougir sur la source mutée');
  });
}
const DESK = lire('nexus-desktop.js');
const css = DESK.slice(DESK.indexOf('.nexus-sidebar{'));
const bloc = (src, entete) => {
  const i = src.indexOf(entete); if (i < 0) return '';
  let d = 0, j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (d === 0) return src.slice(j + 1, k); } }
  return '';
};
const GRAND = bloc(css, '@media (min-width:1600px)');
const REDUIT = bloc(css, '@media (prefers-reduced-motion:reduce)');

t('survol ET focus clavier : même règle, fond plus clair, titre 16 px semi-gras', () => {
  assert.ok(/\.nexus-sidebar-link:hover, \.nexus-sidebar-link:focus-visible\{[^}]*font-size:16px;[^}]*font-weight:600/.test(css));
  assert.ok(/\.nexus-sidebar-link:hover, \.nexus-sidebar-link:focus-visible\{[^}]*background:#222D3A/.test(css));
});
t('survol ET focus : l\'icône passe à 24 px', () => {
  assert.ok(/\.nexus-sidebar-link:hover img, \.nexus-sidebar-link:focus-visible img\{width:24px; height:24px/.test(css));
});
t('hauteur réservée : la rangée a une hauteur fixe, rien ne bouge au survol', () => {
  const r = (css.match(/\.nexus-sidebar-link\{[^}]*\}/) || [''])[0];
  assert.ok(/[ ;]height:44px/.test(r) && /box-sizing:border-box/.test(r), r);
  assert.ok(!/(^|[^-])padding:8px/.test(r), 'plus de padding vertical qui grandit avec le contenu');
});
t('transition d\'environ 150 ms sur la taille, le fond et la couleur', () => {
  const r = (css.match(/\.nexus-sidebar-link\{[^}]*\}/) || [''])[0];
  ['background-color 150ms', 'color 150ms', 'font-size 150ms'].forEach(x => assert.ok(r.includes(x), x));
  assert.ok(/img\{[^}]*transition:width 150ms ease, height 150ms ease/.test(css));
});
t('grands écrans (≥ 1600 px) : icône 20 px, titre 15 px, interligne plus large, sans survol', () => {
  assert.ok(GRAND, 'bloc @media (min-width:1600px) introuvable');
  assert.ok(/\.nexus-sidebar-link\{[^}]*font-size:15px[^}]*line-height:1\.3/.test(GRAND));
  assert.ok(/\.nexus-sidebar-link img\{width:20px; height:20px/.test(GRAND));
});
t('mouvement réduit : plus de transition, l\'état change seul', () => {
  assert.ok(REDUIT, 'bloc prefers-reduced-motion introuvable');
  assert.ok(/transition:none/.test(REDUIT));
  assert.ok(/\.nexus-sidebar-link img/.test(REDUIT));
});
t('emoji et anciens PNG suivent la même règle de taille (classe dédiée, y compris la puce de repli)', () => {
  assert.ok(DESK.includes('<span class="nexus-sidebar-emoji" style="font-size:15px;">'));
  assert.ok(DESK.includes("puce.className = 'nexus-sidebar-emoji'"));
  assert.ok(/:hover \.nexus-sidebar-emoji, \.nexus-sidebar-link:focus-visible \.nexus-sidebar-emoji\{font-size:22px !important/.test(css));
  assert.ok(/\.nexus-sidebar-link \.nexus-sidebar-emoji\{font-size:18px !important/.test(GRAND));
});
t('l\'icône v2 ≤ 24 px reste le -24.svg simplifié (pas de srcset flou) : le registre n\'est pas touché', () => {
  assert.ok(DESK.includes('NexusIcones.img(item.module, 16, { decoratif: true, ancien })'));
  const R = lire('nexus-icones.js');
  assert.ok(/SEUIL_SIMPLIFIE\s*=\s*24/.test(R));
});
t('titre long : au plus deux lignes dans la hauteur réservée', () => {
  assert.ok(/\.nexus-sidebar-link > span:last-child\{[^}]*-webkit-line-clamp:2[^}]*overflow:hidden/.test(css));
});
t('thème Jour : survol et focus ont leur surcharge, contraste conservé', () => {
  assert.ok(/\[data-theme="jour"\] \.nexus-sidebar-link:hover, \[data-theme="jour"\] \.nexus-sidebar-link:focus-visible\{background:#E3E9EE; color:#0F172A/.test(css));
});
t('le menu mobile et les tuiles d\'accueil ne changent pas : aucun fichier autre que nexus-desktop.js n\'est visé', () => {
  assert.ok(!/nexus-sidebar-link\{/.test(lire('NEXUS-App-v1.html')), 'la page mobile ne porte pas ces styles');
  assert.ok(/@media \(min-width:900px\)\{\s*\.nexus-vue-bureau-flottant/.test(css), 'bascule bureau intacte');
});

garde('hover : l\'icône à 24 px', css, c => /:hover img, \.nexus-sidebar-link:focus-visible img\{width:24px; height:24px/.test(c), 'width:24px; height:24px', 'width:16px; height:16px');
garde('focus clavier : même rendu que le survol', css, c => /\.nexus-sidebar-link:hover, \.nexus-sidebar-link:focus-visible\{background:#222D3A/.test(c), ':hover, .nexus-sidebar-link:focus-visible{background:#222D3A', ':hover{background:#222D3A');
garde('survol : titre à 16 px semi-gras', css, c => /:focus-visible\{[^}]*font-size:16px;[^}]*font-weight:600/.test(c), 'font-size:16px; font-weight:600', 'font-size:12.5px; font-weight:400');
garde('hauteur réservée de la rangée', css, c => /\.nexus-sidebar-link\{[^}]*[ ;]height:44px/.test(c), 'height:44px; box-sizing', 'min-height:44px; box-sizing');
garde('grands écrans : media query 1600 px', css, c => /@media \(min-width:1600px\)\{[^@]*img\{width:20px/.test(c), '@media (min-width:1600px)', '@media (min-width:1900px)');
garde('grands écrans : titre 15 px', css, c => /@media \(min-width:1600px\)\{[^@]*font-size:15px/.test(c), 'height:48px; font-size:15px', 'height:48px; font-size:13px');
garde('mouvement réduit : transition coupée', css, c => /prefers-reduced-motion:reduce\)\{[^@]*transition:none/.test(c), 'transition:none;}\n  }', 'transition:all;}\n  }');
garde('transition de 150 ms', css, c => /\.nexus-sidebar-link\{[^}]*font-size 150ms ease/.test(c), 'font-size 150ms ease', 'font-size 0ms ease');

// ---- Vignettes de l'avatar (Guardian 6715143323) : l'en-tête du menu ne charge plus le PNG de 1,67 Mo ----
const APPH = lire('NEXUS-App-v1.html');
t('vignettes d\'avatar 64/96/128 px présentes, carrées et légères', () => {
  [64, 96, 128].forEach(px => {
    const p = path.join(__dirname, 'assets/avatar/nexus-avatar-' + px + '.png');
    assert.ok(fs.existsSync(p), px);
    const b = fs.readFileSync(p);
    assert.strictEqual(b.readUInt32BE(16), px); assert.strictEqual(b.readUInt32BE(20), px);
    assert.ok(b.length <= 40 * 1024, px + ' px : ' + b.length + ' octets');
  });
});
t('l\'en-tête du menu bureau et les deux avatars de l\'accueil utilisent les vignettes, plus le PNG pleine définition', () => {
  assert.ok(/<a class="nexus-sidebar-brand"[^>]*>\s*<img src="assets\/avatar\/nexus-avatar-64\.png" srcset="[^"]*128w" sizes="30px"/.test(DESK));
  assert.ok(!/nexus-sidebar-brand[^>]*>\s*<img src="nexus-avatar\.png"/.test(DESK));
  assert.strictEqual((APPH.match(/class="conseiller-avatar" src="assets\/avatar\/nexus-avatar-96\.png" srcset=/g) || []).length, 2);
  assert.ok(!/class="conseiller-avatar" src="assets\/nexus-avatar\.png"/.test(APPH));
});
garde('l\'en-tête du menu : vignette en srcset', DESK, c => /<img src="assets\/avatar\/nexus-avatar-64\.png" srcset="[^"]*128w"/.test(c), 'src="assets/avatar/nexus-avatar-64.png" srcset=', 'src="nexus-avatar.png" data-x=');
garde('l\'accueil : avatars du conseiller en vignette', APPH, c => (c.match(/class="conseiller-avatar" src="assets\/avatar\/nexus-avatar-96\.png" srcset=/g) || []).length === 2, 'class="conseiller-avatar" src="assets/avatar/nexus-avatar-96.png" srcset=', 'class="conseiller-avatar" src="assets/nexus-avatar.png" data-x=');

console.log(n + ' épreuves OK');
