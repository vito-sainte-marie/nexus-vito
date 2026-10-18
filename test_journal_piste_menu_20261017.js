// Journal Piste dans le menu bureau + point rouge clignotant sur alerte ouverte.
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const src = fs.readFileSync(__dirname + '/nexus-desktop.js', 'utf8');
assert(/label: 'Relevés, contrôles des index et décisions', href: 'NEXUS-Journal-Piste-v1\.html'/.test(src), 'entrée de menu absente');
const m = src.match(/async function nexusVerifierAlertesPiste\(\) \{[\s\S]*?\n\}\n/);
assert(m, 'fonction absente');
async function essai(count, error) {
  const ajoutes = [];
  const lien = { querySelector: () => null, appendChild: (d) => ajoutes.push(d) };
  const filtres = [];
  const q = { select() { return q; }, eq(c, v) { filtres.push(c + '=' + v); return q; },
    maybeSingle: async () => ({ data: { site_id: 'S1' }, error: null }),
    then: (ok) => ok({ count, error }) };
  const ctx = { console, nexusClient: { auth: { getSession: async () => ({ data: { session: { user: { id: 'u' } } } }) }, from: () => q },
    document: { querySelector: () => lien, createElement: () => ({}) } };
  vm.createContext(ctx); vm.runInContext(m[0] + '; this.f = nexusVerifierAlertesPiste;', ctx);
  await ctx.f(); return { ajoutes, filtres };
}
(async () => {
  let r = await essai(2, null);
  assert.strictEqual(r.ajoutes.length, 1); assert.strictEqual(r.ajoutes[0].className, 'nexus-sidebar-dot');
  assert(r.filtres.includes('statut=ouverte') && r.filtres.includes('site=S1'));
  assert.strictEqual((await essai(0, null)).ajoutes.length, 0, 'aucune alerte : pas de point');
  assert.strictEqual((await essai(3, { message: 'x' })).ajoutes.length, 0, 'erreur : pas de point');
  console.log('test_journal_piste_menu_20261017 : OK');
})().catch(e => { console.error(e); process.exit(1); });
