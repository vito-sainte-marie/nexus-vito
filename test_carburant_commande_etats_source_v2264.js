// Test — v2.264 (28/08/2026, retour de Frédéric — 7 règles de correction
// sur la carte "Commande" + priorité explicite sur le point 4).
//
// 1) Trois états mutuellement exclusifs (Confirmée / Proposition à
//    confirmer / Calcul impossible) — jamais "CALCUL SUSPENDU" en même
//    temps qu'une "Commande recommandée".
// 2) Une anomalie ne bloque la recommandation que si le carburant concerné
//    est réellement retenu dans la commande (GNR non évalué ne bloque plus
//    GO).
// 3) "Ouvrir Verify" seulement si un contrôle Verify identifié est
//    réellement pertinent, sinon "Qualifier l'écart".
// 4) Source de l'ancre affichée explicitement — cas réel exact signalé par
//    Frédéric : jaugeage du 28/08 05:52 (Dylan, terrain) vs 27/08 10:10
//    (manager, dernier avec mesure_le).
// 7) Chaque cause "à confirmer" porte désormais une action concrète.
//
// Fonctions extraites du vrai code (Article 11, jamais recopiées à la
// main) — mêmes conventions que les tests v2.262/v2.263.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const DIR = '/sessions/dazzling-compassionate-ride/mnt/image nexus project';
const html = fs.readFileSync(path.join(DIR, 'NEXUS-Carburants-Pilotage-v1.html'), 'utf8');
const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
const moteurCommandeSrc = fs.readFileSync(path.join(DIR, 'nexus-carburant-commande-moteur.js'), 'utf8');

let n = 0;
function ok(label) { n++; console.log('OK —', label); }

function chargerModule(sandbox, fichier) {
  const code = fs.readFileSync(path.join(DIR, fichier), 'utf8');
  vm.runInContext(code, sandbox);
}

// ------------------------------------------------------------
// PARTIE A — Moteur pur (nexus-carburant-commande-moteur.js)
// ------------------------------------------------------------
{
  const sandbox = { console };
  vm.createContext(sandbox);
  vm.runInContext(moteurCommandeSrc, sandbox);
  const M = sandbox.NexusCarburantCommandeMoteur;

  // --- Point 1 : etatConfirmationCommande, 3 états mutuellement exclusifs
  assert.strictEqual(M.etatConfirmationCommande({ commandeRecommandee: null, causesAConfirmer: [] }), 'confirmee', 'aucune cause -> confirmée, même sans commande (rien à confirmer)');
  assert.strictEqual(
    M.etatConfirmationCommande({ commandeRecommandee: { volumes: { go: 3000 } }, causesAConfirmer: [{ carburant: 'go' }] }),
    'proposition_a_confirmer',
    'des causes existent MAIS une commande réelle existe -> proposition à confirmer, jamais "calcul impossible"'
  );
  assert.strictEqual(
    M.etatConfirmationCommande({ commandeRecommandee: null, causesAConfirmer: [{ carburant: 'go' }] }),
    'calcul_impossible',
    'des causes existent ET aucune commande n\'a pu être établie -> calcul impossible'
  );
  assert.strictEqual(
    M.etatConfirmationCommande({ commandeRecommandee: { volumes: { go: 0, sp95: 0 } }, causesAConfirmer: [{ carburant: 'go' }] }),
    'calcul_impossible',
    'commandeRecommandee existe mais tous les volumes sont à 0 -> pas une "commande réelle", donc calcul impossible'
  );
  ok('NexusCarburantCommandeMoteur.etatConfirmationCommande — 3 états mutuellement exclusifs, jamais "calcul impossible" quand une commande réelle existe');

  // --- Point 2 : resumerCausesConfirmationCommande filtré aux carburants inclus
  const parCarburantDetails = {
    go: { detailConfiance: { niveau: 'a_confirmer', causes: ['anomalie_majeure'] }, ecartPhysiqueTheoriqueL: -1195 },
    gnr: { detailConfiance: { niveau: 'non_calculable', causes: ['stock_fiable'] }, ecartPhysiqueTheoriqueL: null },
  };
  // Sans filtre (comportement historique, ex. aucune commande établie) : GNR compte.
  const sansFiltre = M.resumerCausesConfirmationCommande(parCarburantDetails);
  assert.strictEqual(sansFiltre.length, 2, 'sans filtre, les 2 carburants non fiables comptent : ' + JSON.stringify(sansFiltre));
  // Avec filtre = seulement GO retenu dans la commande (cas réel de
  // Frédéric : "le GNR non évalué ne doit pas nécessairement bloquer une
  // commande GO") : GNR disparaît du résumé.
  const avecFiltre = M.resumerCausesConfirmationCommande(parCarburantDetails, ['go']);
  assert.strictEqual(avecFiltre.length, 1, 'avec filtre sur ["go"], GNR (non inclus dans la commande) ne doit plus compter : ' + JSON.stringify(avecFiltre));
  assert.strictEqual(avecFiltre[0].carburant, 'go');
  ok('NexusCarburantCommandeMoteur.resumerCausesConfirmationCommande — filtré aux carburants réellement inclus dans la commande (GNR non évalué ne bloque plus GO)');

  // --- Point 7 : chaque cause porte désormais une action concrète
  avecFiltre.forEach(c => {
    assert.ok(c.action && c.action.length > 0, `la cause "${c.cause}" doit porter une action concrète (point 7) : ${JSON.stringify(c)}`);
  });
  const resHistorique = M.resumerCausesConfirmationCommande({
    sp95: { detailConfiance: { niveau: 'a_confirmer', causes: ['historique_fiable'] }, ecartPhysiqueTheoriqueL: null },
  });
  assert.strictEqual(resHistorique[0].action, 'Laisser NEXUS accumuler quelques jours de ventes supplémentaires', 'action exacte attendue pour la cause "historique_fiable" : ' + JSON.stringify(resHistorique[0]));
  ok('NexusCarburantCommandeMoteur.resumerCausesConfirmationCommande — action concrète toujours présente (point 7)');
}

// ------------------------------------------------------------
// PARTIE B — Données (nexus-carburant-commande-donnees.js) :
// chargerStockEtFiabiliteParCarburant — source de l'ancre (point 4),
// reproduisant le cas réel exact signalé par Frédéric. NexusCarburantDonnees.
// chargerControleJour() est STUBBÉE directement (même discipline que
// test_carburant_commande_stock_maintenant_v2243.js), ses propres
// dépendances Supabase étant déjà couvertes ailleurs.
// ------------------------------------------------------------
const HORAIRES = { quart1: { normal: '06:00', fin_normal: '14:00' }, quart2: { normal: '14:00', fin_normal: '22:00' } };
const FUSEAU = 'UTC';

function creerClientAuditsCaisseVide() {
  return {
    from(table) {
      return {
        select() { return this; }, eq() { return this; }, gte() { return this; }, lt() { return this; },
        then(resolve) { return Promise.resolve({ data: [], error: null }).then(resolve); },
      };
    },
  };
}

(async () => {
  // --- Cas A : jaugeage saisi aujourd'hui (mesure_le présent, P0 corrigé) --
  {
    const sandbox = { console, window: undefined };
    vm.createContext(sandbox);
    sandbox.window = sandbox;
    chargerModule(sandbox, 'nexus-carburant-moteur.js');
    sandbox.NexusCarburantDonnees = {
      chargerControleJour: async () => ({
        aucunReleve: false,
        // Cas réel exact : Dylan, terrain, 28/08 05:52 (mesure_le désormais
        // renseigné depuis le correctif P0 de ce même lot).
        releveDuJour: { date: '2026-08-28', mesure_le: '2026-08-28T09:52:22.923Z', origine: 'terrain_pompiste' },
        dernierReleve: { date: '2026-08-27', mesure_le: '2026-08-27T14:10:49.514Z', origine: 'manager' },
        parCarburant: { go: { reelDuJour: 10496, dernierReel: 13250, statut: 'À corriger', ecart: -1195 } },
      }),
    };
    chargerModule(sandbox, 'nexus-carburant-commande-donnees.js');
    const Donnees = sandbox.NexusCarburantCommandeDonnees;
    const client = creerClientAuditsCaisseVide();
    const r = await Donnees.chargerStockEtFiabiliteParCarburant(client, 'vito-sainte-marie', '2026-08-28', HORAIRES, FUSEAU, '2026-08-28T12:00:00.000Z');

    assert.ok(r.sourceAncre, 'sourceAncre doit être exposé');
    assert.strictEqual(r.sourceAncre.utiliseAujourdhui, true, 'jaugeage du jour présent avec mesure_le -> ancré sur aujourd\'hui (P0 corrigé)');
    assert.strictEqual(r.sourceAncre.dateISO, '2026-08-28');
    assert.strictEqual(r.sourceAncre.mesureLe, '2026-08-28T09:52:22.923Z', 'doit porter le mesure_le RÉEL de Dylan (28/08 05:52 heure locale), jamais celui du 27/08');
    assert.strictEqual(r.sourceAncre.origine, 'terrain_pompiste');
    assert.strictEqual(r.sourceAncre.motif, null, 'aucun motif de repli quand le jaugeage du jour est utilisé normalement');
    ok('chargerStockEtFiabiliteParCarburant — Cas A (P0 corrigé) : sourceAncre pointe bien sur le jaugeage terrain du jour (28/08 05:52), jamais sur le 27/08');
  }

  // --- Cas B : AUCUN jaugeage aujourd'hui (reproduit le bug tel qu'il se
  // manifestait AVANT le correctif P0 — mesure_le absent du jour) : l'ancre
  // retombe honnêtement sur le dernier relevé connu, avec un motif explicite
  // (point 4 : "expliquer pourquoi").
  {
    const sandbox = { console, window: undefined };
    vm.createContext(sandbox);
    sandbox.window = sandbox;
    chargerModule(sandbox, 'nexus-carburant-moteur.js');
    sandbox.NexusCarburantDonnees = {
      chargerControleJour: async () => ({
        aucunReleve: false,
        releveDuJour: null, // aucune ligne pour aujourd'hui (ou mesure_le absent -> traité comme Cas B par chargerStockEtFiabiliteParCarburant)
        dernierReleve: { date: '2026-08-27', mesure_le: '2026-08-27T14:10:49.514Z', origine: 'manager' },
        parCarburant: { go: { dernierReel: 13250, ventesDepuis: 2754, statut: 'Sous contrôle', ecart: null } },
      }),
    };
    chargerModule(sandbox, 'nexus-carburant-commande-donnees.js');
    const Donnees = sandbox.NexusCarburantCommandeDonnees;
    const client = creerClientAuditsCaisseVide();
    const r = await Donnees.chargerStockEtFiabiliteParCarburant(client, 'vito-sainte-marie', '2026-08-28', HORAIRES, FUSEAU, '2026-08-28T12:00:00.000Z');

    assert.strictEqual(r.sourceAncre.utiliseAujourdhui, false, 'aucun jaugeage aujourd\'hui -> repli honnête, jamais un jaugeage fabriqué');
    assert.strictEqual(r.sourceAncre.dateISO, '2026-08-27');
    assert.strictEqual(r.sourceAncre.origine, 'manager');
    assert.ok(r.sourceAncre.motif && r.sourceAncre.motif.includes('2026-08-28') && r.sourceAncre.motif.includes('2026-08-27'), 'le motif doit citer explicitement la date sans jaugeage ET la date du relevé de repli utilisé : ' + r.sourceAncre.motif);
    ok('chargerStockEtFiabiliteParCarburant — Cas B : sourceAncre explique honnêtement le repli sur le dernier relevé connu (point 4)');
  }

  // ------------------------------------------------------------
  // PARTIE C — Écran (NEXUS-Carburants-Pilotage-v1.html) : rendu réel de
  // renderCommandeCarburant, avec le VRAI NexusCarburantCommandeMoteur.
  // ------------------------------------------------------------
  function extraire(source, nomFonction) {
    const debut = source.indexOf(`function ${nomFonction}(`);
    assert.ok(debut !== -1, `Fonction ${nomFonction} introuvable`);
    let i = source.indexOf('{', debut);
    let profondeur = 1, j = i + 1;
    while (profondeur > 0) {
      if (source[j] === '{') profondeur++;
      else if (source[j] === '}') profondeur--;
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
      if (source[j] === '{') profondeur++;
      else if (source[j] === '}') profondeur--;
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
      if (source[j] === '[') profondeur++;
      else if (source[j] === ']') profondeur--;
      j++;
    }
    return source.slice(debut, j) + ';';
  }

  const sandboxMoteur = { console };
  vm.createContext(sandboxMoteur);
  vm.runInContext(moteurCommandeSrc, sandboxMoteur);
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
    // 28/08/2026, v2.265 — renderCommandeCarburant appelle désormais ces 2
    // fonctions (diagnostic d'écart contextuel) : doivent être extraites
    // ici aussi, sinon ReferenceError dès qu'une cause 'anomalie_majeure'
    // existe.
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

  // --- Source de l'ancre affichée (point 4), Cas A -----------------------
  {
    const { zone, render } = construireRender();
    const evaluation = {
      ok: true, etatGlobal: 'moment_ideal', modeFinDeMois: false, dateISO: '2026-08-28',
      config: { cutoff_heure: '11:00' },
      parCarburant: {
        go: {
          carburant: 'go', etat: 'moment_ideal', confiance: 'fiable', joursAvantBesoin: 0,
          scenarioMaintenant: { dateEffective: '2026-08-28', livraisonISO: '2026-08-29', margeJours: 1.2 },
          attente: { motif: 'x' }, detailConfiance: { niveau: 'fiable', causes: [], raison: null },
        },
      },
      sourceAncreCommande: { utiliseAujourdhui: true, dateISO: '2026-08-28', mesureLe: '2026-08-28T09:52:00.000Z', origine: 'terrain_pompiste', motif: null },
      optimisation: { decision: 'commander', motif: null, volumesRetenus: { go: 3000 } },
      commandeRecommandee: { volumes: { go: 3000 }, total: 3000 },
    };
    render(evaluation);
    const out = zone.innerHTML;
    assert.ok(out.includes('Ancré sur le jaugeage du 28/08 à 05:52'), 'source de l\'ancre affichée avec date+heure réelles : ' + out);
    assert.ok(out.includes('saisie terrain'), 'origine du relevé affichée en clair : ' + out);
    ok('renderCommandeCarburant — source de l\'ancre affichée explicitement (Cas A, jaugeage du jour utilisé)');
  }

  // --- Source de l'ancre affichée (point 4), Cas B (repli) ---------------
  {
    const { zone, render } = construireRender();
    const evaluation = {
      ok: true, etatGlobal: 'moment_ideal', modeFinDeMois: false, dateISO: '2026-08-28',
      config: { cutoff_heure: '11:00' },
      parCarburant: {
        go: {
          carburant: 'go', etat: 'moment_ideal', confiance: 'fiable', joursAvantBesoin: 0,
          scenarioMaintenant: { dateEffective: '2026-08-28', livraisonISO: '2026-08-29', margeJours: 1.2 },
          attente: { motif: 'x' }, detailConfiance: { niveau: 'fiable', causes: [], raison: null },
        },
      },
      sourceAncreCommande: { utiliseAujourdhui: false, dateISO: '2026-08-27', mesureLe: '2026-08-27T14:10:49.000Z', origine: 'manager', motif: "Aucun jaugeage saisi le 2026-08-28 — dernier relevé fiable connu utilisé (2026-08-27)." },
      optimisation: { decision: 'commander', motif: null, volumesRetenus: { go: 3000 } },
      commandeRecommandee: { volumes: { go: 3000 }, total: 3000 },
    };
    render(evaluation);
    const out = zone.innerHTML;
    assert.ok(out.includes('Aucun jaugeage saisi aujourd\'hui'), 'avertissement explicite quand le jaugeage du jour manque : ' + out);
    assert.ok(out.includes('27/08 à 10:10'), 'date+heure du relevé de repli affichées : ' + out);
    assert.ok(out.includes('saisie manager'), 'origine du relevé de repli affichée en clair : ' + out);
    ok('renderCommandeCarburant — source de l\'ancre affichée explicitement (Cas B, repli honnête avec explication)');
  }

  // --- Point 3 : "Qualifier l'écart" quand aucun avis Verify pertinent ---
  {
    const { zone, render } = construireRender();
    const evaluation = {
      ok: true, etatGlobal: 'securite', modeFinDeMois: false, dateISO: '2026-08-28',
      config: { cutoff_heure: '11:00' },
      parCarburant: {
        go: {
          carburant: 'go', etat: 'securite', confiance: 'a_confirmer', joursAvantBesoin: 0,
          scenarioMaintenant: { dateEffective: '2026-08-28', livraisonISO: '2026-08-29', margeJours: -0.5 },
          attente: { motif: 'x' },
          detailConfiance: { niveau: 'a_confirmer', causes: ['anomalie_majeure'], raison: 'Écart confirmé.' },
        },
      },
      // Pas d'avisVerifyJour du tout -> aucun contrôle Verify identifié.
      causesAConfirmer: [{ carburant: 'go', cause: 'anomalie_majeure', niveau: 'a_confirmer', libelle: 'Anomalie détectée', action: 'Vérifier les écarts', cta: 'Ouvrir Verify →', cible: 'verify_jour', ecartL: -800 }],
      optimisation: { decision: 'commander', motif: null, volumesRetenus: { go: 3000 } },
      commandeRecommandee: { volumes: { go: 3000 }, total: 3000 },
    };
    render(evaluation);
    const out = zone.innerHTML;
    assert.ok(!out.includes('Ouvrir Verify'), 'aucun lien Verify proposé quand aucun contrôle identifié n\'est réellement pertinent : ' + out);
    assert.ok(out.includes('Qualifier l\'écart'), 'action Carburants native ("Qualifier l\'écart") proposée à la place : ' + out);
    ok('construireBlocFiabilite — "Ouvrir Verify" absent et remplacé par "Qualifier l\'écart" quand aucun avis Verify réel n\'existe (point 3)');
  }

  console.log(`\n${n} tests passés.`);
})();
