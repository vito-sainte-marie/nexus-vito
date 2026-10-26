// Une demande déjà arbitrée ne se ré-arbitre pas — 26/10/2026.
//
// Le relais hachait le corps intégral du réveil : il changeait avec la tête du
// rail, et un réveil déjà publié et traité repartait vers l'API (429, CI rouge
// sur 033ad017). La clé est désormais la demande. Mutations : retirer l'appel
// dans l'étape CI, et ignorer l'ordre « réponse après réveil ».
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { dejaTraite } = require('./outils/arbitrage-deja-traite.js');

let echecs = 0, total = 0;
function epreuve(nom, fn) {
  total++;
  try { fn(); console.log(`ok   ${nom}`); }
  catch (e) { echecs++; console.log(`FAIL ${nom}\n     ${String(e.message).split('\n').join('\n     ')}`); }
}
const LOT = 'LOT-X', DEM = 'request-3.md';
const reveil = (d) => 'NEXUS Orchestrator — réveil Handoff\n\nLOT_ID: `' + LOT + '`\nDemande en attente: `' + d + '`\n';
const reponse = 'Réponse de l\'arbitre (ChatGPT, via l\'API, run 1). Contrat validé.\n\n**Décision : BLOCKED.**';

epreuve('A1 — réveil puis réponse : TRAITE', () => assert.strictEqual(dejaTraite([reveil(DEM), reponse], LOT, DEM), true));
epreuve('A2 — réveil sans réponse : A_TRAITER', () => assert.strictEqual(dejaTraite([reveil(DEM)], LOT, DEM), false));
epreuve('A3 — la réponse à la demande précédente ne couvre pas la suivante', () =>
  assert.strictEqual(dejaTraite([reveil('request-2.md'), reponse, reveil(DEM)], LOT, DEM), false));
epreuve('A4 — réponse non conforme (⚠️) : pas traité, on peut réarbitrer', () =>
  assert.strictEqual(dejaTraite([reveil(DEM), '⚠️ Réponse de l\'arbitre NON CONFORME'], LOT, DEM), false));
epreuve('A5 — entrée illisible ou sans lot : jamais TRAITE', () => {
  assert.strictEqual(dejaTraite(null, LOT, DEM), false);
  assert.strictEqual(dejaTraite([reveil(DEM), reponse], '', DEM), false);
  assert.strictEqual(dejaTraite([reveil(DEM), reponse], LOT, ''), false);
});
epreuve('A6 — un autre lot ne couvre pas celui-ci', () =>
  assert.strictEqual(dejaTraite([reveil(DEM), reponse], 'LOT-Y', DEM), false));

const YML = fs.readFileSync(path.join(__dirname, '.github', 'workflows', 'tests.yml'), 'utf8');
function relais(yml) {
  const i = yml.indexOf('- name: Réveil Orchestrateur — relais vers l\'arbitre (API OpenAI)');
  assert.ok(i >= 0, 'étape du relais absente');
  const j = yml.indexOf('\n      - name: ', i + 1);
  return yml.slice(i, j < 0 ? undefined : j);
}
function preuveCablage(yml) {
  const r = relais(yml);
  const a = r.indexOf('node outils/arbitrage-deja-traite.js');
  assert.ok(a >= 0, 'l\'étape doit interroger arbitrage-deja-traite.js');
  assert.ok(r.includes('rien ARBITRAGE_DEMANDE_DEJA_TRAITEE'), 'la demande traitée doit conclure NO_WORK');
  assert.ok(r.includes("--jq '.[].body|tojson'"), 'gh --paginate rend un tableau par page : le filtre doit itérer .[]');
  assert.ok(a < r.indexOf('relais-arbitre-openai.js >'), 'la garde doit précéder l\'appel à l\'API');
}
epreuve('C1 — tests.yml : la garde de demande traitée précède l\'appel à l\'API', () => preuveCablage(YML));
epreuve('M1 — sans l\'appel à l\'outil, C1 rougit', () => {
  const m = YML.replace('node outils/arbitrage-deja-traite.js', 'true');
  let rouge = false;
  try { preuveCablage(m); } catch (e) { rouge = /doit interroger/.test(e.message); if (!rouge) throw e; }
  assert.ok(rouge, 'la mutation est restée verte');
});
epreuve('M2 — sans le NO_WORK, C1 rougit', () => {
  const m = YML.replace('rien ARBITRAGE_DEMANDE_DEJA_TRAITEE', 'true ARBITRAGE_DEMANDE_DEJA_TRAITEE');
  let rouge = false;
  try { preuveCablage(m); } catch (e) { rouge = /NO_WORK/.test(e.message); if (!rouge) throw e; }
  assert.ok(rouge, 'la mutation est restée verte');
});
console.log(`\n${total - echecs}/${total} épreuves passent`);
process.exit(echecs ? 1 : 0);
