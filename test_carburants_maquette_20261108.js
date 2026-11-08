// Carburants : en-tête et cartes façon maquette (Guardian 6724782750 / 6724791056, 08/11/2026) : présentation seulement.
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
const H = fs.readFileSync(path.join(__dirname, 'NEXUS-Carburants-Pilotage-v1.html'), 'utf8');
const P2 = H.slice(H.indexOf('2e passe (Guardian 6724782750'));

t('bannière : la règle dépend du conteneur (.hero), plus de la largeur de la fenêtre', () => {
  assert.ok(/\.hero\{container-type:inline-size;\}/.test(P2));
  assert.ok(/@container \(max-width:699px\)\{\s*\.hero-haut>\.am-banniere\{position:relative/.test(P2));
  assert.ok(!/@media \(max-width:820px\)\{\s*\.hero-haut>\.am-banniere/.test(H));
});
t('en-tête : pastilles lisibles (sans monospace), date en toutes lettres, ⓘ groupé avec le statut', () => {
  assert.ok(/\.pastille\{font-family:var\(--sans\)/.test(P2));
  assert.ok(/weekday: 'long', day: 'numeric', month: 'long'/.test(H));
  assert.ok(/<span class="statut-ligne"><span class="relever-statut" id="releveStatutJour"><\/span>\s*<button[^>]*id="btnInfoPage"/.test(H));
  assert.ok(/\.statut-ligne\{[^}]*flex-wrap:nowrap/.test(P2));
});
t('statut du relevé : pastille colorée par état, texte « Relevé du jour saisi à 08 h 15 »', () => {
  assert.ok(/relever-statut\.saisi\{background:rgba\(52,199,89/.test(P2));
  assert.ok(/relever-statut\.a-completer,\.selecteurs \.relever-statut\.a-valider\{background:rgba\(245,166,35/.test(P2));
  assert.ok(H.includes("`Relevé du jour saisi à ${heureTxt.replace(':', ' h ')}`"));
});
t('boutons : dégradé cyan, largeur partagée à parts égales sur mobile', () => {
  assert.ok(/\.btn-cta\{background:linear-gradient\(135deg,#22D3EE/.test(P2));
  assert.ok(/@container \(max-width:699px\)\{[^@]*\.topacts\{display:grid; grid-template-columns:1fr 1fr;\}/.test(P2));
});
t('À traiter : titre, puces et bouton sur une ligne, titre foncé en Jour', () => {
  assert.ok(/\.a-traiter\{display:flex; flex-wrap:wrap; align-items:center/.test(P2));
  assert.ok(/\.a-traiter \.lien-discret\{[^}]*margin-left:auto[^}]*border:1px solid var\(--cyan\)/.test(P2));
  assert.ok(/\[data-theme="jour"\] \.a-traiter-titre\{color:#8A3F06;\}/.test(P2));
  assert.ok(/<div class="a-traiter-titre">\$\{jours\.length\} jaugeage/.test(H));
});
t('titres de section en petites capitales espacées', () => {
  assert.ok(/\.sec-titre\{[^}]*letter-spacing:\.16em; text-transform:uppercase/.test(P2));
});
t('cartes : liseré de 4 px en haut, bordure fine ailleurs, titre dans la couleur du texte avec pastille ronde', () => {
  assert.ok(/border:1px solid var\(--hairline\); border-top:4px solid var\(--carb-couleur/.test(P2));
  assert.ok(/\.carb-carte2-titre\{[^}]*color:var\(--text\)/.test(P2));
  assert.ok(/\.carb-pastille-ronde\{[^}]*background:var\(--carb-couleur/.test(P2));
  assert.ok(H.includes('<span class="carb-pastille-ronde" aria-hidden="true"></span>${COURT_CARBURANT[cle]}'));
  assert.ok(/\.carb-ref-court\{[^}]*margin-left:auto/.test(P2));
});
t('ⓘ Infos et ⓘ Écart : visuel de 28 px, zone tactile de 44 px par pseudo-élément', () => {
  assert.ok(/\.carb-info-btn,\.ecart-caveat\{position:relative; min-height:28px/.test(P2));
  assert.ok(/\.carb-info-btn::before,\.ecart-caveat::before\{content:''; position:absolute; inset:-8px;\}/.test(P2));
});
t('une seule ligne sous Écart : le bloc Autonomie perd sa bordure du haut', () => {
  assert.ok(/\.carb-bloc-autonomie \.carb-autonomie-bloc\{border-top:0/.test(P2));
});
t('identifiants et sources inchangés', () => {
  ['pastilleSite', 'pastilleDate', 'releveStatutJour', 'btnInfoPage', 'btnRattrapageAutreDate', 'rattrapageManuel'].forEach(i => assert.ok(H.includes('id="' + i + '"') || H.includes("id=\"" + i + "\""), i));
  assert.ok(/class="pastille nexus-nom-commerce" id="pastilleSite"/.test(H));
});

garde('conteneur : container-type', P2, c => /\.hero\{container-type:inline-size;\}/.test(c), 'container-type:inline-size', 'container-type:normal');
garde('conteneur : seuil 700 px', P2, c => /@container \(max-width:699px\)/.test(c), '@container (max-width:699px)', '@media (max-width:699px)');
garde('liseré du haut 4 px', P2, c => /border-top:4px solid var\(--carb-couleur/.test(c), 'border-top:4px solid', 'border-top:1px solid');
garde('titre de carte en couleur du texte', P2, c => /\.carb-carte2-titre\{[^}]*color:var\(--text\)/.test(c), 'color:var(--text); font-size:15px', 'color:var(--carb-couleur); font-size:15px');
garde('zone tactile 44 px conservée', P2, c => /::before\{content:''; position:absolute; inset:-8px;\}/.test(c), 'inset:-8px', 'inset:0');
garde('titre À traiter foncé en Jour', P2, c => /jour"\] \.a-traiter-titre\{color:#8A3F06/.test(c), '#8A3F06', 'var(--amber)');
garde('ⓘ sur la même ligne que le statut', H, c => /<span class="statut-ligne"><span class="relever-statut"/.test(c), '<span class="statut-ligne">', '<span class="statut-x">');
garde('date en toutes lettres', H, c => /weekday: 'long'/.test(c), "weekday: 'long'", "weekday: 'short'");
console.log(n + ' épreuves OK');
