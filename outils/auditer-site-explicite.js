// SITE-EXPLICITE — détecteur des écritures applicatives sans site explicite.
//
// POURQUOI CE FICHIER EXISTE. La cartographie de Phase 1 a d'abord annoncé 78
// écritures sur 58 tables. Le motif ne reconnaissait que `site:` et manquait
// la notation abrégée ES6 `{ site, … }` — trente faux positifs. Un chiffre
// faux dans une cartographie destinée à fonder un plan de correction aurait
// produit un plan faux.
//
// Le détecteur vit donc ici, versionné et éprouvé par mutation, au lieu de
// rester un script jetable dont personne ne peut vérifier les résultats.
'use strict';

const fs = require('fs');
const path = require('path');

// `.from('table').insert(` ou `.upsert(`, tolérant aux retours à la ligne.
const APPEL = /\.from\('([a-z0-9_]+)'\)\s*\.?\s*(?:\n\s*)?\.(insert|upsert)\(/g;

// Le site est fourni si l'objet écrit porte `site:` / `site_id:` OU la
// notation abrégée `site,` / `site }` / `site` en fin de ligne. Omettre le
// raccourci est exactement l'erreur qui a gonflé le premier comptage.
const SITE_FOURNI = /\bsite(_id)?\s*(:|,|\}|$)/m;

function corpsDeLAppel(source, depuis) {
  const fenetre = source.slice(depuis, depuis + 700);
  const fin = fenetre.indexOf('})');
  return fenetre.slice(0, fin === -1 ? 400 : fin);
}

// Analyse une source et rend les écritures qui NE fournissent PAS le site.
function analyserSource(source, fichier) {
  const trouvees = [];
  APPEL.lastIndex = 0;
  let m;
  while ((m = APPEL.exec(source)) !== null) {
    const corps = corpsDeLAppel(source, m.index + m[0].length);
    if (!SITE_FOURNI.test(corps)) {
      trouvees.push({
        fichier: fichier || '(source)',
        ligne: source.slice(0, m.index).split('\n').length,
        table: m[1],
        operation: m[2],
      });
    }
  }
  return trouvees;
}

function analyserDepot(racine) {
  const cible = /^(NEXUS-.*\.html|nexus-.*\.js)$/;
  return fs.readdirSync(racine).filter(f => cible.test(f)).sort()
    .flatMap(f => analyserSource(fs.readFileSync(path.join(racine, f), 'utf8'), f));
}

module.exports = { analyserSource, analyserDepot, SITE_FOURNI, APPEL };

if (require.main === module) {
  const trouvees = analyserDepot(path.resolve(__dirname, '..'));
  const tables = new Set(trouvees.map(t => t.table));
  for (const t of trouvees) {
    console.log(`  ${t.table.padEnd(36)} ${t.operation.padEnd(6)} ${t.fichier}:${t.ligne}`);
  }
  console.log(`\n${trouvees.length} écriture(s) sans site explicite, sur ${tables.size} table(s).`);
}
