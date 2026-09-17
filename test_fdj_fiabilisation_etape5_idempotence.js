// Test — FDJ Fiabilisation Étape 5 (18/08/2026, cahier
// NEXUS_FDJ_Audit_Fiabilisation_Chaine_Quarts.pdf, §9/§12/§13 "Idempotence
// des activations et appro tickets", P0). Couvre executerActivationCarnet /
// incrementerApproAutomatique dans NEXUS-FDJ-v1.html : le garde-fou anti
// double-tap (activationsEnCours), l'idempotence de l'activation, et
// l'incrément atomique de l'appro via le RPC fdj_incrementer_appro_shift_count
// (remplace l'ancien lire-puis-écrire côté client, source de la perte
// d'incrément en cas d'activations concurrentes).
//
// VAGUE 1 — CE QUI A CHANGÉ SOUS CE TEST
//
// L'activation n'est plus un `insert` direct dans fdj_stock_movements : elle
// passe par la commande serveur `fdj_activer_carnet`. Trois conséquences que
// les tests ci-dessous traquent :
//   · l'écran n'envoie plus une CLÉ d'idempotence mais un JETON d'appel ; la
//     clé est dérivée côté serveur de `auth.uid()`, du jeton et du contexte,
//     de sorte qu'un appelant ne peut ni fabriquer la clé d'un autre, ni
//     échapper à la déduplication de son propre rejeu ;
//   · le rejeu ne remonte plus un 23505 déguisé en succès : la commande
//     répond `{ enregistre: true, idempotent: true }`, et c'est ce retour-là
//     que l'écran doit reconnaître ;
//   · `site`, `employee_id`, `created_by` et `effective_at` ne sont plus
//     fournis par l'écran : ils sont déduits du quart et de l'identité de
//     l'appelant. Les tests 6 et 7 vérifient précisément cela — c'est la
//     garantie qu'un employé ne peut pas écrire au nom d'un collègue.
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
// FAUX CLIENT SUPABASE — `insert()` reste là pour les tables encore
// écrites directement par l'écran employé (fdj_alertes), avec la
// simulation de l'index unique partiel sur idempotency_key ; `rpc()`
// sert les deux commandes serveur du parcours.
//
// Le comptage est tenu PAR NOM de RPC : depuis que l'activation est
// elle-même un appel serveur, un compteur global ne dirait plus rien —
// ce qu'on veut mesurer, c'est le nombre d'incréments d'appro.
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
    compteurs.parRpc[nom] = (compteurs.parRpc[nom] || 0) + 1;
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

// ------------------------------------------------------------
// FAUSSE COMMANDE SERVEUR `fdj_activer_carnet`
//
// Portage fidèle de supabase/migrations/20260916221000_fdj_commandes_activations_et_mouvements.sql.
// `etatServeur` tient ce que le serveur SAIT et que l'appelant ne choisit
// pas : l'identité (`uid`) et le quart (site, responsable opérationnel,
// heure d'ouverture). Tout ce que l'écran envoie qui ressemblerait à l'une
// de ces valeurs est ignoré — c'est le cœur de la garantie.
// ------------------------------------------------------------
const METHODES_ADMISES = ['quantite', 'implicite_appro', 'reconstituee_correction_manager'];

function creerRpcActiverCarnet(tables, etatServeur) {
  return (params) => {
    const { p_shift_id, p_game_id, p_quantite, p_methode, p_jeton, p_justification, p_motif, p_booklet_id } = params || {};
    tables.fdj_stock_movements = tables.fdj_stock_movements || [];

    const refus = (code, message) => Promise.resolve({ data: null, error: { code, message } });
    if (!etatServeur.uid) return refus('42501', 'Appel non authentifié.');
    if (!p_game_id) return refus('22023', 'Jeu manquant.');
    if (!p_jeton || !String(p_jeton).trim()) {
      return refus('22023', "Jeton d'appel manquant : l'idempotence ne peut pas être garantie.");
    }
    if (p_quantite === null || p_quantite === undefined || Number(p_quantite) === 0) {
      return refus('22023', 'Quantité nulle.');
    }
    if (!METHODES_ADMISES.includes(p_methode)) return refus('22023', `Méthode inconnue : ${p_methode}`);

    // Garde de quart : le quart doit être celui de l'appelant (employé) ou
    // un quart dont il est le manager. Un shift_id arbitraire ne passe pas.
    const quart = etatServeur.quarts[p_shift_id];
    if (!quart) return refus('42501', "Ce quart n'est pas accessible à l'appelant.");

    // La clé n'est PAS le jeton : elle en dérive, avec l'identité de
    // l'appelant et le contexte de l'appel (cf. fdj_cle_idempotence).
    const cle = `md5(${etatServeur.uid}|${p_jeton}|activation|${quart.id}|${p_game_id}|${p_methode})`;
    const dejaVu = tables.fdj_stock_movements.find(m => m.idempotency_key === cle);
    if (dejaVu) {
      return Promise.resolve({
        data: { enregistre: true, idempotent: true, shift_id: quart.id, par_manager: !!etatServeur.par_manager },
        error: null,
      });
    }

    const mouvement = {
      id: `id-${Math.random().toString(36).slice(2, 8)}`,
      // --- déduit du quart, jamais de l'appelant ---
      site: quart.site,
      shift_id: quart.id,
      employee_id: quart.employee_id,
      effective_at: quart.ouvert_le,
      // --- déduit de l'identité ---
      created_by: etatServeur.uid,
      idempotency_key: cle,
      // --- fourni par l'appelant, et contrôlé ---
      game_id: p_game_id,
      quantite: p_quantite,
      type_mouvement: p_quantite >= 0 ? 'activation' : 'correction',
      methode_identification: p_methode,
      booklet_id: p_booklet_id || null,
      justification: p_justification || null,
    };
    tables.fdj_stock_movements.push(mouvement);

    tables.fdj_audit_log = tables.fdj_audit_log || [];
    tables.fdj_audit_log.push({
      site: quart.site, shift_id: quart.id, entite_type: 'fdj_stock_movement', entite_id: mouvement.id,
      action: p_methode === 'implicite_appro' ? 'fdj_activation_implicite_appro' : 'fdj_activation_carnet',
      acteur_id: etatServeur.uid, motif: p_motif || null,
      nouvelle_valeur: {
        game_id: p_game_id, quantite: p_quantite, employee_id: quart.employee_id,
        created_by: etatServeur.uid, effective_at: quart.ouvert_le,
      },
    });

    return Promise.resolve({
      data: {
        enregistre: true, idempotent: false, mouvement_id: mouvement.id, shift_id: quart.id,
        type_mouvement: mouvement.type_mouvement, employee_id: quart.employee_id,
        created_by: etatServeur.uid, effective_at: quart.ouvert_le,
        par_manager: !!etatServeur.par_manager,
      },
      error: null,
    });
  };
}

const QUART_TEST = { id: 'shift-1', site: 'site-test', employee_id: 'emp-1', ouvert_le: '2026-08-18T06:00:00.000Z' };

function nouveauContexte({ tables, shiftCounts, cryptoFixe, etatServeur }) {
  const compteurs = { rpc: 0, parRpc: {}, alertes: 0 };
  const serveur = etatServeur || { uid: 'emp-1', par_manager: false, quarts: { 'shift-1': { ...QUART_TEST } } };
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
    nexusClient: creerNexusClientFake(tables, {
      fdj_incrementer_appro_shift_count: creerRpcIncrementerAppro(shiftCounts),
      fdj_activer_carnet: creerRpcActiverCarnet(tables, serveur),
    }, compteurs),
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
  return { ctx, compteurs, alertesAppelees, serveur };
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
  assert.strictEqual(compteurs.parRpc.fdj_incrementer_appro_shift_count, 2);
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
// 4) Rejeu réseau de la même tentative (même jeton, donc même clé dérivée
//    côté serveur) -> la commande répond `idempotent: true`, traité comme un
//    succès : aucune alerte, aucun deuxième mouvement, aucun double
//    incrément d'appro.
// ------------------------------------------------------------
async function test4() {
  const tables = { fdj_stock_movements: [] };
  const shiftCounts = [];
  const cryptoFixe = { randomUUID: () => 'uuid-fixe-meme-tentative' }; // simule un rejeu : la "tentative" génère la même clé
  const { ctx, compteurs, alertesAppelees } = nouveauContexte({ tables, shiftCounts, cryptoFixe });

  await ctx.__executerActivationCarnet('g1', null); // première tentative — passe
  await ctx.__executerActivationCarnet('g1', null); // rejeu de la même tentative (guard déjà relâché) — même jeton -> idempotent

  assert.strictEqual(tables.fdj_stock_movements.length, 1, 'Le rejeu réseau ne doit jamais poser un deuxième mouvement de stock');
  assert.strictEqual(compteurs.parRpc.fdj_incrementer_appro_shift_count, 1, 'Le rejeu ne doit jamais déclencher un deuxième incrément d\'appro');
  assert.strictEqual(compteurs.parRpc.fdj_activer_carnet, 2, 'La commande serveur est bien rappelée : c\'est elle, et non l\'écran, qui reconnaît le rejeu');
  assert.strictEqual(shiftCounts.find(l => l.game_id === 'g1').appro, 10);
  assert.strictEqual(alertesAppelees.length, 0, 'Un conflit 23505 sur l\'idempotence n\'est jamais une vraie erreur pour l\'utilisateur');
  console.log('OK — rejeu réseau (même jeton, clé dérivée côté serveur) traité comme un succès idempotent, jamais un doublon.');
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
  // La clé porte l'identité de l'appelant : c'est ce qui empêche un tiers de
  // fabriquer la clé d'un autre pour faire passer son écriture pour un rejeu.
  assert.ok(ligne.idempotency_key.includes('emp-1'), 'La clé doit dériver de l\'identité de l\'appelant, pas du seul jeton de l\'écran');
  console.log('OK — chaque activation porte une idempotency_key non nulle, dérivée côté serveur de l\'identité de l\'appelant.');
}

// ------------------------------------------------------------
// 6) L'écran ne fournit AUCUNE des valeurs d'attribution (PR #62, point 3).
//    Garde statique sur le code réel : l'appel à fdj_activer_carnet ne doit
//    transporter ni site, ni employee_id, ni auteur, ni date d'effet, ni
//    clé d'idempotence toute faite. Un employé qui pourrait les fournir
//    pourrait écrire au nom d'un collègue — la RLS ne le verrait pas, elle
//    filtre des lignes, pas des colonnes.
// ------------------------------------------------------------
async function test6() {
  const source = extraire('executerActivationCarnetInterne');
  const iAppel = source.indexOf("rpc('fdj_activer_carnet'");
  assert.notStrictEqual(iAppel, -1, 'L\'activation doit passer par la commande serveur fdj_activer_carnet');
  const fin = source.indexOf('})', iAppel);
  const argumentsAppel = source.slice(iAppel, fin);
  for (const interdit of ['p_site', 'p_employee_id', 'p_created_by', 'p_effective_at', 'p_idempotency_key', 'p_acteur']) {
    assert.ok(!argumentsAppel.includes(interdit),
      `L'écran employé transmet « ${interdit} » à fdj_activer_carnet : cette valeur doit être déduite côté serveur, jamais choisie par l'appelant.`);
  }
  assert.ok(argumentsAppel.includes('p_jeton'), 'L\'écran doit transmettre un jeton d\'appel — sans lui, aucune idempotence');
  assert.ok(!/from\(\s*'fdj_stock_movements'\s*\)/.test(source),
    'L\'écran employé ne doit plus écrire directement dans fdj_stock_movements.');
  console.log('OK — l\'écran employé ne fournit ni site, ni employé, ni auteur, ni date d\'effet : tout est déduit côté serveur.');
}

// ------------------------------------------------------------
// 7) Saisie par un manager (PR #62, point 3). Le manager ouvre la feuille
//    d'un quart dont il n'est pas le responsable opérationnel : le
//    mouvement reste imputé à l'employé du quart, tandis que l'auteur est
//    le manager. C'est la distinction que `created_by` a été ajoutée pour
//    porter — avant, les deux se confondaient et la feuille mentait sur
//    l'un ou sur l'autre.
// ------------------------------------------------------------
async function test7() {
  const tables = { fdj_stock_movements: [] };
  const shiftCounts = [];
  const etatServeur = { uid: 'mgr-9', par_manager: true, quarts: { 'shift-1': { ...QUART_TEST } } };
  const { ctx } = nouveauContexte({ tables, shiftCounts, etatServeur });
  await ctx.__executerActivationCarnet('g1', null);

  assert.strictEqual(tables.fdj_stock_movements.length, 1);
  const m = tables.fdj_stock_movements[0];
  assert.strictEqual(m.employee_id, 'emp-1', 'Le mouvement reste imputé au responsable opérationnel du quart');
  assert.strictEqual(m.created_by, 'mgr-9', 'L\'auteur de la saisie est le manager qui l\'a effectuée');
  assert.strictEqual(m.site, 'site-test', 'Le site vient du quart');
  assert.strictEqual(m.effective_at, QUART_TEST.ouvert_le, 'La date d\'effet vient du quart, pas de l\'horloge du poste');
  const trace = tables.fdj_audit_log.find(l => l.entite_id === m.id);
  assert.ok(trace, 'Une saisie managériale doit laisser une trace');
  assert.strictEqual(trace.acteur_id, 'mgr-9', 'La trace nomme le manager, jamais l\'employé à sa place');
  console.log('OK — saisie manager : employee_id reste l\'employé du quart, created_by devient le manager.');
}

(async () => {
  await test1();
  await test2();
  await test3();
  await test4();
  await test5();
  await test6();
  await test7();
  console.log('\nTous les tests "FDJ Fiabilisation Étape 5 — idempotence activations/appro" passent.');
})().catch(e => { console.error(e); process.exit(1); });
