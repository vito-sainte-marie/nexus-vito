// Correctif Contrôle inventaire (Guardian #160, 6685948063) : sur la page Manager, aucune carte
// « Stock par emplacement » ne chevauche la bannière, et les blocs injectés (résumé Photo Decenium,
// bandeau Réassort cigarettes) se placent APRÈS le Conseiller, jamais entre la bannière et les tuiles.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const lire = f => fs.readFileSync(path.join(__dirname, f), 'utf8');

const entree = lire('nexus-inventaire-stock-localise-entry.js');
const plein = lire('nexus-inventaire-manager-fullwidth-v2.js');
const cigs = lire('nexus-inventaire-manager-reassort-cigarettes-v3.js');
const page = lire('NEXUS-Inventaire-Manager-v1.html');

// 1. La carte n'est plus injectée sur la page Manager ; l'accès reste celui du bouton d'en-tête.
assert.ok(!/ajouterAccesManager\(\)/.test(entree.replace(/function ajouterAccesManager\(\)/, '')), 'ajouterAccesManager n’est plus appelée');
assert.ok(/page!==\x27NEXUS-Inventaire-Manager-v1\.html\x27\) ajouterAccesInventaire\(\)/.test(entree), 'l’accès de l’écran Inventaire est conservé hors page Manager');
assert.ok(page.includes('id="btnStockEmplacement"') && page.includes('NEXUS-Stock-Localise-v1.html'), 'le bouton « Stock par emplacement » de l’en-tête reste');

// 2. Résumé Photo Decenium : après le Conseiller, plus au début de la section.
assert.ok(!plein.includes("insertAdjacentElement('afterbegin',acces)"), 'plus d’insertion au début de la section');
assert.ok(plein.includes("conseiller.insertAdjacentElement('afterend',acces)"), 'inséré juste après le Conseiller');
assert.ok(/getElementById\('conseillerCard'\);\s*if\(!conseiller\) return;/.test(plein), 'sans Conseiller, on attend (l’observateur relance)');

// 3. Bandeau Réassort cigarettes : après le résumé Photo (ou le Conseiller), repli en tête seulement sans Conseiller.
assert.ok(cigs.includes("getElementById('invPhotoDeceniumAccess')||document.getElementById('conseillerCard')"), 'ancre : résumé Photo puis Conseiller');
assert.ok(cigs.includes("apres.insertAdjacentElement('afterend',w)") && cigs.includes('content.insertBefore(w,content.firstChild)'), 'repli en tête conservé');

// 4. Simulation du DOM : ordre final tuiles → Conseiller → Photo → Réassort, quel que soit l'ordre d'arrivée.
function ordre(arrivees) {
  const enfants = ['tuiles', 'conseillerCard'];
  const apres = id => enfants.indexOf(id);
  for (const a of arrivees) {
    if (a === 'invPhotoDeceniumAccess') enfants.splice(apres('conseillerCard') + 1, 0, a);
    if (a === 'cigarettes') {
      const ancre = enfants.includes('invPhotoDeceniumAccess') ? 'invPhotoDeceniumAccess' : 'conseillerCard';
      enfants.splice(apres(ancre) + 1, 0, a);
    }
  }
  return enfants.join('>');
}
assert.strictEqual(ordre(['invPhotoDeceniumAccess', 'cigarettes']), 'tuiles>conseillerCard>invPhotoDeceniumAccess>cigarettes');
assert.strictEqual(ordre(['cigarettes', 'invPhotoDeceniumAccess']), 'tuiles>conseillerCard>invPhotoDeceniumAccess>cigarettes');
console.log('test_inventaire_correctif_bandeau_20261106 : OK');
