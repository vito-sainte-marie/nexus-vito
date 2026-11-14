// Avatar du Conseiller : recadrage « visage et épaules », fichiers d'empreinte connue, aucun petit cadre sur l'image en pied.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
let echecs = 0;
function t(nom, fn) { try { fn(); console.log('  ok   ' + nom); } catch (e) { echecs++; console.log('  FAIL ' + nom + '\n       ' + e.message); } }
const EMPREINTES = { 64: '86400453', 96: 'c51e09a4', 128: '7f27a2c3', 256: '712331e6' };
const GRANDS = ['NEXUS-Login-v1.html', 'NEXUS-Brief-v1.html'];
const pages = fs.readdirSync(__dirname).filter(f => /^NEXUS-.*\.html$/.test(f));

t('les quatre fichiers recadrés existent avec les empreintes attendues', () => {
  Object.keys(EMPREINTES).forEach(px => {
    const b = fs.readFileSync(path.join(__dirname, 'assets/avatar/nexus-avatar-' + px + '.png'));
    assert.strictEqual(crypto.createHash('sha256').update(b).digest('hex').slice(0, 8), EMPREINTES[px], 'empreinte ' + px);
  });
});
t('aucun petit cadre ne charge encore l’image en pied (hors Login et Brief)', () => {
  pages.filter(f => !GRANDS.includes(f)).forEach(f => {
    const c = fs.readFileSync(path.join(__dirname, f), 'utf8');
    (c.match(/<img[^>]*>/g) || []).forEach(img => assert.ok(!/src="(assets\/)?nexus-avatar\.png"/.test(img), f + ' : ' + img.slice(0, 90)));
  });
});
t('les grandes illustrations en pied restent telles quelles', () => {
  assert.ok(/hero-avatar" src="assets\/nexus-avatar\.png"/.test(fs.readFileSync(path.join(__dirname, 'NEXUS-Login-v1.html'), 'utf8')));
  assert.ok(/plans-loading-logo" src="nexus-avatar\.png"/.test(fs.readFileSync(path.join(__dirname, 'NEXUS-Brief-v1.html'), 'utf8')));
});
t('chaque page qui affiche l’avatar recadré porte un srcset 64/96/128', () => {
  pages.forEach(f => {
    const c = fs.readFileSync(path.join(__dirname, f), 'utf8');
    (c.match(/<img[^>]*assets\/avatar\/nexus-avatar-[^>]*>/g) || []).forEach(img => {
      assert.ok(/srcset="[^"]*64w[^"]*96w[^"]*128w/.test(img) && /sizes="(?:\(max-width: \d+px\) \d+px, )?\d+px"/.test(img), f + ' : srcset incomplet');
    });
  });
});
t('les pages passées sur le recadrage sont rondes et en cover', () => {
  ['Scanner-Stock-v1', 'Rayon-v1', 'Produits-v1', 'Import-v1'].forEach(n => {
    const c = fs.readFileSync(path.join(__dirname, 'NEXUS-' + n + '.html'), 'utf8');
    assert.ok(/\.conseiller-avatar\{width:52px; height:52px; border-radius:50%; object-fit:cover;/.test(c), n);
  });
});
console.log(echecs ? echecs + ' échec(s)' : 'tous ok');
process.exit(echecs ? 1 : 0);
