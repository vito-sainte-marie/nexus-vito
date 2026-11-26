// Test — INVENTAIRE-ICONES : les emojis décoratifs d'Inventaire sont remplacés par des SVG inline,
// les cibles cliquables et les identifiants ne bougent pas. Aucune logique métier n'est lue ici.
const fs = require('fs'), path = require('path'), assert = require('assert');
const H = fs.readFileSync(path.join(__dirname, 'NEXUS-Inventaire-v1.html'), 'utf8');
const I = fs.readFileSync(path.join(__dirname, 'nexus-icones.js'), 'utf8');
let rouges = 0;
const t = (n, f) => { try { f(); console.log('OK  ' + n); } catch (e) { rouges++; console.log('KO  ' + n + ' : ' + e.message); } };
for (const n of ['sun', 'moon', 'clipboard-check', 'clipboard-list', 'list-checks', 'lock-keyhole'])
  t('icône ' + n + ' définie', () => assert(new RegExp("'" + n + "'\\s*:").test(I)));
t('SVG décoratif aria-hidden', () => assert(/aria-hidden="true"/.test(I) && /currentColor/.test(I)));
t('Matin et Soir : SVG, plus d’emoji', () => {
  assert(/data-quart="matin">\$\{NexusIcones\.svg\('sun'/.test(H));
  assert(/data-quart="soir">\$\{NexusIcones\.svg\('moon'/.test(H));
  assert(!/data-quart="(matin|soir)">[^<]*[☀🌙]/u.test(H));
});
t('cartes Commencer / Clôturer : SVG, plus 📋🟢🔴', () => {
  assert(/choix-icone ouverture">\$\{NexusIcones\.svg\('clipboard-list'/.test(H));
  assert(/choix-icone cloture">\$\{NexusIcones\.svg\('clipboard-check'/.test(H));
  assert(!/choix-icone (ouverture|cloture)">[^<$]*[📋🟢🔴]/u.test(H));
});
t('statut verrouillé : template interpolé, pas de ${ brut en chaîne simple', () => {
  assert(/`<div class="choix-statut attente">\$\{NexusIcones\.svg\('lock-keyhole'/.test(H));
  assert(!/'<div class="choix-statut attente">\$\{/.test(H));
});
t('cibles inchangées', () => {
  for (const s of ['id="carteOuverture"', 'id="carteCloture"', 'data-quart="matin"', 'data-quart="soir"']) assert(H.includes(s), s);
});
t('pas de CDN ni de couleur en dur ajoutée', () => assert(!/\.ico-inv[^{]*\{[^}]*#[0-9a-f]{3,6}/i.test(H)));
console.log(rouges ? rouges + ' rouge(s)' : 'tout vert'); process.exit(rouges ? 1 : 0);
