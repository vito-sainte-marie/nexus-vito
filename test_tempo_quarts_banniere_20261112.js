// Tempo V2, page Quarts : bannière de l'en-tête (photo préparée par Guardian, 6827677546). Rien d'autre ne bouge.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, 'NEXUS-Tempo-v2-Quarts.html'), 'utf8');
let echecs = 0;
function t(nom, fn) {
  try { fn(); console.log('  ok   ' + nom); }
  catch (e) { echecs++; console.log('  FAIL ' + nom + '\n       ' + e.message); }
}
const TAILLES = [800, 1200, 1600];
t('les trois tailles existent et sont référencées', () => {
  TAILLES.forEach(w => {
    const f = 'assets/tempo/tempo-quarts-' + w + '.webp';
    assert.ok(fs.existsSync(path.join(__dirname, f)), 'fichier absent : ' + f);
    assert.ok(html.includes('${b}-' + w + '.webp'), 'non référencé : ' + w);
  });
  assert.ok(html.includes("const b = 'assets/tempo/tempo-quarts';"));
});
t('la bannière est posée dans l’en-tête, une seule image pour les deux thèmes, sans texte alternatif', () => {
  assert.ok(html.includes("getElementById('enTete').insertAdjacentHTML('afterbegin'"));
  assert.ok(html.includes('data-photo-jour="${b}-1200.webp" data-photo-nuit="${b}-1200.webp"'));
  assert.ok(html.includes('width="800" height="267" alt=""'));
  assert.ok(/sizes="\(max-width:820px\) 100vw, 900px"/.test(html));
});
t('le cadrage est réglé pour l’ordinateur et le téléphone', () => {
  assert.ok(/--banniere-cadrage:70% 50%/.test(html) && /--banniere-cadrage-tel:60% 50%/.test(html));
});
t('la bannière reste réservée aux sites de la liste', () => {
  assert.ok(html.includes('NexusBanniereStation.siteAvecBanniere(employee.site_id, NexusBanniereStation.apercuDemande())'));
});
t('les gardes de la page sont intactes', () => {
  assert.ok(html.includes('nexusEstManager(employee)') && html.includes("NexusForfait.nexusRequireProfessional('NEXUS-Tempo-v2-Quarts.html'"));
});
console.log(echecs ? echecs + ' échec(s)' : 'tous ok');
process.exit(echecs ? 1 : 0);
