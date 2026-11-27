// Lot A2 — un compte de la station A ne voit rien de la station B ; sans siteId, la lecture lève.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const RACINE = __dirname;
global.window = global;
require('./outils/fuseau-metier-pour-tests.js').installerAvecFuseau('America/Martinique');
require(path.join(RACINE, 'nexus-site-requis.js'));
for (const f of ['nexus-ponctualite.js','nexus-app-donnees.js','nexus-brief-donnees.js','nexus-coach-fdj-donnees.js','nexus-fdj-analyse-donnees.js']) require(path.join(RACINE, f));

let passes = 0, echecs = 0;
async function t(nom, fn) {
  try { await fn(); passes++; console.log('  ✓ ' + nom); }
  catch (e) { echecs++; process.exitCode = 1; console.error('  ✗ ' + nom + '\n    ' + (e && e.message)); }
}

function faireClient(tables) {
  const vus = [];
  function from(table) {
    const preds = [];
    const b = {
      select(c, o) { b._o = o || {}; return b; },
      eq(c, v) { preds.push(l => l[c] === v); return b; },
      gt(c, v) { preds.push(l => l[c] != null && l[c] > v); return b; },
      gte(c, v) { preds.push(l => l[c] != null && l[c] >= v); return b; },
      lte(c, v) { preds.push(l => l[c] != null && l[c] <= v); return b; },
      lt(c, v) { preds.push(l => l[c] != null && l[c] < v); return b; },
      in(c, vs) { preds.push(l => vs.indexOf(l[c]) !== -1); return b; },
      not() { return b; }, order() { return b; }, limit() { return b; }, range() { return b; },
      maybeSingle() { return b; }, single() { return b; },
      then(ok, ko) {
        const lignes = (tables[table] || []).filter(l => preds.every(p => p(l)));
        lignes.forEach(l => vus.push({ table, l }));
        const o = b._o || {};
        return Promise.resolve(o.head ? { data: null, count: lignes.length, error: null }
          : { data: lignes, count: o.count ? lignes.length : null, error: null }).then(ok, ko);
      },
    };
    return b;
  }
  return { vus, client: { from } };
}

const AD = global.NexusAppDonnees, BD = global.NexusBriefDonnees;
const NOMS = ['chargerDomainesRadarHome','chargerDomaineEquipe','chargerDerniereReferenceFdj','chargerReferenceCoach','chargerDerniereReference'];

(async () => {
  for (const nom of NOMS) {
    for (const [lib, val] of [['absent', undefined], ['vide', ''], ['non-chaîne', 42]]) {
      await t(`${nom} sans siteId (${lib}) lève`, async () => {
        const { client } = faireClient({});
        let leve = false;
        try {
          const a = nom === 'chargerDomaineEquipe' ? BD.chargerDomaineEquipe(client, val, '2026-09-19')
            : nom === 'chargerDomainesRadarHome' ? AD.chargerDomainesRadarHome(client, val)
            : nom === 'chargerDerniereReferenceFdj' ? BD.chargerDerniereReferenceFdj(client, val)
            : nom === 'chargerReferenceCoach' ? global.NexusCoachFdjDonnees.chargerReferenceCoach(client, val)
            : global.NexusFdjAnalyseDonnees.chargerDerniereReference(client, val);
          await a;
        } catch (e) { leve = /siteId obligatoire/.test(e.message); }
        assert.ok(leve, nom + ' n\'a pas levé');
      });
    }
  }

  const ajd = new Date().toISOString().slice(0, 10);
  const pts = (site, id) => ({ site, id, employee_id: 'e-' + site, type: 'arrivee', date: ajd, retard_min: 5 });
  await t('accueil : la station A ne lit aucun pointage ni mission de B', async () => {
    const { client, vus } = faireClient({
      pointages: [pts('A', 1), pts('B', 2)],
      mission_completions: [{ site_id: 'A', id: 1 }, { site_id: 'B', id: 2 }],
    });
    await AD.chargerDomainesRadarHome(client, 'A');
    assert.ok(vus.length > 0, 'rien lu : test sans portée');
    assert.ok(vus.every(v => (v.l.site || v.l.site_id) === 'A'), 'ligne de B lue');
  });
  await t('brief équipe : la station A ne lit aucun pointage de B', async () => {
    const { client, vus } = faireClient({ pointages: [pts('A', 1), pts('B', 2), pts('B', 3)] });
    await BD.chargerDomaineEquipe(client, 'A', ajd);
    assert.ok(vus.length > 0, 'rien lu : test sans portée');
    assert.ok(vus.every(v => v.l.site === 'A'), 'ligne de B lue');
  });
  const ref = { id: 'r1', site: 'A' };
  const lignesFdj = [{ site: 'A', reference_id: 'r1', id: 1 }, { site: 'B', reference_id: 'r1', id: 2 }];
  const src = f => fs.readFileSync(path.join(RACINE, f), 'utf8');
  for (const f of ['nexus-brief-donnees.js', 'nexus-coach-fdj-donnees.js', 'nexus-fdj-analyse-donnees.js']) {
    await t(`${f} : la lecture de fdj_stock_reference_lignes porte .eq('site', …)`, () => {
      const m = src(f).match(/fdj_stock_reference_lignes[\s\S]{0,300}/g) || [];
      assert.ok(m.length && m.every(x => /\.eq\('site',/.test(x)), 'filtre site absent');
    });
  }
  console.log(`\n${echecs ? '✗' : '✓'} ${passes} réussite(s), ${echecs} échec(s)`);
})();
