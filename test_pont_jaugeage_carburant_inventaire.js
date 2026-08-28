// Test — Pont Jaugeage carburant Inventaire → Carburants (19/08/2026,
// demande de Frédéric : "avant d'attaquer M7 : Je ferais exactement ce
// parcours"). Le pompiste du Quart 1 saisit le jaugeage physique
// d'ouverture directement dans Inventaire ; Inventaire DÉCLENCHE l'action
// mais la donnée va dans le domaine Carburants (carburant_releves), jamais
// une deuxième vérité dans les tables Inventaire (Article 11).
//
// PARTIE 1 — nexus-carburant-donnees.js : les 4 nouvelles fonctions
//   (chargerReleveDuJour, chargerStatutJaugeageJour,
//   enregistrerJaugeageOuverturePompiste, enregistrerJaugeageImpossible),
//   require() direct + mock Supabase chaînable, aucune réécriture des
//   fonctions testées.
// PARTIE 2 — NEXUS-Inventaire-v1.html : renderBlocJaugeageCarburant +
//   libelleMotifImpossible, extraites par regex comme tous les tests de ce
//   module, les 3 états (à faire / fait / impossible) + le cas "flag
//   inactif -> aucun bloc, jamais un bouton grisé".

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const PROJET = '/sessions/dazzling-compassionate-ride/mnt/image nexus project';

function testSync(nom, fn) {
  try { fn(); console.log(`OK — ${nom}`); }
  catch (e) { console.error(`FAIL — ${nom}\n  ${e.stack}`); process.exitCode = 1; }
}
async function testAsync(nom, fn) {
  try { await fn(); console.log(`OK — ${nom}`); }
  catch (e) { console.error(`FAIL — ${nom}\n  ${e.stack}`); process.exitCode = 1; }
}

// ------------------------------------------------------------
// PARTIE 1 — nexus-carburant-donnees.js (require direct)
// ------------------------------------------------------------
global.window = global;
require(path.join(PROJET, 'nexus-carburant-moteur.js'));
require(path.join(PROJET, 'nexus-carburant-donnees.js'));
const Donnees = global.NexusCarburantDonnees;
assert.ok(Donnees, 'NexusCarburantDonnees non chargé');
['chargerReleveDuJour', 'chargerStatutJaugeageJour', 'enregistrerJaugeageOuverturePompiste', 'enregistrerJaugeageImpossible']
  .forEach(fn => assert.strictEqual(typeof Donnees[fn], 'function', `${fn} doit être exportée`));

// Mock Supabase chaînable minimal : capte chaque .from(table) comme un
// nouvel "appel", chaîne .select/.eq/.insert/.upsert/.update, résout via
// des réponses préprogrammées par table (queue FIFO par table).
function creerClientMock(reponses) {
  const appels = [];
  const compteurs = {};
  function b(table, type, payload) {
    const appel = { table, type, payload, eq: {} };
    appels.push(appel);
    const chain = {
      select() { return chain; },
      eq(k, v) { appel.eq[k] = v; return chain; },
      async maybeSingle() {
        const liste = reponses[table] || [];
        const i = compteurs[table] || 0;
        compteurs[table] = i + 1;
        return liste[i] || { data: null, error: null };
      },
      then(resolve, reject) {
        // Cas où le code n'appelle ni .select().maybeSingle() ni .select()
        // après un insert/upsert brut (ex: le upsert "best-effort" du statut
        // du jour dans enregistrerJaugeageOuverturePompiste) : le mock doit
        // rester "thenable" pour être awaité directement.
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
        update(payload) { return b(table, 'update', payload); },
      };
    },
  };
}

(async function main() {
  // --- chargerReleveDuJour / chargerStatutJaugeageJour -------------------
  await testAsync('chargerReleveDuJour relit tel quel (Article 11), null proprement en cas d\'erreur', async () => {
    const clientOk = creerClientMock({ carburant_releves: [{ data: { id: 'r1', stock_reel_sp95: 8000 }, error: null }] });
    const r1 = await Donnees.chargerReleveDuJour(clientOk, 'vito', '2026-08-19');
    assert.strictEqual(r1.id, 'r1');

    const clientErr = creerClientMock({ carburant_releves: [{ data: null, error: { message: 'boom' } }] });
    const r2 = await Donnees.chargerReleveDuJour(clientErr, 'vito', '2026-08-19');
    assert.strictEqual(r2, null, 'Erreur Supabase -> null, jamais une exception qui casserait le bloc Inventaire');
  });

  await testAsync('chargerStatutJaugeageJour relit carburant_jaugeage_statuts_jour, null en cas d\'erreur', async () => {
    const client = creerClientMock({ carburant_jaugeage_statuts_jour: [{ data: { statut: 'impossible', motif_impossible: 'acces_impossible' }, error: null }] });
    const s = await Donnees.chargerStatutJaugeageJour(client, 'vito', '2026-08-19');
    assert.strictEqual(s.statut, 'impossible');
    assert.strictEqual(s.motif_impossible, 'acces_impossible');
  });

  // --- enregistrerJaugeageOuverturePompiste — première saisie du jour ----
  await testAsync('enregistrerJaugeageOuverturePompiste (aucun précédent) : saisie_initiale, origine terrain_pompiste sur les 2 écritures, statut "fait"', async () => {
    const client = creerClientMock({
      carburant_releves: [
        { data: null, error: null }, // chargerReleveDuJour (précédent)
        { data: { id: 'nouveauReleve', stock_reel_sp95: 8000 }, error: null }, // upsert().select().maybeSingle()
      ],
      carburant_releve_versions: [{ data: null, error: null }],
      carburant_jaugeage_statuts_jour: [{ data: null, error: null }],
    });
    const r = await Donnees.enregistrerJaugeageOuverturePompiste(client, 'vito', {
      date: '2026-08-19', employeeId: 'emp1', valeurs: { sp95: 8000, go_cuve1: 12000, go_cuve2: null, gnr: 4000 },
    });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.dejaAJour, false);
    assert.strictEqual(r.releve.id, 'nouveauReleve');

    const insertVersion = client.appels.find(a => a.table === 'carburant_releve_versions' && a.type === 'insert');
    assert.ok(insertVersion, 'Doit écrire la preuve dans carburant_releve_versions AVANT la vue courante ("preuve avant vue")');
    assert.strictEqual(insertVersion.payload.type_version, 'saisie_initiale');
    assert.strictEqual(insertVersion.payload.origine, 'terrain_pompiste');
    assert.strictEqual(insertVersion.payload.motif_correction, null, 'Première saisie -> pas de motif de correction');
    assert.strictEqual(insertVersion.payload.stock_reel_sp95, 8000);
    assert.strictEqual(insertVersion.payload.stock_reel_go_cuve1, 12000);
    assert.strictEqual(insertVersion.payload.stock_reel_go_cuve2, null, 'Cuve non saisie et aucun précédent -> null, jamais une fausse précision (Article 5)');
    assert.strictEqual(insertVersion.payload.livraison_go, 0, 'Le pompiste ne déclare jamais de livraison -> reprise à 0 par défaut');
    // 28/08/2026, P0 (retour de Frédéric, jaugeage 28/08 05:52 invisible au
    // moteur de commande, qui restait ancré sur le 27/08 10:10) : cette
    // fonction n'a jamais renseigné `mesure_le`, contrairement à l'écran
    // manager et au pont Réception — chargerStockEtFiabiliteParCarburant en
    // dépend pour reconnaître "un jaugeage a été saisi aujourd'hui" (Cas A).
    assert.ok(insertVersion.payload.mesure_le, 'mesure_le doit être renseigné sur la preuve (carburant_releve_versions), sinon le moteur de commande ignore ce jaugeage');
    assert.ok(!Number.isNaN(new Date(insertVersion.payload.mesure_le).getTime()), 'mesure_le doit être un instant ISO valide');

    const upsertReleve = client.appels.find(a => a.table === 'carburant_releves' && a.type === 'upsert');
    assert.ok(upsertReleve, 'Doit écrire ensuite la vue courante carburant_releves');
    assert.strictEqual(upsertReleve.payload.origine, 'terrain_pompiste');
    assert.strictEqual(upsertReleve.payload.saisi_par, 'emp1');
    assert.ok(upsertReleve.payload.mesure_le, 'mesure_le doit aussi être renseigné sur la vue courante (carburant_releves), sinon le relevé du jour reste invisible au moteur de commande (Cas A de chargerStockEtFiabiliteParCarburant)');
    assert.strictEqual(upsertReleve.payload.mesure_le, insertVersion.payload.mesure_le, 'Même instant de capture sur les deux écritures (preuve et vue courante), jamais deux horodatages différents pour un seul événement de saisie');

    const upsertStatut = client.appels.find(a => a.table === 'carburant_jaugeage_statuts_jour' && a.type === 'upsert');
    assert.ok(upsertStatut, 'Doit marquer le statut du jour "fait"');
    assert.strictEqual(upsertStatut.payload.statut, 'fait');
    assert.strictEqual(upsertStatut.payload.motif_impossible, null);
  });

  // --- enregistrerJaugeageOuverturePompiste — précédent identique --------
  await testAsync('enregistrerJaugeageOuverturePompiste (précédent identique) : dejaAJour=true, aucune écriture (jamais une version bruitée)', async () => {
    const precedent = {
      version_num: 3, stock_reel_go_cuve1: 12000, stock_reel_go_cuve2: 6000, stock_reel_sp95: 8000, stock_reel_gnr: 4000,
      livraison_go: 0, livraison_sp95: 0, livraison_gnr: 0, mouvement_go: 0, mouvement_sp95: 0, mouvement_gnr: 0,
      motif_mouvement: null, commentaire: null,
    };
    const client = creerClientMock({ carburant_releves: [{ data: precedent, error: null }] });
    const r = await Donnees.enregistrerJaugeageOuverturePompiste(client, 'vito', {
      date: '2026-08-19', employeeId: 'emp1', valeurs: { sp95: 8000, go_cuve1: 12000, go_cuve2: 6000, gnr: 4000 },
    });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.dejaAJour, true);
    assert.strictEqual(r.releve, precedent);
    assert.strictEqual(client.appels.filter(a => a.type === 'insert' || a.type === 'upsert').length, 0, 'Valeurs identiques au précédent -> aucune écriture (ni preuve ni statut)');
  });

  // --- enregistrerJaugeageOuverturePompiste — correction (manager a déjà saisi) --
  await testAsync('enregistrerJaugeageOuverturePompiste (précédent existant, valeur différente) : correction_manager, motif honnête', async () => {
    const precedent = {
      version_num: 1, stock_reel_go_cuve1: 11800, stock_reel_go_cuve2: 6000, stock_reel_sp95: 8000, stock_reel_gnr: 4000,
      livraison_go: 500, livraison_sp95: 0, livraison_gnr: 0, mouvement_go: 0, mouvement_sp95: 0, mouvement_gnr: 0,
      motif_mouvement: null, commentaire: null,
    };
    const client = creerClientMock({
      carburant_releves: [{ data: precedent, error: null }, { data: { id: 'r2' }, error: null }],
      carburant_releve_versions: [{ data: null, error: null }],
      carburant_jaugeage_statuts_jour: [{ data: null, error: null }],
    });
    const r = await Donnees.enregistrerJaugeageOuverturePompiste(client, 'vito', {
      date: '2026-08-19', employeeId: 'emp1', valeurs: { sp95: 8000, go_cuve1: 12000, go_cuve2: 6000, gnr: 4000 },
    });
    assert.strictEqual(r.ok, true);
    const insertVersion = client.appels.find(a => a.table === 'carburant_releve_versions' && a.type === 'insert');
    assert.strictEqual(insertVersion.payload.type_version, 'correction_manager', 'Un précédent existe déjà -> classé correction_manager (seules 2 valeurs existent pour type_version, Article 11)');
    assert.strictEqual(insertVersion.payload.origine, 'terrain_pompiste', 'origine reste honnête : c\'est bien le pompiste qui a écrit cette version, quel que soit le type_version');
    assert.ok(insertVersion.payload.motif_correction.includes('pont Inventaire'), 'Le motif doit rester honnête sur ce qui s\'est réellement passé (pas un champ que le pompiste devrait remplir)');
    assert.strictEqual(insertVersion.payload.livraison_go, 500, 'Livraison déjà saisie par le manager -> reprise telle quelle, jamais écrasée par le pompiste');
    assert.ok(insertVersion.payload.mesure_le, 'mesure_le doit être renseigné même sur une correction (P0 28/08/2026)');

    const upsertReleve = client.appels.find(a => a.table === 'carburant_releves' && a.type === 'upsert');
    assert.strictEqual(upsertReleve.payload.origine, 'terrain_pompiste', 'origine du relevé courant reflète la version retenue la plus récente (mirroir, pas figé à la première saisie)');
    assert.ok(upsertReleve.payload.mesure_le, 'mesure_le doit être renseigné sur la vue courante même sur une correction (P0 28/08/2026)');
  });

  // --- enregistrerJaugeageOuverturePompiste — saisie partielle -----------
  await testAsync('enregistrerJaugeageOuverturePompiste (saisie partielle, précédent existant) : champs omis repris du précédent, jamais écrasés à null', async () => {
    const precedent = {
      version_num: 1, stock_reel_go_cuve1: 12000, stock_reel_go_cuve2: 6000, stock_reel_sp95: 8000, stock_reel_gnr: 4000,
      livraison_go: 0, livraison_sp95: 0, livraison_gnr: 0, mouvement_go: 0, mouvement_sp95: 0, mouvement_gnr: 0,
      motif_mouvement: null, commentaire: 'Note existante',
    };
    const client = creerClientMock({
      carburant_releves: [{ data: precedent, error: null }, { data: { id: 'r3' }, error: null }],
      carburant_releve_versions: [{ data: null, error: null }],
      carburant_jaugeage_statuts_jour: [{ data: null, error: null }],
    });
    // Seul GNR est resaisi (ex: cuve GNR seule accessible ce matin-là).
    const r = await Donnees.enregistrerJaugeageOuverturePompiste(client, 'vito', {
      date: '2026-08-19', employeeId: 'emp1', valeurs: { gnr: 3900 },
    });
    assert.strictEqual(r.ok, true);
    const insertVersion = client.appels.find(a => a.table === 'carburant_releve_versions' && a.type === 'insert');
    assert.strictEqual(insertVersion.payload.stock_reel_gnr, 3900);
    assert.strictEqual(insertVersion.payload.stock_reel_sp95, 8000, 'SP95 omis -> repris du précédent, jamais mis à null');
    assert.strictEqual(insertVersion.payload.stock_reel_go_cuve1, 12000, 'GO cuve1 omis -> repris du précédent');
    assert.strictEqual(insertVersion.payload.commentaire, 'Note existante', 'Commentaire existant préservé, jamais écrasé par une saisie partielle du pompiste');
  });

  // --- enregistrerJaugeageImpossible --------------------------------------
  await testAsync('enregistrerJaugeageImpossible : écrit UNIQUEMENT le statut du jour, jamais une valeur dans carburant_releves (Article 5)', async () => {
    const client = creerClientMock({ carburant_jaugeage_statuts_jour: [{ data: { statut: 'impossible', motif_impossible: 'equipement_indisponible' }, error: null }] });
    const r = await Donnees.enregistrerJaugeageImpossible(client, 'vito', {
      date: '2026-08-19', employeeId: 'emp1', motif: 'equipement_indisponible', commentaire: 'Veeder-Root en panne',
    });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.statut.statut, 'impossible');
    assert.strictEqual(client.appels.filter(a => a.table === 'carburant_releves').length, 0, 'Jamais une écriture dans carburant_releves quand le jaugeage est déclaré impossible');
    const upsertStatut = client.appels.find(a => a.table === 'carburant_jaugeage_statuts_jour' && a.type === 'upsert');
    assert.strictEqual(upsertStatut.payload.motif_impossible, 'equipement_indisponible');
    assert.strictEqual(upsertStatut.payload.commentaire, 'Veeder-Root en panne');
  });

  console.log('\n--- PARTIE 1 (nexus-carburant-donnees.js) terminée ---\n');

  // ------------------------------------------------------------
  // PARTIE 2 — NEXUS-Inventaire-v1.html : renderBlocJaugeageCarburant +
  // libelleMotifImpossible, extraction par regex (jamais réécrites à la main).
  // ------------------------------------------------------------
  const html = fs.readFileSync(path.join(PROJET, 'NEXUS-Inventaire-v1.html'), 'utf8');
  const scriptMatches = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  const script = scriptMatches.reduce((a, b) => (b.length > a.length ? b : a), '');
  assert.ok(script.includes('renderBlocJaugeageCarburant'), 'Bloc script applicatif introuvable');

  function extraireFonction(nomFonction) {
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

  const srcParts = [
    'let jaugeageCarburantActif = false;',
    'let statutJaugeageJour = null;',
    extraireFonction('libelleMotifImpossible'),
    extraireFonction('renderBlocJaugeageCarburant'),
    `globalThis.__test = {
      setEnv: (env) => { jaugeageCarburantActif = env.jaugeageCarburantActif; statutJaugeageJour = env.statutJaugeageJour; },
      renderBlocJaugeageCarburant, libelleMotifImpossible,
    };`,
  ].join('\n\n');
  const ctx = { globalThis: {}, console, Date };
  ctx.globalThis = ctx;
  vm.runInNewContext(srcParts, ctx);
  const T = ctx.__test;

  testSync('renderBlocJaugeageCarburant : flag site inactif -> aucun bloc (jamais un bouton grisé, "cela ajouterait du bruit inutile")', () => {
    T.setEnv({ jaugeageCarburantActif: false, statutJaugeageJour: null });
    assert.strictEqual(T.renderBlocJaugeageCarburant(), '', 'Flag inactif -> chaîne vide, aucune trace du bloc dans le DOM');
  });

  testSync('renderBlocJaugeageCarburant : flag actif, aucun statut -> carte "À faire"', () => {
    T.setEnv({ jaugeageCarburantActif: true, statutJaugeageJour: null });
    const html = T.renderBlocJaugeageCarburant();
    assert.ok(html.includes('Jaugeage carburants — ouverture'), 'Doit afficher le titre exact du cahier des charges');
    assert.ok(html.includes('SP95') && html.includes('GO') && html.includes('GNR'), 'Doit citer les 3 carburants concernés');
    assert.ok(html.includes('À faire'), 'Statut "À faire" tant que rien n\'est saisi');
    assert.ok(html.includes('carteJaugeageCarburant'), 'La carte doit exposer son id pour le câblage du clic (démarrerJaugeageOuverture)');
  });

  testSync('renderBlocJaugeageCarburant : statut "fait" -> carte cliquée = "Effectué à HH:MM", jamais re-proposée', () => {
    T.setEnv({ jaugeageCarburantActif: true, statutJaugeageJour: { statut: 'fait', cree_le: '2026-08-19T05:56:00.000Z', motif_impossible: null } });
    const html = T.renderBlocJaugeageCarburant();
    assert.ok(html.includes('Effectué à'), 'Doit confirmer l\'heure de saisie, jamais reproposer le formulaire une fois fait');
    assert.ok(html.includes('Voir le relevé'), 'Doit exposer le lien de consultation du relevé (toggleDetailReleveJaugeage)');
    assert.ok(!html.includes('carteJaugeageCarburant'), 'La carte "À faire" ne doit plus exister une fois le jaugeage effectué');
  });

  testSync('renderBlocJaugeageCarburant : statut "impossible" -> motif affiché en clair, jamais un code brut', () => {
    T.setEnv({ jaugeageCarburantActif: true, statutJaugeageJour: { statut: 'impossible', motif_impossible: 'acces_impossible' } });
    const html = T.renderBlocJaugeageCarburant();
    assert.ok(html.includes('Signalé impossible'), 'Doit indiquer clairement que le jaugeage n\'a pas pu être fait');
    assert.ok(html.includes('accès impossible'), 'Le motif doit être en français lisible, pas le code brut "acces_impossible"');
    assert.ok(html.includes('provisoire'), 'Doit rappeler que le contrôle carburant du jour reste provisoire');
  });

  testSync('libelleMotifImpossible : les 3 motifs connus + repli sur la valeur brute si motif inconnu (jamais une exception)', () => {
    assert.strictEqual(T.libelleMotifImpossible('equipement_indisponible'), 'équipement indisponible');
    assert.strictEqual(T.libelleMotifImpossible('acces_impossible'), 'accès impossible');
    assert.strictEqual(T.libelleMotifImpossible('autre'), 'autre motif');
    assert.strictEqual(T.libelleMotifImpossible('valeur_future_inconnue'), 'valeur_future_inconnue', 'Motif inconnu -> repli sur la valeur brute, jamais une exception qui casserait l\'écran');
  });

  // ------------------------------------------------------------
  // PARTIE 3 — resoudreJaugeageCarburant() (19/08/2026, retour Frédéric :
  // "si je me connecte en piste je dois voir cette carte") — la condition
  // suit désormais la ZONE (piste), pas le rôle. Extraction de
  // resoudreJaugeageCarburant + chargerJaugeageCarburantActif, avec un
  // nexusClient et un NexusCarburantDonnees mockés (jamais réécrits).
  // ------------------------------------------------------------
  function extraireFonction2(nomFonction) {
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

  function creerContexteResolution({ jaugeageActifSite, statutJour }) {
    const appelsStationConfig = [];
    const appelsStatutJour = [];
    const srcParts2 = [
      'let jaugeageCarburantActif = false;',
      'let statutJaugeageJour = null;',
      'let quartActuel = null;',
      'let zoneActive = null;',
      "let employeeCourant = { site_id: 'vito-sainte-marie' };",
      "function dateISO() { return '2026-08-19'; }",
      extraireFonction2('chargerJaugeageCarburantActif'),
      extraireFonction2('resoudreJaugeageCarburant'),
      `globalThis.__test = {
        setEnv: (env) => { quartActuel = env.quartActuel; zoneActive = env.zoneActive; },
        resoudreJaugeageCarburant,
        lire: () => ({ jaugeageCarburantActif, statutJaugeageJour }),
      };`,
    ].join('\n\n');
    const nexusClient = {
      from(table) {
        appelsStationConfig.push(table);
        return {
          select() { return this; },
          eq() { return this; },
          async maybeSingle() {
            return { data: { jaugeage_carburant_actif: jaugeageActifSite }, error: null };
          },
        };
      },
    };
    const NexusCarburantDonnees = {
      async chargerStatutJaugeageJour(client, site, date) {
        appelsStatutJour.push({ client, site, date });
        return statutJour;
      },
    };
    const ctx2 = { globalThis: {}, console, Date, nexusClient, NexusCarburantDonnees };
    ctx2.globalThis = ctx2;
    vm.runInNewContext(srcParts2, ctx2);
    return { T: ctx2.__test, appelsStationConfig, appelsStatutJour };
  }

  await testAsync('resoudreJaugeageCarburant : quart matin + zone piste + flag actif -> visible, statut du jour chargé (pompiste, toujours en piste, est donc déjà couvert)', async () => {
    const { T, appelsStationConfig, appelsStatutJour } = creerContexteResolution({ jaugeageActifSite: true, statutJour: { statut: 'fait', cree_le: '2026-08-19T05:56:00.000Z', motif_impossible: null } });
    T.setEnv({ quartActuel: 'matin', zoneActive: 'piste' });
    await T.resoudreJaugeageCarburant();
    const etat = T.lire();
    assert.strictEqual(etat.jaugeageCarburantActif, true);
    assert.strictEqual(etat.statutJaugeageJour.statut, 'fait');
    assert.strictEqual(appelsStationConfig.length, 1, 'Doit lire station_config une fois');
    assert.strictEqual(appelsStatutJour.length, 1, 'Doit lire le statut du jour une fois');
  });

  await testAsync('resoudreJaugeageCarburant : quart matin + zone piste (ex: manager qui a choisi piste) + flag actif -> visible aussi, même chemin que le pompiste', async () => {
    const { T } = creerContexteResolution({ jaugeageActifSite: true, statutJour: null });
    T.setEnv({ quartActuel: 'matin', zoneActive: 'piste' });
    await T.resoudreJaugeageCarburant();
    const etat = T.lire();
    assert.strictEqual(etat.jaugeageCarburantActif, true, 'La condition est désormais la zone, pas le rôle : un manager en zone piste voit le bloc');
  });

  await testAsync('resoudreJaugeageCarburant : quart matin + zone boutique -> invisible, aucune lecture Supabase (ni station_config ni statut jour)', async () => {
    const { T, appelsStationConfig, appelsStatutJour } = creerContexteResolution({ jaugeageActifSite: true, statutJour: { statut: 'fait' } });
    T.setEnv({ quartActuel: 'matin', zoneActive: 'boutique' });
    await T.resoudreJaugeageCarburant();
    const etat = T.lire();
    assert.strictEqual(etat.jaugeageCarburantActif, false);
    assert.strictEqual(etat.statutJaugeageJour, null);
    assert.strictEqual(appelsStationConfig.length, 0, 'Zone boutique -> ne doit même pas interroger station_config, coût nul');
    assert.strictEqual(appelsStatutJour.length, 0);
  });

  await testAsync('resoudreJaugeageCarburant : quart soir + zone piste -> invisible même si le flag site est actif', async () => {
    const { T } = creerContexteResolution({ jaugeageActifSite: true, statutJour: null });
    T.setEnv({ quartActuel: 'soir', zoneActive: 'piste' });
    await T.resoudreJaugeageCarburant();
    assert.strictEqual(T.lire().jaugeageCarburantActif, false, 'Le jaugeage d\'ouverture n\'a de sens qu\'au Quart 1');
  });

  await testAsync('resoudreJaugeageCarburant : quart matin + zone piste + flag site inactif -> invisible, statut jamais interrogé', async () => {
    const { T, appelsStatutJour } = creerContexteResolution({ jaugeageActifSite: false, statutJour: { statut: 'fait' } });
    T.setEnv({ quartActuel: 'matin', zoneActive: 'piste' });
    await T.resoudreJaugeageCarburant();
    const etat = T.lire();
    assert.strictEqual(etat.jaugeageCarburantActif, false);
    assert.strictEqual(etat.statutJaugeageJour, null, 'Flag site inactif -> jamais interroger/afficher un statut du jour, même s\'il en existe un en base');
    assert.strictEqual(appelsStatutJour.length, 0);
  });

  console.log('\nTous les tests "Pont Jaugeage carburant Inventaire → Carburants" passent.');
})();
