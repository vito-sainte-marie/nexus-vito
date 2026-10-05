// Contre-vérification : le ledger écrit par le serveur, relu par le moteur des écrans.
const fs = require('fs');
const ctx = { window: {} }; require('vm').runInNewContext(fs.readFileSync(process.argv[2], 'utf8'), ctx); const M = ctx.window.NexusFdjMoteur;
const L = { caisse: '00000000-0000-0000-0000-0000000000c1', bureau: '00000000-0000-0000-0000-0000000000c2', bloque: '00000000-0000-0000-0000-0000000000c3' };
const g = n => '00000000-0000-0000-0000-0000000000b' + n;
// [bureau, confies, actives, nonActives]
const attendu = {
  A: { 1: [5,0,0,0], 2: [0,0,0,0], 3: [1,2,2,0] },
  B: { 1: [4,1,1,0], 2: [2,1,1,0], 3: [2,1,0,1] },
  C: { 1: [2,3,3,0] },
  D: { 1: [5,0,0,0], 3: [1,2,0,2] },
  E: { 1: [3,2,2,0], 2: [2,0,0,0] },
  F: { 2: [0,0,3,-3] },
  M: { 1: [4,1,1,0], 2: [0,0,1,-1] },
  G: { 1: [2,3,3,0] },
  R: { 2: [1,1,1,0] },
};
let ko = 0, vus = 0;
for (const ligne of fs.readFileSync(process.argv[3], 'utf8').split('\n')) {
  if (!ligne.startsWith('LEDGER|')) continue;
  const [, sc, json] = ligne.split('|');
  const d = JSON.parse(json);
  const s = M.soldesCarnetsAvecReference(d.mouvements, L, d.reference);
  for (const [n, [b, c, a, na]] of Object.entries(attendu[sc] || {})) {
    const x = s[g(n)]; vus++;
    const obtenu = [x.bureau, x.confies, x.actives, x.nonActives];
    const bon = JSON.stringify(obtenu) === JSON.stringify([b, c, a, na]);
    if (!bon) ko++;
    console.log((bon ? 'OK ' : 'KO ') + sc + ' b' + n + ' ' + JSON.stringify(obtenu) + (bon ? '' : ' attendu ' + JSON.stringify([b, c, a, na])));
  }
}
console.log(`${vus - ko}/${vus} soldes conformes`);
process.exit(ko || vus !== 16 ? 1 : 0);
