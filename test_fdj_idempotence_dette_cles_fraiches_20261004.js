// Test — FDJ-CARNETS-LEDGER-AUDIT-1-20261004 (04/10/2026), suite autorisée
// par le GO de Frédéric (réponse à request-2.md) : ferme la dette §8 de
// request-1.md sur les 3 derniers chemins qui minTaient une
// idempotency_key FRAÎCHE à chaque appel plutôt que STABLE —
//   - NEXUS-FDJ-v1.html::creerActivationImplicite (employé, clôture)
//   - NEXUS-FDJ-v1.html::executerActivationCarnetInterne (employé, en direct)
//   - NEXUS-FDJ-Manager-v1.html::creerActivationReconstitueeCorrectionManager
// Même discipline que jetonsRetourBloque/jetonIntention déjà qualifiés pour
// les 6 écritures manager "hors quart" (test_fdj_idempotence_ecritures_manager_20261004.js) :
// un jeton par jeu, conservé tant que l'écriture n'a pas réussi (y compris
// 23505), supprimé après succès pour qu'une intention réellement nouvelle
// reparte d'une clé neuve.
//
// Extrait les fonctions réelles (jamais réécrites à la main) des deux
// fichiers via regex + comptage d'accolades — même discipline que tous les
// tests de ce module.

const fs = require('fs');
const assert = require('assert');
const vm = require('vm');

const CHEMIN_BASE = __dirname;
const htmlEmploye = fs.readFileSync(`${CHEMIN_BASE}/NEXUS-FDJ-v1.html`, 'utf8');
const scriptEmploye = htmlEmploye.match(/<script>([\s\S]*)<\/script>/)[1];
const htmlManager = fs.readFileSync(`${CHEMIN_BASE}/NEXUS-FDJ-Manager-v1.html`, 'utf8');
const scriptManager = htmlManager.match(/<script>([\s\S]*)<\/script>/)[1];

function extraireDe(script, nomFonction) {
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
const extraireEmploye = (nom) => extraireDe(scriptEmploye, nom);
const extraireManager = (nom) => extraireDe(scriptManager, nom);

// ------------------------------------------------------------
// FAUX CLIENT SUPABASE — insert() simule l'index unique partiel sur
// idempotency_key (code 23505 si déjà posée et non nulle) pour
// fdj_stock_movements ; les tables annexes (fdj_alertes, fdj_audit_log)
// acceptent tout, sans rapport avec l'idempotence testée ici.
// ------------------------------------------------------------
function creerNexusClientFake(tables) {
  function from(table) {
    tables[table] = tables[table] || [];
    return {
      insert(ligneEntree) {
        if (table === 'fdj_stock_movements' && ligneEntree.idempotency_key != null) {
          const doublon = tables[table].some(l => l.idempotency_key === ligneEntree.idempotency_key);
          if (doublon) {
            return Promise.resolve({ data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "fdj_stock_movements_idempotency_key_uniq"' } });
          }
        }
        tables[table].push({ id: `id-${Math.random().toString(36).slice(2, 8)}`, ...ligneEntree });
        return Promise.resolve({ data: [ligneEntree], error: null });
      },
    };
  }
  return { from };
}

let compteurUuid = 0;

function fabriqueCrypto() {
  compteurUuid = 0;
  return { randomUUID: () => `uuid-${++compteurUuid}` };
}

// ------------------------------------------------------------
// Contexte employé (NEXUS-FDJ-v1.html) — creerActivationImplicite,
// executerActivationCarnetInterne (via le wrapper executerActivationCarnet
// pour respecter le garde-fou anti double-tap réel).
// ------------------------------------------------------------
function nouveauContexteEmploye(tables) {
  const alertes = [];
  const ctx = {
    console,
    document: { querySelector: () => null, getElementById: () => null },
    alert: (msg) => alertes.push(msg),
    crypto: fabriqueCrypto(),
    siteId: 'site-test',
    shiftRow: { id: 'shift-1', date: '2026-10-04', quart: '1' },
    employeeCourant: { id: 'emp-1' },
    jeux: [{ id: 'g1', tickets_par_carnet: null }, { id: 'g2', tickets_par_carnet: null }],
    soldesCarnets: { g1: { confies: 5, actives: 0, nonActives: 5 }, g2: { confies: 5, actives: 0, nonActives: 5 } },
    emplacements: [{ id: 'loc-caisse', type: 'caisse' }],
    activationsEnCours: new Set(),
    carnetsDeclaresCeQuart: 0,
    MOTIFS_EXCEPTION_CARNET: [{ value: 'autre', label: 'Autre' }],
    nexusClient: creerNexusClientFake(tables),
    incrementerApproAutomatique: async () => {},
  };
  ctx.globalThis = ctx;
  const src = [
    extraireEmploye('emplacementParType'),
    extraireEmploye('genererIdempotencyKey'),
    'let jetonsActivationCarnet = {};',
    'let jetonsActivationImplicite = {};',
    extraireEmploye('executerActivationCarnetInterne'),
    extraireEmploye('executerActivationCarnet'),
    extraireEmploye('creerActivationImplicite'),
    'globalThis.__executerActivationCarnet = executerActivationCarnet;',
    'globalThis.__creerActivationImplicite = creerActivationImplicite;',
    'globalThis.__jetonsActivationCarnet = jetonsActivationCarnet;',
    'globalThis.__jetonsActivationImplicite = jetonsActivationImplicite;',
  ].join('\n\n');
  vm.runInNewContext(src, ctx);
  return { ctx, alertes };
}

// ------------------------------------------------------------
// Contexte manager (NEXUS-FDJ-Manager-v1.html) —
// creerActivationReconstitueeCorrectionManager.
// ------------------------------------------------------------
function nouveauContexteManager(tables) {
  const alertes = [];
  const ctx = {
    console,
    alert: (msg) => alertes.push(msg),
    crypto: fabriqueCrypto(),
    siteId: 'site-test',
    managerCourant: { id: 'mgr-1' },
    emplacements: [{ id: 'loc-caisse', type: 'caisse' }],
    nexusClient: creerNexusClientFake(tables),
  };
  ctx.globalThis = ctx;
  const src = [
    extraireManager('emplacementParType'),
    extraireManager('genererIdempotencyKey'),
    'const jetonsCorrectionManager = {};',
    extraireManager('creerActivationReconstitueeCorrectionManager'),
    'globalThis.__creerActivationReconstitueeCorrectionManager = creerActivationReconstitueeCorrectionManager;',
    'globalThis.__jetonsCorrectionManager = jetonsCorrectionManager;',
  ].join('\n\n');
  vm.runInNewContext(src, ctx);
  return { ctx, alertes };
}

(async () => {
  // ============================================================
  // A) executerActivationCarnetInterne (employé, en direct)
  // ============================================================
  {
    // A1 — retry après perte de réponse : une erreur réseau (pas 23505) sur
    // la première tentative laisse le jeton en attente ; le second tap
    // (retry réel de la même intention) doit réutiliser EXACTEMENT le même
    // jeton.
    const tables = { fdj_stock_movements: [] };
    const { ctx, alertes } = nouveauContexteEmploye(tables);
    const insertOriginal = ctx.nexusClient.from;
    let premierAppel = true;
    ctx.nexusClient.from = (table) => {
      const reel = insertOriginal(table);
      if (table === 'fdj_stock_movements' && premierAppel) {
        premierAppel = false;
        return { insert: () => Promise.resolve({ data: null, error: { message: 'network error (simulée)' } }) };
      }
      return reel;
    };
    await ctx.__executerActivationCarnet('g1', null);
    assert.strictEqual(alertes.length, 1, 'une erreur réseau doit être signalée');
    assert.strictEqual(tables.fdj_stock_movements.length, 0, 'aucune ligne tant que la tentative a échoué côté client');
    const jeton1 = ctx.__jetonsActivationCarnet.g1;
    assert.ok(jeton1, 'le jeton doit rester en attente après un échec réseau');
    await ctx.__executerActivationCarnet('g1', null); // retry réel, même intention
    assert.strictEqual(tables.fdj_stock_movements.length, 1);
    assert.strictEqual(tables.fdj_stock_movements[0].idempotency_key, jeton1, 'le retry doit réutiliser le même jeton que la tentative échouée');
    console.log('OK — A1 executerActivationCarnetInterne : retry après perte de réponse -> même jeton.');
  }
  {
    // A2 — double clic : deux taps concurrents sur le MÊME jeu, avant que
    // le premier n'ait résolu, ne doivent produire qu'un seul mouvement
    // (garde-fou activationsEnCours, déjà qualifié, revérifié ici avec le
    // nouveau jeton stable).
    const tables = { fdj_stock_movements: [] };
    const { ctx } = nouveauContexteEmploye(tables);
    const p1 = ctx.__executerActivationCarnet('g1', null);
    const p2 = ctx.__executerActivationCarnet('g1', null);
    await Promise.all([p1, p2]);
    assert.strictEqual(tables.fdj_stock_movements.length, 1, 'un double clic sur le même jeu ne doit produire qu\'un seul mouvement');
    console.log('OK — A2 executerActivationCarnetInterne : double clic même jeu -> un seul mouvement.');
  }
  {
    // A3 — intention distincte : une fois la première activation réussie
    // (jeton libéré), une activation ULTÉRIEURE et DISTINCTE du même jeu
    // doit porter un jeton différent — sinon elle serait avalée à tort
    // comme un rejeu (23505) et le carnet ne serait jamais réellement
    // activé une seconde fois.
    const tables = { fdj_stock_movements: [] };
    const { ctx } = nouveauContexteEmploye(tables);
    await ctx.__executerActivationCarnet('g1', null);
    const jeton1 = tables.fdj_stock_movements[0].idempotency_key;
    await ctx.__executerActivationCarnet('g1', null); // nouvelle intention, après succès
    assert.strictEqual(tables.fdj_stock_movements.length, 2, 'deux intentions distinctes doivent produire deux mouvements réels');
    assert.notStrictEqual(tables.fdj_stock_movements[1].idempotency_key, jeton1, 'une intention distincte après succès doit porter un jeton différent');
    console.log('OK — A3 executerActivationCarnetInterne : nouvelle intention après succès -> jeton distinct, carnet réellement activé.');
  }
  {
    // A4 — deux jeux distincts simultanément -> jamais le même jeton,
    // jamais bloqués l'un par l'autre.
    const tables = { fdj_stock_movements: [] };
    const { ctx } = nouveauContexteEmploye(tables);
    const p1 = ctx.__executerActivationCarnet('g1', null);
    const p2 = ctx.__executerActivationCarnet('g2', null);
    await Promise.all([p1, p2]);
    assert.strictEqual(tables.fdj_stock_movements.length, 2);
    assert.notStrictEqual(tables.fdj_stock_movements[0].idempotency_key, tables.fdj_stock_movements[1].idempotency_key, 'deux jeux distincts doivent produire deux jetons distincts');
    console.log('OK — A4 executerActivationCarnetInterne : deux jeux distincts -> jetons distincts.');
  }

  // ============================================================
  // B) creerActivationImplicite (employé, clôture)
  // ============================================================
  {
    // B1 — retry après perte de réponse.
    const tables = { fdj_stock_movements: [], fdj_alertes: [], fdj_audit_log: [] };
    const { ctx, alertes } = nouveauContexteEmploye(tables);
    const insertOriginal = ctx.nexusClient.from;
    let premierAppel = true;
    ctx.nexusClient.from = (table) => {
      const reel = insertOriginal(table);
      if (table === 'fdj_stock_movements' && premierAppel) {
        premierAppel = false;
        return { insert: () => Promise.resolve({ data: null, error: { message: 'network error (simulée)' } }) };
      }
      return reel;
    };
    await ctx.__creerActivationImplicite('g1', 3, null);
    assert.strictEqual(alertes.length, 1);
    assert.strictEqual(tables.fdj_stock_movements.length, 0);
    const jeton1 = ctx.__jetonsActivationImplicite.g1;
    assert.ok(jeton1, 'le jeton doit rester en attente après un échec réseau');
    await ctx.__creerActivationImplicite('g1', 3, null); // retry réel
    assert.strictEqual(tables.fdj_stock_movements.length, 1);
    assert.strictEqual(tables.fdj_stock_movements[0].idempotency_key, jeton1, 'le retry doit réutiliser le même jeton');
    console.log('OK — B1 creerActivationImplicite : retry après perte de réponse -> même jeton.');
  }
  {
    // B2 — rejeu réseau avec clé déjà posée (réponse perdue APRÈS que
    // l'écriture ait réellement eu lieu côté serveur) : conflit 23505,
    // traité comme un succès idempotent, aucune deuxième ligne, aucune
    // alerte.
    const tables = { fdj_stock_movements: [], fdj_alertes: [], fdj_audit_log: [] };
    const { ctx, alertes } = nouveauContexteEmploye(tables);
    await ctx.__creerActivationImplicite('g1', 2, null);
    assert.strictEqual(tables.fdj_stock_movements.length, 1);
    // Rejoue manuellement le même insert avec le jeton déjà consommé —
    // simule l'écriture arrivée deux fois côté réseau avant que le jeton
    // n'ait pu être supprimé (fenêtre théorique, même discipline que les
    // 6 écritures manager déjà qualifiées).
    const jetonDejaPose = tables.fdj_stock_movements[0].idempotency_key;
    ctx.__jetonsActivationImplicite.g1 = jetonDejaPose; // ré-impose le jeton pour simuler le rejeu
    await ctx.__creerActivationImplicite('g1', 2, null);
    assert.strictEqual(tables.fdj_stock_movements.length, 1, 'un rejeu avec la même clé ne doit jamais poser une deuxième ligne');
    assert.strictEqual(alertes.length, 0, 'un conflit 23505 sur l\'idempotence n\'est jamais une vraie erreur pour l\'utilisateur');
    console.log('OK — B2 creerActivationImplicite : rejeu avec clé déjà posée -> conflit 23505 idempotent, jamais un doublon.');
  }
  {
    // B3 — intention distincte après succès -> jeton différent.
    const tables = { fdj_stock_movements: [], fdj_alertes: [], fdj_audit_log: [] };
    const { ctx } = nouveauContexteEmploye(tables);
    await ctx.__creerActivationImplicite('g1', 1, null);
    const jeton1 = tables.fdj_stock_movements[0].idempotency_key;
    await ctx.__creerActivationImplicite('g1', 1, null);
    assert.strictEqual(tables.fdj_stock_movements.length, 2);
    assert.notStrictEqual(tables.fdj_stock_movements[1].idempotency_key, jeton1, 'une nouvelle intention après succès doit porter un jeton différent');
    console.log('OK — B3 creerActivationImplicite : nouvelle intention après succès -> jeton distinct.');
  }
  {
    // B4 — deux jeux distincts -> jetons distincts, même en concurrence.
    const tables = { fdj_stock_movements: [], fdj_alertes: [], fdj_audit_log: [] };
    const { ctx } = nouveauContexteEmploye(tables);
    const p1 = ctx.__creerActivationImplicite('g1', 1, null);
    const p2 = ctx.__creerActivationImplicite('g2', 1, null);
    await Promise.all([p1, p2]);
    assert.strictEqual(tables.fdj_stock_movements.length, 2);
    assert.notStrictEqual(tables.fdj_stock_movements[0].idempotency_key, tables.fdj_stock_movements[1].idempotency_key);
    console.log('OK — B4 creerActivationImplicite : deux jeux distincts -> jetons distincts.');
  }

  // ============================================================
  // C) creerActivationReconstitueeCorrectionManager (manager, correction)
  // ============================================================
  {
    // C1 — retry après perte de réponse (même jeu, même intention de
    // synchronisation).
    const tables = { fdj_stock_movements: [], fdj_audit_log: [] };
    const { ctx, alertes } = nouveauContexteManager(tables);
    const insertOriginal = ctx.nexusClient.from;
    let premierAppel = true;
    ctx.nexusClient.from = (table) => {
      const reel = insertOriginal(table);
      if (table === 'fdj_stock_movements' && premierAppel) {
        premierAppel = false;
        return { insert: () => Promise.resolve({ data: null, error: { message: 'network error (simulée)' } }) };
      }
      return reel;
    };
    const shift = { id: 'shift-1' };
    const r1 = await ctx.__creerActivationReconstitueeCorrectionManager('g1', shift, 2, 'justif');
    assert.strictEqual(r1, false, 'un échec réseau réel doit renvoyer false');
    assert.strictEqual(alertes.length, 1);
    assert.strictEqual(tables.fdj_stock_movements.length, 0);
    const jeton1 = ctx.__jetonsCorrectionManager.g1;
    assert.ok(jeton1, 'le jeton doit rester en attente après un échec réseau');
    const r2 = await ctx.__creerActivationReconstitueeCorrectionManager('g1', shift, 2, 'justif'); // retry réel
    assert.strictEqual(r2, true);
    assert.strictEqual(tables.fdj_stock_movements.length, 1);
    assert.strictEqual(tables.fdj_stock_movements[0].idempotency_key, jeton1, 'le retry doit réutiliser le même jeton que la tentative échouée');
    console.log('OK — C1 creerActivationReconstitueeCorrectionManager : retry après perte de réponse -> même jeton.');
  }
  {
    // C2 — rejeu réseau avec clé déjà posée -> 23505 idempotent.
    const tables = { fdj_stock_movements: [], fdj_audit_log: [] };
    const { ctx, alertes } = nouveauContexteManager(tables);
    const shift = { id: 'shift-1' };
    await ctx.__creerActivationReconstitueeCorrectionManager('g1', shift, 3, 'justif');
    assert.strictEqual(tables.fdj_stock_movements.length, 1);
    const jetonDejaPose = tables.fdj_stock_movements[0].idempotency_key;
    ctx.__jetonsCorrectionManager.g1 = jetonDejaPose; // simule le rejeu réseau de la même tentative
    const r2 = await ctx.__creerActivationReconstitueeCorrectionManager('g1', shift, 3, 'justif');
    assert.strictEqual(r2, true, 'un conflit 23505 doit être traité comme un succès idempotent');
    assert.strictEqual(tables.fdj_stock_movements.length, 1, 'aucune deuxième ligne');
    assert.strictEqual(alertes.length, 0);
    console.log('OK — C2 creerActivationReconstitueeCorrectionManager : rejeu avec clé déjà posée -> idempotent, jamais un doublon.');
  }
  {
    // C3 — intention distincte après succès : une annulation (quantité
    // négative) qui suit une synchronisation réussie pour le MÊME jeu doit
    // porter un jeton différent — sinon l'annulation (correction) serait
    // avalée à tort comme un rejeu de l'activation précédente, et le ledger
    // perdrait la contre-écriture qui doit annuler actives.
    const tables = { fdj_stock_movements: [], fdj_audit_log: [] };
    const { ctx } = nouveauContexteManager(tables);
    const shift = { id: 'shift-1' };
    await ctx.__creerActivationReconstitueeCorrectionManager('g1', shift, 2, 'synchronisation');
    const jeton1 = tables.fdj_stock_movements[0].idempotency_key;
    await ctx.__creerActivationReconstitueeCorrectionManager('g1', shift, -2, 'annulation');
    assert.strictEqual(tables.fdj_stock_movements.length, 2, 'la contre-écriture (correction) doit réellement être posée, jamais avalée');
    assert.notStrictEqual(tables.fdj_stock_movements[1].idempotency_key, jeton1, 'une intention distincte après succès doit porter un jeton différent');
    assert.strictEqual(tables.fdj_stock_movements[1].type_mouvement, 'correction');
    console.log('OK — C3 creerActivationReconstitueeCorrectionManager : annulation après succès -> jeton distinct, contre-écriture réellement posée.');
  }
  {
    // C4 — deux jeux distincts, écritures concurrentes -> jamais le même
    // jeton (même discipline que la synchronisation réelle de
    // enregistrerEdition, qui appelle cette fonction par jeu dans une
    // boucle sans attendre un await séquentiel bloquant entre deux jeux
    // différents n'est PAS le cas réel — mais la génération synchrone du
    // jeton avant le premier await garantit l'absence de fenêtre de course
    // même si l'appelant les lançait en parallèle).
    const tables = { fdj_stock_movements: [], fdj_audit_log: [] };
    const { ctx } = nouveauContexteManager(tables);
    const shift = { id: 'shift-1' };
    const p1 = ctx.__creerActivationReconstitueeCorrectionManager('g1', shift, 1, 'justif');
    const p2 = ctx.__creerActivationReconstitueeCorrectionManager('g2', shift, 1, 'justif');
    await Promise.all([p1, p2]);
    assert.strictEqual(tables.fdj_stock_movements.length, 2);
    assert.notStrictEqual(tables.fdj_stock_movements[0].idempotency_key, tables.fdj_stock_movements[1].idempotency_key);
    console.log('OK — C4 creerActivationReconstitueeCorrectionManager : deux jeux distincts (concurrents) -> jetons distincts.');
  }

  console.log('\nTous les tests "FDJ idempotence — dette §8, clés fraîches fermée (3 chemins)" passent.');
})().catch(e => { console.error(e); process.exit(1); });
