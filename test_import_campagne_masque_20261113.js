const assert = require('assert'); const fs = require('fs');
let echecs = 0; function t(n, f) { try { f(); console.log('OK  ' + n); } catch (e) { echecs++; console.log('KO  ' + n + ' : ' + e.message); } }
const imp = fs.readFileSync(__dirname + '/NEXUS-Import-v1.html', 'utf8');
const camp = fs.readFileSync(__dirname + '/nexus-campagnes.js', 'utf8');
t('la carte Campagne NEXUS n\'est plus proposée', () => {
  assert(/id="typeCampagne"[^>]*\shidden/.test(imp));
  assert(/\.type-card\[hidden\]\s*\{\s*display:\s*none/.test(imp));
});
t('aucun texte ne renvoie à « Import > Campagne NEXUS »', () => {
  assert(!/Import > Campagne NEXUS/.test(camp));
  assert(camp.includes('Impact par produit non disponible dans cette version.'));
});
process.exit(echecs ? 1 : 0);
