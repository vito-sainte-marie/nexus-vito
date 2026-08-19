// Test — Production journalière, écran Q1 (18/08/2026, M2 — cahier "Audit
// Inventaire - Production, mouvements & réceptions" §3.2). Couvre la partie
// logique NON dépendante du DOM extraite de NEXUS-Inventaire-v1.html :
// l'aiguillage comptage/mouvement (ecrireSaisieImmediat), l'écriture
// idempotente + file d'attente pour les mouvements (ecrireMouvementImmediat/
// ecrireProductionInitialeImmediat), et le périmètre Q2 sans écran
// (produitsZoneOuverturePourQuart). Le rendu (renderCarrouselProduction,
// renderLigneProductionOuverture) reste DOM-dépendant et vérifié
// manuellement, comme le reste du carrousel/grille dans ce module.
//
// Extrait les fonctions réelles de NEXUS-Inventaire-v1.html via regex
// (jamais réécrites à la main), comme tous les tests de ce module.

const fs = require('fs');
const assert = require('assert');
const vm = require('vm');

const html = fs.readFileSync('/sessions/dazzling-compassionate-ride/mnt/image nexus project/NEXUS-Inventaire-v1.html', 'utf8');
const script = html.match(/<script>([\s\S]*)<\/script>/)[1];

function extraire(nomFonction) {
  let debut = script.indexOf(`function ${nomFonction}(`);
  assert.ok(debut !== -1, `Fonction ${nomFonction} introuvable`);
  const prefixe = 'async ';
  if (script.slice(debut - prefixe.length, debut) === prefixe) debut -= prefixe.length;
  let i = script.indexOf('{', debut);
  let profondeur = 1, j = i + 1;
  while (profondeur > 0) {
    if (script[j] === '{') profondeur++;
    else if (script[j] === '}') profondeur--;
    j++;
  }
  return script.slice(debut, j);
}

// Mock Supabase — même forme que test_inventaire_sprint4bis (upsert
// chaînable avec .select().maybeSingle(), et await direct pour la file).
function creerNexusClientMock(reponse) {
  const appels = [];
  const client = {
    from(table) {
      return {
        upsert(payload, opts) {
          appels.push({ table, payload, opts });
          const resultat = typeof reponse === 'function' ? reponse(payload) : reponse;
          if (resultat instanceof Error) throw resultat;
          const r = Promise.resolve(resultat);
          return {
            then: (resolve, reject) => r.then(resolve, reject),
            select: () => ({ maybeSingle: async () => resultat }),
          };
        },
      };
    },
  };
  return { client, appels };
}

function creerLocalStorageFake() {
  let store = {};
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    reset: () => { store = {}; },
  };
}

const srcParts = [
  'let employeeCourant = null;',
  'let quartRow = null;',
  'let quartActuel = null;',
  'let dernierStock = {};',
  'let comptagesSaisie = {};',
  'let planItemIdParProduit = {};',
  'let produitsZone = [];',
  'let profilParProduit = {};',
  'let nexusClient = null;',
  'let localStorage = null;',
  'let compteurTapsSession = 0;',
  extraire('djb2InventaireHash'),
  extraire('cleIdempotenceComptage'),
  extraire('cleFileSync'),
  extraire('chargerFileSync'),
  extraire('sauvegarderFileSync'),
  extraire('ajouterFileSync'),
  extraire('retirerFileSync'),
  extraire('ecrireComptageImmediat'),
  extraire('tenterSynchronisationFileAttente'),
  extraire('ecrireTransmisImmediat'),
  extraire('ecrireOuvertureImmediat'),
  extraire('cleIdempotenceMouvement'),
  extraire('ecrireMouvementImmediat'),
  extraire('ecrireProductionInitialeImmediat'),
  extraire('ecrireSaisieImmediat'),
  extraire('produitsZoneOuverturePourQuart'),
  `globalThis.__test = {
    setEnv: (env) => { employeeCourant = env.employeeCourant; quartRow = env.quartRow; quartActuel = env.quartActuel; dernierStock = env.dernierStock || {}; comptagesSaisie = env.comptagesSaisie || {}; planItemIdParProduit = env.planItemIdParProduit || {}; produitsZone = env.produitsZone || []; profilParProduit = env.profilParProduit || {}; nexusClient = env.nexusClient; localStorage = env.localStorage; },
    cleIdempotenceMouvement, cleIdempotenceComptage, chargerFileSync, ajouterFileSync,
    ecrireMouvementImmediat, ecrireProductionInitialeImmediat, ecrireSaisieImmediat,
    ecrireOuvertureImmediat, produitsZoneOuverturePourQuart,
    getCompteurTaps: () => compteurTapsSession,
  };`,
].join('\n\n');

const ctx = { globalThis: {}, console, Promise };
ctx.globalThis = ctx;
vm.runInNewContext(srcParts, ctx);
const T = ctx.__test;

function creerLocalStorageEtEnv(overrides) {
  const ls = creerLocalStorageFake();
  const env = Object.assign({
    employeeCourant: { id: 'emp1', site_id: 'vito-sainte-marie' },
    quartRow: { id: 'quartQ1' },
    quartActuel: 'matin',
    dernierStock: {},
    comptagesSaisie: {},
    planItemIdParProduit: {},
    produitsZone: [],
    profilParProduit: {},
    localStorage: ls,
  }, overrides || {});
  return { ls, env };
}

async function main() {
  // ------------------------------------------------------------
  // PARTIE 1 — cleIdempotenceMouvement délègue à cleIdempotenceComptage
  // (Article 11 : même algorithme, jamais une deuxième implémentation).
  // ------------------------------------------------------------
  {
    const a = T.cleIdempotenceMouvement('quartQ1', 'p1', 'production_initiale', 12);
    const b = T.cleIdempotenceComptage('quartQ1', 'p1', 'production_initiale', 12);
    assert.strictEqual(a, b, 'cleIdempotenceMouvement doit produire exactement la même clé que cleIdempotenceComptage pour les mêmes entrées');
    const c = T.cleIdempotenceMouvement('quartQ1', 'p1', 'production_initiale', 13);
    assert.notStrictEqual(a, c, 'Une quantité différente doit produire une clé différente');
    console.log('OK — cleIdempotenceMouvement délègue à cleIdempotenceComptage (même algorithme, pas de duplication).');
  }

  // ------------------------------------------------------------
  // PARTIE 2 — ecrireProductionInitialeImmediat écrit un MOUVEMENT
  // production_initiale, jamais un comptage, avec la bonne quantité.
  // ------------------------------------------------------------
  {
    const { env } = creerLocalStorageEtEnv({ comptagesSaisie: { p1: { compte: 14, justification: '' } } });
    const { client, appels } = creerNexusClientMock({ data: { id: 'mvt1' }, error: null });
    env.nexusClient = client;
    T.setEnv(env);
    await T.ecrireProductionInitialeImmediat({ id: 'p1', designation: 'Croissant' });
    assert.strictEqual(appels.length, 1, 'Une seule écriture réseau');
    assert.strictEqual(appels[0].table, 'inventaire_mouvements', 'Doit écrire dans inventaire_mouvements, jamais inventaire_comptages');
    assert.strictEqual(appels[0].payload.type_mouvement, 'production_initiale');
    assert.strictEqual(appels[0].payload.quantite, 14);
    assert.strictEqual(appels[0].payload.quart_id, 'quartQ1');
    assert.strictEqual(appels[0].payload.produit_id, 'p1');
    assert.ok(appels[0].payload.idempotency_key, 'Une clé d\'idempotence doit être posée');
    console.log('OK — ecrireProductionInitialeImmediat écrit un mouvement production_initiale (table, type, quantité, quart, produit corrects).');
  }

  // ------------------------------------------------------------
  // PARTIE 3 — ecrireProductionInitialeImmediat ne fait rien tant que
  // `.compte` n'est pas connu (même garde que ecrireOuvertureImmediat).
  // ------------------------------------------------------------
  {
    const { env } = creerLocalStorageEtEnv({ comptagesSaisie: {} });
    const { client, appels } = creerNexusClientMock({ data: {}, error: null });
    env.nexusClient = client;
    T.setEnv(env);
    await T.ecrireProductionInitialeImmediat({ id: 'p1' });
    assert.strictEqual(appels.length, 0, 'Aucune écriture tant que comptagesSaisie[p.id] est absent');
    console.log('OK — ecrireProductionInitialeImmediat ne tente rien sur une saisie absente/partielle.');
  }

  // ------------------------------------------------------------
  // PARTIE 4 — Échec réseau -> mise en file d'attente avec `table` posé
  // (généralisation de tenterSynchronisationFileAttente à une 2e table).
  // ------------------------------------------------------------
  {
    const { env } = creerLocalStorageEtEnv({ comptagesSaisie: { p1: { compte: 9, justification: '' } } });
    const { client } = creerNexusClientMock(() => { throw new Error('offline'); });
    env.nexusClient = client;
    T.setEnv(env);
    await T.ecrireProductionInitialeImmediat({ id: 'p1' });
    const file = T.chargerFileSync();
    assert.strictEqual(file.length, 1, 'Échec réseau -> une entrée en file d\'attente');
    assert.strictEqual(file[0].table, 'inventaire_mouvements', 'L\'entrée en file doit porter la table cible pour la resynchro générique');
    assert.strictEqual(file[0].payload.type_mouvement, 'production_initiale');
    console.log('OK — échec réseau sur un mouvement de production -> mise en file d\'attente avec `table` explicite (§10, même filet que les comptages).');
  }

  // ------------------------------------------------------------
  // PARTIE 5 — ecrireSaisieImmediat aiguille correctement : mouvement pour
  // production_journaliere au matin, comptage classique sinon (Article 11 —
  // un seul endroit qui décide, jamais deux tests divergents ailleurs).
  // ------------------------------------------------------------
  {
    const { env } = creerLocalStorageEtEnv({
      quartActuel: 'matin',
      profilParProduit: { p1: 'production_journaliere', p2: 'continu' },
      comptagesSaisie: { p1: { compte: 8, justification: '' }, p2: { compte: 3, ecartNonNul: false, justification: '' } },
      dernierStock: {},
    });
    const { client, appels } = creerNexusClientMock({ data: { id: 'x' }, error: null });
    env.nexusClient = client;
    T.setEnv(env);
    await T.ecrireSaisieImmediat({ id: 'p1', designation: 'Pain Choco' });
    await T.ecrireSaisieImmediat({ id: 'p2', designation: 'Café' });
    const tablesUtilisees = appels.map(a => a.table);
    assert.ok(tablesUtilisees.includes('inventaire_mouvements'), 'p1 (production_journaliere, matin) doit écrire dans inventaire_mouvements');
    assert.ok(tablesUtilisees.includes('inventaire_comptages'), 'p2 (profil continu) doit toujours écrire un comptage classique');
    const appelMouvement = appels.find(a => a.table === 'inventaire_mouvements');
    assert.strictEqual(appelMouvement.payload.produit_id, 'p1');
    console.log('OK — ecrireSaisieImmediat aiguille vers un mouvement pour production_journaliere au matin, et garde le comptage classique pour les autres profils.');
  }

  // ------------------------------------------------------------
  // PARTIE 6 — ecrireSaisieImmediat au quart SOIR ignore profilParProduit
  // (aucun produit production_journaliere n'a d'écran Q2 — voir Partie 7 —
  // mais si jamais appelé, doit rester sur le comptage classique, jamais un
  // mouvement de production hors Q1).
  // ------------------------------------------------------------
  {
    const { env } = creerLocalStorageEtEnv({
      quartActuel: 'soir',
      profilParProduit: { p1: 'production_journaliere' },
      comptagesSaisie: { p1: { compte: 2, ecartNonNul: false, justification: '' } },
      dernierStock: {},
    });
    const { client, appels } = creerNexusClientMock({ data: { id: 'x' }, error: null });
    env.nexusClient = client;
    T.setEnv(env);
    await T.ecrireSaisieImmediat({ id: 'p1' });
    assert.strictEqual(appels[0].table, 'inventaire_comptages', 'Au quart soir, même un produit production_journaliere passe par le comptage classique (aucun écran Q2 ne devrait jamais appeler ceci, mais la garde reste sûre)');
    console.log('OK — ecrireSaisieImmediat ne bascule en mouvement de production qu\'au quart matin, jamais au soir.');
  }

  // ------------------------------------------------------------
  // PARTIE 7 — produitsZoneOuverturePourQuart : périmètre inchangé au matin,
  // exclusion des production_journaliere au soir (reste hérité automatiquement
  // via `transmis`, aucun écran) — jamais appliqué à produitsZone lui-même.
  // ------------------------------------------------------------
  {
    const produits = [
      { id: 'p1', designation: 'Pain Choco' },
      { id: 'p2', designation: 'Café' },
      { id: 'p3', designation: 'Croissant' },
    ];
    const profils = { p1: 'production_journaliere', p3: 'production_journaliere' };

    const { env: envMatin } = creerLocalStorageEtEnv({ quartActuel: 'matin', produitsZone: produits, profilParProduit: profils });
    T.setEnv(envMatin);
    const resMatin = T.produitsZoneOuverturePourQuart();
    assert.strictEqual(resMatin.length, 3, 'Au matin, aucune exclusion — les 3 produits restent (l\'écran dédié gère p1/p3, pas une exclusion de périmètre)');
    assert.strictEqual(resMatin, produits, 'Au matin, doit retourner exactement produitsZone (même référence), jamais une copie filtrée');

    const { env: envSoir } = creerLocalStorageEtEnv({ quartActuel: 'soir', produitsZone: produits, profilParProduit: profils });
    T.setEnv(envSoir);
    const resSoir = T.produitsZoneOuverturePourQuart();
    assert.strictEqual(resSoir.length, 1, 'Au soir, seul le produit non production_journaliere reste dans le périmètre ouverture');
    assert.strictEqual(resSoir[0].id, 'p2', 'p2 (profil continu) doit rester ; p1/p3 (production_journaliere) exclus au soir');
    console.log('OK — produitsZoneOuverturePourQuart : périmètre complet au matin, production_journaliere exclue de l\'écran d\'ouverture au soir uniquement.');
  }

  console.log('\nTous les tests "Production journalière — écran Q1" passent.');
}

main().catch(e => { console.error(e); process.exit(1); });
