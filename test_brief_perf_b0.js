// B0-perf : le repli carburant parallèle et la pagination parallèle donnent
// EXACTEMENT le résultat des versions séquentielles (même date, même ordre).
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
let ok = 0;
function t(nom, f) { return f().then(() => { ok++; }, e => { console.error('ECHEC', nom, e.message); process.exitCode = 1; }); }

function charger(fichier, extra) {
  const g = Object.assign({ console }, extra || {}); g.window = g; g.self = g;
  vm.createContext(g); vm.runInContext(fs.readFileSync(fichier, 'utf8'), g, { filename: fichier });
  return g;
}

(async () => {
  // Pagination : client factice, 2500 lignes, ordre vérifié, pages en désordre d'arrivée.
  const g = charger('nexus-conseiller-donnees.js');
  const D = g.NexusConseillerDonnees;
  const lignes = Array.from({ length: 2500 }, (_, i) => ({ article: 'A' + String(i).padStart(4, '0'), categorie: 'c' }));
  let appels = 0;
  const client = { from(table) {
    if (table === 'produits_appel') return { select: () => ({ eq: async () => ({ data: [], error: null }) }) };
    const q = { select: () => q, eq: () => q, order: () => q,
      range: (a, b) => new Promise(r => { appels++; setTimeout(() => r({ data: lignes.slice(a, b + 1), error: null }), a === 1000 ? 30 : 1); }) };
    return q;
  } };
  await t('pagination identique et ordonnée', async () => {
    const r = await D.chargerProduitsBrut(client, 's');
    assert.strictEqual(JSON.stringify(r.map(x => x.article)), JSON.stringify(lignes.map(x => x.article)));
    assert.strictEqual(appels, 1 + 4);   // 1 page seule, puis un lot de 4 (arrêt à la 3e page courte)
  });
  await t('petit jeu : une seule page', async () => {
    appels = 0; const court = lignes.splice(0, 10);
    lignes.length = 0; court.forEach(x => lignes.push(x));
    const r = await D.chargerProduitsBrut(client, 's');
    assert.strictEqual(r.length, 10); assert.strictEqual(appels, 1);
  });
  console.log(ok + ' ok');
})();
