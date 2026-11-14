'use strict';
// Guardian 6879228189 : les prix promo survivent à une validation, une seconde validation crée la version 2,
// la version 1 reste affichée ; formats au centime et dates jj/mm/aaaa ; ordre des cartes.
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const html = fs.readFileSync('NEXUS-Campagne-v2-Objectifs.html', 'utf8');
const code = html.split('<script>').pop().split('</script>')[0];
global.window = global; require('./nexus-vocabulaire.js'); require('./nexus-simulateur-promo.js');
const els = {}, handlers = {};
const el = id => els[id] || (els[id] = { id, innerHTML: '', textContent: '', hidden: false, disabled: false, value: '', addEventListener(ev, f){ handlers[id + ':' + ev] = f; } });
const bdd = { campagne_objectifs_produits: [] };
const donnees = {
  campagnes_nexus: [{ id: 'c1', nom: 'Promo test', date_debut: '2026-10-20', date_fin: '2026-11-18', produits_concernes: ['X'] }],
  products: [{ article: 'X', categorie: 'C', periode_debut: '2026-09-01', periode_fin: '2026-09-30', quantite: 60, ca: 120, marge: 60, tva: 8.5 }]
};
function table(nom){
  const q = { _ins: null, select(){ return q; }, eq(){ return q; }, order(){ return q; }, range(){ return q; },
    insert(l){ bdd[nom].push(...l); return Promise.resolve({ error: null }); },
    then(ok){ return Promise.resolve({ data: nom in bdd ? bdd[nom].slice().sort((a, b) => a.version - b.version) : donnees[nom], error: null }).then(ok); } };
  return q;
}
const sandbox = { window: global, console, document: { getElementById: el, querySelector: () => null },
  location: { search: '' }, URLSearchParams, Date, Math, Number, String, Array, Object, Promise, Set,
  NexusVocab: global.NexusVocab, NexusSimulateurPromo: global.NexusSimulateurPromo,
  NexusTempo: { dateLocale: d => new Date(d + 'T00:00:00') },
  nexusClient: { from: table },
  nexusRequireAuth: () => Promise.resolve({ role: 'manager', site_id: 's', id: 'e1' }),
  NexusForfait: { nexusRequireProfessional: () => Promise.resolve(true) } };
sandbox.globalThis = sandbox; vm.createContext(sandbox);
const saisir = (champ, v) => handlers['objTable:input']({ target: { dataset: { oi: '0', ochamp: champ }, value: v } });
(async () => {
  vm.runInContext(code, sandbox);
  await new Promise(r => setTimeout(r, 50));
  assert(/value="2,17"/.test(el('objTable').innerHTML), 'PV habituel au centime : ' + el('objTable').innerHTML.slice(0, 600));
  assert(!/2026-/.test(el('objComparCorps').innerHTML), 'aucune date ISO');
  assert(/du 01\/09 au 30\/09\/2026/.test(el('objComparCorps').innerHTML), 'période jj/mm/aaaa : ' + el('objComparCorps').innerHTML);
  assert(/<details class="obj-hab"><summary>Prix habituels proposés/.test(el('objTable').innerHTML), 'prix habituels derrière un chevron par ligne');
  saisir('paPromo', '0,9'); saisir('pvPromo', '1,8');
  await handlers['objValider:click']();
  assert.strictEqual(bdd.campagne_objectifs_produits.length, 1); assert.strictEqual(bdd.campagne_objectifs_produits[0].version, 1);
  const h1 = el('objTable').innerHTML;
  assert(/value="0,90"/.test(h1) && /value="1,80"/.test(h1), 'prix promo conservés après validation');
  assert(!/Renseignez les quatre prix/.test(h1) && /Version 1 :/.test(h1));
  assert(!el('objValider').disabled, 'seconde validation possible');
  saisir('pvPromo', '1,9');
  await handlers['objValider:click']();
  assert.strictEqual(bdd.campagne_objectifs_produits.length, 2); assert.strictEqual(bdd.campagne_objectifs_produits[1].version, 2);
  const h2 = el('objTable').innerHTML;
  assert(/Version 2 :/.test(h2) && /Version 1 :/.test(h2), 'version 2 affichée, version 1 conservée');
  const C = global.NexusVocab.campagne.cartes.map(c => c.cle);
  assert.deepStrictEqual(C.slice(0, 4), ['promotions', 'compensation', 'objectifs', 'opportunites-achat']);
  console.log('ok revalidation');
})().catch(e => { console.error(e); process.exit(1); });
