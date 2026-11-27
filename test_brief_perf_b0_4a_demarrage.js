// B0-perf-4a : forfait, fuseau, poste et sites partent ensemble, mais aucun
// contenu n'est affiché ni appliqué avant le verdict d'accès.
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const H = fs.readFileSync('NEXUS-Brief-v1.html', 'utf8');
const i = H.indexOf('nexusRequireAuth().then(async employee => {');
const j = H.indexOf('\n  });\n</script>', i);
assert.ok(i > 0 && j > i, 'bloc de démarrage introuvable');
const bloc = H.slice(i, j + 6);
let ok = 0;
const attendre = ms => new Promise(r => setTimeout(r, ms));

async function lancer({ gestion, forfait, delais }) {
  const journal = [];
  const dom = { header: '', body: '' };
  const g = {
    console, setTimeout, Promise,
    employeeCourantId: null, ROLE_REEL_COURANT: null, SITE_ACTUEL: null, FUSEAU_STATION: null,
    STATION_CONFIG: { manager_prenom: '', manager_role: '', station_nom: 'Ma station', logo_url: '' },
    SITE_SECTEURS_CONFIG: null, ANIMATION_CHARGEMENT: null,
    nexusRequireAuth: async () => ({ id: 'e1', nom: 'Marie', role: 'manager', site_id: 's1' }),
    nexusRequireGestion: () => { journal.push('gestion'); return gestion; },
    NexusForfait: { nexusRequireBriefNexus: async () => { journal.push('forfait:debut'); await attendre(delais.forfait); journal.push('forfait:fin'); return forfait; } },
    NexusStation: { fuseauDeLaStation: async () => { journal.push('fuseau:debut'); await attendre(delais.autres); return { timezone: 'Europe/Paris' }; } },
    NexusTheme: { definirFuseau: () => journal.push('definirFuseau') },
    nexusServiceCourant: async () => { journal.push('poste:debut'); await attendre(delais.autres); return { service: { role: 'manager' } }; },
    nexusClient: { from: () => { const q = { select: () => q, eq: () => q, maybeSingle: async () => { journal.push('sites:debut'); await attendre(delais.autres); return { data: { nom_entreprise: 'Vito', logo_url: 'l.png', type_commerce: 'x', secteurs: [] } }; } }; return q; } },
    NexusSecteursCatalogue: { secteursActifsSite: () => ({ secteurs: [] }) },
    demarrerAnimationChargement: () => { journal.push('animation'); return {}; },
    chargerJournalDecisions: async () => { journal.push('journal'); },
    rafraichir: async () => { journal.push('rafraichir'); },
    lirePosteDuJour: async emp => { const r = await g.nexusServiceCourant(emp); return r.service ? r.service.role : null; },
    document: { getElementById: () => ({ set innerHTML(v) { dom.header = v; } }), body: { set innerHTML(v) { dom.body = v; } } },
    window: {},
  };
  g.window = g;
  vm.createContext(g);
  vm.runInContext(bloc, g);
  await attendre(120);
  return { journal, dom, g };
}

(async () => {
  async function t(nom, f) { try { await f(); ok++; } catch (e) { console.error('ECHEC', nom, e.message); process.exitCode = 1; } }

  await t('compte autorisé : les quatre lectures partent avant la fin du forfait', async () => {
    const r = await lancer({ gestion: true, forfait: true, delais: { forfait: 40, autres: 5 } });
    const iFin = r.journal.indexOf('forfait:fin');
    ['fuseau:debut', 'poste:debut', 'sites:debut'].forEach(k => assert.ok(r.journal.indexOf(k) >= 0 && r.journal.indexOf(k) < iFin, k + ' doit démarrer avant la fin du forfait'));
    assert.ok(r.journal.indexOf('rafraichir') > iFin);
    assert.ok(r.dom.header.includes('Vito') && r.dom.header.includes('MANAGER') === false);
  });
  await t('définirFuseau avant animation et rendu', async () => {
    const r = await lancer({ gestion: true, forfait: true, delais: { forfait: 10, autres: 5 } });
    assert.ok(r.journal.indexOf('definirFuseau') < r.journal.indexOf('animation'));
    assert.ok(r.journal.indexOf('animation') < r.journal.indexOf('rafraichir'));
  });
  await t('forfait refusé : aucun contenu, aucun rendu, rien d\'appliqué même si les lectures répondent', async () => {
    const r = await lancer({ gestion: true, forfait: false, delais: { forfait: 10, autres: 5 } });
    assert.strictEqual(r.dom.header, '');
    assert.strictEqual(r.dom.body, '');
    ['animation', 'journal', 'rafraichir', 'definirFuseau'].forEach(k => assert.ok(!r.journal.includes(k), k + ' ne doit jamais s\'exécuter'));
    assert.strictEqual(r.g.STATION_CONFIG.station_nom, 'Ma station');
    assert.strictEqual(r.g.STATION_CONFIG.logo_url, '');
    assert.strictEqual(r.g.FUSEAU_STATION, null);
  });
  await t('forfait refusé alors que les lectures répondent plus tard : toujours rien', async () => {
    const r = await lancer({ gestion: true, forfait: false, delais: { forfait: 5, autres: 30 } });
    assert.strictEqual(r.dom.header, ''); assert.ok(!r.journal.includes('rafraichir'));
  });
  await t('rôle non autorisé : aucune lecture ne démarre, message de refus seul', async () => {
    const r = await lancer({ gestion: false, forfait: true, delais: { forfait: 5, autres: 5 } });
    ['forfait:debut', 'fuseau:debut', 'poste:debut', 'sites:debut', 'rafraichir'].forEach(k => assert.ok(!r.journal.includes(k), k));
    assert.ok(r.dom.body.includes('réservé'));
    assert.strictEqual(r.dom.header, '');
  });
  console.log(ok + ' épreuves OK');
})();
