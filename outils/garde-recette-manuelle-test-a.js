// Convention d'identité de recette — decision-5 d'OUTILLAGE-REGULARISATION-20261026.
//
// « Employé Test A » est réservé à la recette AUTOMATIQUE. Une recette manuelle
// documentée (docs/recettes/*.md) se joue avec « Employé Test B » ou « Manager
// Test ». Sans cette garde, la convention ne tient que par la discipline de
// celui qui rédige : la séparation qui a produit un service clos avant sa
// création (recette et humain sur le même compte) reviendrait par la porte du
// document.
//
// Portée : les recettes datées du 26/10/2026 ou après (nom `AAAA-MM-JJ-…` ou
// `…-AAAAMMJJ`). Les recettes antérieures citent Test A légitimement : elles
// précèdent la convention. Une recette qui décrit le parcours AUTOMATIQUE le
// déclare par `RECETTE: automatique` dans ses 30 premières lignes.
'use strict';
const fs = require('fs');
const path = require('path');

const DEPUIS = '20261026';
const CITE_TEST_A = /Employ[ée]\s+Test\s+A\b|employe-test-a\b|\bTest\s+A\b/i;
const DECLARE_AUTO = /^\s*RECETTE\s*:\s*automatique\b/im;

function dateDuNom(nom) {
  const iso = nom.match(/^(\d{4})-(\d{2})-(\d{2})-/);
  if (iso) return iso[1] + iso[2] + iso[3];
  const suf = nom.match(/-(\d{8})(?=\.|-)/);
  return suf ? suf[1] : null;
}

/** Renvoie la liste des recettes manuelles postérieures à la règle qui citent Test A. */
function controler(racine) {
  const dossier = path.join(racine, 'docs', 'recettes');
  const fautes = [];
  if (!fs.existsSync(dossier)) return fautes;
  for (const nom of fs.readdirSync(dossier).filter(n => n.endsWith('.md')).sort()) {
    const d = dateDuNom(nom);
    if (!d || d < DEPUIS) continue;
    const texte = fs.readFileSync(path.join(dossier, nom), 'utf8');
    if (DECLARE_AUTO.test(texte.split('\n').slice(0, 30).join('\n'))) continue;
    const l = texte.split('\n').findIndex(x => CITE_TEST_A.test(x));
    if (l >= 0) fautes.push({ fichier: `docs/recettes/${nom}`, ligne: l + 1 });
  }
  return fautes;
}

module.exports = { controler, dateDuNom, DEPUIS, CITE_TEST_A };

if (require.main === module) {
  const f = controler(path.resolve(__dirname, '..'));
  for (const x of f) console.error(`REFUS RECETTE_MANUELLE_CITE_TEST_A — ${x.fichier}:${x.ligne} : Employé Test A est réservé à la recette automatique ; utiliser Employé Test B ou Manager Test, ou déclarer « RECETTE: automatique ».`);
  console.log(f.length ? `${f.length} recette(s) en faute` : 'Convention Test A respectée');
  process.exit(f.length ? 1 : 0);
}
