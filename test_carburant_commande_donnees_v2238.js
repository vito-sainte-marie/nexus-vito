// Test — Moteur Commande Carburant, colle Supabase
// (nexus-carburant-commande-donnees.js), v2.238 (24/08/2026).
//
// require() direct des vrais fichiers (moteur générique carburant, moteur
// Commande Carburant, colle donnees) — même discipline que
// test_pont_reception_carburant_stock_20260821.js : mock Supabase
// chaînable minimal, aucune réécriture des fonctions testées.

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
require(path.join(PROJET, 'nexus-carburant-commande-moteur.js'));
require(path.join(PROJET, 'nexus-carburant-commande-donnees.js'));
const Donnees = global.NexusCarburantCommandeDonnees;
assert.strictEqual(typeof Donnees.evaluerCommandeCarburantSite, 'function', 'evaluerCommandeCarburantSite doit être exportée');

// ------------------------------------------------------------
// Mock Supabase chaînable — réponses en file par table, supporte
// select/insert/update/eq/gte/lt/in/order/limit/maybeSingle/single, et un
// `then` pour les requêtes qui résolvent directement en tableau (comme le
// reste des tests carburant du projet).
// ------------------------------------------------------------
function creerClientMock(reponses) {
  const appels = [];
  const compteurs = {};
  function prochaine(table) {
    const liste = reponses[table] || [];
    const i = compteurs[table] || 0;
    compteurs[table] = i + 1;
    return liste[i] || { data: null, error: null };
  }
  function b(table, type, payload) {
    const appel = { table, type, payload, eq: {} };
    appels.push(appel);
    const chain = {
      select() { return chain; },
      eq(k, v) { appel.eq[k] = v; return chain; },
      gte() { return chain; },
      lt() { return chain; },
      lte() { return chain; },
      in() { return chain; },
      order() { return chain; },
      limit() { return chain; },
      async maybeSingle() { return prochaine(table); },
      async single() { return prochaine(table); },
      then(resolve, reject) { return Promise.resolve(prochaine(table)).then(resolve, reject); },
    };
    return chain;
  }
  return {
    appels,
    from(table) {
      return {
        select() { return b(table, 'select'); },
        insert(payload) { return b(table, 'insert', payload); },
        update(payload) { return b(table, 'update', payload); },
      };
    },
  };
}

const CONFIG_COMMANDE = {
  cutoff_heure: '11:00', jours_livraison_iso: [1, 2, 3, 4, 5],
  minimum_camion_litres: 10000, stock_securite_jours: 3,
};
const CUVES_VITO = {
  sp95: { actif: true, label: 'SP95', cuves: [{ id: 'unique', capacite: 30276, limite_remplissage: 28761 }] },
  go: { actif: true, label: 'GO', cuves: [{ id: 'cuve1', capacite: 20020, limite_remplissage: 19019 }, { id: 'cuve2', capacite: 10036, limite_remplissage: 9534 }] },
  gnr: { actif: false, label: 'GNR', cuves: [{ id: 'unique', capacite: 30000, limite_remplissage: 28500 }] },
};

(async function main() {
  // ------------------------------------------------------------
  // 1) chargerConfigEtCuves — lecture directe, repli explicite si absent.
  // ------------------------------------------------------------
  await testAsync('chargerConfigEtCuves : lit carburant_commande_config + cuves_carburants en une seule requête, et aucun fuseau', async () => {
    const client = creerClientMock({
      station_config: [{ data: { carburant_commande_config: CONFIG_COMMANDE, cuves_carburants: CUVES_VITO, fuseau_horaire: 'America/Martinique' }, error: null }],
    });
    const r = await Donnees.chargerConfigEtCuves(client, 'vito-sainte-marie');
    assert.deepStrictEqual(r.config, CONFIG_COMMANDE);
    assert.strictEqual(r.cuves.gnr.actif, false, 'GNR doit rester désactivé (pompe indisponible, décision actée avec Frédéric)');
    assert.strictEqual(client.appels.length, 1, 'une seule requête station_config, jamais trois');
  });

  await testAsync('chargerConfigEtCuves : site sans config -> repli null explicite, jamais une exception', async () => {
    const client = creerClientMock({ station_config: [{ data: null, error: null }] });
    const r = await Donnees.chargerConfigEtCuves(client, 'site-inconnu');
    assert.strictEqual(r.config, null);
    assert.strictEqual(r.cuves, null);
    // A3 / C1c-4a (05/09/2026) : cette assertion vérifiait le repli qu'on
    // vient de supprimer. `chargerConfigEtCuves` ne fournit plus de fuseau du
    // tout — c'est le contrat, pas un oubli.
    assert.strictEqual(r.fuseau, undefined, 'le fuseau ne fait plus partie du contrat de chargerConfigEtCuves');
    assert.ok(!('timezone' in r), 'cette couche de données ne résout aucun fuseau');
  });

  // ------------------------------------------------------------
  // 2) chargerJoursFeries
  // ------------------------------------------------------------
  await testAsync('chargerJoursFeries : ne retient que type=ferie, jamais les vacances (hors périmètre de ce lot)', async () => {
    const client = creerClientMock({ inventaire_calendrier_site: [{ data: [{ date: '2026-12-25' }, { date: '2026-01-01' }], error: null }] });
    const jours = await Donnees.chargerJoursFeries(client, 'vito-sainte-marie');
    assert.deepStrictEqual(jours, ['2026-12-25', '2026-01-01']);
  });

  // ------------------------------------------------------------
  // 3) chargerHistoriqueVentesParJour — agrégation par date, plusieurs
  //    lignes (quarts) du même jour sommées.
  // ------------------------------------------------------------
  await testAsync('chargerHistoriqueVentesParJour : agrège plusieurs quarts du même jour, format attendu par le moteur', async () => {
    const client = creerClientMock({
      audits_caisse: [{
        data: [
          { date: '2026-08-20', litrage_gazole: 700, litrage_sp95: 800, litrage_gnr: null },
          { date: '2026-08-20', litrage_gazole: 600, litrage_sp95: 900, litrage_gnr: null },
          { date: '2026-08-21', litrage_gazole: 1300, litrage_sp95: 1600, litrage_gnr: null },
        ], error: null,
      }],
    });
    const historique = await Donnees.chargerHistoriqueVentesParJour(client, 'vito-sainte-marie', '2026-08-22');
    assert.deepStrictEqual(historique, [
      { date: '2026-08-20', ventes: { go: 1300, sp95: 1700, gnr: null } },
      { date: '2026-08-21', ventes: { go: 1300, sp95: 1600, gnr: null } },
    ]);
  });

  // ------------------------------------------------------------
  // 4) chargerCommandeEnCoursParCarburant — exemple §10 du cahier.
  // ------------------------------------------------------------
  await testAsync('chargerCommandeEnCoursParCarburant : reprend le volume par carburant de la commande la plus récente non livrée', async () => {
    const client = creerClientMock({
      carburant_commandes: [{
        data: [{ id: 'cmd1', carburants: { sp95: { volumeL: 15000 } }, livraison_prevue_le: '2026-08-25', statut: 'validee' }],
        error: null,
      }],
    });
    const r = await Donnees.chargerCommandeEnCoursParCarburant(client, 'vito-sainte-marie');
    assert.strictEqual(r.sp95.volumeL, 15000);
    assert.strictEqual(r.sp95.livraisonPrevueLe, '2026-08-25');
    assert.strictEqual(r.go, undefined, 'un carburant sans commande en cours ne doit jamais apparaître avec une valeur fabriquée');
  });

  // ------------------------------------------------------------
  // 5) evaluerCommandeCarburantSite — orchestration complète, repli honnête
  //    si la config n'existe pas.
  // ------------------------------------------------------------
  await testAsync('evaluerCommandeCarburantSite : config absente -> ok=false explicite, jamais une évaluation inventée', async () => {
    const client = creerClientMock({ station_config: [{ data: null, error: null }] });
    const r = await Donnees.evaluerCommandeCarburantSite(client, 'site-sans-config', { timezone: 'America/Martinique', dateISO: '2026-08-21' });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.etatGlobal, 'non_calculable');
  });

  await testAsync('evaluerCommandeCarburantSite : GNR désactivé -> jamais évalué, seuls SP95/GO entrent dans la commande recommandée', async () => {
    const client = creerClientMock({
      station_config: [{ data: { carburant_commande_config: CONFIG_COMMANDE, cuves_carburants: CUVES_VITO, fuseau_horaire: 'America/Martinique' }, error: null }],
      inventaire_calendrier_site: [{ data: [], error: null }],
      audits_caisse: [{ data: [], error: null }],
      carburant_releves: [{ data: null, error: null }, { data: null, error: null }],
      carburant_stock_references: [{ data: null, error: null }],
      carburant_commandes: [{ data: [], error: null }],
    });
    const r = await Donnees.evaluerCommandeCarburantSite(client, 'vito-sainte-marie', { timezone: 'America/Martinique', dateISO: '2026-08-21', heureHHMM: '09:00' });
    assert.strictEqual(r.ok, true);
    assert.ok(!('gnr' in r.parCarburant), 'GNR (actif=false) ne doit jamais apparaître dans l\'évaluation');
    assert.ok('sp95' in r.parCarburant && 'go' in r.parCarburant);
  });

  // ------------------------------------------------------------
  // 6) Écriture — cycle de vie d'une commande (§31-34).
  // ------------------------------------------------------------
  await testAsync('creerPropositionCommande : insère avec statut proposee, volumes bien structurés en jsonb', async () => {
    const client = creerClientMock({ carburant_commandes: [{ data: { id: 'nouvelle-cmd' }, error: null }] });
    const r = await Donnees.creerPropositionCommande(client, 'vito-sainte-marie', {
      volumes: { sp95: 7000, go: 5000 }, total: 12000, confidence: 'fiable', raison: 'Test',
      cutoffDeadline: '2026-08-21T11:00:00Z', livraisonPrevueLe: '2026-08-24', createdBy: 'emp1',
    });
    assert.strictEqual(r.ok, true);
    const insertAppel = client.appels.find(a => a.type === 'insert');
    assert.strictEqual(insertAppel.payload.statut, 'proposee');
    assert.deepStrictEqual(insertAppel.payload.carburants, { sp95: { volumeL: 7000 }, go: { volumeL: 5000 } });
  });

  await testAsync('reporterCommande : motif catégorisé obligatoire, statut reportee', async () => {
    const client = creerClientMock({ carburant_commandes: [{ data: { id: 'cmd1', statut: 'reportee' }, error: null }] });
    const r = await Donnees.reporterCommande(client, 'cmd1', { motifCategorie: 'decision_tresorerie', motif: 'On attend la fin du mois' });
    assert.strictEqual(r.ok, true);
    const updateAppel = client.appels.find(a => a.type === 'update');
    assert.strictEqual(updateAppel.payload.statut, 'reportee');
    assert.strictEqual(updateAppel.payload.motif_report_categorie, 'decision_tresorerie');
  });

  await testAsync('enregistrerCommandeHorsNexus : source=hors_nexus, confidence=fiable (une commande réelle passée ailleurs n\'est jamais "à confirmer")', async () => {
    const client = creerClientMock({ carburant_commandes: [{ data: { id: 'cmd-externe' }, error: null }] });
    const r = await Donnees.enregistrerCommandeHorsNexus(client, 'vito-sainte-marie', { volumes: { go: 10000 }, total: 10000 });
    assert.strictEqual(r.ok, true);
    const insertAppel = client.appels.find(a => a.type === 'insert');
    assert.strictEqual(insertAppel.payload.source, 'hors_nexus');
    assert.strictEqual(insertAppel.payload.statut, 'hors_nexus');
    assert.strictEqual(insertAppel.payload.confidence, 'fiable');
  });

  await testAsync('rapprocherCommandeReception : marque livree et pointe vers la visite, sans dupliquer la mesure', async () => {
    const client = creerClientMock({ carburant_commandes: [{ data: { id: 'cmd1', statut: 'livree' }, error: null }] });
    const r = await Donnees.rapprocherCommandeReception(client, 'cmd1', 'visite-42', '2026-08-24');
    assert.strictEqual(r.ok, true);
    const updateAppel = client.appels.find(a => a.type === 'update');
    assert.strictEqual(updateAppel.payload.statut, 'livree');
    assert.strictEqual(updateAppel.payload.visite_reception_id, 'visite-42');
  });

  // ------------------------------------------------------------
  // 7) 27/08/2026, point 22 (refonte qualitative) — 2 étapes réelles
  //    manquantes du cycle de vie : "commande confirmée fournisseur" (entre
  //    validee et livree) et "réception contrôlée" (après livree). Colonnes
  //    et valeurs CHECK ajoutées par la migration
  //    carburant_commandes_ajout_statuts_confirmee_reception_controlee.
  // ------------------------------------------------------------
  await testAsync('confirmerCommandeFournisseur : statut confirmee_fournisseur, référence + horodatage tracés', async () => {
    const client = creerClientMock({ carburant_commandes: [{ data: { id: 'cmd1', statut: 'confirmee_fournisseur' }, error: null }] });
    const r = await Donnees.confirmerCommandeFournisseur(client, 'cmd1', { confirmePar: 'emp1', referenceFournisseur: 'BL-2026-0827' });
    assert.strictEqual(r.ok, true);
    const updateAppel = client.appels.find(a => a.type === 'update');
    assert.strictEqual(updateAppel.payload.statut, 'confirmee_fournisseur');
    assert.strictEqual(updateAppel.payload.confirmee_fournisseur_par, 'emp1');
    assert.strictEqual(updateAppel.payload.reference_fournisseur, 'BL-2026-0827');
    assert.ok(updateAppel.payload.confirmee_fournisseur_le, 'horodatage obligatoire, jamais silencieux');
  });

  await testAsync('controlerReceptionCommande : statut reception_controlee, verdict + note tracés, distinct de "livree"', async () => {
    const client = creerClientMock({ carburant_commandes: [{ data: { id: 'cmd1', statut: 'reception_controlee' }, error: null }] });
    const r = await Donnees.controlerReceptionCommande(client, 'cmd1', { controlePar: 'emp2', verdict: 'conforme', note: 'RAS, compartiments conformes au BL' });
    assert.strictEqual(r.ok, true);
    const updateAppel = client.appels.find(a => a.type === 'update');
    assert.strictEqual(updateAppel.payload.statut, 'reception_controlee', 'statut distinct de "livree" — la réception physique et son contrôle sont deux faits différents (point 22)');
    assert.strictEqual(updateAppel.payload.reception_controle_verdict, 'conforme');
    assert.strictEqual(updateAppel.payload.reception_controle_note, 'RAS, compartiments conformes au BL');
    assert.ok(updateAppel.payload.reception_controlee_le, 'horodatage obligatoire, jamais silencieux');
  });

  console.log('\nTests Moteur Commande Carburant (colle Supabase) — v2.238 terminés.');
})();
