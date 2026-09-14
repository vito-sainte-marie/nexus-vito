// Test — v2.265 (28/08/2026, retour de Frédéric — "Évolution demandée :
// validation des relevés et diagnostic des écarts carburant").
//
// 1) Rendre la validation des relevés explicite (bouton "Valider ce relevé
//    tel quel" sur NEXUS-Carburants-v1.html).
// 2+4) L'écart carburant déclenche un diagnostic contextuel respectant
//    l'ordre : relevé saisi -> validé ? -> Verify complet jusqu'au relevé ?
//    -> écart toujours présent ? -> investigation carburant.
// 3) Le ⓘ de la ligne "Écart" devient un point d'entrée actionnable.
// 5) Ce diagnostic est visible directement dans la carte "Prochaine
//    commande", pas seulement caché derrière "Voir les calculs".
// 6) La confiance de la commande suit ce même diagnostic (reste
//    "à confirmer" tant que relevé/Verify ne sont pas complets).
//
// Conventions déjà établies dans ce dépôt (Article 11, jamais recopiées à
// la main) : vm.createContext + chargement direct des vrais fichiers
// (mêmes techniques que test_carburant_commande_regime_couverture_minimum_v2260.js
// et test_carburant_commande_etats_source_v2264.js).

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const DIR = __dirname;
const html = fs.readFileSync(path.join(DIR, 'NEXUS-Carburants-Pilotage-v1.html'), 'utf8');
const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
const htmlManager = fs.readFileSync(path.join(DIR, 'NEXUS-Carburants-v1.html'), 'utf8');

let n = 0;
function ok(label) { n++; console.log('OK —', label); }

function chargerModule(sandbox, fichier) {
  const code = fs.readFileSync(path.join(DIR, fichier), 'utf8');
  vm.runInContext(code, sandbox);
}

// ------------------------------------------------------------
// PARTIE A — Moteur pur (nexus-carburant-moteur.js) :
// diagnostiquerEcartCarburant, les 5 cas et l'ORDRE exact demandé (point 4)
// — le statut de validation du relevé prime sur Verify (relevé non validé
// -> jamais "verify_incomplet" même si des contrôles manquent aussi).
// ------------------------------------------------------------
{
  const sandbox = { console };
  vm.createContext(sandbox);
  chargerModule(sandbox, 'nexus-carburant-moteur.js');
  const M = sandbox.NexusCarburantMoteur;
  assert.strictEqual(typeof M.diagnostiquerEcartCarburant, 'function', 'diagnostiquerEcartCarburant doit être exportée');

  assert.strictEqual(M.diagnostiquerEcartCarburant({ statut: null }).cas, 'donnees_insuffisantes');
  assert.strictEqual(M.diagnostiquerEcartCarburant({ statut: 'Données insuffisantes' }).cas, 'donnees_insuffisantes');
  assert.strictEqual(M.diagnostiquerEcartCarburant({ statut: 'Sous contrôle', releveValide: true }).cas, 'ecart_acceptable', 'écart dans la tolérance -> acceptable, jamais un diagnostic d\'anomalie');
  assert.strictEqual(M.diagnostiquerEcartCarburant({ statut: 'À surveiller', releveValide: false }).cas, 'ecart_acceptable', 'écart tolérable -> acceptable MÊME si le relevé n\'est pas validé (la validation ne concerne que les écarts significatifs)');

  // Ordre exact demandé par Frédéric : "Relevé saisi -> Relevé validé ? ->
  // Verify complet jusqu'au relevé ? -> ... -> Investigation". Le relevé
  // NON validé doit primer, même si Verify est ÉGALEMENT incomplet — le
  // manager doit d'abord valider avant que Verify soit même pertinent.
  const casNonValideEtVerifyIncomplet = M.diagnostiquerEcartCarburant({
    statut: 'À corriger', ecartL: -1195, releveValide: false,
    verifyManquants: [{ date: '2026-08-27', quart: '2' }],
  });
  assert.strictEqual(casNonValideEtVerifyIncomplet.cas, 'releve_non_valide', 'relevé non validé doit primer sur Verify incomplet (ordre exact du point 4) : ' + JSON.stringify(casNonValideEtVerifyIncomplet));
  assert.strictEqual(casNonValideEtVerifyIncomplet.ecartL, -1195);

  const casValideEtVerifyIncomplet = M.diagnostiquerEcartCarburant({
    statut: 'À corriger', ecartL: -1195, releveValide: true,
    verifyManquants: [{ date: '2026-08-27', quart: '2' }],
  });
  assert.strictEqual(casValideEtVerifyIncomplet.cas, 'verify_incomplet', 'relevé validé + Verify incomplet -> analyse incomplète : ' + JSON.stringify(casValideEtVerifyIncomplet));
  assert.strictEqual(casValideEtVerifyIncomplet.verifyManquants.length, 1);

  const casInvestiguer = M.diagnostiquerEcartCarburant({
    statut: 'À corriger', ecartL: -1195, releveValide: true, verifyManquants: [],
  });
  assert.strictEqual(casInvestiguer.cas, 'anomalie_a_investiguer', 'relevé validé + Verify complet + écart persistant -> investigation carburant (jamais un renvoi automatique vers Verify) : ' + JSON.stringify(casInvestiguer));

  ok('NexusCarburantMoteur.diagnostiquerEcartCarburant — 5 cas + ordre exact (validation du relevé prime sur Verify, point 4)');
}

// ------------------------------------------------------------
// PARTIE B — Moteur pur (nexus-carburant-commande-moteur.js) :
// resumerCausesConfirmationCommande consulte diagnosticEcart pour choisir
// une action CONTEXTUELLE (jamais le texte statique "Ouvrir Verify" pour
// une cause qui n'a rien à voir avec Verify).
// ------------------------------------------------------------
{
  const sandbox = { console };
  vm.createContext(sandbox);
  chargerModule(sandbox, 'nexus-carburant-commande-moteur.js');
  const M = sandbox.NexusCarburantCommandeMoteur;

  // --- releve_non_valide -> action "Valider le relevé", jamais "Ouvrir Verify"
  {
    const res = M.resumerCausesConfirmationCommande({
      go: {
        detailConfiance: { niveau: 'a_confirmer', causes: ['anomalie_majeure'] },
        ecartPhysiqueTheoriqueL: -1195,
        diagnosticEcart: { cas: 'releve_non_valide', niveau: 'attention', ecartL: -1195 },
      },
    });
    assert.strictEqual(res.length, 1);
    assert.strictEqual(res[0].cible, 'releve_jour');
    assert.ok(!res[0].cta.includes('Verify'), 'jamais de renvoi vers Verify quand la cause réelle est un relevé non validé : ' + JSON.stringify(res[0]));
    assert.ok(res[0].action.toLowerCase().includes('valider'), 'action attendue : valider le relevé : ' + JSON.stringify(res[0]));
  }

  // --- verify_incomplet -> action "Ouvrir Verify", cible verify_jour
  {
    const res = M.resumerCausesConfirmationCommande({
      go: {
        detailConfiance: { niveau: 'a_confirmer', causes: ['anomalie_majeure'] },
        ecartPhysiqueTheoriqueL: -1195,
        diagnosticEcart: { cas: 'verify_incomplet', niveau: 'attention', ecartL: -1195, verifyManquants: [{ date: '2026-08-27', quart: '2' }] },
      },
    });
    assert.strictEqual(res[0].cible, 'verify_jour');
    assert.strictEqual(res[0].cta, 'Ouvrir Verify →');
  }

  // --- anomalie_a_investiguer -> "Analyser les mouvements", jamais Verify
  {
    const res = M.resumerCausesConfirmationCommande({
      go: {
        detailConfiance: { niveau: 'a_confirmer', causes: ['anomalie_majeure'] },
        ecartPhysiqueTheoriqueL: -1195,
        diagnosticEcart: { cas: 'anomalie_a_investiguer', niveau: 'alerte', ecartL: -1195 },
      },
    });
    assert.strictEqual(res[0].cible, 'historique_mouvements');
    assert.ok(!res[0].cta.includes('Verify'), 'NEXUS ne doit jamais envoyer automatiquement vers Verify simplement parce qu\'il existe un écart (point 4) : ' + JSON.stringify(res[0]));
    assert.strictEqual(res[0].cta, 'Analyser les mouvements →');
  }

  // --- Robustesse : diagnosticEcart absent -> repli sur l'ancien texte
  // statique (ACTIONS_FIABILITE), jamais une exception (Article 5, anciens
  // appelants/tests qui ne le fournissent pas encore).
  {
    const res = M.resumerCausesConfirmationCommande({
      go: { detailConfiance: { niveau: 'a_confirmer', causes: ['anomalie_majeure'] }, ecartPhysiqueTheoriqueL: -800 },
    });
    assert.strictEqual(res[0].cta, 'Ouvrir Verify →', 'repli sur le comportement historique quand diagnosticEcart manque : ' + JSON.stringify(res[0]));
  }

  ok('NexusCarburantCommandeMoteur.resumerCausesConfirmationCommande — action contextuelle selon diagnosticEcart.cas, jamais "Ouvrir Verify" hors de propos (point 4), repli robuste si absent');
}

// ------------------------------------------------------------
// PARTIE C — Données (nexus-carburant-commande-donnees.js) :
// chargerStockEtFiabiliteParCarburant expose désormais `statut` brut par
// carburant (nécessaire au diagnostic), en plus de `anomalieMajeure`.
// ------------------------------------------------------------
const HORAIRES = { quart1: { normal: '06:00', fin_normal: '14:00' }, quart2: { normal: '14:00', fin_normal: '22:00' } };
const FUSEAU = 'UTC';
function creerClientAuditsCaisseVide() {
  return {
    from() {
      return {
        select() { return this; }, eq() { return this; }, gte() { return this; }, lt() { return this; },
        then(resolve) { return Promise.resolve({ data: [], error: null }).then(resolve); },
      };
    },
  };
}

(async () => {
  {
    const sandbox = { console, window: undefined };
    vm.createContext(sandbox);
    sandbox.window = sandbox;
    chargerModule(sandbox, 'nexus-carburant-moteur.js');
    sandbox.NexusCarburantDonnees = {
      chargerControleJour: async () => ({
        aucunReleve: false,
        releveDuJour: { date: '2026-08-28', mesure_le: '2026-08-28T09:52:22.923Z', origine: 'terrain_pompiste' },
        dernierReleve: { date: '2026-08-27', mesure_le: '2026-08-27T14:10:49.514Z', origine: 'manager' },
        parCarburant: { go: { reelDuJour: 10496, dernierReel: 13250, statut: 'À corriger', ecart: -1195 } },
      }),
    };
    chargerModule(sandbox, 'nexus-carburant-commande-donnees-core.js');
    const Donnees = sandbox.NexusCarburantCommandeDonnees;
    const r = await Donnees.chargerStockEtFiabiliteParCarburant(creerClientAuditsCaisseVide(), 'vito-sainte-marie', '2026-08-28', HORAIRES, FUSEAU, '2026-08-28T12:00:00.000Z');
    assert.strictEqual(r.parCarburant.go.statut, 'À corriger', 'statut brut désormais exposé (nécessaire au diagnostic d\'écart) : ' + JSON.stringify(r.parCarburant.go));
    ok('chargerStockEtFiabiliteParCarburant — expose le statut brut par carburant (Cas A), base du diagnostic d\'écart');
  }

  // ------------------------------------------------------------
  // PARTIE D — Données bout-en-bout : evaluerCommandeCarburantSite calcule
  // diagnosticEcart par carburant à partir de la validation RÉELLE du
  // relevé ancre + des avis Verify RÉELS jusqu'à cette date, reproduisant
  // le cas exact signalé par Frédéric.
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
        gte() { return chain; }, lt() { return chain; }, lte() { return chain; }, in() { return chain; },
        order() { return chain; }, limit() { return chain; },
        async maybeSingle() { return prochaine(table); },
        async single() { return prochaine(table); },
        then(resolve, reject) { return Promise.resolve(prochaine(table)).then(resolve, reject); },
      };
      return chain;
    }
    return {
      appels,
      from(table) {
        return { select() { return b(table, 'select'); }, insert(p) { return b(table, 'insert', p); }, update(p) { return b(table, 'update', p); } };
      },
    };
  }

  const CONFIG = { cutoff_heure: '11:00', jours_livraison_iso: [1, 2, 3, 4, 5], minimum_camion_litres: 3000, maximum_camion_litres: 36000, stock_securite_jours: 3 };
  const CUVES = {
    go: { actif: true, label: 'GO', cuves: [{ id: 'cuve1', capacite: 20020, limite_remplissage: 19019 }] },
    sp95: { actif: false, label: 'SP95', cuves: [{ id: 'unique', capacite: 30276, limite_remplissage: 28761 }] },
    gnr: { actif: false, label: 'GNR', cuves: [{ id: 'unique', capacite: 30000, limite_remplissage: 28500 }] },
  };

  function creerSandboxDonnees(fixtureControleJour) {
    const sandbox = { console, window: undefined };
    vm.createContext(sandbox);
    sandbox.window = sandbox;
    chargerModule(sandbox, 'nexus-carburant-moteur.js');
    chargerModule(sandbox, 'nexus-carburant-commande-moteur.js');
    chargerModule(sandbox, 'nexus-verify-moteur.js');
    // chargerControleJour stubbée (même discipline que Partie C et
    // test_carburant_commande_etats_source_v2264.js) : ses propres
    // dépendances Supabase (carburant_releves) sont déjà couvertes ailleurs
    // — ce test se concentre sur le NOUVEAU câblage diagnosticEcart.
    sandbox.NexusCarburantDonnees = { chargerControleJour: async () => fixtureControleJour };
    chargerModule(sandbox, 'nexus-carburant-commande-donnees-core.js');
    return sandbox.NexusCarburantCommandeDonnees;
  }

  // --- Scénario 1 : relevé du jour NON validé (origine terrain_pompiste) --
  {
    const Donnees = creerSandboxDonnees({
      aucunReleve: false,
      releveDuJour: { date: '2026-08-28', mesure_le: '2026-08-28T09:52:22.923Z', origine: 'terrain_pompiste' },
      dernierReleve: { date: '2026-08-27', mesure_le: '2026-08-27T14:10:49.514Z', origine: 'manager' },
      parCarburant: { go: { reelDuJour: 10496, dernierReel: 13250, statut: 'À corriger', ecart: -1195 } },
    });
    const client = creerClientMock({
      station_config: [{ data: { carburant_commande_config: CONFIG, cuves_carburants: CUVES, fuseau_horaire: 'UTC' }, error: null }],
      inventaire_calendrier_site: [{ data: [], error: null }],
      audits_caisse: [{ data: [], error: null }, { data: [], error: null }, { data: [], error: null }, { data: [], error: null }],
      carburant_commandes: [{ data: [], error: null }],
    });
    const r = await Donnees.evaluerCommandeCarburantSite(client, 'vito-sainte-marie', { timezone: 'UTC', dateISO: '2026-08-28', heureHHMM: '09:00' });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.parCarburant.go.diagnosticEcart.cas, 'releve_non_valide', 'relevé terrain non validé -> releve_non_valide, même si aucun avis Verify n\'existe par ailleurs : ' + JSON.stringify(r.parCarburant.go.diagnosticEcart));
    ok('evaluerCommandeCarburantSite — relevé ancre non validé (origine terrain_pompiste) -> diagnosticEcart releve_non_valide');
  }

  // --- Scénario 2 : relevé validé (origine manager) mais Verify incomplet
  // jusqu'à la date de l'ancre (Quart 2 du 27/08 non contrôlé, cas exact du
  // mockup de Frédéric).
  {
    const Donnees = creerSandboxDonnees({
      aucunReleve: false,
      releveDuJour: { date: '2026-08-28', mesure_le: '2026-08-28T09:52:22.923Z', origine: 'manager' },
      dernierReleve: { date: '2026-08-27', mesure_le: '2026-08-27T14:10:49.514Z', origine: 'manager' },
      parCarburant: { go: { reelDuJour: 10496, dernierReel: 13250, statut: 'À corriger', ecart: -1195 } },
    });
    const client = creerClientMock({
      station_config: [{ data: { carburant_commande_config: CONFIG, cuves_carburants: CUVES, fuseau_horaire: 'UTC' }, error: null }],
      inventaire_calendrier_site: [{ data: [], error: null }],
      audits_caisse: [
        { data: [], error: null }, // chargerHistoriqueVentesParJour
        { data: [], error: null }, // chargerHistoriqueVentesParQuart('1')
        { data: [], error: null }, // chargerHistoriqueVentesParQuart('2')
        { // chargerAvisVerifyJour : Quart 2 du 27/08 jamais touché
          data: [{ date: '2026-08-27', quart: '2', ecart_piste: 0, ecart_boutique: 0, valide_le_piste: null, valide_le_boutique: null, premiere_validation_le_piste: null, premiere_validation_le_boutique: null, valide_par_piste: null, valide_par_boutique: null }],
          error: null,
        },
      ],
      carburant_commandes: [{ data: [], error: null }],
    });
    const r = await Donnees.evaluerCommandeCarburantSite(client, 'vito-sainte-marie', { timezone: 'UTC', dateISO: '2026-08-28', heureHHMM: '09:00' });
    assert.strictEqual(r.parCarburant.go.diagnosticEcart.cas, 'verify_incomplet', 'relevé validé + Quart 2 du 27/08 non contrôlé -> verify_incomplet : ' + JSON.stringify(r.parCarburant.go.diagnosticEcart));
    assert.strictEqual(r.parCarburant.go.diagnosticEcart.verifyManquants[0].quart, '2');
    assert.strictEqual(r.parCarburant.go.diagnosticEcart.verifyManquants[0].date, '2026-08-27');
    ok('evaluerCommandeCarburantSite — relevé validé + Verify incomplet jusqu\'à l\'ancre -> diagnosticEcart verify_incomplet (Quart 2 du 27/08, cas réel de Frédéric)');
  }

  // --- Scénario 3 : relevé validé ET Verify complet -> anomalie à investiguer
  {
    const Donnees = creerSandboxDonnees({
      aucunReleve: false,
      releveDuJour: { date: '2026-08-28', mesure_le: '2026-08-28T09:52:22.923Z', origine: 'manager' },
      dernierReleve: { date: '2026-08-27', mesure_le: '2026-08-27T14:10:49.514Z', origine: 'manager' },
      parCarburant: { go: { reelDuJour: 10496, dernierReel: 13250, statut: 'À corriger', ecart: -1195 } },
    });
    const client = creerClientMock({
      station_config: [{ data: { carburant_commande_config: CONFIG, cuves_carburants: CUVES, fuseau_horaire: 'UTC' }, error: null }],
      inventaire_calendrier_site: [{ data: [], error: null }],
      audits_caisse: [
        { data: [], error: null }, { data: [], error: null }, { data: [], error: null },
        { // chargerAvisVerifyJour : tout validé -> aucun avis
          data: [{ date: '2026-08-27', quart: '2', ecart_piste: 0, ecart_boutique: 0, valide_le_piste: '2026-08-27T22:00:00Z', valide_le_boutique: '2026-08-27T22:00:00Z', premiere_validation_le_piste: '2026-08-27T22:00:00Z', premiere_validation_le_boutique: '2026-08-27T22:00:00Z', valide_par_piste: 'mgr1', valide_par_boutique: 'mgr1' }],
          error: null,
        },
      ],
      carburant_commandes: [{ data: [], error: null }],
    });
    const r = await Donnees.evaluerCommandeCarburantSite(client, 'vito-sainte-marie', { timezone: 'UTC', dateISO: '2026-08-28', heureHHMM: '09:00' });
    assert.strictEqual(r.parCarburant.go.diagnosticEcart.cas, 'anomalie_a_investiguer', 'relevé validé + Verify complet + écart persistant -> anomalie à investiguer : ' + JSON.stringify(r.parCarburant.go.diagnosticEcart));
    // Point 6 : la commande reste "à confirmer" (jamais confirmée
    // silencieusement) tant qu'un problème quelconque subsiste sur GO — ici
    // l'historique de ventes est également insuffisant dans ce mock (aucune
    // vente fournie), donc la cause de premier rang est 'historique_fiable',
    // pas 'anomalie_majeure' (précédence documentée dans
    // detailQualiteDonneesCommande, inchangée par ce lot) — ce test vérifie
    // seulement que GO n'est pas confirmé silencieusement, pas la cause
    // précise (déjà couverte par la Partie B ci-dessus, sur le moteur pur
    // isolé).
    assert.ok(r.causesAConfirmer.some(c => c.carburant === 'go'), 'GO doit rester "à confirmer" tant qu\'un problème (ici : historique insuffisant) subsiste, jamais confirmé silencieusement (point 6) : ' + JSON.stringify(r.causesAConfirmer));
    ok('evaluerCommandeCarburantSite — relevé validé + Verify complet + écart persistant -> diagnosticEcart anomalie_a_investiguer, commande reste à confirmer (point 6)');
  }

  // ------------------------------------------------------------
  // PARTIE E — Écran (NEXUS-Carburants-Pilotage-v1.html) : rendu réel de
  // renderCommandeCarburant avec le format multi-lignes détaillé (point 5)
  // et le lien contextuel correct selon le diagnostic.
  // ------------------------------------------------------------
  function extraire(source, nomFonction) {
    const debut = source.indexOf(`function ${nomFonction}(`);
    assert.ok(debut !== -1, `Fonction ${nomFonction} introuvable`);
    let i = source.indexOf('{', debut);
    let profondeur = 1, j = i + 1;
    while (profondeur > 0) {
      if (source[j] === '{') profondeur++; else if (source[j] === '}') profondeur--;
      j++;
    }
    return source.slice(debut, j);
  }
  function extraireConst(source, nomConst) {
    const debut = source.indexOf(`const ${nomConst} = {`);
    assert.ok(debut !== -1, `Constante ${nomConst} introuvable`);
    let i = source.indexOf('{', debut);
    let profondeur = 1, j = i + 1;
    while (profondeur > 0) {
      if (source[j] === '{') profondeur++; else if (source[j] === '}') profondeur--;
      j++;
    }
    return source.slice(debut, j) + ';';
  }
  function extraireConstTableau(source, nomConst) {
    const debut = source.indexOf(`const ${nomConst} = [`);
    assert.ok(debut !== -1, `Constante ${nomConst} introuvable`);
    let i = source.indexOf('[', debut);
    let profondeur = 1, j = i + 1;
    while (profondeur > 0) {
      if (source[j] === '[') profondeur++; else if (source[j] === ']') profondeur--;
      j++;
    }
    return source.slice(debut, j) + ';';
  }

  const sandboxMoteur = { console };
  vm.createContext(sandboxMoteur);
  vm.runInContext(fs.readFileSync(path.join(DIR, 'nexus-carburant-commande-moteur.js'), 'utf8'), sandboxMoteur);
  const MOTEUR_COMMANDE_REEL = sandboxMoteur.NexusCarburantCommandeMoteur;

  const src = [
    extraireConst(script, 'COURT_CARBURANT'),
    extraireConst(script, 'ETAT_COMMANDE_STYLE'),
    extraireConst(script, 'LIBELLE_ORIGINE_JAUGEAGE'),
    extraire(script, 'libelleOrigineJaugeage'),
    extraire(script, 'fmtL'),
    extraire(script, 'fmtEcartSigneTxt'),
    extraire(script, 'formaterDateFrCourt'),
    extraireConstTableau(script, 'JOURS_SEMAINE_FR'),
    extraire(script, 'formaterDateFrAvecJour'),
    'let FUSEAU_STATION = \'America/Martinique\';',
    extraire(script, 'formaterDateHeureFr'),
    'let CONTROLE_CTX = null;',
    extraire(script, 'formaterCouvertureEstimeeTexte'),
    extraireConst(script, 'NIVEAU_FIABILITE_BADGE'),
    extraire(script, 'construireBlocFiabilite'),
    'function todayISO() { return "2026-08-28"; }',
    extraire(script, 'construireLigneCauseAConfirmer'),
    extraire(script, 'construireLienActionDiagnostic'),
    extraire(script, 'renderCommandeCarburant'),
    'globalThis.__test = { renderCommandeCarburant, fmtL };',
  ].join('\n\n');

  function fabriquerZone() {
    return { _html: '', get innerHTML() { return this._html; }, set innerHTML(v) { this._html = v; }, addEventListener() {} };
  }
  function construireRender() {
    const zone = fabriquerZone();
    const document = { getElementById: (id) => (id === 'commandeCarburantZone' ? zone : null) };
    const ctx = { globalThis: {}, console, document, NexusCarburantCommandeMoteur: MOTEUR_COMMANDE_REEL };
    ctx.globalThis = ctx;
    vm.runInNewContext(src, ctx);
    return { zone, render: ctx.__test.renderCommandeCarburant };
  }

  // --- Verify incomplet -> "Analyse : données incomplètes" + "Compléter Verify" (Ouvrir Verify →), visible sans clic (point 5) ---
  {
    const { zone, render } = construireRender();
    const evaluation = {
      ok: true, etatGlobal: 'securite', modeFinDeMois: false, dateISO: '2026-08-28',
      config: { cutoff_heure: '11:00' },
      parCarburant: {
        go: {
          carburant: 'go', etat: 'securite', confiance: 'a_confirmer', joursAvantBesoin: 0,
          scenarioMaintenant: { dateEffective: '2026-08-28', livraisonISO: '2026-08-29', margeJours: -0.5 },
          attente: { motif: 'x' }, detailConfiance: { niveau: 'a_confirmer', causes: ['anomalie_majeure'], raison: 'Écart confirmé.' },
        },
      },
      causesAConfirmer: [{
        carburant: 'go', cause: 'anomalie_majeure', niveau: 'a_confirmer',
        libelle: 'Analyse incomplète', action: 'Compléter le(s) contrôle(s) Verify manquant(s) avant de qualifier cet écart',
        cta: 'Ouvrir Verify →', cible: 'verify_jour', ecartL: -1195,
        diagnosticEcart: { cas: 'verify_incomplet', niveau: 'attention', ecartL: -1195, verifyManquants: [{ date: '2026-08-27', quart: '2' }] },
      }],
      optimisation: { decision: 'commander', motif: null, volumesRetenus: { go: 3000 } },
      commandeRecommandee: { volumes: { go: 3000 }, total: 3000 },
    };
    render(evaluation);
    const out = zone.innerHTML;
    assert.ok(out.includes('Analyse : données incomplètes'), 'texte "Analyse : données incomplètes" visible directement, pas caché derrière Voir les calculs : ' + out);
    assert.ok(out.includes('Quart 2 du'), 'quart précis manquant affiché : ' + out);
    assert.ok(out.includes('Ouvrir Verify'), 'lien vers Verify proposé quand Verify est réellement la donnée manquante : ' + out);
    assert.ok(out.includes('ouvrir_date=2026-08-27') && out.includes('ouvrir_quart=2'), 'lien profond exact vers le quart manquant : ' + out);
    ok('renderCommandeCarburant — Verify incomplet : "Analyse : données incomplètes" + quart précis + lien Verify, visible sans clic (point 5)');
  }

  // --- Anomalie à investiguer -> "Verify : contrôles complets ✓" + "Analyser les mouvements →" (jamais Verify) ---
  {
    const { zone, render } = construireRender();
    const evaluation = {
      ok: true, etatGlobal: 'securite', modeFinDeMois: false, dateISO: '2026-08-28',
      config: { cutoff_heure: '11:00' },
      parCarburant: {
        go: {
          carburant: 'go', etat: 'securite', confiance: 'a_confirmer', joursAvantBesoin: 0,
          scenarioMaintenant: { dateEffective: '2026-08-28', livraisonISO: '2026-08-29', margeJours: -0.5 },
          attente: { motif: 'x' }, detailConfiance: { niveau: 'a_confirmer', causes: ['anomalie_majeure'], raison: 'Écart confirmé.' },
        },
      },
      causesAConfirmer: [{
        carburant: 'go', cause: 'anomalie_majeure', niveau: 'a_confirmer',
        libelle: 'Anomalie de litrage à investiguer', action: 'Analyser les mouvements carburant',
        cta: 'Analyser les mouvements →', cible: 'historique_mouvements', ecartL: -1195,
        diagnosticEcart: { cas: 'anomalie_a_investiguer', niveau: 'alerte', ecartL: -1195 },
      }],
      sourceAncreCommande: { utiliseAujourdhui: true, dateISO: '2026-08-28', mesureLe: '2026-08-28T09:52:00.000Z', origine: 'manager', motif: null },
      optimisation: { decision: 'commander', motif: null, volumesRetenus: { go: 3000 } },
      commandeRecommandee: { volumes: { go: 3000 }, total: 3000 },
    };
    render(evaluation);
    const out = zone.innerHTML;
    assert.ok(out.includes('Verify : contrôles complets'), 'confirme que Verify est complet avant de parler d\'anomalie : ' + out);
    assert.ok(out.includes('Écart toujours inexpliqué'), out);
    assert.ok(out.includes('Analyser les mouvements'), 'lien vers l\'historique des mouvements, jamais vers Verify (point 4) : ' + out);
    assert.ok(out.includes('data-ouvrir-historique'), 'lien construit via le mécanisme délégué ouvrirHistoriqueEtCentrer, jamais un second écran : ' + out);
    assert.ok(!out.includes('Ouvrir Verify'), 'aucun lien Verify quand la cause réelle est une anomalie de litrage confirmée (Verify déjà complet) : ' + out);
    ok('renderCommandeCarburant — anomalie à investiguer : "Verify : contrôles complets ✓" + "Analyser les mouvements →", jamais un renvoi vers Verify');
  }

  // ------------------------------------------------------------
  // PARTIE F — Écran manager (NEXUS-Carburants-v1.html) : point 1, présence
  // structurelle du bouton "Valider ce relevé tel quel" gardé par
  // `origine === 'terrain_pompiste'`, et de la fonction validerReleveTelQuel
  // qui n'écrase jamais mesure_le (Article 5).
  // ------------------------------------------------------------
  {
    assert.ok(htmlManager.includes("btnValiderTelQuel"), 'le bouton "Valider ce relevé tel quel" doit exister');
    assert.ok(htmlManager.includes("RELEVE_CIBLE.origine === 'terrain_pompiste'") && htmlManager.includes('boutonValiderHTML'), 'le bouton ne doit apparaître QUE sur un relevé terrain non encore validé');
    assert.ok(htmlManager.includes('async function validerReleveTelQuel()'), 'la fonction de validation doit exister');
    const corpsValidation = htmlManager.slice(htmlManager.indexOf('async function validerReleveTelQuel()'), htmlManager.indexOf('async function validerReleveTelQuel()') + 3000);
    assert.ok(corpsValidation.includes('mesure_le: RELEVE_CIBLE.mesure_le'), 'la validation ne doit JAMAIS réécrire mesure_le (l\'instant réel de la mesure physique reste celui de la saisie terrain, Article 5) : ' + corpsValidation.slice(0, 400));
    assert.ok(corpsValidation.includes("type_version: 'correction_manager'") && corpsValidation.includes('MOTIF_VALIDATION'), 'doit poser une version de preuve avec un motif système honnête (contrainte réelle Supabase carburant_releve_versions_motif_correction_check vérifiée le 28/08/2026)');
    ok('NEXUS-Carburants-v1.html — bouton "Valider ce relevé tel quel" gardé par origine terrain non validée, ne réécrit jamais mesure_le (point 1)');
  }

  console.log(`\n${n} tests passés.`);
})();
