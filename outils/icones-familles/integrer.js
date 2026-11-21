#!/usr/bin/env node
'use strict';
// Chaîne d'intégration des icônes de famille (Guardian 7064246243). NON exécutée dans la session de rédaction :
// aucun encodeur WebP disponible là-bas. À lancer sur un poste où `npm i sharp` est possible (hors dépôt).
//
// Entrée  : un PNG par famille, objet seul, fond transparent, carré 1024 px, nommé <id>.png (ex. cat-confiserie.png)
// Sortie  : assets/icones/v2/<id>/ au format des familles existantes :
//   <id>@1x|2x|3x.webp (Nuit), <id>-jour@1x|2x|3x.webp (Jour), <id>-24.png (simplifié), planche de contrôle 16/24/48/96.
// Usage   : node outils/icones-familles/integrer.js <dossier-sources> [--pret]
//   --pret : écrit aussi la liste à copier dans PRETES de nexus-rayons-familles.js (jamais modifié automatiquement).
const fs = require('fs');
const path = require('path');
let sharp;
try { sharp = require('sharp'); } catch (e) { console.error('sharp est requis : npm i sharp (hors dépôt).'); process.exit(2); }
const T = require('../../nexus-rayons-familles.js');

const THEMES = {
  nuit: { suffixe: '', fond: '#10354A', liseré: '#63E7EF' },
  jour: { suffixe: '-jour', fond: '#DCEFF5', liseré: '#0E7C93' }
};
const ECHELLES = { '1x': 48, '2x': 96, '3x': 144 };
const PLAFONDS = { '2x': 15 * 1024, '3x': 25 * 1024 };
const SOURCE = 1024;
const RAYON_TUILE = 0.22;   // part du côté, arrondi de la tuile
const MARGE_OBJET = 0.14;   // part du côté laissée autour de l'objet

function tuileSvg(px, th) {
  const r = Math.round(px * RAYON_TUILE), e = Math.max(1, Math.round(px / 48));
  return Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="' + px + '" height="' + px + '">' +
    '<rect x="' + e / 2 + '" y="' + e / 2 + '" width="' + (px - e) + '" height="' + (px - e) + '" rx="' + r + '" fill="' + th.fond +
    '" stroke="' + th.liseré + '" stroke-width="' + e + '"/></svg>');
}
async function composer(src, px, th) {
  const marge = Math.round(px * MARGE_OBJET), cote = px - 2 * marge;
  const objet = await sharp(src).resize(cote, cote, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  return sharp(tuileSvg(px, th)).composite([{ input: objet, left: marge, top: marge }]);
}
async function webp(img, qualiteMax, plafond) {
  for (let q = qualiteMax; q >= 40; q -= 8) {
    const buf = await img.clone().webp({ quality: q, effort: 6 }).toBuffer();
    if (!plafond || buf.length <= plafond) return { buf, q };
  }
  throw new Error('plafond de poids non tenable');
}

async function famille(dossierSrc, id, sortie) {
  const fichier = path.join(dossierSrc, id + '.png');
  const meta = await sharp(fichier).metadata();
  if (meta.width !== SOURCE || meta.height !== SOURCE || !meta.hasAlpha) throw new Error(id + ' : 1024 x 1024 avec transparence exigé (' + meta.width + 'x' + meta.height + ', alpha ' + meta.hasAlpha + ')');
  const dir = path.join(sortie, id); fs.mkdirSync(dir, { recursive: true });
  const rapport = [];
  for (const nom of Object.keys(THEMES)) {
    const th = THEMES[nom];
    for (const ech of Object.keys(ECHELLES)) {
      const img = await composer(fichier, ECHELLES[ech], th);
      const r = await webp(img, 88, PLAFONDS[ech]);
      fs.writeFileSync(path.join(dir, id + th.suffixe + '@' + ech + '.webp'), r.buf);
      rapport.push(id + th.suffixe + '@' + ech + ' ' + r.buf.length + ' o (q' + r.q + ')');
    }
    // PNG simplifié 24 px (≤ 24 px, les surfaces utilisent le simplifié)
    const p24 = await composer(fichier, 24, th);
    const png24 = await p24.png().toBuffer();
    fs.writeFileSync(path.join(dir, id + '-24' + th.suffixe + '.png'), png24);
    // Le chargeur lit <id>-24[-jour].svg : on enveloppe le PNG 24 px dans un SVG de même taille.
    fs.writeFileSync(path.join(dir, id + '-24' + th.suffixe + '.svg'),
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><image width="24" height="24" href="data:image/png;base64,' + png24.toString('base64') + '"/></svg>\n');
  }
  return rapport;
}

// Planche de contrôle : toutes les familles à 16, 24, 48, 96 px, sur fond Nuit et Jour.
async function planche(sortie, ids, nom) {
  const th = THEMES[nom], fondPlanche = nom === 'jour' ? '#F4F7FA' : '#0B0F14';
  const tailles = [16, 24, 48, 96], pas = 112, haut = 4 * 0 + 120;
  const larg = tailles.length * pas + 16, hauteur = ids.length * haut * 2 / 2 + 16;
  const couches = [];
  for (let i = 0; i < ids.length; i++) for (let j = 0; j < tailles.length; j++) {
    const cote = tailles[j];
    const buf = await sharp(path.join(sortie, ids[i], ids[i] + th.suffixe + '@3x.webp')).resize(cote, cote).png().toBuffer();
    couches.push({ input: buf, left: 16 + j * pas, top: 8 + i * haut });
  }
  const fond = { create: { width: larg, height: Math.max(hauteur, 128), channels: 4, background: fondPlanche } };
  await sharp(fond).composite(couches).png().toFile(path.join(sortie, 'planche-controle-familles-' + nom + '.png'));
}

(async () => {
  const src = process.argv[2];
  if (!src) { console.error('Usage : node outils/icones-familles/integrer.js <dossier-sources> [--pret]'); process.exit(2); }
  const sortie = path.join(__dirname, '../../assets/icones/v2');
  const CIBLES = T.A_VENIR.length ? T.A_VENIR : T.PRETES.slice(11);   // liste vide une fois les 18 familles déclarées prêtes
  const ids = CIBLES.filter(id => fs.existsSync(path.join(src, id + '.png')));
  const manquantes = CIBLES.filter(id => !ids.includes(id));
  if (!ids.length) { console.error('Aucune source trouvée dans ' + src); process.exit(1); }
  for (const id of ids) (await famille(src, id, sortie)).forEach(l => console.log(l));
  await planche(sortie, ids, 'nuit'); await planche(sortie, ids, 'jour');
  console.log('\nFamilles intégrées (' + ids.length + ') : ' + ids.join(', '));
  if (manquantes.length) console.log('Encore sans image (icône neutre) : ' + manquantes.join(', '));
  if (process.argv.includes('--pret')) console.log('\nÀ ajouter à PRETES dans nexus-rayons-familles.js : ' + JSON.stringify(ids));
})().catch(e => { console.error(e.message); process.exit(1); });
