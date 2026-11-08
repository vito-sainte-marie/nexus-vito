// Effet de loupe façon Dock sur le menu bureau (Guardian 6715331183, 07/11/2026) : échelle selon la distance du pointeur (en lignes),
// transform sans décalage de mise en page, rAF, repli en mouvement réduit et écran tactile.
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
const corps = (src, entete) => {
  const i = src.indexOf(entete); if (i < 0) return '';
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (d === 0) return src.slice(i, k + 1); } }
  return '';
};
const fonction = (src, nom) => new Function(corps(src, 'function ' + nom) + '; return ' + nom + ';')();
const echelle = fonction(DESK, 'nexusEchelleLoupe');
const titre = fonction(DESK, 'nexusEchelleTitreLoupe');
const proche = (a, b, e = 1e-9) => Math.abs(a - b) < e;

t('fonction pure : 0, 1, 2 et 3 lignes donnent x2,2 / x1,6 / x1,25 / x1,08', () => {
  assert.ok(proche(echelle(0), 2.2)); assert.ok(proche(echelle(1), 1.6));
  assert.ok(proche(echelle(2), 1.25)); assert.ok(proche(echelle(3), 1.08));
});
t('rayon de 3,5 lignes : x1 à 3,5 et au-delà ; entrée négative ou invalide : sans erreur', () => {
  assert.ok(proche(echelle(3.5), 1));
  assert.ok(echelle(3.25) > 1 && echelle(3.25) < 1.08);
  [3.51, 4, 10, 1000].forEach(d => assert.strictEqual(echelle(d), 1));
  assert.ok(proche(echelle(-2), 2.2)); assert.ok(proche(echelle(NaN), 2.2)); assert.ok(proche(echelle(undefined), 2.2));
});
t('courbe lisse : décroissante, continue, sans saut entre deux lignes', () => {
  let prec = echelle(0);
  for (let d = 0.01; d <= 4; d += 0.01) {
    const v = echelle(d);
    assert.ok(v <= prec + 1e-12, 'non décroissante en ' + d);
    assert.ok(prec - v < 0.04, 'saut en ' + d);
    prec = v;
  }
  assert.ok(echelle(0.5) > echelle(1) && echelle(0.5) < echelle(0), 'demi-ligne entre les ancres');
});
t('titre : grossit moins que l\'icône, x1,25 sur la ligne survolée, ~x1,1 sur les voisines, x1 au repos', () => {
  assert.ok(proche(titre(1), 1)); assert.ok(proche(titre(echelle(0)), 1.25));
  assert.ok(Math.abs(titre(echelle(1)) - 1.1) < 0.01, String(titre(echelle(1))));
  for (let d = 0; d <= 4; d += 0.25) assert.ok(titre(echelle(d)) <= 1.25 + 1e-9 && titre(echelle(d)) <= echelle(d));
});
t('titre décalé de (échelle - 1) x largeur de l\'icône, sans retrait ; marge à droite réservée ; interligne +4 px au survol du menu', () => {
  const inst = corps(DESK, 'function nexusInstallerLoupeSidebar');
  assert.ok(/dec = icone \? Math\.max\(0, \(echelle - 1\) \* icone\.offsetWidth\) : 0;/.test(inst));
  assert.ok(/\.nexus-sidebar-loupe \.nexus-sidebar-link\{padding-right:46px;/.test(DESK));
  assert.ok(/\.nexus-sidebar-loupe-actif \.nexus-sidebar-link\{margin-bottom:6px;\}/.test(DESK));
  assert.ok(/margin-bottom 120ms ease-out/.test(DESK));
  assert.ok(/classList\.toggle\('nexus-sidebar-loupe-actif', y !== null\)/.test(inst));
  assert.ok(/tous\[0\]\.offsetHeight \+ \(y !== null \? 6 : 2\)/.test(inst));
  assert.ok(/margin-bottom:2px;/.test(DESK), 'interligne de repos inchangé');
});
t('aucun décalage de mise en page : transform scale, origine à gauche, hauteur de ligne non touchée', () => {
  assert.ok(/\.nexus-sidebar-loupe \.nexus-sidebar-link img[^{]*\{\s*transform:scale\(var\(--nl-icone, 1\)\); transform-origin:left center/.test(DESK));
  assert.ok(/> .nexus-sidebar-titre\{\s*transform:translateX\(var\(--nl-dec, 0px\)\) scale\(var\(--nl-titre, 1\)\); transform-origin:left center/.test(DESK));
  assert.ok(!/nexus-sidebar-loupe[^{]*\{[^}]*(?:^|[^-])height:\s*\d/.test(DESK.replace(/img\{width:\d+px; height:\d+px;\}/g, '')), 'la loupe ne change aucune hauteur de ligne');
});
t('transition d\'environ 120 ms', () => {
  assert.ok(/transform 120ms ease-out/.test(DESK));
});
t('repli : mouvement réduit et écran tactile coupent le transform', () => {
  const m = DESK.match(/@media \(prefers-reduced-motion:reduce\), \(hover:none\)\{([^}]*\}[^}]*\}[^}]*)\}/);
  assert.ok(m, 'bloc de repli introuvable'); assert.ok(/transform:none/.test(m[1]));
  const inst = corps(DESK, 'function nexusInstallerLoupeSidebar');
  assert.ok(/\(hover:hover\) and \(pointer:fine\)/.test(inst) && /prefers-reduced-motion:reduce/.test(inst));
  assert.ok(/if \(!mqSouris\.matches \|\| mqCalme\.matches\) return;/.test(inst));
});
t('mise à jour par requestAnimationFrame, mesurée au mousemove sur tout le menu, retour en douceur à la sortie', () => {
  const inst = corps(DESK, 'function nexusInstallerLoupeSidebar');
  assert.ok(/requestAnimationFrame\(appliquer\)/.test(inst));
  assert.ok(/addEventListener\('mousemove'/.test(inst) && /addEventListener\('mouseleave', \(\) => \{ y = null; planifier\(\); \}\)/.test(inst));
  assert.ok(/addEventListener\('scroll'/.test(inst));
  assert.ok(/nexusEchelleLoupe\(Math\.abs\(y -/.test(inst));
});
t('l\'installateur est appelé à l\'init de la vue bureau, après les replis d\'icônes', () => {
  assert.ok(/nexusInstallerReplisIconesSidebar\(\);\s*nexusInstallerLoupeSidebar\(\);/.test(DESK));
});
t('à la loupe, le survol simple cède la place au transform (taille de base, y compris >= 1600 px) ; le focus clavier garde l\'agrandissement', () => {
  assert.ok(/\.nexus-sidebar-loupe \.nexus-sidebar-link:hover img\{width:16px; height:16px;\}/.test(DESK));
  assert.ok(/@media \(min-width:1600px\)\{\s*\.nexus-sidebar-loupe \.nexus-sidebar-link:hover\{font-size:15\.0px;\}\s*\.nexus-sidebar-loupe \.nexus-sidebar-link:hover img\{height:20px; width:20px;\}/.test(DESK));
  assert.ok(!/nexus-sidebar-loupe[^{]*focus-visible/.test(DESK));
  assert.ok(/\.nexus-sidebar-link:hover, \.nexus-sidebar-link:focus-visible img|\.nexus-sidebar-link:hover img, \.nexus-sidebar-link:focus-visible img\{width:24px/.test(DESK));
});
t('emoji et anciens PNG suivent la même règle (même sélecteur de transform)', () => {
  assert.ok(/\.nexus-sidebar-loupe \.nexus-sidebar-link \.nexus-sidebar-emoji\{\s*transform:scale/.test(DESK));
});

const FN = corps(DESK, 'function nexusEchelleLoupe');
garde('fonction : x2,2 sur la ligne la plus proche', FN, c => proche(new Function(c + '; return nexusEchelleLoupe')()(0), 2.2), '[2.2, 1.6', '[1.9, 1.6');
garde('fonction : x1,6 à une ligne', FN, c => proche(new Function(c + '; return nexusEchelleLoupe')()(1), 1.6), '1.6, 1.25', '1.5, 1.25');
garde('fonction : x1,25 à deux lignes', FN, c => proche(new Function(c + '; return nexusEchelleLoupe')()(2), 1.25), '1.25, 1.08', '1.3, 1.08');
garde('fonction : x1,08 à trois lignes', FN, c => proche(new Function(c + '; return nexusEchelleLoupe')()(3), 1.08), '1.08, 1]', '1.15, 1]');
garde('fonction : taille normale à partir de 3,5 lignes', FN, c => new Function(c + '; return nexusEchelleLoupe')()(5) === 1, 'if (d >= POSITIONS[POSITIONS.length - 1]) return 1;', 'if (d >= 99) return 1;');
garde('titre : plafonné à x1,25', corps(DESK, 'function nexusEchelleTitreLoupe'), c => proche(new Function(c + '; return nexusEchelleTitreLoupe')()(2.2), 1.25), '0.25 *', '0.4 *');
garde('titre : pas de retrait du décalage', DESK, c => /dec = icone \? Math\.max\(0, \(echelle - 1\) \* icone\.offsetWidth\) : 0;/.test(c), '* icone.offsetWidth) : 0', '* icone.offsetWidth - 8) : 0');
garde('marge à droite réservée pour le titre agrandi', DESK, c => /\.nexus-sidebar-loupe \.nexus-sidebar-link\{padding-right:46px;/.test(c), 'link{padding-right:46px;', 'link{padding-right:0px;');
garde('interligne élargi de 4 px au survol du menu', DESK, c => /\.nexus-sidebar-loupe-actif \.nexus-sidebar-link\{margin-bottom:6px;\}/.test(c), 'loupe-actif .nexus-sidebar-link{margin-bottom:6px;}', 'loupe-actif .nexus-sidebar-link{margin-bottom:2px;}');
garde('pas de calcul aligné sur l\'interligne élargi', DESK, c => /tous\[0\]\.offsetHeight \+ \(y !== null \? 6 : 2\)/.test(c), '(y !== null ? 6 : 2)', '2');
garde('repli mouvement réduit présent dans l\'installateur', DESK, c => /if \(!mqSouris\.matches \|\| mqCalme\.matches\) return;/.test(c), 'mqSouris.matches || mqCalme.matches', 'mqSouris.matches');
garde('repli écran tactile présent dans l\'installateur', DESK, c => /matchMedia\('\(hover:hover\) and \(pointer:fine\)'\)/.test(c), '(hover:hover) and (pointer:fine)', '(min-width:1px)');
garde('rAF', DESK, c => /requestAnimationFrame\(appliquer\)/.test(c), 'requestAnimationFrame(appliquer)', 'appliquer()');
garde('retour en douceur à la sortie du menu', DESK, c => /addEventListener\('mouseleave', \(\) => \{ y = null; planifier\(\); \}\)/.test(c), "{ y = null; planifier(); }", "{ }");
garde('transform sans décalage de mise en page', DESK, c => /\.nexus-sidebar-loupe \.nexus-sidebar-link img[^{]*\{\s*transform:scale\(var\(--nl-icone, 1\)\); transform-origin:left center/.test(c), 'transform:scale(var(--nl-icone, 1)); transform-origin:left center', 'width:calc(16px * var(--nl-icone, 1)); transform-origin:left center');
garde('repli CSS : transform coupé en mouvement réduit / tactile', DESK, c => /@media \(prefers-reduced-motion:reduce\), \(hover:none\)\{[^}]*\}[^}]*\}[^}]*transform:none/.test(c) || /@media \(prefers-reduced-motion:reduce\), \(hover:none\)\{[\s\S]*?transform:none/.test(c), '@media (prefers-reduced-motion:reduce), (hover:none){', '@media (max-width:1px){');

console.log(n + ' épreuves OK');
