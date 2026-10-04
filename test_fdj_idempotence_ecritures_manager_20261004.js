// Test — FDJ-CARNETS-LEDGER-AUDIT-1-20261004 (04/10/2026), point 2/7 de la
// mission : fermeture du gap d'idempotence des 6 écritures manager « hors
// quart » (réception, réapprovisionnement caisse, retrait caisse, blocage,
// retour depuis bloqué, rapprochement) dans NEXUS-FDJ-Manager-v1.html.
//
// Avant ce lot, ces 6 fonctions écrivaient directement dans
// fdj_stock_movements sans idempotency_key : un rejeu réseau ou un double
// clic double-comptait l'inventaire. Elles sont désormais branchées sur la
// commande serveur fdj_enregistrer_mouvement_stock (déployée le 16/09/2026,
// migration 20260916221000, jusqu'ici inutilisée) avec un jeton STABLE par
// intention de saisie (jetonIntention), jamais régénéré tant que l'écran
// n'a pas été quitté ou que l'enregistrement n'a pas réussi.
//
// Extrait les fonctions réelles (jamais réécrites à la main) de
// NEXUS-FDJ-Manager-v1.html via regex + comptage d'accolades — même
// discipline que test_fdj_fiabilisation_etape5_idempotence.js.

const fs = require('fs');
const assert = require('assert');
const vm = require('vm');

const CHEMIN_BASE = __dirname;
const html = fs.readFileSync(`${CHEMIN_BASE}/NEXUS-FDJ-Manager-v1.html`, 'utf8');
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

function extraireConst(nom) {
  const re = new RegExp(`const ${nom} = (\\[[\\s\\S]*?\\]);`);
  const m = script.match(re);
  assert.ok(m, `Const ${nom} introuvable`);
  return `const ${nom} = ${m[1]};`;
}

// ------------------------------------------------------------
// FAUX CLIENT SUPABASE — rpc() enregistre chaque appel (nom + params) et
// renvoie par défaut un succès. `prochaineErreur` permet d'injecter UNE
// erreur réseau simulée sur le prochain appel (retry), puis retombe sur le
// succès par défaut.
// ------------------------------------------------------------
function creerNexusClientFake() {
  const appels = [];
  let prochaineErreur = null;
  function rpc(nom, params) {
    appels.push({ nom, params });
    if (prochaineErreur) {
      const err = prochaineErreur;
      prochaineErreur = null;
      return Promise.resolve({ data: null, error: err });
    }
    return Promise.resolve({ data: { enregistre: true, idempotent: false }, error: null });
  }
  return {
    client: { rpc },
    appels,
    injecterErreurReseau() { prochaineErreur = { message: 'network error (simulée)' }; },
  };
}

function fabriquerDocument() {
  const registre = new Map();
  function elementPour(id) {
    if (!registre.has(id)) {
      registre.set(id, { id, disabled: false, textContent: '', _innerHTML: '', get innerHTML() { return this._innerHTML; }, set innerHTML(v) { this._innerHTML = v; } });
    }
    return registre.get(id);
  }
  return { getElementById: elementPour, querySelectorAll() { return []; } };
}

function nouveauContexte() {
  const { client, appels, injecterErreurReseau } = creerNexusClientFake();
  const alertes = [];
  const ctx = {
    console,
    document: fabriquerDocument(),
    alert: (msg) => alertes.push(msg),
    confirm: () => true,
    crypto: { randomUUID: () => `uuid-${Math.random().toString(36).slice(2, 10)}` },
    nexusClient: client,
    vue: 'liste',
    reappro: null, retraitCaisse: null, reception: null, blocage: null, rapprochement: null,
    stockEtat: null,
    // Stubs : les trois fonctions appelées en fin d'écriture font des allers-
    // retours Supabase réels sans rapport avec l'idempotence testée ici.
    renderAccueil() {},
    async ouvrirStockEtat() {},
  };
  ctx.globalThis = ctx;
  const src = [
    extraireConst('MOTIFS_RETRAIT_CAISSE'),
    extraire('labelMotifRetraitCaisse'),
    extraire('genererIdempotencyKey'),
    extraire('jetonIntention'),
    'const jetonsRetourBloque = {};',
    extraire('enregistrerReappro'),
    extraire('enregistrerRetraitCaisse'),
    extraire('enregistrerReception'),
    extraire('validerRapprochement'),
    extraire('enregistrerBlocage'),
    extraire('retournerDepuisBloque'),
    'globalThis.__fns = { enregistrerReappro, enregistrerRetraitCaisse, enregistrerReception, validerRapprochement, enregistrerBlocage, retournerDepuisBloque };',
  ].join('\n\n');
  vm.runInNewContext(src, ctx);
  return { ctx, appels, alertes, injecterErreurReseau };
}

(async () => {
  // ------------------------------------------------------------
  // 1) Les 6 opérations sont bien mappées sur fdj_enregistrer_mouvement_stock,
  //    avec le p_operation et les paramètres attendus par la migration
  //    20260916221000 — et chacune porte un p_jeton non vide (le gap #4 de
  //    l'audit : zéro idempotency_key avant ce lot).
  // ------------------------------------------------------------
  {
    const { ctx, appels } = nouveauContexte();
    ctx.reappro = { quantites: { g1: 2, g2: 0 } };
    await ctx.__fns.enregistrerReappro();
    assert.strictEqual(appels.length, 1);
    assert.strictEqual(appels[0].nom, 'fdj_enregistrer_mouvement_stock');
    assert.strictEqual(appels[0].params.p_operation, 'reappro_caisse');
    assert.strictEqual(JSON.stringify(appels[0].params.p_lignes), JSON.stringify([{ game_id: 'g1', quantite: 2 }]));
    assert.ok(appels[0].params.p_jeton, 'reappro_caisse doit porter un jeton non vide');
    console.log('OK — enregistrerReappro -> reappro_caisse, lignes filtrées (qte=0 exclue), jeton présent.');
  }
  {
    const { ctx, appels } = nouveauContexte();
    ctx.retraitCaisse = { quantites: { g1: 1 }, motif: 'surstock' };
    await ctx.__fns.enregistrerRetraitCaisse();
    assert.strictEqual(appels[0].params.p_operation, 'retrait_caisse');
    assert.strictEqual(appels[0].params.p_motif, 'Surstock en caisse', 'le motif doit être le libellé, pas le code brut');
    assert.ok(appels[0].params.p_jeton);
    console.log('OK — enregistrerRetraitCaisse -> retrait_caisse, motif traduit, jeton présent.');
  }
  {
    const { ctx, appels } = nouveauContexte();
    ctx.reception = { quantites: { g1: 5 }, source: 'Dépôt FDJ Martinique' };
    await ctx.__fns.enregistrerReception();
    assert.strictEqual(appels[0].params.p_operation, 'reception');
    assert.strictEqual(appels[0].params.p_source, 'Dépôt FDJ Martinique');
    assert.ok(appels[0].params.p_jeton);
    console.log('OK — enregistrerReception -> reception, source transmise, jeton présent.');
  }
  {
    const { ctx, appels } = nouveauContexte();
    ctx.rapprochement = { gameId: 'g1', quantite: 3, justification: 'quart du 11/08 non tracé' };
    await ctx.__fns.validerRapprochement();
    assert.strictEqual(appels[0].params.p_operation, 'rapprochement_activation');
    assert.strictEqual(JSON.stringify(appels[0].params.p_lignes), JSON.stringify([{ game_id: 'g1', quantite: 3 }]));
    assert.strictEqual(appels[0].params.p_motif, 'quart du 11/08 non tracé');
    assert.ok(appels[0].params.p_jeton);
    console.log('OK — validerRapprochement -> rapprochement_activation, jeton présent.');
  }
  {
    const { ctx, appels } = nouveauContexte();
    ctx.blocage = { gameId: 'g1', quantite: 4, emplacement: 'caisse', motif: 'série suspecte' };
    await ctx.__fns.enregistrerBlocage();
    assert.strictEqual(appels[0].params.p_operation, 'blocage');
    assert.strictEqual(appels[0].params.p_motif, 'série suspecte');
    assert.strictEqual(appels[0].params.p_emplacement_source, 'caisse');
    assert.ok(appels[0].params.p_jeton);
    console.log('OK — enregistrerBlocage -> blocage, emplacement source + motif transmis, jeton présent.');
  }
  {
    const { ctx, appels } = nouveauContexte();
    ctx.stockEtat = { soldes: { g1: { bloques: 7 } } };
    await ctx.__fns.retournerDepuisBloque('g1');
    assert.strictEqual(appels[0].params.p_operation, 'retour_bloque');
    assert.strictEqual(JSON.stringify(appels[0].params.p_lignes), JSON.stringify([{ game_id: 'g1', quantite: 7 }]));
    assert.ok(appels[0].params.p_jeton);
    console.log('OK — retournerDepuisBloque -> retour_bloque, quantité bloquée exacte, jeton présent.');
  }

  // ------------------------------------------------------------
  // 2) RETRY RÉSEAU — une panne réseau simulée sur la première tentative
  //    laisse l'état intact (`reappro` n'est remis à null qu'en cas de
  //    succès) ; le retry qui suit doit porter EXACTEMENT le même p_jeton
  //    que la tentative initiale. C'est précisément le gap que ce lot
  //    ferme : avant, aucune clé n'était envoyée du tout, donc rien ne
  //    permettait au serveur de reconnaître le rejeu.
  // ------------------------------------------------------------
  {
    const { ctx, appels, alertes, injecterErreurReseau } = nouveauContexte();
    ctx.reappro = { quantites: { g1: 2 } };
    injecterErreurReseau();
    await ctx.__fns.enregistrerReappro();
    assert.strictEqual(alertes.length, 1, 'une erreur réseau doit être signalée à l\'utilisateur');
    assert.ok(ctx.reappro, 'un échec réseau ne doit jamais effacer la saisie en cours');
    const jeton1 = appels[0].params.p_jeton;
    await ctx.__fns.enregistrerReappro(); // retry explicite du manager, même formulaire
    assert.strictEqual(appels.length, 2);
    assert.strictEqual(appels[1].params.p_jeton, jeton1, 'le retry après coupure réseau doit envoyer le même jeton');
    console.log('OK — retry réseau sur le même formulaire (reappro) -> même jeton envoyé aux deux tentatives.');
  }

  // ------------------------------------------------------------
  // 3) CONCURRENCE — deux appels lancés avant que le premier n'ait résolu
  //    (Promise.all), sur le même état : la génération du jeton est
  //    synchrone et précède le premier `await`, donc les deux portent déjà
  //    le même jeton au moment où ils atteignent le réseau — aucune fenêtre
  //    de course possible côté client.
  // ------------------------------------------------------------
  {
    const { ctx, appels } = nouveauContexte();
    ctx.retraitCaisse = { quantites: { g1: 1 }, motif: '' };
    const p1 = ctx.__fns.enregistrerRetraitCaisse();
    const p2 = ctx.__fns.enregistrerRetraitCaisse();
    await Promise.all([p1, p2]);
    assert.strictEqual(appels.length, 2);
    assert.strictEqual(appels[0].params.p_jeton, appels[1].params.p_jeton, 'deux appels concurrents sur le même formulaire doivent porter le même jeton');
    console.log('OK — deux appels concurrents (retraitCaisse) -> même jeton, aucune fenêtre de course côté client.');
  }

  // ------------------------------------------------------------
  // 4) TRANSFERT (RETOUR DEPUIS BLOQUÉ) INTERROMPU PUIS REJOUÉ — une erreur
  //    réseau simulée sur la première tentative ne doit JAMAIS faire
  //    disparaître la clé : le retry qui suit doit réutiliser le même
  //    jeton, exactement ce qui permet au serveur de reconnaître un rejeu.
  // ------------------------------------------------------------
  {
    const { ctx, appels, alertes, injecterErreurReseau } = nouveauContexte();
    ctx.stockEtat = { soldes: { g1: { bloques: 2 } } };
    injecterErreurReseau();
    await ctx.__fns.retournerDepuisBloque('g1');
    assert.strictEqual(alertes.length, 1, 'une erreur réseau doit être signalée à l\'utilisateur');
    const jeton1 = appels[0].params.p_jeton;
    // Retry explicite de l'utilisateur (même jeu, toujours bloqué).
    await ctx.__fns.retournerDepuisBloque('g1');
    assert.strictEqual(appels[1].params.p_jeton, jeton1, 'le retry après coupure réseau doit réutiliser le même jeton, pas un neuf');
    console.log('OK — retour depuis bloqué interrompu par une coupure réseau -> le retry réutilise le même jeton.');
  }

  // ------------------------------------------------------------
  // 5) NOUVELLE INTENTION APRÈS SUCCÈS — une fois l'écriture réussie et
  //    l'état remis à zéro (nouvel objet, comme le fait le vrai écran),
  //    un NOUVEAU jeton doit être généré. Sinon, pour retour_bloque en
  //    particulier, un futur blocage->retour légitime sur le MÊME jeu
  //    retomberait sur l'ancienne clé et serait pris à tort pour un rejeu —
  //    silencieusement avalé par le serveur, carnet jamais réellement
  //    retourné.
  // ------------------------------------------------------------
  {
    const { ctx, appels } = nouveauContexte();
    ctx.stockEtat = { soldes: { g1: { bloques: 3 } } };
    await ctx.__fns.retournerDepuisBloque('g1'); // succès -> jeton libéré (delete jetonsRetourBloque[gameId])
    const jeton1 = appels[0].params.p_jeton;
    // Un NOUVEAU cycle blocage -> retour sur le même jeu (nouvelle quantité bloquée).
    ctx.stockEtat = { soldes: { g1: { bloques: 5 } } };
    await ctx.__fns.retournerDepuisBloque('g1');
    assert.strictEqual(appels.length, 2);
    assert.notStrictEqual(appels[1].params.p_jeton, jeton1, 'un nouveau cycle de blocage/retour doit obtenir un jeton différent, jamais réutiliser l\'ancien');
    console.log('OK — nouveau cycle blocage/retour sur le même jeu après succès -> jeton différent (pas de collision avec l\'ancien).');
  }

  // ------------------------------------------------------------
  // 6) DEUX JEUX DIFFÉRENTS BLOQUÉS EN MÊME TEMPS — jamais le même jeton
  //    (sinon le retour du second serait avalé comme rejeu du premier).
  // ------------------------------------------------------------
  {
    const { ctx, appels } = nouveauContexte();
    ctx.stockEtat = { soldes: { g1: { bloques: 2 }, g2: { bloques: 4 } } };
    await ctx.__fns.retournerDepuisBloque('g1');
    await ctx.__fns.retournerDepuisBloque('g2');
    assert.notStrictEqual(appels[0].params.p_jeton, appels[1].params.p_jeton, 'deux jeux distincts ne doivent jamais partager un jeton');
    console.log('OK — deux jeux bloqués distincts -> jetons distincts.');
  }

  console.log('\nTous les tests "FDJ idempotence écritures manager hors quart" passent.');
})().catch(e => { console.error(e); process.exit(1); });
