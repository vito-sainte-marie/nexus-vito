// Lever la marque « à revoir » d'un quart FDJ (Manager) — 14/11/2026.
// Page : exécutée via vm avec un faux client Supabase. Migration : lue comme
// texte (garde, motif, refus si alerte ouverte, journal, droits). Aucun
// accès à git.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const DIR = __dirname;
const html = fs.readFileSync(path.join(DIR, 'NEXUS-FDJ-Manager-v1.html'), 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
if (scripts.length !== 1) throw new Error(`Attendu 1 <script> inline, trouvé ${scripts.length}`);
const moteurSrc = fs.readFileSync(path.join(DIR, 'nexus-fdj-moteur.js'), 'utf8');
const sql = fs.readFileSync(path.join(DIR, 'supabase/migrations/20261114120000_fdj_lever_a_revoir.sql'), 'utf8');

const el = () => ({ value: '', textContent: '', _h: '', style: {}, dataset: {},
  classList: { add(){}, remove(){}, contains(){ return false; }, toggle(){} }, addEventListener(){}, click(){},
  get innerHTML() { return this._h; }, set innerHTML(v) { this._h = v; } });
const registre = new Map();
const documentMock = { getElementById: id => { if (!registre.has(id)) registre.set(id, el()); return registre.get(id); },
  querySelectorAll() { return []; }, querySelector() { return null; } };
const alertes = [];
const sandbox = { document: documentMock, console, nexusRequireAuth: () => new Promise(() => {}), nexusClient: {}, Date,
  alert: m => alertes.push(m) };
vm.createContext(sandbox);
vm.runInContext(moteurSrc, sandbox);
vm.runInContext(scripts[0] + `
;globalThis.__NEXUS_TEST__ = { get siteId(){ return siteId; }, set siteId(v){ siteId = v; },
  leverARevoirDevenusSains, leverARevoirManuellement, renderExceptionItem };`, sandbox);
const H = sandbox.__NEXUS_TEST__;
H.siteId = 'site-a';

// Faux client : alertes ouvertes lues par select().eq().in().is() ; rpc journalisé.
function client(alertesOuvertes, { rpcErreur = null } = {}) {
  const appels = [];
  return {
    appels,
    from() {
      const q = { select() { return q; }, eq() { return q; }, in() { return q; },
        is() { return Promise.resolve({ data: alertesOuvertes, error: null }); } };
      return q;
    },
    rpc(nom, args) { appels.push({ nom, args }); return Promise.resolve({ error: rpcErreur }); },
  };
}
const AMONT = 'correction_amont_stock_initial_deja_confirme';
let n = 0, ko = 0;
async function test(nom, fn) { try { await fn(); n++; } catch (e) { ko++; console.error('ÉCHEC :', nom, '\n ', e.message); } }

(async () => {
  await test('migration : commande, garde manager, motif, refus si alerte ouverte, journal', () => {
    assert(/function public\.fdj_manager_lever_a_revoir\(p_shift_id uuid, p_motif text\)/.test(sql));
    assert(/security definer/.test(sql) && /set search_path = ''/.test(sql));
    assert(/public\.fdj_quart_du_manager\(p_shift_id\)/.test(sql));
    assert(/char_length\(btrim\(p_motif\)\) < 5/.test(sql));
    assert(/continuite_stock_a_verifier/.test(sql) && /chaine_interrompue/.test(sql) && /resolue_le is null/.test(sql));
    assert(/a_revoir = false, a_revoir_motif = null, a_revoir_depuis_le = null/.test(sql));
    assert(/insert into public\.fdj_audit_log/.test(sql) && /'a_revoir_leve'/.test(sql));
    assert(/'a_revoir_motif', v_shift\.a_revoir_motif/.test(sql) && /'a_revoir_depuis_le', v_shift\.a_revoir_depuis_le/.test(sql));
    assert(/auth\.uid\(\)/.test(sql));
  });
  await test('migration : ne fait rien si le quart n\'est pas à revoir', () => {
    assert(/if v_shift\.a_revoir is not true then\s+return false;/.test(sql));
  });
  await test('migration : droits fermés à public et anon, ouverts à authenticated et service_role', () => {
    const f = 'public.fdj_manager_lever_a_revoir(uuid, text)';
    assert(sql.includes(`revoke all on function ${f} from public;`));
    assert(sql.includes(`revoke all on function ${f} from anon;`));
    assert(sql.includes(`grant execute on function ${f} to authenticated;`));
    assert(sql.includes(`grant execute on function ${f} to service_role;`));
  });

  await test('levée automatique : plus aucune alerte → la commande est appelée avec le motif de rétablissement', async () => {
    const c = client([]); sandbox.nexusClient = c;
    const r = await H.leverARevoirDevenusSains([{ id: 'q1', a_revoir_motif: AMONT }]);
    assert.strictEqual(c.appels.length, 1);
    assert.strictEqual(c.appels[0].nom, 'fdj_manager_lever_a_revoir');
    assert.strictEqual(c.appels[0].args.p_shift_id, 'q1');
    assert.strictEqual(c.appels[0].args.p_motif, 'Continuité de stock rétablie : stock initial aligné sur la fin du quart précédent');
    assert.strictEqual(r.length, 0);
  });
  await test('levée automatique : pas avant — alerte encore ouverte, rien n\'est levé', async () => {
    const c = client([{ shift_id: 'q1' }]); sandbox.nexusClient = c;
    const r = await H.leverARevoirDevenusSains([{ id: 'q1', a_revoir_motif: AMONT }]);
    assert.strictEqual(c.appels.length, 0);
    assert.strictEqual(r.length, 1);
    assert.strictEqual(r[0].continuiteOuverte, true);
  });
  await test('levée automatique : une alerte ouverte sur un autre quart ne bloque pas celui-ci', async () => {
    const c = client([{ shift_id: 'autre' }]); sandbox.nexusClient = c;
    const r = await H.leverARevoirDevenusSains([{ id: 'q1', a_revoir_motif: AMONT }]);
    assert.strictEqual(c.appels.length, 1);
    assert.strictEqual(r.length, 0);
  });
  await test('levée automatique : un autre motif n\'est jamais levé tout seul', async () => {
    const c = client([]); sandbox.nexusClient = c;
    const r = await H.leverARevoirDevenusSains([{ id: 'q2', a_revoir_motif: 'autre_motif' }]);
    assert.strictEqual(c.appels.length, 0);
    assert.strictEqual(r.length, 1);
    assert.strictEqual(r[0].continuiteOuverte, false);
  });
  await test('levée automatique : si la commande échoue, le quart reste à revoir', async () => {
    const c = client([], { rpcErreur: { message: 'refusé' } }); sandbox.nexusClient = c;
    const r = await H.leverARevoirDevenusSains([{ id: 'q1', a_revoir_motif: AMONT }]);
    assert.strictEqual(r.length, 1);
  });

  await test('levée manuelle : sans raison (moins de 5 caractères), la commande n\'est pas appelée', async () => {
    const c = client([]); sandbox.nexusClient = c; alertes.length = 0;
    assert.strictEqual(await H.leverARevoirManuellement('q1', '  ok '), false);
    assert.strictEqual(await H.leverARevoirManuellement('q1', ''), false);
    assert.strictEqual(c.appels.length, 0);
    assert.strictEqual(alertes.length, 2);
  });
  await test('levée manuelle : avec une raison, la commande reçoit la raison nettoyée', async () => {
    const c = client([]); sandbox.nexusClient = c;
    assert.strictEqual(await H.leverARevoirManuellement('q1', '  Vérifié sur le carnet  '), true);
    assert.strictEqual(JSON.stringify(c.appels[0].args), JSON.stringify({ p_shift_id: 'q1', p_motif: 'Vérifié sur le carnet' }));
  });
  await test('levée manuelle : refus serveur → false et message', async () => {
    const c = client([], { rpcErreur: { message: 'x' } }); sandbox.nexusClient = c; alertes.length = 0;
    assert.strictEqual(await H.leverARevoirManuellement('q1', 'Vérifié sur le carnet'), false);
    assert.strictEqual(alertes.length, 1);
  });

  await test('écran : bouton « Confirmer, rien à corriger » actif sans alerte, désactivé avec alerte', () => {
    const base = { id: 'q1', date: '2026-11-14', quart: '1' };
    const libre = H.renderExceptionItem('correctionsRetroactives', { ...base, continuiteOuverte: false });
    assert(libre.includes('Confirmer, rien à corriger') && libre.includes('data-lever-a-revoir="q1"'));
    assert(!/data-lever-a-revoir="q1"[^>]*disabled/.test(libre));
    assert(libre.includes('Vérifier / valider'));
    const bloque = H.renderExceptionItem('correctionsRetroactives', { ...base, continuiteOuverte: true });
    assert(/data-lever-a-revoir="q1"[^>]*disabled/.test(bloque));
  });
  await test('câblage : la levée automatique passe après la réconciliation et alimente la liste', () => {
    assert(/mutationsStock = await reconcilierAlertesContinuiteStock[\s\S]{0,400}quartsARevoirRestants = await leverARevoirDevenusSains\(quartsARevoir\)/.test(html));
    assert(html.includes('...quartsARevoirRestants],'));
  });

  console.log(ko ? `${n} OK, ${ko} en échec` : `${n} tests OK`);
  process.exit(ko ? 1 : 0);
})();
