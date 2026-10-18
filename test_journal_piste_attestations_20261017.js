// Harnais : exécute le script réel de NEXUS-Journal-Piste-v1.html avec un client Supabase simulé.
const fs = require('fs'), vm = require('vm');
const html = fs.readFileSync(__dirname + '/NEXUS-Journal-Piste-v1.html', 'utf8');
const script = html.match(/<script>\n\(function[\s\S]*?<\/script>/)[0].replace(/<\/?script>/g, '');
const lib = fs.readFileSync(__dirname + '/nexus-releves-piste.js', 'utf8');
let echecs = 0;
const ok = (c, m) => { console.log((c ? 'ok - ' : 'ECHEC - ') + m); if (!c) echecs++; };

async function rendre(valeurs, employes, opts = {}) {
  const app = { innerHTML: '' };
  const q = (table) => {
    const o = { table, filtres: {} };
    const b = {};
    ['select', 'eq', 'order', 'limit'].forEach(m => { b[m] = () => b; });
    b.in = () => b;
    b.maybeSingle = () => Promise.resolve({ data: { fuseau_horaire: 'America/Martinique' } });
    b.then = (res) => {
      let data = [];
      if (table === 'carburant_index_valeurs') data = o.total ? opts.tousLesCompteurs : valeurs;
      if (table === 'employees') data = employes;
      res({ data, error: (table === 'carburant_index_valeurs' && opts.erreur) ? { message: 'x' } : null });
    };
    return b;
  };
  let nValeurs = 0;
  const client = {
    rpc: () => Promise.resolve({ data: null, error: null }),
    from: (t) => {
      const b = q(t);
      if (t === 'carburant_index_valeurs') {
        const s = b.select; let appel = ++nValeurs;
        b.select = (cols) => { if (cols === 'releve_id') { b.then = (res) => res({ data: opts.tousLesCompteurs || [], error: opts.erreurTotaux ? { message: 'x' } : null }); } return b; };
      }
      return b;
    },
  };
  const ctx = { window: {}, document: { getElementById: () => app, querySelector: () => null }, console,
    nexusClient: client, nexusRequireAuth: () => Promise.resolve({ role: 'manager', site_id: 'S1' }) };
  ctx.window = ctx; ctx.self = ctx;
  app.addEventListener = () => {};
  vm.createContext(ctx);
  vm.runInContext(lib, ctx);
  vm.runInContext(script, ctx);
  await new Promise(r => setTimeout(r, 50));
  return app.innerHTML;
}
const ligne = (rel, le, par) => ({ releve_id: rel, recopiee_le: le, recopiee_par: par });
const huit = (rel, le, par) => Array.from({ length: 8 }, () => ligne(rel, le, par));

(async () => {
  // 1. aucune recopie
  let h = await rendre([], []);
  ok(/Aucune recopie Decenium déclarée/.test(h) && !/Recopie Decenium déclarée par/.test(h), 'aucune recopie : mention explicite, aucune attestation inventée');
  // 2. employé non identifiable
  h = await rendre(huit('r1', '2026-10-17T05:00:00Z', null), [], { tousLesCompteurs: huit('r1') });
  ok(/déclarée par un employé à 17\/10, 01:00|déclarée par un employé à 17\/10 01:00/.test(h), 'employé non identifiable : « un employé », heure de Martinique (UTC-4)');
  ok(/8\/8 compteurs/.test(h) && !/incomplète/.test(h), 'recopie complète : 8/8 sans avertissement');
  // 3. recopie incomplète
  h = await rendre([ligne('r2', '2026-10-17T03:30:00Z', 'e1'), ligne('r2', '2026-10-17T03:30:00Z', 'e1'), ligne('r2', '2026-10-17T03:29:00Z', 'e1')], [{ id: 'e1', nom: 'Employé Test B' }], { tousLesCompteurs: huit('r2') });
  ok(/Employé Test B/.test(h) && /3\/8 compteurs : recopie incomplète/.test(h), 'recopie incomplète : 3/8 signalée');
  // 4. dix dernières, ordre conservé
  const v = []; for (let i = 0; i < 12; i++) v.push(ligne('r' + i, new Date(Date.UTC(2026, 9, 17, 12 - i)).toISOString(), 'e1'));
  h = await rendre(v, [{ id: 'e1', nom: 'A' }], { tousLesCompteurs: v });
  const n = (h.match(/Recopie Decenium déclarée par/g) || []).length;
  ok(n === 10, 'dix dernières attestations seulement (' + n + ')');
  const heures = [...h.matchAll(/à (\d\d)\/10,? (\d\d):/g)].map(m => +m[1] * 100 + +m[2]);
  ok(heures.length === 10 && heures.every((x, i) => i === 0 || x < heures[i - 1]), 'ordre décroissant : ' + heures.join(','));
  // 5. échec de lecture des totaux : jamais « complète » affirmée
  h = await rendre(huit('r1', '2026-10-17T05:00:00Z', 'e1'), [{ id: 'e1', nom: 'A' }], { erreurTotaux: true });
  ok(/total non vérifié/.test(h) && !/8\/8/.test(h), 'totaux illisibles : « total non vérifié », pas de complétude affirmée');
  ok(/NEXUS ne compare pas avec Decenium/.test(h), 'déclaration humaine rappelée');
  console.log(echecs ? echecs + ' échec(s)' : 'TOUT OK'); process.exit(echecs ? 1 : 0);
})();
