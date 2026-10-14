// Épreuves de P2 : la classification de CLOSES:true ne refuse aucun cas légitime.
'use strict';
const assert = require('assert'), fs = require('fs'), path = require('path'), os = require('os');
const r = require('./outils/relais-arbitre-openai.js');
let echecs = 0, total = 0;
function epreuve(nom, fn) { total++; try { fn(); console.log(`ok   ${nom}`); } catch (e) { echecs++; console.log(`FAIL ${nom}\n     ${String(e.message).split('\n').join('\n     ')}`); } }
const c = (x) => ({ CLOSES: 'true', DECISION: 'APPROVED', OWNER_NEXT: 'Claude', STOP_REQUIRED: 'non', ACTION_NEXT: 'aucune', ...x });
const classe = (m) => require('./outils/coherence-decision.js').classerCloture(c(m)).classe;

epreuve('C1 — CLOSES ≠ true : hors règle', () => assert.strictEqual(classe({ CLOSES: 'false', ACTION_NEXT: 'faire X' }), 'NON_CLOTURE'));
epreuve('C2 — clôture qui matérialise la décision : admise', () => {
  assert.strictEqual(classe({ ACTION_NEXT: 'Matérialiser cette décision de clôture avec outils/handoff.js decision --auteur ChatGPT.' }), 'CLOTURE_MATERIALISATION');
  assert.strictEqual(classe({ ACTION_NEXT: 'Matérialiser cette décision avec `outils/handoff.js decision --auteur ChatGPT` et clore le lot.' }), 'CLOTURE_MATERIALISATION');
});
epreuve('C3 — clôture portant une opération métier : signalée, jamais confondue avec une matérialisation', () => {
  assert.strictEqual(classe({ ACTION_NEXT: 'Comparer la définition Production de _regul_tiroir_detail au texte attendu par la migration.' }), 'CLOTURE_AVEC_ACTION');
  assert.strictEqual(classe({ ACTION_NEXT: 'Matérialiser cette décision puis exécuter la migration G1.' }), 'CLOTURE_AVEC_ACTION');
});
epreuve('C4 — arrêt humain : BLOCKED, Frédéric ou STOP posé', () => {
  assert.strictEqual(classe({ DECISION: 'BLOCKED', OWNER_NEXT: 'Frédéric', ACTION_NEXT: 'Donner ou refuser le GO.' }), 'ARRET_HUMAIN');
  assert.strictEqual(classe({ STOP_REQUIRED: 'SECRET_PERMISSION_SURFACE_SECURITE', ACTION_NEXT: 'x' }), 'ARRET_HUMAIN');
});
epreuve('C5 — clôture sans suite : admise', () => assert.strictEqual(classe({ ACTION_NEXT: 'aucune' }), 'CLOTURE_SANS_ACTION'));
epreuve('C6 — la règle ne refuse jamais : classer ne touche pas valider()', () => {
  const src = fs.readFileSync(path.join(__dirname, 'outils', 'coherence-decision.js'), 'utf8');
  assert.ok(!/refus|throw|exit/.test(src.replace(/\/\/.*$/gm, '')), 'le classeur ne doit rien refuser');
});

// H2 — rejeu du rail : chaque décision CLOSES:true reçoit une classe, aucune n'échappe.
epreuve('H2 — rejeu des décisions CLOSES:true du rail : toutes classées, matérialisation et action métier distinguées', () => {
  const { classerCloture } = require('./outils/coherence-decision.js');
  const base = path.join(__dirname, 'docs', 'handoff', 'lots'), n = {};
  for (const l of fs.readdirSync(base)) {
    const d = path.join(base, l); if (!fs.statSync(d).isDirectory()) continue;
    for (const f of fs.readdirSync(d).filter(x => /^decision-\d+\.md$/.test(x))) {
      const k = r.lireContrat(fs.readFileSync(path.join(d, f), 'utf8')); if (!k || !/true/.test(k.CLOSES || '')) continue;
      const cl = classerCloture(k).classe; n[cl] = (n[cl] || 0) + 1;
      assert.ok(cl !== 'NON_CLOTURE', `${l}/${f} non classée`);
    }
  }
  const tot = Object.values(n).reduce((a, b) => a + b, 0);
  assert.ok(tot >= 15, `${tot} décisions seulement`);
  assert.ok(n.CLOTURE_MATERIALISATION >= 8, JSON.stringify(n));
  assert.ok(n.CLOTURE_AVEC_ACTION >= 3, JSON.stringify(n));
  assert.ok(n.ARRET_HUMAIN >= 1, JSON.stringify(n));
  console.log('     ', JSON.stringify(n));
});

// M5 — mutation : si toute action non vide valait « avec action », C2 rougit (le cas légitime serait bloqué).
epreuve('M5 — si toute action est « métier », C2 rougit', () => {
  const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'coh-mut-')));
  const src = fs.readFileSync(path.join(__dirname, 'outils', 'coherence-decision.js'), 'utf8');
  const ancre = "return { classe: autre ? 'CLOTURE_AVEC_ACTION' : 'CLOTURE_MATERIALISATION', action };";
  assert.strictEqual(src.split(ancre).length, 2);
  fs.writeFileSync(path.join(tmp, 'm.js'), src.replace(ancre, "return { classe: 'CLOTURE_AVEC_ACTION', action };"));
  const m = require(path.join(tmp, 'm.js'));
  assert.notStrictEqual(m.classerCloture(c({ ACTION_NEXT: 'Matérialiser cette décision avec outils/handoff.js decision --auteur ChatGPT.' })).classe, 'CLOTURE_MATERIALISATION');
});
console.log(`\n${total - echecs}/${total} épreuves passent`);
process.exit(echecs ? 1 : 0);
