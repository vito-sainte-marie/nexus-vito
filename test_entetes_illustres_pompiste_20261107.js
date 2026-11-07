// Test — en-têtes illustrés du fil pompiste (lot 6706558761, 07/11/2026).
// Un écran = une image : jaugeage, relevé d'index, inventaire. Même image en Jour et en Sombre.
// Les pictogrammes du kit remplacent les emojis dans l'inventaire pompiste. Présentation seulement.
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const lire = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');
function t(nom, fn) { try { fn(); console.log(`OK — ${nom}`); } catch (e) { console.error(`FAIL — ${nom}\n  ${e.stack}`); process.exitCode = 1; } }

const piste = lire('NEXUS-Releves-Piste-v1.html');
const inv = lire('NEXUS-Inventaire-v1.html');

t('les fichiers webp existent aux trois largeurs (jaugeage, relevé d\'index) et pour l\'inventaire', () => {
  for (const base of ['assets/pompiste/jaugeage', 'assets/pompiste/releve-index'])
    for (const w of [800, 1200, 1600]) assert.ok(fs.existsSync(path.join(__dirname, `${base}-${w}.webp`)), `${base}-${w}.webp manquant`);
  assert.ok(fs.existsSync(path.join(__dirname, 'assets/inventaire/inventaire-banniere-sombre.webp')));
});
t('Piste : écran du jaugeage → image du jaugeage, tout le reste → relevé d\'index', () => {
  assert.ok(/jaugeage:\s*\{[^}]*assets\/pompiste\/jaugeage-1200\.webp/.test(piste));
  assert.ok(/index:\s*\{[^}]*assets\/pompiste\/releve-index-1200\.webp/.test(piste));
  assert.ok(/ecran === 'jauge' \|\| ecran === 'jaugeimpossible'\) \? 'jaugeage' : 'index'/.test(piste));
});
t('Piste : l\'en-tête suit l\'écran affiché (appelé par rendre) et se place hors de #app', () => {
  assert.ok(/app\.innerHTML = filBandeau\(\) \+ vue;\s*majEntete\(\);/.test(piste));
  assert.ok(piste.indexOf('id="entIllustre"') < piste.indexOf('id="app"'));
});
t('Piste : même image en Jour et en Sombre, module partagé et règles de site du Manager', () => {
  assert.ok(piste.includes('<script src="nexus-banniere-station.js"></script>'));
  assert.ok(/NexusBanniereStation\.html\(site, \{ apercu: NexusBanniereStation\.apercuDemande\(\)/.test(piste));
  assert.ok(/jaugeage:\s*\{ jour: '([^']+)', nuit: '\1'/.test(piste));
  assert.ok(/index:\s*\{ jour: '([^']+)', nuit: '\1'/.test(piste));
});
t('Inventaire : image de l\'inventaire, insérée avant la barre du fil', () => {
  assert.ok(inv.includes('<script src="nexus-banniere-station.js"></script>'));
  assert.ok(/inventaire-banniere-sombre\.webp/.test(inv));
  assert.ok(inv.indexOf('phone.insertBefore(w, barre)') > inv.indexOf('phone.insertBefore(barre, phone.firstChild)'));
});
t('Inventaire : les cinq pictogrammes du kit existent et sont embarqués', () => {
  for (const k of ['gaz', 'glacons', 'cigarettes', 'stock', 'comptage'])
    assert.ok(fs.existsSync(path.join(__dirname, `assets/inventaire/icones/${k}.svg`)), `${k}.svg manquant`);
  for (const k of ['cigarettes', 'gaz', 'glacons', 'stock', 'comptage']) assert.ok(new RegExp(`\\b${k}: '<`).test(inv), k);
});
t('Inventaire : règle de choix identique à iconeCategorie du Manager', () => {
  const man = lire('NEXUS-Inventaire-Manager-v1.html');
  for (const frag of ["indexOf('cigar')", "indexOf('gaz')", "indexOf('gla')"]) {
    assert.ok(inv.includes(frag) && man.includes(frag), frag);
  }
});
t('Inventaire : plus d\'emoji 🎯 📦 📥 ⛽ comme pictogramme ; ⚠️ seulement en tête d\'un avertissement de connexion', () => {
  for (const e of ['🎯', '📦', '📥', '⛽']) assert.ok(!inv.includes(e), `emoji ${e} encore présent`);
  for (const l of inv.split('\n').filter((x) => x.includes('⚠️'))) assert.ok(/en attente de connexion/.test(l), l.slice(0, 80));
});
t('aucune couleur hexadécimale brute ajoutée dans les styles de l\'en-tête', () => {
  for (const [nom, src] of [['piste', piste], ['inventaire', inv]]) {
    const bloc = (src.match(/\.ent-illustre[^}]*\}/g) || []).join('');
    assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(bloc), nom);
  }
});
