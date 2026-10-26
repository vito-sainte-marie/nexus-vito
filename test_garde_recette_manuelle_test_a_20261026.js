// Convention Test A — OUTILLAGE-REGULARISATION-20261026, decision-5.
// Employé Test A est réservé à la recette automatique ; une recette manuelle
// documentée datée du 26/10/2026 ou après ne le cite pas.
//  - la garde refuse une recette manuelle qui cite Test A (trois graphies) ;
//  - elle accepte B, Manager Test, une recette déclarée automatique et les
//    recettes antérieures à la règle ;
//  - elle passe sur l'arbre réel (c'est ce qui la fait mordre en CI) ;
//  - la règle est inscrite dans RULES.json ;
//  - MUTATION : la garde neutralisée (portée de date étendue à tout) est vue
//    échouer sur l'arbre réel, preuve que l'épreuve a mordu.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

const RACINE = __dirname;
const OUTILS = path.join(RACINE, 'outils');
let echecs = 0, total = 0;
function epreuve(nom, fn) {
  total++;
  try { fn(); console.log(`ok   ${nom}`); }
  catch (e) { echecs++; console.log(`FAIL ${nom}\n     ${String(e.message).split('\n').join('\n     ')}`); }
}
function charger(f) { delete require.cache[require.resolve(f)]; return require(f); }
function muter(nom, avant, apres) {
  const src = fs.readFileSync(path.join(OUTILS, nom), 'utf8');
  assert.ok(src.includes(avant), `ancre de mutation introuvable dans ${nom}`);
  assert.strictEqual(src.split(avant).length, 2, `ancre non unique dans ${nom}`);
  const tmp = path.join(OUTILS, `.mut-${process.pid}-${nom}`);
  fs.writeFileSync(tmp, src.replace(avant, apres));
  try { return charger(tmp); } finally { fs.unlinkSync(tmp); }
}
function arbre(fichiers) {
  const r = fs.mkdtempSync(path.join(os.tmpdir(), 'recette-testa-'));
  fs.mkdirSync(path.join(r, 'docs', 'recettes'), { recursive: true });
  for (const [n, t] of Object.entries(fichiers)) fs.writeFileSync(path.join(r, 'docs', 'recettes', n), t);
  return r;
}
const garde = charger(path.join(OUTILS, 'garde-recette-manuelle-test-a.js'));

epreuve('T1 — recette manuelle postérieure citant Test A (3 graphies) : refusée', () => {
  const r = arbre({
    '2026-10-27-a.md': 'Parcours.\nSession Employé Test A.\n',
    'recette-20261028.md': 'compte employe-test-a\n',
    '2026-11-02-b.md': 'avec Test A en caissière\n',
  });
  assert.deepStrictEqual(garde.controler(r).map(x => x.fichier).sort(),
    ['docs/recettes/2026-10-27-a.md', 'docs/recettes/2026-11-02-b.md', 'docs/recettes/recette-20261028.md']);
});
epreuve('T2 — Test B, Manager Test, recette déclarée automatique, recette antérieure : acceptés', () => {
  const r = arbre({
    '2026-10-27-b.md': 'Employé Test B puis Manager Test.\n',
    '2026-10-28-auto.md': 'RECETTE: automatique\nEmployé Test A\n',
    '2026-09-05-ancienne.md': 'Employé Test A\n',
    'journal-20261018.md': 'Employé Test A\n',
  });
  assert.deepStrictEqual(garde.controler(r), []);
});
epreuve('T3 — « RECETTE: automatique » noyé après la ligne 30 ne dispense pas', () => {
  const r = arbre({ '2026-10-29-x.md': '\n'.repeat(35) + 'RECETTE: automatique\nEmployé Test A\n' });
  assert.strictEqual(garde.controler(r).length, 1);
});
epreuve('T4 — l\'arbre réel respecte la convention', () => {
  assert.deepStrictEqual(garde.controler(RACINE), []);
});
epreuve('T5 — RULES.json porte la convention', () => {
  const d = JSON.parse(fs.readFileSync(path.join(RACINE, 'docs', 'learning', 'RULES.json'), 'utf8'));
  const g = d.rules.find(x => x.id === 'GOV-012');
  assert.ok(g && g.severity === 'blocking' && /Test A/.test(g.rule) && /Test B/.test(g.rule) && /Manager Test/.test(g.rule));
});
epreuve('M1 — mutation : portée de date supprimée, la garde mord les recettes antérieures', () => {
  const m = muter('garde-recette-manuelle-test-a.js', "if (!d || d < DEPUIS) continue;", "if (!d) continue;");
  const r = arbre({ '2026-09-05-ancienne.md': 'Employé Test A\n' });
  assert.deepStrictEqual(garde.controler(r), [], 'intact : antérieure acceptée');
  assert.strictEqual(m.controler(r).length, 1, 'mutée : la différence prouve que la portée mord');
});
epreuve('M2 — mutation : citation neutralisée, T1 verrait l\'écart', () => {
  const m = muter('garde-recette-manuelle-test-a.js', "const l = texte.split('\\n').findIndex(x => CITE_TEST_A.test(x));", "const l = -1;");
  const r = arbre({ '2026-10-27-a.md': 'Employé Test A\n' });
  assert.strictEqual(garde.controler(r).length, 1);
  assert.strictEqual(m.controler(r).length, 0, 'mutée : plus aucun refus — T1 rougirait');
});

console.log(`\n${total - echecs}/${total}`);
process.exit(echecs ? 1 : 0);
