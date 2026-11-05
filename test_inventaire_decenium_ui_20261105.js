// L2a — robustesse de l'import Photo Decenium (recette Guardian du 05/11/2026) :
// clic unique, bilan qui survit au rendu, heure future refusée, Stock absent signalé.
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const src = fs.readFileSync(path.join(__dirname, 'NEXUS-Inventaire-Manager-v1.html'), 'utf8');
let echecs = 0;
function t(nom, f) { try { f(); console.log('OK  ', nom); } catch (e) { echecs++; console.log('FAIL', nom, '-', e.message); } }

const debut = src.indexOf("btnComparerVentes.addEventListener('click'");
const clic = src.slice(debut, src.indexOf('.btn-decision[data-decision]', debut));

t('double clic — le bouton est désactivé avant tout appel d\'écriture', () => {
  const iDesactive = clic.indexOf('btnComparerVentes.disabled = true');
  assert.ok(iDesactive > 0);
  assert.ok(iDesactive < clic.indexOf('construirePhotoDecenium('));
  assert.ok(clic.indexOf('if (photoDeceniumImportEnCours) return') < iDesactive);
});

t('bilan — conservé en état et rendu dans la section au redessin', () => {
  assert.ok(src.includes('<div id="snapshotAvertissement">${photoDeceniumRetourHtml}</div>'));
  assert.ok(clic.includes('photoDeceniumRetourHtml = renderBilanPhotoDecenium(resultat)'));
  assert.ok(clic.indexOf('photoDeceniumRetourHtml = renderBilanPhotoDecenium') < clic.indexOf('await comparerVentesQuart(fichier)'));
});

t('heure future — refusée avant toute écriture, message clair', () => {
  const f = src.slice(src.indexOf('async function construirePhotoDecenium'));
  const iRefus = f.indexOf('est dans le futur');
  assert.ok(iRefus > 0);
  assert.ok(iRefus < f.indexOf('creerSnapshot('));
});

t('Stock absent — message explicite, aucune photo', () => {
  assert.ok(clic.includes('Photo Decenium non créée : fichier Stock absent'));
});

if (echecs) { console.log('\nDes tests ont échoué.'); process.exit(1); }
console.log('\nTous les tests sont passés.');
