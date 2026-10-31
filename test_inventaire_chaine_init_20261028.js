// Test — INVENTAIRE-CHAINE-INITIALISATION-20261027 : les réglages du plan
// sont lus PENDANT la recherche du plan existant, et ne sont attendus qu'à la
// génération. Un plan existant ne dépend donc jamais des réglages ; une
// génération applique toujours les réglages résolus. Mutation en fin de fichier.
global.window = global;
const fs = require('fs'), path = require('path'), assert = require('assert'), vm = require('vm');
const SRC = fs.readFileSync(path.join(__dirname, 'nexus-inventaire-plan-donnees.js'), 'utf8');
const HTML = fs.readFileSync(path.join(__dirname, 'NEXUS-Inventaire-v1.html'), 'utf8');

function charger(src, planExistant) {
  const inserts = [];
  const client = { from(table) {
    let mode = 'select', valeur = null;
    const q = {
      select() { return q; }, eq() { return q; }, gte() { return q; }, lt() { return q; }, in() { return q; },
      order() { return q; }, limit() { return q; },
      insert(v) { mode = 'insert'; valeur = v; return q; },
      maybeSingle() { return Promise.resolve(q._r(true)); },
      then(ok, ko) { return Promise.resolve(q._r(false)).then(ok, ko); },
      _r(unique) {
        if (mode === 'insert') { inserts.push({ table, valeur }); return { data: { id: 'plan-neuf' }, error: null }; }
        if (table === 'inventaire_plans_comptage' && planExistant) return { data: unique ? { id: 'plan-existant' } : [], error: null };
        if (table === 'inventaire_plan_items') return { data: [], error: null };
        return { data: unique ? null : [], error: null };
      },
    };
    return q;
  } };
  const sandbox = { console, Promise, Date, Array, Object, Set, Map, Number, String, JSON };
  sandbox.window = sandbox; sandbox.global = sandbox;
  sandbox.NexusInventaireMoteur = {
    construireReglesEffectivesParProduit: () => ({}), appliquerCutoverControles: x => x, agregerAnomaliesParProduit: () => ({}),
    construirePlanComptage: () => ({ items: [] }),
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return { client, inserts, PD: sandbox.NexusInventairePlanDonnees };
}

// Le calcul du quart est figé : sa règle (fuseau -> horaires -> bascule) ne
// change pas avec la parallélisation de la pré-chaîne.
const STATION = fs.readFileSync(path.join(__dirname, 'nexus-station.js'), 'utf8');
const sha = x => require('crypto').createHash('sha256').update(x).digest('hex').slice(0, 16);
function corps(t, debut) { const i = t.indexOf(debut); if (i < 0) return ''; const j = t.indexOf('\n  }\n', i); return t.slice(i, j); }
function calculQuartFige(html, station) {
  return [corps(html, 'async function quartDuMoment'), corps(station, 'async function quartConfigureDuMoment'),
    corps(station, 'async function seuilDeBascule'), corps(station, 'function quartDepuisMinutes')].map(sha).join(',');
}
const EMPREINTE_QUART = 'd9ac7c429e10aa5c,80e938e9be475b64,5e073ada93a474a0,d268877969562575';
function ordreInit(html) {
  const e = [];
  const iZ = html.indexOf("lectureZones = Promise.resolve(nexusClient.from('inventaire_zones')");
  const iF = html.indexOf('await NexusStation.fuseauDeLaStation(employee.site_id)');
  const iQ = html.indexOf('quartActuel = await quartDuMoment(employee.site_id, fuseauInventaire.timezone)');
  const iN = html.indexOf('if (!quartActuel) { bloquerFauteDHorairesDeQuart(); return; }');
  const iR = html.indexOf('const resolution = await roleEnCours');
  const iW = html.indexOf('obtenirOuCreerQuart()', iF);
  if (!(iZ > 0 && iZ < iF)) e.push('les zones doivent partir avant le fuseau');
  if (!(iF < iQ && iQ < iN)) e.push('fuseau puis quart, dans cet ordre');
  if (!(iN < iR)) e.push('écran des horaires avant celui du rôle');
  if (!(iN < iW && iR < iW)) e.push("aucune écriture (quart) avant le quart connu et le rôle");
  return e;
}

async function epreuves(src) {
  const echecs = [];
  const essai = async (nom, f) => { try { await f(); } catch (e) { echecs.push(nom + ' : ' + e.message); } };

  await essai('plan existant : les réglages ne sont pas attendus', async () => {
    const w = charger(src, true);
    const jamais = new Promise(() => {});
    const r = await Promise.race([
      w.PD.chargerOuGenererPlan(w.client, 's', '2026-10-28', 'matin', jamais),
      new Promise(res => setTimeout(() => res('bloque'), 200)),
    ]);
    assert.notStrictEqual(r, 'bloque');
    assert.strictEqual(r.plan.id, 'plan-existant');
    assert.strictEqual(w.inserts.length, 0);
  });

  await essai('génération : les réglages (promesse) sont appliqués', async () => {
    const w = charger(src, false);
    await w.PD.chargerOuGenererPlan(w.client, 's', '2026-10-28', 'matin', Promise.resolve({ socleCible: 7, surprisesCible: 2 }));
    const plan = w.inserts.find(i => i.table === 'inventaire_plans_comptage');
    assert.ok(plan, 'plan inséré');
    assert.strictEqual(plan.valeur.socle_cible, 7);
    assert.strictEqual(plan.valeur.surprises_cible, 2);
  });

  await essai('génération : un objet simple reste accepté', async () => {
    const w = charger(src, false);
    await w.PD.chargerOuGenererPlan(w.client, 's', '2026-10-28', 'matin', { socleCible: 9 });
    assert.strictEqual(w.inserts.find(i => i.table === 'inventaire_plans_comptage').valeur.socle_cible, 9);
  });
  return echecs;
}

(async () => {
  const sain = await epreuves(SRC);
  assert.deepStrictEqual(sain, [], 'code réel : ' + sain.join(' | '));
  // L'écran lance bien les trois lectures avant d'attendre les réglages.
  const m = HTML.match(/async function lirePlanEtReglagesDuQuart[\s\S]*?\n  }\n/);
  assert.ok(m, 'lirePlanEtReglagesDuQuart introuvable');
  assert.ok(!/await Promise\.all\(\[\s*chargerReglagesPlanComptage/.test(m[0]), 'réglages attendus avant le plan');
  assert.ok(/chargerOuGenererPlan\(.*, reglages\)/.test(m[0]), 'le plan reçoit les réglages en promesse');
  // Mutation : si les réglages sont attendus tôt, l'épreuve doit rougir.
  const mute = SRC.replace('options = await options;', '');
  const rouge = await epreuves(mute);
  assert.ok(rouge.length > 0, 'la mutation (réglages non attendus) doit rougir une épreuve');
  // Calcul du quart figé + ordre de l'init ; mutations : chacune doit rougir.
  assert.strictEqual(calculQuartFige(HTML, STATION), EMPREINTE_QUART, 'le calcul du quart a changé');
  assert.notStrictEqual(calculQuartFige(HTML, STATION.replace("p_quart: 'quart2'", "p_quart: 'quart1'")), EMPREINTE_QUART, 'mutation du calcul non détectée');
  assert.deepStrictEqual(ordreInit(HTML), [], 'ordre de l\'init');
  const zonesApres = HTML.replace("const lectureZones = Promise.resolve(nexusClient.from('inventaire_zones').select('id, code'));", '').replace('    const reponseZones', '    const reponseZones');
  assert.ok(ordreInit(zonesApres).length > 0, 'mutation (zones plus tard) non détectée');
  const ecritureTot = HTML.replace('quartActuel = await quartDuMoment(', 'const _t = quartRow = await obtenirOuCreerQuart(); quartActuel = await quartDuMoment(');
  assert.ok(ordreInit(ecritureTot).length > 0, 'mutation (écriture avant le quart) non détectée');
  console.log('OK test_inventaire_chaine_init_20261028');
})().catch(e => { console.error('ÉCHEC', e.message); process.exit(1); });
