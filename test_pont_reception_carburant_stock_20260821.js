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
//
// 19/09/2026 — étendu pour la régularisation d'une réception passée
// (mandat "Régularisation d'une réception passée", tests obligatoires n°8,
// n°9 et n°11). Le piège central : le relevé physique du 19/09 contient
// DÉJÀ le carburant livré le 18/09. Reconstruire l'historique ne doit donc
// jamais revenir à faire "stock du 19/09 + livraison du 18/09", ni déplacer
// l'instant de mesure de la ligne du 18/09 vers le jour de la saisie, ni
// réécrire une version antérieure.

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

// ------------------------------------------------------------
// referencePhysiqueDuJour — versant LECTURE du test obligatoire n°8 du
// 19/09/2026 : "relevé physique J+1 prioritaire pour le stock courant".
// Une réception régularisée après coup porte la date de la livraison
// passée. Si Pilotage la retenait comme référence physique du jour, les
// cartes du haut afficheraient un jaugeage d'avant-hier à la place du
// relevé de ce matin — et, pire, le stock d'après dépotage du 18/09
// alors que les ventes du 18 et du 19 ont déjà eu lieu depuis.
// ------------------------------------------------------------

const VISITE_REGUL_1809 = {
  date_visite: '2026-09-18', statut: 'terminee', mode_saisie: 'regularisation',
  heure_fin: '2026-09-18T15:15:00.000Z',
};
const RELEVE_PHYSIQUE_1909 = { date: '2026-09-19', created_at: '2026-09-19T10:05:00.000Z' };

testSync('referencePhysiqueDuJour : une réception régularisée du 18/09 ne devient JAMAIS la référence physique du 19/09 (test obligatoire n°8)', () => {
  const r = M.referencePhysiqueDuJour(RELEVE_PHYSIQUE_1909, VISITE_REGUL_1809, '2026-09-19');
  assert.strictEqual(r.source, 'ouverture',
    'Le relevé physique du jour prime : la livraison du 18/09 est déjà dans les cuves qu\'il a mesurées');
  assert.strictEqual(r.heure, '2026-09-19T10:05:00.000Z');
});

testSync('referencePhysiqueDuJour : sans relevé du jour, une réception régularisée d\'hier ne comble pas le vide (jamais une fausse référence)', () => {
  const r = M.referencePhysiqueDuJour(null, VISITE_REGUL_1809, '2026-09-19');
  assert.strictEqual(r.source, null, 'Aucune mesure d\'aujourd\'hui : NEXUS doit le dire, pas ressortir celle d\'hier');
  assert.strictEqual(r.heure, null);
});

testSync('referencePhysiqueDuJour : le jour même, une réception terminée plus récente que le jaugeage d\'ouverture reste prioritaire (non-régression du 20/08)', () => {
  const visiteDuJour = { date_visite: '2026-09-19', statut: 'terminee', heure_fin: '2026-09-19T14:00:00.000Z' };
  const r = M.referencePhysiqueDuJour(RELEVE_PHYSIQUE_1909, visiteDuJour, '2026-09-19');
  assert.strictEqual(r.source, 'reception');
  assert.strictEqual(r.heure, '2026-09-19T14:00:00.000Z');
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
        // 19/09/2026 — enregistrés, et non absents : une garde « aucune
        // réécriture de l'historique » posée sur un mock qui ignore update et
        // delete ne mordrait jamais.
        update(payload) { return b(table, 'update', payload); },
        delete() { return b(table, 'delete'); },
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

  // ------------------------------------------------------------
  // 19/09/2026 — régularisation d'une réception passée (mandat du 19/09,
  // tests obligatoires n°8 et n°9). Le piège est précis : le relevé
  // physique du 19/09 CONTIENT DÉJÀ le carburant livré le 18/09. Le pont ne
  // doit donc jamais faire « stock du 19/09 + livraison du 18/09 » — il doit
  // reconstruire la ligne du 18/09, à sa propre date, avec l'instant de
  // mesure du relevé manuscrit.
  // ------------------------------------------------------------
  const MESURES_REGUL_1809 = [
    { cuve_id: 'unique', carburant: 'sp95', jaugeage_apres_l: 14950, delta_mesure_l: 11950 },
    { cuve_id: 'cuve1', carburant: 'go', jaugeage_apres_l: 12980, delta_mesure_l: 9980 },
    { cuve_id: 'cuve2', carburant: 'go', jaugeage_apres_l: 8990, delta_mesure_l: 5990 },
  ];
  const JAUGEAGE_TERRAIN_1809 = '2026-09-18T15:15:00.000Z'; // fin du dépotage, relevé manuscrit

  await testAsync('régularisation 18/09 : la ligne de stock est écrite à la DATE DE LA LIVRAISON, jamais à celle de la saisie (test obligatoire n°8)', async () => {
    const client = creerClientMock({
      carburant_releve_versions: [{ data: null, error: null }],
      carburant_releves: [
        { data: null, error: null },              // aucun relevé au 18/09
        { data: { id: 'regul-1809' }, error: null },
      ],
    });
    const r = await Donnees.enregistrerReleveDepuisReceptionLivraison(client, 'vito-sainte-marie', {
      date: '2026-09-18', employeeId: 'mgr1', visiteId: 'visite-regul-1809',
      mesures: MESURES_REGUL_1809, cuvesGo: CUVES_GO_VITO, mesureLe: JAUGEAGE_TERRAIN_1809,
    });
    assert.strictEqual(r.ok, true);

    // Aucune lecture ni écriture ne doit toucher le 19/09 : le relevé
    // physique du lendemain est la vérité du stock courant, et il reste
    // intact. C'est lui qui prime, pas cette reconstruction historique.
    const datesTouchees = new Set();
    client.appels.forEach(a => {
      if (a.eq && a.eq.date) datesTouchees.add(a.eq.date);
      if (a.payload && a.payload.date) datesTouchees.add(a.payload.date);
    });
    assert.ok(!datesTouchees.has('2026-09-19'),
      'Une régularisation du 18/09 ne doit ni lire ni écrire la ligne du 19/09 — "stock 19/09 + livraison 18/09" est précisément le double comptage interdit');
    assert.deepStrictEqual([...datesTouchees], ['2026-09-18']);

    const insertVersion = client.appels.find(a => a.table === 'carburant_releve_versions' && a.type === 'insert');
    assert.strictEqual(insertVersion.payload.date, '2026-09-18');
    const upsertReleve = client.appels.find(a => a.table === 'carburant_releves' && a.type === 'upsert');
    assert.strictEqual(upsertReleve.payload.date, '2026-09-18');
  });

  await testAsync('régularisation 18/09 : mesure_le est l\'instant du jaugeage manuscrit, pas celui de la saisie (test obligatoire n°9)', async () => {
    const client = creerClientMock({
      carburant_releve_versions: [{ data: null, error: null }],
      carburant_releves: [{ data: null, error: null }, { data: { id: 'regul-1809' }, error: null }],
    });
    const avant = Date.now();
    await Donnees.enregistrerReleveDepuisReceptionLivraison(client, 'vito-sainte-marie', {
      date: '2026-09-18', employeeId: 'mgr1', visiteId: 'visite-regul-1809b',
      mesures: MESURES_REGUL_1809, cuvesGo: CUVES_GO_VITO, mesureLe: JAUGEAGE_TERRAIN_1809,
    });
    const insertVersion = client.appels.find(a => a.table === 'carburant_releve_versions' && a.type === 'insert');
    const upsertReleve = client.appels.find(a => a.table === 'carburant_releves' && a.type === 'upsert');
    assert.strictEqual(insertVersion.payload.mesure_le, JAUGEAGE_TERRAIN_1809);
    assert.strictEqual(upsertReleve.payload.mesure_le, JAUGEAGE_TERRAIN_1809);
    assert.ok(new Date(upsertReleve.payload.mesure_le).getTime() < avant,
      'Poser l\'instant de saisie ici ferait de la ligne du 18/09 la mesure la plus récente et étendrait sa fenêtre de ventes jusqu\'au jour de la régularisation');
  });

  await testAsync('régularisation 18/09 : la livraison s\'additionne au relevé DU 18/09, pas au stock du lendemain', async () => {
    // Relevé d'ouverture du 18/09 (avant la livraison), tel qu'il existait.
    const ouverture1809 = {
      version_num: 1, stock_reel_go_cuve1: 3000, stock_reel_go_cuve2: 3000, stock_reel_sp95: 3000, stock_reel_gnr: 4371,
      livraison_go: 0, livraison_sp95: 0, livraison_gnr: 0, mouvement_go: 0, mouvement_sp95: 0, mouvement_gnr: 0,
      motif_mouvement: null, commentaire: null,
    };
    const client = creerClientMock({
      carburant_releve_versions: [{ data: null, error: null }],
      carburant_releves: [{ data: ouverture1809, error: null }, { data: { id: 'r-1809-v2' }, error: null }],
    });
    await Donnees.enregistrerReleveDepuisReceptionLivraison(client, 'vito-sainte-marie', {
      date: '2026-09-18', employeeId: 'mgr1', visiteId: 'visite-regul-1809c',
      mesures: MESURES_REGUL_1809, cuvesGo: CUVES_GO_VITO, mesureLe: JAUGEAGE_TERRAIN_1809,
    });
    const insertVersion = client.appels.find(a => a.table === 'carburant_releve_versions' && a.type === 'insert');
    assert.strictEqual(insertVersion.payload.livraison_sp95, 11950);
    assert.strictEqual(insertVersion.payload.livraison_go, 9980 + 5990);
    assert.strictEqual(insertVersion.payload.stock_reel_sp95, 14950, 'Le jaugeage manuscrit d\'après dépotage devient le stock du 18/09');
    assert.strictEqual(insertVersion.payload.stock_reel_gnr, 4371, 'Le GNR, absent de cette livraison, est repris du relevé du 18/09');
    assert.strictEqual(insertVersion.payload.type_version, 'correction_manager');
  });

  await testAsync('régularisation rejouée (même visite) : aucune seconde application, la livraison n\'est jamais comptée deux fois', async () => {
    const client = creerClientMock({
      carburant_releve_versions: [{ data: { id: 'version-regul-deja-la' }, error: null }],
    });
    const r = await Donnees.enregistrerReleveDepuisReceptionLivraison(client, 'vito-sainte-marie', {
      date: '2026-09-18', employeeId: 'mgr1', visiteId: 'visite-regul-1809',
      mesures: MESURES_REGUL_1809, cuvesGo: CUVES_GO_VITO, mesureLe: JAUGEAGE_TERRAIN_1809,
    });
    assert.strictEqual(r.dejaAJour, true);
    assert.strictEqual(client.appels.filter(a => a.type === 'insert' || a.type === 'upsert').length, 0);
  });

  await testAsync('temps réel inchangé : sans mesureLe, l\'instant reste celui de la saisie (non-régression du parcours nominal)', async () => {
    const client = creerClientMock({
      carburant_releve_versions: [{ data: null, error: null }],
      carburant_releves: [{ data: null, error: null }, { data: { id: 'r-tr' }, error: null }],
    });
    const avant = Date.now();
    await Donnees.enregistrerReleveDepuisReceptionLivraison(client, 'vito-sainte-marie', {
      date: '2026-08-20', employeeId: 'emp1', visiteId: 'visite-tr', mesures: MESURES_VISITE_2008, cuvesGo: CUVES_GO_VITO,
    });
    const apres = Date.now();
    const upsertReleve = client.appels.find(a => a.table === 'carburant_releves' && a.type === 'upsert');
    const t = new Date(upsertReleve.payload.mesure_le).getTime();
    assert.ok(t >= avant && t <= apres, 'En temps réel, mesure_le reste new Date() — rien n\'a changé pour le parcours du jour');
  });

  await testAsync('régularisation 18/09 : l\'historique s\'empile, il ne se réécrit pas (test obligatoire n°11)', async () => {
    const ouverture1809 = {
      version_num: 3, stock_reel_go_cuve1: 3000, stock_reel_go_cuve2: 3000, stock_reel_sp95: 3000, stock_reel_gnr: 4371,
      livraison_go: 0, livraison_sp95: 0, livraison_gnr: 0, mouvement_go: 0, mouvement_sp95: 0, mouvement_gnr: 0,
      motif_mouvement: null, commentaire: 'Jaugeage d\'ouverture',
    };
    const client = creerClientMock({
      carburant_releve_versions: [{ data: null, error: null }],
      carburant_releves: [{ data: ouverture1809, error: null }, { data: { id: 'r-1809-v4' }, error: null }],
    });
    await Donnees.enregistrerReleveDepuisReceptionLivraison(client, 'vito-sainte-marie', {
      date: '2026-09-18', employeeId: 'mgr1', visiteId: 'visite-regul-1809d',
      mesures: MESURES_REGUL_1809, cuvesGo: CUVES_GO_VITO, mesureLe: JAUGEAGE_TERRAIN_1809,
    });

    // Une régularisation intervient APRÈS coup, sur des lignes que d'autres
    // ont déjà signées. Si elle pouvait modifier ou supprimer l'existant,
    // elle effacerait la trace de ce qui avait été constaté sur le moment.
    const interdits = client.appels.filter(a => a.type === 'update' || a.type === 'delete');
    assert.deepStrictEqual(interdits, [],
      'Le pont ne doit jamais modifier ni supprimer une version antérieure : l\'historique s\'empile');

    const insertVersion = client.appels.find(a => a.table === 'carburant_releve_versions' && a.type === 'insert');
    assert.strictEqual(insertVersion.payload.version_num, 4, 'La version régularisée prend le numéro suivant');
    assert.strictEqual(insertVersion.payload.auteur, 'mgr1', 'L\'auteur de la régularisation est tracé');
    assert.strictEqual(insertVersion.payload.origine, 'reception_livraison');
    assert.strictEqual(insertVersion.payload.visite_reception_id, 'visite-regul-1809d',
      'La version reste rattachable à la réception qui l\'a produite');
    assert.ok(insertVersion.payload.motif_correction, 'Une correction sans motif serait un trou dans l\'audit');

    // Le diff nomme précisément ce qui change — et seulement cela.
    const diff = insertVersion.payload.diff_vs_precedent;
    assert.ok(diff && typeof diff === 'object', 'Une correction doit produire un diff exploitable');
    assert.deepStrictEqual(diff.livraison_sp95, { avant: 0, apres: 11950 });
    assert.deepStrictEqual(diff.stock_reel_sp95, { avant: 3000, apres: 14950 });
    assert.ok(!('stock_reel_gnr' in diff), 'Le GNR n\'a pas bougé : il ne doit pas apparaître dans le diff');
    assert.ok(!('commentaire' in diff), 'Le commentaire d\'ouverture est repris tel quel, pas réécrit');
    assert.strictEqual(insertVersion.payload.commentaire, 'Jaugeage d\'ouverture');
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
