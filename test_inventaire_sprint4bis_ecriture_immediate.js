// Test — Sprint 4bis "Écriture Supabase par produit + file d'attente
// hors-ligne" (18/08/2026, cahier Inventaire 2.0 §10 "Réseau : sauvegarde
// locale immédiate + synchro en arrière-plan", réarchitecture complète
// choisie explicitement par Frédéric).
//
// Extrait les fonctions réelles de NEXUS-Inventaire-v1.html via regex
// (jamais réécrites à la main), comme tous les tests de ce module.

const fs = require('fs');
const assert = require('assert');
const vm = require('vm');

const html = fs.readFileSync(__dirname + '/NEXUS-Inventaire-v1.html', 'utf8');
const script = html.match(/<script>([\s\S]*)<\/script>/)[1];

function extraire(nomFonction) {
  let debut = script.indexOf(`function ${nomFonction}(`);
  assert.ok(debut !== -1, `Fonction ${nomFonction} introuvable`);
  // Fonctions async : `function X(` matche aussi à l'intérieur de
  // `async function X(` — il faut inclure le mot-clé `async` s'il précède
  // immédiatement, sinon la fonction extraite perd son caractère async et
  // tout `await` interne devient une SyntaxError une fois concaténée.
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

// ------------------------------------------------------------
// Mock localStorage (Node n'a pas cet objet global) — un simple magasin en
// mémoire, remis à zéro entre chaque scénario via reset().
// ------------------------------------------------------------
function creerLocalStorageFake() {
  let store = {};
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    reset: () => { store = {}; },
  };
}

// Mock Supabase — reproduit juste assez la forme chaînable réellement
// utilisée par ecrireComptageImmediat (`.from(t).upsert(p,o).select().
// maybeSingle()`) et par tenterSynchronisationFileAttente (`await
// nexusClient.from(t).upsert(p,o)` directement, sans .select()). `reponse`
// est soit un objet {data,error}, soit une fonction qui lève une exception
// pour simuler une vraie coupure réseau.
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

const srcParts = [
  'let employeeCourant = null;',
  'let quartRow = null;',
  'let dernierStock = {};',
  'let comptagesSaisie = {};',
  'let planItemIdParProduit = {};',
  'let produitsZone = [];',
  'let nexusClient = null;',
  'let localStorage = null;',
  // Sprint 8 (18/08/2026) — ecrireOuvertureImmediat incrémente désormais
  // compteurTapsSession (INV2-19) ; il faut le déclarer ici comme les
  // autres lets de module, sinon l'extraction regex de la seule fonction
  // laisse une référence libre.
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
  extraire('produitEstCompte'),
  extraire('tenterEcritureProduit'),
  `globalThis.__test = {
    setEnv: (env) => { employeeCourant = env.employeeCourant; quartRow = env.quartRow; dernierStock = env.dernierStock || {}; comptagesSaisie = env.comptagesSaisie || {}; planItemIdParProduit = env.planItemIdParProduit || {}; produitsZone = env.produitsZone || []; nexusClient = env.nexusClient; localStorage = env.localStorage; },
    cleIdempotenceComptage, chargerFileSync, ajouterFileSync, retirerFileSync,
    ecrireComptageImmediat, tenterSynchronisationFileAttente, ecrireOuvertureImmediat,
    tenterEcritureProduit,
  };`,
].join('\n\n');

const ctx = { globalThis: {}, console, Promise };
ctx.globalThis = ctx;
vm.runInNewContext(srcParts, ctx);
const T = ctx.__test;

// ------------------------------------------------------------
// PARTIE 1 — Clé d'idempotence déterministe.
// ------------------------------------------------------------
const cle1 = T.cleIdempotenceComptage('quartA', 'produit1', 'ouverture', 12);
const cle2 = T.cleIdempotenceComptage('quartA', 'produit1', 'ouverture', 12);
assert.strictEqual(cle1, cle2, 'Même quart+produit+type+valeur -> même clé, à chaque appel');
assert.match(cle1, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/, 'La clé doit avoir un format UUID valide (colonne uuid côté Postgres)');
console.log('OK — cleIdempotenceComptage est déterministe et produit un UUID valide.');

const cle3 = T.cleIdempotenceComptage('quartA', 'produit1', 'ouverture', 13); // valeur différente
const cle4 = T.cleIdempotenceComptage('quartA', 'produit2', 'ouverture', 12); // produit différent
const cle5 = T.cleIdempotenceComptage('quartB', 'produit1', 'ouverture', 12); // quart différent
const cle6 = T.cleIdempotenceComptage('quartA', 'produit1', 'transmis', 12); // type différent
const toutesCles = new Set([cle1, cle3, cle4, cle5, cle6]);
assert.strictEqual(toutesCles.size, 5, 'Chaque variation (valeur/produit/quart/type) doit produire une clé distincte');
console.log('OK — une vraie correction (valeur différente) ou un contexte différent produit toujours une clé différente -> jamais de collision fonctionnelle.');

console.log('\nPartie 1 (clé d\'idempotence) : tous les tests passent.\n');

// ------------------------------------------------------------
// PARTIE 2 — Écriture immédiate : succès, dédoublonnage, échec réseau.
// ------------------------------------------------------------
function nouvelEnv(nexusClient) {
  return {
    employeeCourant: { id: 'emp1', site_id: 'site1' },
    quartRow: { id: 'quart1' },
    dernierStock: { p1: { quantite: 10, comptage_id: 'evt-transmis-anterieur' } },
    comptagesSaisie: {},
    planItemIdParProduit: {},
    produitsZone: [{ id: 'p1', designation: 'Produit Test' }],
    nexusClient,
    localStorage: creerLocalStorageFake(),
  };
}

async function main() {
  // Succès simple.
  {
    const { client, appels } = creerNexusClientMock({ data: { id: 'nouvelle-ligne' }, error: null });
    const env = nouvelEnv(client);
    T.setEnv(env);
    const resultat = await T.ecrireComptageImmediat({ site: 'site1', quart_id: 'quart1', produit_id: 'p1', type_comptage: 'transmis', quantite: 10, source: 'auto' });
    assert.strictEqual(resultat.id, 'nouvelle-ligne', 'Écriture réussie -> renvoie la ligne créée');
    assert.strictEqual(appels[0].payload.idempotency_key, T.cleIdempotenceComptage('quart1', 'p1', 'transmis', 10), 'La clé posée sur le payload correspond bien à la clé calculée');
    assert.strictEqual(T.chargerFileSync().length, 0, 'Rien à mettre en file après un succès');
    console.log('OK — écriture réussie : renvoie la ligne, pose la bonne clé d\'idempotence, ne remplit jamais la file.');
  }

  // Dédoublonnage : la base répond data=null (ON CONFLICT DO NOTHING a joué)
  // -> pas d'erreur, juste rien de neuf, et surtout pas de mise en file
  // (ce n'est pas un échec, c'est une confirmation que c'était déjà acquis).
  {
    const { client } = creerNexusClientMock({ data: null, error: null });
    const env = nouvelEnv(client);
    T.setEnv(env);
    const resultat = await T.ecrireComptageImmediat({ site: 'site1', quart_id: 'quart1', produit_id: 'p1', type_comptage: 'transmis', quantite: 10, source: 'auto' });
    assert.strictEqual(resultat, null, 'Conflit ignoré -> null, pas une erreur');
    assert.strictEqual(T.chargerFileSync().length, 0, 'Un conflit ignoré n\'est jamais mis en file (c\'était déjà écrit)');
    console.log('OK — retentative d\'une écriture déjà réussie (ON CONFLICT DO NOTHING) : traitée comme un succès silencieux, jamais mise en file.');
  }

  // Échec réseau : l'appel lève une exception -> mise en file, jamais
  // d'exception remontée à l'appelant (ne doit jamais bloquer l'employé).
  {
    const { client } = creerNexusClientMock(() => { throw new Error('Failed to fetch'); });
    const env = nouvelEnv(client);
    T.setEnv(env);
    let exceptionRemontee = false;
    let resultat;
    try {
      resultat = await T.ecrireComptageImmediat({ site: 'site1', quart_id: 'quart1', produit_id: 'p1', type_comptage: 'transmis', quantite: 10, source: 'auto' });
    } catch (e) { exceptionRemontee = true; }
    assert.strictEqual(exceptionRemontee, false, 'Une coupure réseau ne doit jamais remonter d\'exception à l\'appelant');
    assert.strictEqual(resultat, null, 'Échec -> null côté appelant');
    const file = T.chargerFileSync();
    assert.strictEqual(file.length, 1, 'Échec réseau -> exactement 1 élément mis en file d\'attente');
    assert.strictEqual(file[0].payload.produit_id, 'p1');
    console.log('OK — coupure réseau : jamais d\'exception remontée, l\'écriture part dans la file d\'attente locale.');
  }

  // Retentative d'une même saisie déjà en file (avant qu'elle n'ait pu
  // partir) : remplace l'entrée existante plutôt que d'empiler un doublon
  // dans la file elle-même.
  {
    const { client } = creerNexusClientMock(() => { throw new Error('Failed to fetch'); });
    const env = nouvelEnv(client);
    T.setEnv(env);
    await T.ecrireComptageImmediat({ site: 'site1', quart_id: 'quart1', produit_id: 'p1', type_comptage: 'transmis', quantite: 10, source: 'auto' });
    await T.ecrireComptageImmediat({ site: 'site1', quart_id: 'quart1', produit_id: 'p1', type_comptage: 'transmis', quantite: 10, source: 'auto' });
    assert.strictEqual(T.chargerFileSync().length, 1, 'Deux tentatives de la même valeur (même clé) -> une seule entrée en file, jamais un doublon empilé');
    console.log('OK — deux tentatives ratées de la même valeur ne créent qu\'une seule entrée en file (remplacement par clé).');
  }

  // tenterSynchronisationFileAttente : vide la file quand le réseau revient.
  {
    const { client: clientHorsLigne } = creerNexusClientMock(() => { throw new Error('Failed to fetch'); });
    const env = nouvelEnv(clientHorsLigne);
    T.setEnv(env);
    await T.ecrireComptageImmediat({ site: 'site1', quart_id: 'quart1', produit_id: 'p1', type_comptage: 'ouverture', quantite: 7, employee_id: 'emp1', source: 'manuel' });
    assert.strictEqual(T.chargerFileSync().length, 1, 'Précondition : un élément en attente après la coupure');

    // Le réseau "revient" : même environnement (même localStorage, donc même
    // file), nouveau client qui répond cette fois avec succès.
    const { client: clientEnLigne } = creerNexusClientMock({ data: null, error: null });
    env.nexusClient = clientEnLigne;
    T.setEnv(env);
    const toutSynchronise = await T.tenterSynchronisationFileAttente();
    assert.strictEqual(toutSynchronise, true, 'Retour réseau -> la synchronisation de la file doit réussir');
    assert.strictEqual(T.chargerFileSync().length, 0, 'La file est vidée une fois les écritures rejouées avec succès');
    console.log('OK — tenterSynchronisationFileAttente vide la file d\'attente dès que le réseau revient (rejeu idempotent).');
  }

  // tenterSynchronisationFileAttente : rien à faire si la file est vide
  // (ne doit jamais planter ni appeler le réseau inutilement).
  {
    const { client, appels } = creerNexusClientMock({ data: null, error: null });
    const env = nouvelEnv(client);
    T.setEnv(env);
    const toutSynchronise = await T.tenterSynchronisationFileAttente();
    assert.strictEqual(toutSynchronise, true, 'File vide -> considéré synchronisé, rien à faire');
    assert.strictEqual(appels.length, 0, 'File vide -> aucun appel réseau inutile');
    console.log('OK — file vide : tenterSynchronisationFileAttente ne fait rien et ne consomme aucun appel réseau.');
  }

  console.log('\nPartie 2 (écriture immédiate + file d\'attente) : tous les tests passent.\n');

  // ------------------------------------------------------------
  // PARTIE 3 — ecrireOuvertureImmediat : garde sur `.compte` (produit en
  // deux lieux non encore finalisé ne doit jamais s'écrire prématurément).
  // ------------------------------------------------------------
  {
    const { client, appels } = creerNexusClientMock({ data: { id: 'x' }, error: null });
    const env = nouvelEnv(client);
    env.comptagesSaisie = { p1: { compteDepot: 5 } }; // deux lieux, boutique pas encore saisie -> .compte absent
    T.setEnv(env);
    await T.ecrireOuvertureImmediat(env.produitsZone[0]);
    assert.strictEqual(appels.length, 0, 'Produit en deux lieux avec seulement le dépôt saisi -> aucune écriture tant que le total n\'est pas connu');
    console.log('OK — ecrireOuvertureImmediat n\'écrit rien tant que `.compte` (le total) n\'est pas encore connu (deux lieux, dépôt seul saisi).');
  }
  {
    const { client, appels } = creerNexusClientMock({ data: { id: 'x' }, error: null });
    const env = nouvelEnv(client);
    env.comptagesSaisie = { p1: { compte: 12, ecartNonNul: true, justification: 'test' } };
    T.setEnv(env);
    await T.ecrireOuvertureImmediat(env.produitsZone[0]);
    // 2 écritures attendues : transmis puis ouverture.
    assert.strictEqual(appels.length, 2, 'Produit à un lieu avec un total connu -> écrit transmis puis ouverture');
    assert.strictEqual(appels[0].payload.type_comptage, 'transmis');
    assert.strictEqual(appels[1].payload.type_comptage, 'ouverture');
    assert.strictEqual(appels[1].payload.quantite, 12);
    console.log('OK — ecrireOuvertureImmediat écrit transmis puis ouverture dès que `.compte` est connu.');
  }

  console.log('\nPartie 3 (garde deux-lieux) : tous les tests passent.\n');

  console.log('Tous les tests "Sprint 4bis écriture immédiate" passent.');
}

main().catch(e => { console.error(e); process.exit(1); });
