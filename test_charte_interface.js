'use strict';
// Charte d'interface NEXUS : NEXUS-REFERENTIEL-CONCEPTION v1.0, section 8.
// MODE RAPPORT : ce script ne rougit jamais dans ce lot (sortie 0 toujours).
// Il ne deviendra bloquant qu'après examen des faux positifs, et seulement
// pour les pages de PAGES_CONTROLEES (recettées conformes).
//
// Ignoré : contenu des <svg>, balises <meta>, replis de var(), et toute ligne marquée
//   /* charte-exception: <raison> */   (ou <!-- charte-exception: <raison> -->)
const fs = require('fs');
const path = require('path');

// Liste fermée des pages recettées conformes. Vide au départ ;
// Produits y entrera après la recette de sa refonte.
const PAGES_CONTROLEES = [];
// Page examinée à titre indicatif seulement.
const PAGES_INDICATIVES = ['NEXUS-Produits-v1.html', 'NEXUS-Dates-Courtes-v1.html', 'NEXUS-Dates-Courtes-Releve-v1.html'];

const RACINE = __dirname;
const RE_EMOJI_ETAT = /[\u{1F534}\u{1F7E0}\u{1F7E1}\u{1F7E2}\u{1F535}\u{26A0}\u{2705}\u{274C}\u{2757}\u{2714}\u{2716}\u{1F6A8}\u{26D4}\u{1F6D1}]/u;
const RE_HEX = /#[0-9a-fA-F]{3,8}\b/g;

function analyser(fichier) {
  const brut = fs.readFileSync(path.join(RACINE, fichier), 'utf8');
  const lignes = brut.split('\n');
  const rapport = { fichier, couleurs: [], emojis: [], icones: [], theme: /nexus-theme\.js/.test(brut) };
  let dansSvg = false, dansRoot = 0, dansStyle = false;
  lignes.forEach((l, i) => {
    const n = i + 1;
    const exception = /charte-exception:/.test(l);
    // Suivi des blocs <svg> (une ligne peut ouvrir et fermer).
    let texte = l;
    if (dansSvg) {
      const fin = texte.search(/<\/svg>/i);
      if (fin === -1) return;
      texte = texte.slice(fin + 6); dansSvg = false;
    }
    texte = texte.replace(/<svg[\s\S]*?<\/svg>/gi, ' ');
    // Ignoré aussi : balises <meta> (theme-color) et replis de var(--x, #...).
    texte = texte.replace(/<meta[^>]*>/gi, ' ').replace(/var\([^)]*\)/g, ' ');
    const ouv = texte.search(/<svg/i);
    if (ouv !== -1) { texte = texte.slice(0, ouv); dansSvg = true; }
    if (/<style/i.test(texte)) dansStyle = true;
    // Blocs :root (y compris :root[data-theme=...]) : définitions de jetons permises.
    const ouvreRoot = /:root[^{]*\{/.test(texte);
    if (ouvreRoot) dansRoot = 1;
    const dansUnRoot = dansRoot > 0;
    if (dansRoot && /\}/.test(texte) && !ouvreRoot || (ouvreRoot && /\}/.test(texte.slice(texte.indexOf('{'))))) dansRoot = 0;
    if (/<\/style/i.test(texte)) dansStyle = false;
    if (exception) return;
    if (!dansUnRoot) {
      const hex = texte.match(RE_HEX) || [];
      // En dehors des styles, un # peut être une ancre : on ne retient que CSS et attributs de style.
      if (hex.length && (dansStyle || /style\s*=|color|background|border|fill|stroke/i.test(texte))) {
        hex.forEach(h => rapport.couleurs.push({ n, h }));
      }
    }
    if (RE_EMOJI_ETAT.test(texte)) rapport.emojis.push({ n, ligne: texte.trim().slice(0, 90) });
    const re = /assets\/[A-Za-z0-9_\-\/.]+\.(?:webp|png|svg|jpg|jpeg)/g;
    let m;
    while ((m = re.exec(texte))) {
      if (!fs.existsSync(path.join(RACINE, m[0]))) rapport.icones.push({ n, chemin: m[0] });
    }
  });
  return rapport;
}

function afficher(r, bloquant) {
  const total = r.couleurs.length + r.emojis.length + r.icones.length + (r.theme ? 0 : 1);
  console.log(`\n== ${r.fichier} (${bloquant ? 'liste contrôlée' : 'indicatif'}) : ${total} point(s)`);
  console.log(`  nexus-theme.js : ${r.theme ? 'présent' : 'ABSENT'}`);
  console.log(`  couleurs hexadécimales hors :root : ${r.couleurs.length}`);
  r.couleurs.slice(0, 15).forEach(c => console.log(`    l.${c.n} ${c.h}`));
  if (r.couleurs.length > 15) console.log(`    ... ${r.couleurs.length - 15} autre(s)`);
  console.log(`  emojis d'état : ${r.emojis.length}`);
  r.emojis.slice(0, 15).forEach(e => console.log(`    l.${e.n} ${e.ligne}`));
  console.log(`  icônes assets/ introuvables : ${r.icones.length}`);
  r.icones.forEach(c => console.log(`    l.${c.n} ${c.chemin}`));
  return total;
}

let ecarts = 0;
PAGES_CONTROLEES.forEach(f => { if (fs.existsSync(path.join(RACINE, f))) ecarts += afficher(analyser(f), true); else console.log(`(absent) ${f}`); });
PAGES_INDICATIVES.forEach(f => { if (fs.existsSync(path.join(RACINE, f))) afficher(analyser(f), false); else console.log(`(absent) ${f}`); });
console.log(`\nMode rapport : ${PAGES_CONTROLEES.length} page(s) contrôlée(s), ${ecarts} écart(s) ; aucun échec dans ce lot.`);
process.exit(0);
