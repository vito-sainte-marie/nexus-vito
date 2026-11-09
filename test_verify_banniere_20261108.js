// Bannière de l'en-tête Verify (demande de Frédéric, 08/11/2026) : photo de caisse, même module que Carburants et Paye.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
let n = 0;
function t(nom, f) { f(); n++; console.log('OK ' + nom); }
function garde(nom, src, regle, litteral, remplacement) {
  t(nom, () => {
    assert.ok(regle(src), 'la garde doit passer sur la source');
    assert.ok(src.indexOf(litteral) >= 0, 'littéral introuvable : ' + litteral);
    assert.ok(!regle(src.replace(litteral, remplacement)), 'la garde doit rougir sur la source mutée');
  });
}
const H = fs.readFileSync(path.join(__dirname, 'NEXUS-Verify-v1.html'), 'utf8');
const BAN = fs.readFileSync(path.join(__dirname, 'nexus-banniere-station.js'), 'utf8');

const script = c => { const i = c.search(/<script src="nexus-banniere-station\.js[^"]*"><\/script>/); const j = c.search(/<script>/); return i > 0 && j > i; };
const gardeSite = c => /NexusBanniereStation\.siteAvecBanniere\(SITE_ACTUEL, NexusBanniereStation\.apercuDemande\(\)\)/.test(c);
const apresAuth = c => { const i = c.indexOf('SITE_ACTUEL = employee.site_id;'); const j = c.indexOf('siteAvecBanniere(SITE_ACTUEL'); return i > 0 && j > i; };
const theme = c => /NexusBanniereStation\.suivreTheme\(\)/.test(c);
const unePhoto = c => /data-photo-jour="\$\{bv\}-1200\.jpg" data-photo-nuit="\$\{bv\}-1200\.jpg"/.test(c);
const srcset = c => /srcset="\$\{bv\}-800\.jpg 800w, \$\{bv\}-1200\.jpg 1200w, \$\{bv\}-1600\.jpg 1600w"/.test(c);
const erreur = c => /onerror="this\.parentNode\.remove\(\)"/.test(c);
const decor = c => /<div class="am-banniere"[^>]*><img[^>]* alt=""/.test(c);
const nonBloquant = c => /try \{\s*if \(typeof NexusBanniereStation !== 'undefined'[\s\S]*?\} catch \(_\) \{/.test(c);
const css = c => /\.header>\.am-banniere\{position:absolute;inset:0;z-index:0;overflow:hidden;/.test(c);
const masque = c => /\.header>\.am-banniere\{[^}]*mask-image:linear-gradient\(to bottom,black 70%/.test(c);
const texteDessus = c => /\.header>\.entete-texte\{position:relative;z-index:1;/.test(c);
const texteMarque = c => /<div class="entete-texte">/.test(c);
const jour = c => /:root\[data-theme="jour"\] \.header>\.am-banniere::after\{/.test(c);
const fondu = c => /img\.am-fondu\{opacity:0;transition:opacity 800ms ease\}/.test(c) && /img\.am-fondu-visible\{opacity:1\}/.test(c);
const reduit = c => /prefers-reduced-motion:reduce\)\{\.header>\.am-banniere img\.am-fondu\{transition:none\}\}/.test(c);
const cadrage = c => /\.header\{--banniere-cadrage:80% 40%\}/.test(c);
const menuMarque = c => /<div class="header">\s*<a href="NEXUS-App-v1\.html" class="menu-btn">☰ Menu<\/a>/.test(c);
const menuCss = c => /\.header>\.menu-btn\{position:absolute;top:18px;right:18px;z-index:5;[^}]*background:var\(--panel\)/.test(c);

t('le module partagé est chargé avant le script de la page', () => { assert.ok(script(H)); });
t('la bannière n\'est posée que pour les sites autorisés, après l\'authentification', () => { assert.ok(gardeSite(H)); assert.ok(apresAuth(H)); });
t('le module partagé garde la liste des sites (Vito) et l\'aperçu Test', () => {
  assert.ok(/SITES_BANNIERE_VITO\s*=\s*\['vito-sainte-marie'\]/.test(BAN));
  assert.ok(/nexus-station-test/.test(BAN));
});
t('une seule photo pour Jour et Nuit, trois largeurs en srcset', () => { assert.ok(unePhoto(H)); assert.ok(srcset(H)); });
t('les trois images existent et sont légères', () => {
  [800, 1200, 1600].forEach(w => {
    const p = path.join(__dirname, 'assets/verify/verify-banniere-' + w + '.jpg');
    assert.ok(fs.existsSync(p), w);
    const b = fs.readFileSync(p);
    assert.ok(b[0] === 0xFF && b[1] === 0xD8, 'JPEG ' + w);
    assert.ok(b.length <= 250 * 1024, w + ' : ' + b.length);
  });
});
t('décorative (alt vide), retirée si l\'image échoue, jamais bloquante', () => { assert.ok(decor(H)); assert.ok(erreur(H)); assert.ok(nonBloquant(H)); });
t('le suivi de thème est branché', () => { assert.ok(theme(H)); });
t('CSS commun : bannière derrière le texte, masque vertical (module partagé)', () => { assert.ok(css(BAN)); assert.ok(masque(BAN)); assert.ok(texteDessus(BAN)); assert.ok(texteMarque(H)); });
t('thème Jour : dégradé du module partagé', () => { assert.ok(jour(BAN)); });
t('fondu de 800 ms, coupé en mouvement réduit', () => { assert.ok(fondu(BAN)); assert.ok(reduit(BAN)); });
t('cadrage propre à la page : employée à droite', () => { assert.ok(cadrage(H)); });
t('le bouton Menu est la pastille opaque commune, posée dans l\u2019en-tête', () => { assert.ok(menuMarque(H)); assert.ok(menuCss(BAN)); });

garde('script du module', H, script, '<script src="nexus-banniere-station.js', '<script src="autre-module.js');
garde('liste des sites', H, gardeSite, 'siteAvecBanniere(SITE_ACTUEL, ', 'siteAvecBanniere("x", ');
garde('suivi de thème', H, theme, 'NexusBanniereStation.suivreTheme();', '');
garde('même photo Jour et Nuit', H, unePhoto, 'data-photo-nuit="${bv}-1200.jpg"', 'data-photo-nuit="${bv}-nuit.jpg"');
garde('srcset 1600', H, srcset, '${bv}-1600.jpg 1600w', '${bv}-1600.jpg 1599w');
garde('retrait sur erreur', H, erreur, 'onerror="this.parentNode.remove()"', '');
garde('alt vide', H, decor, ' alt="" decoding', ' alt="photo" decoding');
garde('non bloquant', H, nonBloquant, '} catch (_) { /* la banniere', '} finally { /* la banniere');
garde('bannière derrière le texte', BAN, css, 'inset:0;z-index:0;overflow:hidden', 'inset:0;z-index:2;overflow:hidden');
garde('masque', BAN, masque, '-webkit-mask-image:linear-gradient(to bottom,black 70%,transparent 100%);mask-image:linear-gradient(to bottom,black 70%', '-webkit-mask-image:none;mask-image:none;x:linear-gradient(to bottom,black 70%');
garde('texte au-dessus', BAN, texteDessus, '.header>.entete-texte{position:relative;z-index:1;', '.header>.entete-texte{position:relative;');
garde('Jour : dégradé propre', BAN, jour, ':root[data-theme="jour"] .header>.am-banniere::after{', ':root[data-theme="jour"] .header>.x::after{');
garde('cadrage Verify', H, cadrage, '--banniere-cadrage:80% 40%', '--banniere-cadrage:0% 0%');
garde('Menu dans l\u2019en-tête', H, menuMarque, '<div class="header">\n    <a href="NEXUS-App-v1.html" class="menu-btn">', '<div class="header">\n    <a href="NEXUS-App-v1.html" class="menu-x">');
garde('fondu', BAN, fondu, 'transition:opacity 800ms ease}', 'transition:none}');
garde('mouvement réduit', BAN, reduit, '.am-fondu{transition:none}}', '.am-fondu{transition:opacity 800ms}}');
console.log(n + ' épreuves OK');
