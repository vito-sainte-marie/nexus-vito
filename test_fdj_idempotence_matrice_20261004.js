// Test causal — candidat FDJ reconstruit contre le code RÉEL de production
// (FDJ-CARNETS-LEDGER-AUDIT-1-20261004, GO request-7/decision-7, 2026-10-05).
//
// Matrice 9/9 : les 6 écritures manager « hors quart » (déjà sur RPC via
// PR #62, mais à jeton frais) + les 3 chemins « dette fraîche » signalés
// par request-1.md §8 (1 manager, 2 employé) — tous reconstruits contre le
// code RÉEL de NEXUS-FDJ-Manager-v1.html et NEXUS-FDJ-v1.html
// (l'architecture RPC de PR #62 n'est jamais touchée). 05/10/2026 : les
// défauts pointaient .scratch-fdj/candidate-*.html, absents du dépôt ;
// FDJ_TEST_MANAGER_FILE / FDJ_TEST_EMPLOYE_FILE restent surchargeables.
//
// Pour chaque chemin : RPC réel appelé, jeton non vide, retry après erreur
// réseau réutilise le MÊME jeton, succès réinitialise l'état/le dictionnaire
// (reset), nouvelle intention -> jeton différent.
//
// Extrait les fonctions réelles des deux fichiers (jamais
// réécrites à la main) via regex + comptage d'accolades — même discipline
// que test_fdj_idempotence_ecritures_manager_20261004.js /
// test_fdj_idempotence_dette_cles_fraiches_20261004.js.

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const BASE = __dirname;

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

function extraireDecl(script, nomVar) {
  const re = new RegExp(`(?:let|const)\\s+${nomVar}\\s*=\\s*[^\\n]*?;`);
  const m = script.match(re);
  assert.ok(m, `Déclaration de ${nomVar} introuvable`);
  return `let ${nomVar} = ${m[0].split('=').slice(1).join('=')}`.replace(/;$/, ';');
}

function chargerScript(fichierHtml) {
  const html = fs.readFileSync(path.join(BASE, fichierHtml), 'utf8');
  return html.match(/<script>([\s\S]*)<\/script>/)[1];
}

// ------------------------------------------------------------
// FAUX CLIENT SUPABASE — rpc() enregistre chaque appel (nom + params) et
// renvoie par défaut un succès. `prochaineErreur` injecte UNE erreur réseau
// simulée sur le prochain appel ; `prochaineReponse` force une réponse
// `{ data, error: null }` précise (ex. { idempotent: true }) sur le
// prochain appel.
// ------------------------------------------------------------
function creerNexusClientFake() {
  const appels = [];
  let prochaineErreur = null;
  let prochaineReponse = null;
  function rpc(nom, params) {
    appels.push({ nom, params });
    if (prochaineErreur) { const err = prochaineErreur; prochaineErreur = null; return Promise.resolve({ data: null, error: err }); }
    if (prochaineReponse) { const rep = prochaineReponse; prochaineReponse = null; return Promise.resolve({ data: rep, error: null }); }
    return Promise.resolve({ data: { enregistre: true, idempotent: false }, error: null });
  }
  function from() { return { insert: () => Promise.resolve({ data: null, error: null }) }; }
  return {
    client: { rpc, from },
    appels,
    injecterErreurReseau() { prochaineErreur = { message: 'network error (simulée)' }; },
    injecterReponseIdempotente() { prochaineReponse = { enregistre: true, idempotent: true }; },
  };
}

function fabriquerDocument() {
  const registre = new Map();
  function elementPour(id) {
    if (!registre.has(id)) registre.set(id, { id, disabled: false, textContent: '', style: {}, _innerHTML: '', get innerHTML() { return this._innerHTML; }, set innerHTML(v) { this._innerHTML = v; } });
    return registre.get(id);
  }
  return { getElementById: elementPour, querySelector: () => null, querySelectorAll: () => [] };
}

function nouveauContexteManager() {
  const { client, appels, injecterErreurReseau } = creerNexusClientFake();
  const alertes = [];
  const script = chargerScript(process.env.FDJ_TEST_MANAGER_FILE || 'NEXUS-FDJ-Manager-v1.html');
  const ctx = {
    console, document: fabriquerDocument(), alert: (m) => alertes.push(m), confirm: () => true,
    crypto: { randomUUID: () => `uuid-${Math.random().toString(36).slice(2, 10)}` },
    nexusClient: client,
    vue: 'liste',
    reappro: null, retraitCaisse: null, reception: null, blocage: null, rapprochement: null,
    stockEtat: null, managerCourant: { id: 'manager-1', nom: 'Manager Test' },
    renderAccueil() {}, async ouvrirStockEtat() {},
  };
  ctx.globalThis = ctx;
  const src = [
    extraireDe(script, 'labelMotifRetraitCaisse'),
    extraireDe(script, 'genererIdempotencyKey'),
    extraireDe(script, 'jetonIntention'),
    extraireDecl(script, 'jetonsRetourBloque'),
    extraireDecl(script, 'jetonsCorrectionManager'),
    extraireDe(script, 'enregistrerReappro'),
    extraireDe(script, 'enregistrerRetraitCaisse'),
    extraireDe(script, 'enregistrerReception'),
    extraireDe(script, 'validerRapprochement'),
    extraireDe(script, 'enregistrerBlocage'),
    extraireDe(script, 'retournerDepuisBloque'),
    extraireDe(script, 'creerActivationReconstitueeCorrectionManager'),
    'globalThis.__fns = { enregistrerReappro, enregistrerRetraitCaisse, enregistrerReception, validerRapprochement, enregistrerBlocage, retournerDepuisBloque, creerActivationReconstitueeCorrectionManager };',
  ].join('\n\n');
  vm.runInNewContext(src, ctx);
  return { ctx, appels, alertes, injecterErreurReseau };
}

function nouveauContexteEmploye() {
  const { client, appels, injecterErreurReseau, injecterReponseIdempotente } = creerNexusClientFake();
  const alertes = [];
  const script = chargerScript(process.env.FDJ_TEST_EMPLOYE_FILE || 'NEXUS-FDJ-v1.html');
  const ctx = {
    console, document: fabriquerDocument(), alert: (m) => alertes.push(m),
    crypto: { randomUUID: () => `uuid-${Math.random().toString(36).slice(2, 10)}` },
    nexusClient: client,
    shiftRow: { id: 'shift-1', date: '2026-10-05', quart: 1 },
    siteId: 'site-1', employeeCourant: { id: 'emp-1' },
    jeux: [{ id: 'g1', tickets_par_carnet: 10 }],
    soldesCarnets: { g1: { confies: 5, actives: 1, nonActives: 4 } },
    MOTIFS_EXCEPTION_CARNET: [],
    carnetsDeclaresCeQuart: 0,
    async incrementerApproAutomatique() {},
  };
  ctx.globalThis = ctx;
  const src = [
    extraireDecl(script, 'jetonsActivationCarnet'),
    extraireDecl(script, 'jetonsActivationImplicite'),
    extraireDe(script, 'genererIdempotencyKey'),
    extraireDe(script, 'creerActivationImplicite'),
    extraireDe(script, 'executerActivationCarnetInterne'),
    'globalThis.__fns = { creerActivationImplicite, executerActivationCarnetInterne };',
  ].join('\n\n');
  vm.runInNewContext(src, ctx);
  return { ctx, appels, alertes, injecterErreurReseau, injecterReponseIdempotente };
}

let totalPassed = 0, totalFailed = 0;
function assertOk(cond, label) {
  if (cond) { totalPassed++; } else { totalFailed++; console.error('ÉCHEC:', label); }
}

const matrice = [];

// Chemin « objet d'état persistant » (reappro/retraitCaisse/reception/
// rapprochement/blocage) : 3 appels — (1) erreur réseau, jeton1 capturé,
// état conservé ; (2) retry, même jeton, succès -> état remis à null ;
// (3) nouvelle intention (état reconstruit), jeton différent de jeton1.
async function exercerCheminEtat(nomChemin, operationAttendue, fns, fnNom, etatVar, etat1, etat2, injecterErreurReseau, appels, ctx, extraireEtat) {
  injecterErreurReseau();
  await fns[fnNom](...(etat1.args || []));
  const jeton1 = appels[0].params.p_jeton;
  assertOk(appels[0].params.p_operation === operationAttendue, `${nomChemin}: RPC réel (p_operation=${operationAttendue})`);
  assertOk(!!jeton1, `${nomChemin}: jeton non vide dès le premier appel`);
  assertOk(extraireEtat(ctx) !== null, `${nomChemin}: état conservé après une erreur réseau (jamais effacé)`);

  await fns[fnNom](...(etat1.args || [])); // retry (succès par défaut)
  assertOk(appels[1].params.p_jeton === jeton1, `${nomChemin}: retry réutilise exactement le même jeton`);
  assertOk(extraireEtat(ctx) === null, `${nomChemin}: succès -> état remis à null (reset)`);

  ctx[etatVar] = etat2.etat;
  await fns[fnNom](...(etat2.args || []));
  assertOk(appels[2].params.p_jeton !== jeton1, `${nomChemin}: nouvelle intention -> jeton différent`);

  matrice.push({ chemin: nomChemin, rpc: `fdj_enregistrer_mouvement_stock(${operationAttendue})`, cycle: `jetonIntention(${etatVar})`, retry: 'OK même jeton', reset: `OK ${etatVar}=null après succès`, nouvelleIntention: 'OK jeton différent' });
}

(async () => {
  // --- 1) enregistrerReappro -> reappro_caisse ---
  {
    const { ctx, appels, injecterErreurReseau } = nouveauContexteManager();
    ctx.reappro = { quantites: { g1: 2 } };
    await exercerCheminEtat('enregistrerReappro', 'reappro_caisse', ctx.__fns, 'enregistrerReappro', 'reappro',
      { args: [] }, { etat: { quantites: { g1: 3 } }, args: [] },
      injecterErreurReseau, appels, ctx, (c) => c.reappro);
  }

  // --- 2) enregistrerRetraitCaisse -> retrait_caisse ---
  {
    const { ctx, appels, injecterErreurReseau } = nouveauContexteManager();
    ctx.retraitCaisse = { quantites: { g1: 1 }, motif: '' };
    await exercerCheminEtat('enregistrerRetraitCaisse', 'retrait_caisse', ctx.__fns, 'enregistrerRetraitCaisse', 'retraitCaisse',
      { args: [] }, { etat: { quantites: { g1: 2 }, motif: '' }, args: [] },
      injecterErreurReseau, appels, ctx, (c) => c.retraitCaisse);
  }

  // --- 3) enregistrerReception -> reception ---
  {
    const { ctx, appels, injecterErreurReseau } = nouveauContexteManager();
    ctx.reception = { quantites: { g1: 5 }, source: 'Dépôt' };
    await exercerCheminEtat('enregistrerReception', 'reception', ctx.__fns, 'enregistrerReception', 'reception',
      { args: [] }, { etat: { quantites: { g1: 1 }, source: 'Dépôt' }, args: [] },
      injecterErreurReseau, appels, ctx, (c) => c.reception);
  }

  // --- 4) validerRapprochement -> rapprochement_activation ---
  {
    const { ctx, appels, injecterErreurReseau } = nouveauContexteManager();
    ctx.rapprochement = { gameId: 'g1', quantite: 3, justification: 'x' };
    await exercerCheminEtat('validerRapprochement', 'rapprochement_activation', ctx.__fns, 'validerRapprochement', 'rapprochement',
      { args: [] }, { etat: { gameId: 'g1', quantite: 1, justification: 'y' }, args: [] },
      injecterErreurReseau, appels, ctx, (c) => c.rapprochement);
  }

  // --- 5) enregistrerBlocage -> blocage ---
  {
    const { ctx, appels, injecterErreurReseau } = nouveauContexteManager();
    ctx.blocage = { gameId: 'g1', quantite: 4, emplacement: 'caisse', motif: 'série suspecte' };
    await exercerCheminEtat('enregistrerBlocage', 'blocage', ctx.__fns, 'enregistrerBlocage', 'blocage',
      { args: [] }, { etat: { gameId: 'g1', quantite: 2, emplacement: 'bureau', motif: 'autre' }, args: [] },
      injecterErreurReseau, appels, ctx, (c) => c.blocage);
  }

  // --- 6) retournerDepuisBloque -> retour_bloque (dict jetonsRetourBloque) ---
  {
    const { ctx, appels, injecterErreurReseau } = nouveauContexteManager();
    ctx.stockEtat = { soldes: { g1: { bloques: 2 } } };
    injecterErreurReseau();
    await ctx.__fns.retournerDepuisBloque('g1');
    const jeton1 = appels[0].params.p_jeton;
    assertOk(appels[0].params.p_operation === 'retour_bloque' && !!jeton1, '6-retournerDepuisBloque: RPC réel + jeton présent');
    await ctx.__fns.retournerDepuisBloque('g1'); // retry -> succès -> dict supprimé
    assertOk(appels[1].params.p_jeton === jeton1, '6-retournerDepuisBloque: retry réutilise le même jeton');
    ctx.stockEtat = { soldes: { g1: { bloques: 5 } } }; // nouveau cycle blocage->retour
    await ctx.__fns.retournerDepuisBloque('g1');
    assertOk(appels[2].params.p_jeton !== jeton1, '6-retournerDepuisBloque: nouvelle intention -> jeton différent');
    matrice.push({ chemin: 'retournerDepuisBloque', rpc: 'fdj_enregistrer_mouvement_stock(retour_bloque)', cycle: 'jetonsRetourBloque[gameId]', retry: 'OK même jeton', reset: 'OK delete après succès', nouvelleIntention: 'OK jeton différent' });
  }

  // --- 7) creerActivationReconstitueeCorrectionManager -> fdj_activer_carnet (dette §8, manager) ---
  {
    const { ctx, appels, injecterErreurReseau } = nouveauContexteManager();
    injecterErreurReseau();
    const r1 = await ctx.__fns.creerActivationReconstitueeCorrectionManager('g1', { id: 'shift-1' }, 2, 'sync');
    const jeton1 = appels[0].params.p_jeton;
    assertOk(appels[0].nom === 'fdj_activer_carnet' && !!jeton1, '7-correctionManager: RPC réel + jeton présent');
    assertOk(r1 === false, '7-correctionManager: erreur réseau -> retour false, pas une fausse réussite');
    const r2 = await ctx.__fns.creerActivationReconstitueeCorrectionManager('g1', { id: 'shift-1' }, 2, 'sync'); // retry -> succès -> dict supprimé
    assertOk(appels[1].params.p_jeton === jeton1, '7-correctionManager: retry réutilise le même jeton');
    assertOk(r2 === true, '7-correctionManager: succès renvoie true');
    const r3 = await ctx.__fns.creerActivationReconstitueeCorrectionManager('g1', { id: 'shift-1' }, -1, 'annulation'); // nouvelle intention
    assertOk(r3 === true, '7-correctionManager: nouvelle intention renvoie true aussi');
    assertOk(appels[2].params.p_jeton !== jeton1, '7-correctionManager: nouvelle intention -> jeton différent');
    matrice.push({ chemin: 'creerActivationReconstitueeCorrectionManager', rpc: 'fdj_activer_carnet', cycle: 'jetonsCorrectionManager[gameId]', retry: 'OK même jeton', reset: 'OK delete après succès', nouvelleIntention: 'OK jeton différent' });
  }

  // --- 8) creerActivationImplicite -> fdj_activer_carnet (dette §8, employé) ---
  {
    const { ctx, appels, injecterErreurReseau } = nouveauContexteEmploye();
    injecterErreurReseau();
    await ctx.__fns.creerActivationImplicite('g1', 3, null);
    const jeton1 = appels[0].params.p_jeton;
    assertOk(appels[0].nom === 'fdj_activer_carnet' && appels[0].params.p_methode === 'implicite_appro' && !!jeton1, '8-creerActivationImplicite: RPC réel + jeton présent');
    await ctx.__fns.creerActivationImplicite('g1', 3, null); // retry -> succès -> dict supprimé
    assertOk(appels[1].params.p_jeton === jeton1, '8-creerActivationImplicite: retry réutilise le même jeton');
    await ctx.__fns.creerActivationImplicite('g1', 2, null); // nouvelle intention
    assertOk(appels[2].params.p_jeton !== jeton1, '8-creerActivationImplicite: nouvelle intention -> jeton différent');
    matrice.push({ chemin: 'creerActivationImplicite', rpc: 'fdj_activer_carnet', cycle: 'jetonsActivationImplicite[gameId]', retry: 'OK même jeton', reset: 'OK delete après succès', nouvelleIntention: 'OK jeton différent' });
  }

  // --- 9) executerActivationCarnetInterne -> fdj_activer_carnet (dette §8, employé) ---
  {
    const { ctx, appels, injecterErreurReseau, injecterReponseIdempotente } = nouveauContexteEmploye();
    injecterErreurReseau();
    await ctx.__fns.executerActivationCarnetInterne('g1', null);
    const jeton1 = appels[0].params.p_jeton;
    assertOk(appels[0].nom === 'fdj_activer_carnet' && appels[0].params.p_methode === 'quantite' && !!jeton1, '9-executerActivationCarnetInterne: RPC réel + jeton présent');
    injecterReponseIdempotente(); // le retry est reconnu comme un rejeu par le serveur
    await ctx.__fns.executerActivationCarnetInterne('g1', null);
    assertOk(appels[1].params.p_jeton === jeton1, '9-executerActivationCarnetInterne: retry (reconnu idempotent) réutilise le même jeton');
    await ctx.__fns.executerActivationCarnetInterne('g1', null); // nouvelle intention -> jeton neuf
    assertOk(appels[2].params.p_jeton !== jeton1, '9-executerActivationCarnetInterne: nouvelle intention (après idempotent) -> jeton différent');
    matrice.push({ chemin: 'executerActivationCarnetInterne', rpc: 'fdj_activer_carnet', cycle: 'jetonsActivationCarnet[gameId]', retry: 'OK même jeton (y compris réponse idempotente)', reset: 'OK delete après succès/idempotent', nouvelleIntention: 'OK jeton différent' });
  }

  console.log(`\n=== Matrice 9/9 (code réel des écrans FDJ) ===`);
  matrice.forEach((m, i) => console.log(`${i + 1}. ${m.chemin} -> ${m.rpc} | ${m.cycle} | retry: ${m.retry} | reset: ${m.reset} | nouvelle intention: ${m.nouvelleIntention}`));
  assertOk(matrice.length === 9, 'la matrice couvre exactement les 9 chemins exigés');

  console.log(`\n${totalPassed} assertion(s) réussie(s), ${totalFailed} échec(s).`);
  if (totalFailed > 0) process.exit(1);
  console.log('Tous les tests "idempotence FDJ (code réel)" passent.');
})().catch(e => { console.error(e); process.exit(1); });
