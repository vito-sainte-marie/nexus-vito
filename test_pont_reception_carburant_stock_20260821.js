// Test — Pont Réception carburant → Carburants (21/08/2026, constat de
// Frédéric : "la livraison a été bien enregistrée mais elle ne se voit pas
// dans le stock"). Cause réelle (vérifiée sur données Supabase réelles,
// vito-sainte-marie, visite du 20/08/2026) : carburant_reception_mesures
// capture le vrai jaugeage avant/après livraison, mais aucun pont ne
// l'injectait dans carburant_releves — la seule table lue par Carburants
// Pilotage pour le "stock". Même discipline que le pont Jaugeage Inventaire
// → Carburants (19/08/2026, test_pont_jaugeage_carburant_inventaire.js) :
// require() direct des vrais fichiers, aucune réécriture des fonctions
// testées, mock Supabase chaînable minimal.
//
// PARTIE 1 — nexus-carburant-moteur.js : patchReleveDepuisReceptionMesures
//   (fonction pure, mapping mesures -> colonnes carburant_releves).
// PARTIE 2 — nexus-carburant-donnees.js : enregistrerReleveDepuisReception
//   Livraison (idempotence stricte par visite, additivité de livraison_*,
//   versionnement réutilisé tel quel).

const path = require('path');
const assert = require('assert');

const PROJET = __dirname;

function testSync(nom, fn) {
  try { fn(); console.log(`OK — ${nom}`); }
  catch (e) { console.error(`FAIL — ${nom}\n  ${e.stack}`); process.exitCode = 1; }
}
async function testAsync(nom, fn) {
  try { await fn(); console.log(`OK — ${nom}`); }
  catch (e) { console.error(`FAIL — ${nom}\n  ${e.stack}`); process.exitCode = 1; }
}

global.window = global;
require(path.join(PROJET, 'nexus-carburant-moteur.js'));
require(path.join(PROJET, 'nexus-carburant-donnees.js'));
const M = global.NexusCarburantMoteur;
const Donnees = global.NexusCarburantDonnees;
assert.strictEqual(typeof M.patchReleveDepuisReceptionMesures, 'function', 'patchReleveDepuisReceptionMesures doit être exportée');
assert.strictEqual(typeof Donnees.enregistrerReleveDepuisReceptionLivraison, 'function', 'enregistrerReleveDepuisReceptionLivraison doit être exportée');

// Config cuves GO réelle de vito-sainte-marie (2 cuves distinctes, ordre
// physique du site) — utilisée dans plusieurs cas ci-dessous.
const CUVES_GO_VITO = [{ id: 'cuve1', label: 'Rés. 3', capacite: 20000 }, { id: 'cuve2', label: 'Rés. 2', capacite: 10000 }];

// ------------------------------------------------------------
// PARTIE 1 — patchReleveDepuisReceptionMesures (moteur pur)
// ------------------------------------------------------------
testSync('patchReleveDepuisReceptionMesures : SP95 seul -> stock_reel_sp95 = jaugeage après, livraison = delta mesuré', () => {
  const patch = M.patchReleveDepuisReceptionMesures(
    [{ cuve_id: 'unique', carburant: 'sp95', jaugeage_apres_l: 23556, delta_mesure_l: 21007 }],
    []
  );
  assert.deepStrictEqual(patch, { stockReel: { sp95: 23556 }, livraison: { sp95: 21007 } });
});

testSync('patchReleveDepuisReceptionMesures : GNR seul -> même traitement que SP95 (cuve unique)', () => {
  const patch = M.patchReleveDepuisReceptionMesures(
    [{ cuve_id: 'unique', carburant: 'gnr', jaugeage_apres_l: 18000, delta_mesure_l: 9000 }],
    CUVES_GO_VITO
  );
  assert.deepStrictEqual(patch, { stockReel: { gnr: 18000 }, livraison: { gnr: 9000 } });
});

testSync('patchReleveDepuisReceptionMesures : GO sur 2 cuves -> mapping par ORDRE de config (index 0 -> cuve1, index 1 -> cuve2), livraison_go sommée', () => {
  const mesures = [
    { cuve_id: 'cuve1', carburant: 'go', jaugeage_apres_l: 14851, delta_mesure_l: 7976 },
    { cuve_id: 'cuve2', carburant: 'go', jaugeage_apres_l: 9539, delta_mesure_l: 6962 },
  ];
  const patch = M.patchReleveDepuisReceptionMesures(mesures, CUVES_GO_VITO);
  assert.deepStrictEqual(patch, {
    stockReel: { go_cuve1: 14851, go_cuve2: 9539 },
    livraison: { go: 7976 + 6962 },
  });
});

testSync('patchReleveDepuisReceptionMesures : mapping par ORDRE, pas par id littéral (une config où cuve2 est déclarée avant cuve1)', () => {
  const cuvesOrdreInverse = [{ id: 'cuve2', label: 'Rés. 2', capacite: 10000 }, { id: 'cuve1', label: 'Rés. 3', capacite: 20000 }];
  const mesures = [
    { cuve_id: 'cuve1', carburant: 'go', jaugeage_apres_l: 14851, delta_mesure_l: 7976 },
    { cuve_id: 'cuve2', carburant: 'go', jaugeage_apres_l: 9539, delta_mesure_l: 6962 },
  ];
  const patch = M.patchReleveDepuisReceptionMesures(mesures, cuvesOrdreInverse);
  // cuve2 est maintenant à l'index 0 -> colonne cuve1 ; cuve1 est à l'index 1 -> colonne cuve2.
  assert.strictEqual(patch.stockReel.go_cuve1, 9539, 'La cuve en position 0 de la config du site alimente toujours la colonne _cuve1, quel que soit son id');
  assert.strictEqual(patch.stockReel.go_cuve2, 14851);
});

testSync('patchReleveDepuisReceptionMesures : cuve_id absent de cuvesGo -> repli sur cuve1, jamais une mesure perdue', () => {
  const patch = M.patchReleveDepuisReceptionMesures(
    [{ cuve_id: 'inconnue', carburant: 'go', jaugeage_apres_l: 12000, delta_mesure_l: 5000 }],
    CUVES_GO_VITO
  );
  assert.strictEqual(patch.stockReel.go_cuve1, 12000, 'cuve_id introuvable dans la config -> repli sur cuve1, la mesure ne disparaît jamais');
  assert.strictEqual(patch.livraison.go, 5000);
});

testSync('patchReleveDepuisReceptionMesures : carburant non mesuré dans la visite -> absent du patch (jamais un 0 fabriqué, Article 5)', () => {
  const patch = M.patchReleveDepuisReceptionMesures(
    [{ cuve_id: 'unique', carburant: 'sp95', jaugeage_apres_l: 23556, delta_mesure_l: 21007 }],
    CUVES_GO_VITO
  );
  assert.strictEqual(patch.stockReel.gnr, undefined, 'GNR non livré cette visite -> jamais de stock_reel_gnr fabriqué');
  assert.strictEqual(patch.stockReel.go_cuve1, undefined);
  assert.strictEqual(patch.livraison.go, undefined);
});

testSync('patchReleveDepuisReceptionMesures : jaugeage_apres_l null (mesure incomplète) -> ignorée, jamais une fausse précision', () => {
  const patch = M.patchReleveDepuisReceptionMesures(
    [{ cuve_id: 'unique', carburant: 'sp95', jaugeage_apres_l: null, delta_mesure_l: null }],
    []
  );
  assert.deepStrictEqual(patch, { stockReel: {}, livraison: {} });
});

testSync('patchReleveDepuisReceptionMesures : liste vide/undefined -> patch vide, jamais une exception', () => {
  assert.deepStrictEqual(M.patchReleveDepuisReceptionMesures([], []), { stockReel: {}, livraison: {} });
  assert.deepStrictEqual(M.patchReleveDepuisReceptionMesures(undefined, undefined), { stockReel: {}, livraison: {} });
});

console.log('\n--- PARTIE 1 (nexus-carburant-moteur.js) terminée ---\n');

// ------------------------------------------------------------
// PARTIE 2 — enregistrerReleveDepuisReceptionLivraison (nexus-carburant-donnees.js)
// Mock Supabase chaînable — même construction que
// test_pont_jaugeage_carburant_inventaire.js, étendu avec .limit() pour la
// vérification d'idempotence (.select().eq().limit().maybeSingle()).
// ------------------------------------------------------------
function creerClientMock(reponses) {
  const appels = [];
  const compteurs = {};
  function b(table, type, payload) {
    const appel = { table, type, payload, eq: {} };
    appels.push(appel);
    const chain = {
      select() { return chain; },
      eq(k, v) { appel.eq[k] = v; return chain; },
      limit() { return chain; },
      async maybeSingle() {
        const liste = reponses[table] || [];
        const i = compteurs[table] || 0;
        compteurs[table] = i + 1;
        return liste[i] || { data: null, error: null };
      },
      then(resolve, reject) {
        const liste = reponses[table] || [];
        const i = compteurs[table] || 0;
        compteurs[table] = i + 1;
        return Promise.resolve(liste[i] || { data: null, error: null }).then(resolve, reject);
      },
    };
    return chain;
  }
  return {
    appels,
    from(table) {
      return {
        select() { return b(table, 'select'); },
        insert(payload) { return b(table, 'insert', payload); },
        upsert(payload) { return b(table, 'upsert', payload); },
      };
    },
  };
}

const MESURES_VISITE_2008 = [
  { cuve_id: 'unique', carburant: 'sp95', jaugeage_apres_l: 23556, delta_mesure_l: 21007 },
  { cuve_id: 'cuve1', carburant: 'go', jaugeage_apres_l: 14851, delta_mesure_l: 7976 },
  { cuve_id: 'cuve2', carburant: 'go', jaugeage_apres_l: 9539, delta_mesure_l: 6962 },
];

(async function main() {
  await testAsync('enregistrerReleveDepuisReceptionLivraison : visiteId manquant -> erreur explicite, aucune écriture', async () => {
    const client = creerClientMock({});
    const r = await Donnees.enregistrerReleveDepuisReceptionLivraison(client, 'vito-sainte-marie', {
      date: '2026-08-20', employeeId: 'emp1', mesures: MESURES_VISITE_2008, cuvesGo: CUVES_GO_VITO,
    });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(client.appels.length, 0, 'Aucune requête Supabase sans visiteId — la garde d\'idempotence doit être vérifiée avant tout appel réseau');
  });

  await testAsync('enregistrerReleveDepuisReceptionLivraison : visite déjà appliquée (idempotence stricte) -> dejaAJour, aucune double écriture', async () => {
    const client = creerClientMock({
      carburant_releve_versions: [{ data: { id: 'version-deja-la' }, error: null }],
    });
    const r = await Donnees.enregistrerReleveDepuisReceptionLivraison(client, 'vito-sainte-marie', {
      date: '2026-08-20', employeeId: 'emp1', visiteId: 'visite-1', mesures: MESURES_VISITE_2008, cuvesGo: CUVES_GO_VITO,
    });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.dejaAJour, true);
    assert.strictEqual(client.appels.filter(a => a.type === 'insert' || a.type === 'upsert').length, 0, 'Un second appel avec le même visiteId ne doit jamais réappliquer la livraison (additive -> double comptage sinon)');
  });

  await testAsync('enregistrerReleveDepuisReceptionLivraison : aucun relevé du jour -> saisie_initiale, stock = jaugeage mesuré, livraison = delta mesuré', async () => {
    const client = creerClientMock({
      carburant_releve_versions: [{ data: null, error: null }], // vérif idempotence : rien trouvé
      carburant_releves: [
        { data: null, error: null }, // chargerReleveDuJour (précédent)
        { data: { id: 'nouveauReleve' }, error: null }, // upsert().select().maybeSingle()
      ],
    });
    const r = await Donnees.enregistrerReleveDepuisReceptionLivraison(client, 'vito-sainte-marie', {
      date: '2026-08-20', employeeId: 'emp1', visiteId: 'visite-1', mesures: MESURES_VISITE_2008, cuvesGo: CUVES_GO_VITO,
    });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.dejaAJour, false);

    const insertVersion = client.appels.find(a => a.table === 'carburant_releve_versions' && a.type === 'insert');
    assert.ok(insertVersion, 'Doit écrire la preuve AVANT la vue courante');
    assert.strictEqual(insertVersion.payload.type_version, 'saisie_initiale');
    assert.strictEqual(insertVersion.payload.origine, 'reception_livraison');
    assert.strictEqual(insertVersion.payload.motif_correction, null, 'Première saisie du jour -> pas de motif de correction');
    assert.strictEqual(insertVersion.payload.visite_reception_id, 'visite-1', 'Traçabilité : la version pointe vers la visite qui l\'a produite');
    assert.strictEqual(insertVersion.payload.stock_reel_sp95, 23556);
    assert.strictEqual(insertVersion.payload.stock_reel_go_cuve1, 14851);
    assert.strictEqual(insertVersion.payload.stock_reel_go_cuve2, 9539);
    assert.strictEqual(insertVersion.payload.stock_reel_gnr, null, 'GNR non mesuré et aucun précédent -> null, jamais une fausse précision');
    assert.strictEqual(insertVersion.payload.livraison_sp95, 21007);
    assert.strictEqual(insertVersion.payload.livraison_go, 7976 + 6962);
    assert.strictEqual(insertVersion.payload.livraison_gnr, 0, 'Aucune livraison GNR et aucun précédent -> 0, jamais null sur un champ additif');

    const upsertReleve = client.appels.find(a => a.table === 'carburant_releves' && a.type === 'upsert');
    assert.ok(upsertReleve);
    assert.strictEqual(upsertReleve.payload.origine, 'reception_livraison');
    assert.strictEqual(upsertReleve.payload.saisi_par, 'emp1');
  });

  await testAsync('enregistrerReleveDepuisReceptionLivraison : relevé du jour déjà posé (jaugeage matin) -> correction_manager, livraison ADDITIONNÉE (jamais écrasée), GNR repris du précédent', async () => {
    const precedent = {
      version_num: 1, stock_reel_go_cuve1: 7446, stock_reel_go_cuve2: 2949, stock_reel_sp95: 3548, stock_reel_gnr: 4371,
      livraison_go: 0, livraison_sp95: 0, livraison_gnr: 0, mouvement_go: 0, mouvement_sp95: 0, mouvement_gnr: 0,
      motif_mouvement: null, commentaire: null,
    };
    const client = creerClientMock({
      carburant_releve_versions: [{ data: null, error: null }],
      carburant_releves: [
        { data: precedent, error: null },
        { data: { id: 'r2' }, error: null },
      ],
    });
    const r = await Donnees.enregistrerReleveDepuisReceptionLivraison(client, 'vito-sainte-marie', {
      date: '2026-08-20', employeeId: 'emp1', visiteId: 'visite-1', mesures: MESURES_VISITE_2008, cuvesGo: CUVES_GO_VITO,
    });
    assert.strictEqual(r.ok, true);
    const insertVersion = client.appels.find(a => a.table === 'carburant_releve_versions' && a.type === 'insert');
    assert.strictEqual(insertVersion.payload.type_version, 'correction_manager', 'Un relevé du jour existe déjà -> correction_manager (seules 2 valeurs existent, Article 11)');
    assert.strictEqual(insertVersion.payload.origine, 'reception_livraison', 'origine reste honnête sur qui a réellement écrit cette version');
    assert.ok(insertVersion.payload.motif_correction.includes('Livraison carburant réceptionnée'));
    assert.strictEqual(insertVersion.payload.stock_reel_sp95, 23556, 'Stock SP95 remplacé par le jaugeage après-livraison, la mesure la plus récente');
    assert.strictEqual(insertVersion.payload.stock_reel_gnr, 4371, 'GNR non concerné par cette livraison -> repris du relevé du matin, jamais écrasé');
    assert.strictEqual(insertVersion.payload.livraison_sp95, 0 + 21007, 'Livraison ADDITIONNÉE à celle déjà posée ce jour (ici 0), jamais un remplacement');
    assert.strictEqual(insertVersion.payload.livraison_go, 0 + 7976 + 6962);
  });

  await testAsync('enregistrerReleveDepuisReceptionLivraison : deuxième livraison le même jour -> les deux litrages s\'additionnent (audit §6, "une livraison ne doit jamais disparaître")', async () => {
    const precedentApresPremiereLivraison = {
      version_num: 2, stock_reel_go_cuve1: 14851, stock_reel_go_cuve2: 9539, stock_reel_sp95: 23556, stock_reel_gnr: 4371,
      livraison_go: 14938, livraison_sp95: 21007, livraison_gnr: 0, mouvement_go: 0, mouvement_sp95: 0, mouvement_gnr: 0,
      motif_mouvement: null, commentaire: null,
    };
    const client = creerClientMock({
      carburant_releve_versions: [{ data: null, error: null }],
      carburant_releves: [
        { data: precedentApresPremiereLivraison, error: null },
        { data: { id: 'r3' }, error: null },
      ],
    });
    const deuxiemeLivraison = [{ cuve_id: 'unique', carburant: 'sp95', jaugeage_apres_l: 30000, delta_mesure_l: 6444 }];
    const r = await Donnees.enregistrerReleveDepuisReceptionLivraison(client, 'vito-sainte-marie', {
      date: '2026-08-20', employeeId: 'emp2', visiteId: 'visite-2', mesures: deuxiemeLivraison, cuvesGo: CUVES_GO_VITO,
    });
    assert.strictEqual(r.ok, true);
    const insertVersion = client.appels.find(a => a.table === 'carburant_releve_versions' && a.type === 'insert');
    assert.strictEqual(insertVersion.payload.livraison_sp95, 21007 + 6444, 'Deux livraisons SP95 le même jour -> somme des deux, ni perdue ni écrasée');
    assert.strictEqual(insertVersion.payload.livraison_go, 14938, 'GO non concerné par cette deuxième visite -> repris tel quel');
    assert.strictEqual(insertVersion.payload.visite_reception_id, 'visite-2');
  });

  await testAsync('enregistrerReleveDepuisReceptionLivraison : NexusCarburantMoteur absent -> erreur explicite plutôt qu\'une exception non gérée', async () => {
    const sauvegardeM = global.NexusCarburantMoteur;
    delete global.NexusCarburantMoteur;
    try {
      const client = creerClientMock({});
      const r = await Donnees.enregistrerReleveDepuisReceptionLivraison(client, 'vito-sainte-marie', {
        date: '2026-08-20', employeeId: 'emp1', visiteId: 'visite-1', mesures: [], cuvesGo: [],
      });
      assert.strictEqual(r.ok, false);
    } finally {
      global.NexusCarburantMoteur = sauvegardeM;
    }
  });

  console.log('\nTous les tests "Pont Réception carburant → Carburants" passent.');
})();
