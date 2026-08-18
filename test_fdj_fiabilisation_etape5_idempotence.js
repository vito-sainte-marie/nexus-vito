// Test — FDJ Fiabilisation Étape 5 (18/08/2026, cahier
// NEXUS_FDJ_Audit_Fiabilisation_Chaine_Quarts.pdf, §9/§12/§13 "Idempotence
// des activations et appro tickets", P0). Couvre executerActivationCarnet /
// incrementerApproAutomatique dans NEXUS-FDJ-v1.html : le garde-fou anti
// double-tap (activationsEnCours), la clé d'idempotence posée sur l'insert
// (genererIdempotencyKey + conflit 23505 traité comme un succès), et
// l'incrément atomique de l'appro via le RPC fdj_incrementer_appro_shift_count
// (remplace l'ancien lire-puis-écrire côté client, source de la perte
// d'incrément en cas d'activations concurrentes).
//
// Extrait les fonctions réelles (jamais réécrites à la main) de
// NEXUS-FDJ-v1.html via regex + comptage d'accolades, comme tous les tests
// de ce module.

const fs = require('fs');
const assert = require('assert');
const vm = require('vm');

const CHEMIN_BASE = __dirname;

const html = fs.readFileSync(`${CHEMIN_BASE}/NEXUS-FDJ-v1.html`, 'utf8');
const script = html.match(/<script>([\s\S]*)<\/script>/)[1];

function extraire(nomFonction) {
  const debut = (() => {
    const iAsync = script.indexOf(`async function ${nomFonction}(`);
    if (iAsync !== -1) return iAsync;
    return script.indexOf(`function ${nomFonction}(`);
  })();
  assert.ok(debut !== -1, `Fonction ${nomFonction} introuvable`);
  let i = script.indexOf('{', debut);
  let profondeur = 1, j = i + 1;
  while (profondeur > 0) {
    if (script[j] === '{') profondeur++;
    else if (script[j] === '}') profondeur--;
    j++;
  }
  return script.slice(debut, j);
}

// ------------------------------------------------------------
// FAUX CLIENT SUPABASE — supporte insert() avec simulation de l'index
// unique partiel sur idempotency_key (code 23505 si déjà présent et non
// null), et rpc() pour l'incrément atomique.
// ------------------------------------------------------------
function creerNexusClientFake(tables, rpcHandlers, compteurs) {
  function from(table) {
    tables[table] = tables[table] || [];
    return {
      insert(lignesEntree) {
        const arr = Array.isArray(lignesEntree) ? lignesEntree : [lignesEntree];
        for (const ligne of arr) {
          if (ligne.idempotency_key != null) {
            const doublon = tables[table].some(l => l.idempotency_key === ligne.idempotency_key);
            if (doublon) {
              return Promise.resolve({ data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "fdj_stock_movements_idempotency_key_uniq"' } });
            }
          }
        }
        const inserees = arr.map(l => ({ id: `id-${Math.random().toString(36).slice(2, 8)}`, ...l }));
        tables[table].push(...inserees);
        return Promise.resolve({ data: inserees, error: null });
      },
    };
  }
  function rpc(nom, params) {
    compteurs.rpc = (compteurs.rpc || 0) + 1;
    const gestionnaire = rpcHandlers[nom];
    assert.ok(gestionnaire, `RPC ${nom} non simulé dans ce test`);
    return gestionnaire(params);
  }
  return { from, rpc };
}

// Fausse table fdj_shift_counts en mémoire, incrément atomique fidèle à la
// fonction SQL réelle (ON CONFLICT DO UPDATE SET appro = appro + delta).
function creerRpcIncrementerAppro(shiftCounts) {
  return ({ p_site, p_shift_id, p_game_id, p_delta }) => {
    let ligne = shiftCounts.find(l => l.shift_id === p_shift_id && l.game_id === p_game_id);
    if (!ligne) {
      ligne = { site: p_site, shift_id: p_shift_id, game_id: p_game_id, appro: 0 };
      shiftCounts.push(ligne);
    }
    ligne.appro = (ligne.appro || 0) + p_delta;
    return Promise.resolve({ data: ligne.appro, error: null });
  };
}

function nouveauContexte({ tables, shiftCounts, cryptoFixe }) {
  const compteurs = { rpc: 0, alertes: 0 };
  const alertesAppelees = [];
  const ctx = {
    console,
    document: { querySelector: () => null, getElementById: () => null },
    alert: (msg) => alertesAppelees.push(msg),
    crypto: cryptoFixe || { randomUUID: () => `uuid-${Math.random().toString(36).slice(2, 10)}` },
    siteId: 'site-test',
    shiftRow: { id: 'shift-1', date: '2026-08-18', quart: '1' },
    employeeCourant: { id: 'emp-1' },
    jeux: [{ id: 'g1', tickets_par_carnet: 10 }, { id: 'g2', tickets_par_carnet: 5 }],
    soldesCarnets: { g1: { confies: 3, actives: 0, nonActives: 3 }, g2: { confies: 2, actives: 0, nonActives: 2 } },
    emplacements: [{ id: 'loc-caisse', type: 'caisse' }],
    countsSaisie: {},
    carnetsDeclaresCeQuart: 0,
    activationsEnCours: new Set(),
    MOTIFS_EXCEPTION_CARNET: [],
    fmtNum: (n) => String(n),
    nexusClient: creerNexusClientFake(tables, { fdj_incrementer_appro_shift_count: creerRpcIncrementerAppro(shiftCounts) }, compteurs),
  };
  ctx.globalThis = ctx;
  const src = [
    extraire('emplacementParType'),
    extraire('genererIdempotencyKey'),
    extraire('incrementerApproAutomatique'),
    extraire('executerActivationCarnetInterne'),
    extraire('executerActivationCarnet'),
    'globalThis.__executerActivationCarnet = executerActivationCarnet;',
    'globalThis.__incrementerApproAutomatique = incrementerApproAutomatique;',
    'globalThis.__genererIdempotencyKey = genererIdempotencyKey;',
  ].join('\n\n');
  vm.runInNewContext(src, ctx);
  return { ctx, compteurs, alertesAppelees };
}

// ------------------------------------------------------------
// 1) Incrément d'appro atomique via RPC — deux incréments successifs (deux
//    activations réelles, l'une après l'autre) s'additionnent correctement,
//    jamais un écrasement (contrairement à l'ancien lire-puis-écrire).
// ------------------------------------------------------------
async function test1() {
  const shiftCounts = [];
  const { ctx, compteurs } = nouveauContexte({ tables: {}, shiftCounts });
  const a1 = await ctx.__incrementerApproAutomatique('g1', 10);
  assert.strictEqual(a1, 10);
  const a2 = await ctx.__incrementerApproAutomatique('g1', 10);
  assert.strictEqual(a2, 20, 'Le deuxième incrément doit se cumuler sur le premier, jamais l\'écraser');
  assert.strictEqual(compteurs.rpc, 2);
  assert.strictEqual(ctx.countsSaisie.g1.appro, 20, 'countsSaisie doit refléter le total cumulé côté base');
  console.log('OK — incrément appro atomique (RPC) : deux incréments successifs s\'additionnent, aucune perte.');
}

// ------------------------------------------------------------
// 2) Double-tap sur la même ligne (deux appels concurrents avant que le
//    premier n'ait répondu) -> un seul insert atteint la base, le deuxième
//    est ignoré silencieusement par le garde-fou activationsEnCours.
// ------------------------------------------------------------
async function test2() {
  const tables = { fdj_stock_movements: [] };
  const shiftCounts = [];
  const { ctx } = nouveauContexte({ tables, shiftCounts });
  const p1 = ctx.__executerActivationCarnet('g1', null);
  const p2 = ctx.__executerActivationCarnet('g1', null); // tap immédiat, avant que p1 ait résolu
  await Promise.all([p1, p2]);
  assert.strictEqual(tables.fdj_stock_movements.length, 1, 'Un double-tap sur le même jeu ne doit produire qu\'un seul mouvement de stock');
  assert.strictEqual(shiftCounts.find(l => l.game_id === 'g1').appro, 10, 'L\'appro ne doit être incrémenté qu\'une seule fois');
  console.log('OK — double-tap même jeu -> un seul insert, un seul incrément (garde-fou activationsEnCours).');
}

// ------------------------------------------------------------
// 3) Taps concurrents sur DEUX jeux différents -> aucun blocage croisé, les
//    deux activations aboutissent normalement.
// ------------------------------------------------------------
async function test3() {
  const tables = { fdj_stock_movements: [] };
  const shiftCounts = [];
  const { ctx } = nouveauContexte({ tables, shiftCounts });
  const p1 = ctx.__executerActivationCarnet('g1', null);
  const p2 = ctx.__executerActivationCarnet('g2', null);
  await Promise.all([p1, p2]);
  assert.strictEqual(tables.fdj_stock_movements.length, 2, 'Deux jeux différents activés en même temps doivent produire deux mouvements distincts');
  assert.strictEqual(shiftCounts.find(l => l.game_id === 'g1').appro, 10);
  assert.strictEqual(shiftCounts.find(l => l.game_id === 'g2').appro, 5);
  console.log('OK — activations concurrentes sur deux jeux différents -> jamais bloquées l\'une par l\'autre.');
}

// ------------------------------------------------------------
// 4) Rejeu réseau de la même tentative (même clé d'idempotence) -> conflit
//    23505 traité comme un succès idempotent : aucune alerte, aucun
//    deuxième mouvement, aucun double incrément d'appro.
// ------------------------------------------------------------
async function test4() {
  const tables = { fdj_stock_movements: [] };
  const shiftCounts = [];
  const cryptoFixe = { randomUUID: () => 'uuid-fixe-meme-tentative' }; // simule un rejeu : la "tentative" génère la même clé
  const { ctx, compteurs, alertesAppelees } = nouveauContexte({ tables, shiftCounts, cryptoFixe });

  await ctx.__executerActivationCarnet('g1', null); // première tentative — passe
  await ctx.__executerActivationCarnet('g1', null); // rejeu de la même tentative (guard déjà relâché) — même clé -> 23505

  assert.strictEqual(tables.fdj_stock_movements.length, 1, 'Le rejeu réseau ne doit jamais poser un deuxième mouvement de stock');
  assert.strictEqual(compteurs.rpc, 1, 'Le rejeu ne doit jamais déclencher un deuxième incrément d\'appro');
  assert.strictEqual(shiftCounts.find(l => l.game_id === 'g1').appro, 10);
  assert.strictEqual(alertesAppelees.length, 0, 'Un conflit 23505 sur l\'idempotence n\'est jamais une vraie erreur pour l\'utilisateur');
  console.log('OK — rejeu réseau (même clé, conflit 23505) traité comme un succès idempotent, jamais un doublon.');
}

// ------------------------------------------------------------
// 5) Chaque insert d'activation porte une idempotency_key non nulle — un
//    oubli de ce champ désactiverait silencieusement toute la protection.
// ------------------------------------------------------------
async function test5() {
  const tables = { fdj_stock_movements: [] };
  const shiftCounts = [];
  const { ctx } = nouveauContexte({ tables, shiftCounts });
  await ctx.__executerActivationCarnet('g1', null);
  const ligne = tables.fdj_stock_movements[0];
  assert.ok(ligne.idempotency_key, 'Chaque activation doit porter une idempotency_key');
  assert.notStrictEqual(ligne.idempotency_key, null);
  console.log('OK — chaque activation porte bien une idempotency_key non nulle.');
}

(async () => {
  await test1();
  await test2();
  await test3();
  await test4();
  await test5();
  console.log('\nTous les tests "FDJ Fiabilisation Étape 5 — idempotence activations/appro" passent.');
})().catch(e => { console.error(e); process.exit(1); });
