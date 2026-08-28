// Test — v2.263 (28/08/2026, retour de Frédéric — "Oui, je confirme qu'il
// faut garder les deux mécanismes distincts [...] reliés fonctionnellement
// sans être fusionnés").
//
// 1) Le bandeau Verify doit préciser exactement le quart+date concerné
//    ("Quart 2 du 27 août") et son bouton doit ouvrir CE quart précis dans
//    Verify (ouvrir_date=2026-08-27&ouvrir_quart=2), jamais la page
//    d'accueil de Verify.
// 2) "À confirmer" doit toujours lister des causes précises et résolubles
//    (anomalie de jaugeage, écart stock, etc.) dans un bloc SÉPARÉ du
//    bandeau Verify, jamais fusionnés. Verify n'apparaît JAMAIS parmi les
//    causes de "à confirmer" (aucune donnée Verify n'est aujourd'hui
//    consommée par le moteur carburant).
// 3) "à confirmer" ne doit jamais être un état sans sortie : sous le badge,
//    "Commande : À CONFIRMER / N éléments à résoudre / → Écart GO de
//    −1 195 L à qualifier / → Écart SP95 de −1 476 L à qualifier".
//
// Fonctions extraites du vrai code (Article 11, jamais recopiées à la
// main) — mêmes conventions que test_carburant_commande_carte_v2240.js et
// test_carburant_commande_confiance_visible_nouveau_mois_v2262.js.

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

// ------------------------------------------------------------
// 1) resumerCausesConfirmationCommande — fonction pure
//    (nexus-carburant-commande-moteur.js)
// ------------------------------------------------------------
{
  const sandbox = { console };
  vm.createContext(sandbox);
  vm.runInContext(moteurCommandeSrc, sandbox);
  const M = sandbox.NexusCarburantCommandeMoteur;

  // Cas réel exact du mockup de Frédéric : GO -1195 L, SP95 -1476 L,
  // toutes deux anomalie_majeure avec écart connu -> les deux valeurs
  // exactes doivent ressortir, jamais un texte générique quand la donnée
  // chiffrée existe.
  const parCarburantDetails = {
    go: { detailConfiance: { niveau: 'a_confirmer', causes: ['anomalie_majeure'] }, ecartPhysiqueTheoriqueL: -1195 },
    sp95: { detailConfiance: { niveau: 'a_confirmer', causes: ['anomalie_majeure'] }, ecartPhysiqueTheoriqueL: -1476 },
    gnr: { detailConfiance: { niveau: 'fiable', causes: [] }, ecartPhysiqueTheoriqueL: null },
  };
  const res = M.resumerCausesConfirmationCommande(parCarburantDetails);
  assert.strictEqual(res.length, 2, 'seuls les carburants non fiables ressortent (GNR fiable exclu) : ' + JSON.stringify(res));
  const go = res.find(r => r.carburant === 'go');
  const sp95 = res.find(r => r.carburant === 'sp95');
  assert.ok(go && go.ecartL === -1195, 'écart GO exact transmis (-1195), jamais arrondi/fabriqué : ' + JSON.stringify(go));
  assert.ok(sp95 && sp95.ecartL === -1476, 'écart SP95 exact transmis (-1476) : ' + JSON.stringify(sp95));
  assert.strictEqual(go.cause, 'anomalie_majeure');
  assert.strictEqual(go.cible, 'verify_jour', 'cause anomalie_majeure -> cible verify_jour (Article 11, réutilise ACTIONS_FIABILITE)');

  // Cause SANS écart chiffré connu (ex. historique insuffisant) -> ecartL
  // reste null, jamais une valeur inventée (Article 5).
  const res2 = M.resumerCausesConfirmationCommande({
    gnr: { detailConfiance: { niveau: 'a_confirmer', causes: ['historique_fiable'] }, ecartPhysiqueTheoriqueL: null },
  });
  assert.strictEqual(res2.length, 1);
  assert.strictEqual(res2[0].ecartL, null, 'pas d\'écart connu pour cette cause -> ecartL null, jamais fabriqué : ' + JSON.stringify(res2[0]));
  assert.strictEqual(res2[0].libelle, 'Historique de ventes insuffisant');

  // Carburant non_calculable (pire niveau) -> ressort avec son niveau exact.
  const res3 = M.resumerCausesConfirmationCommande({
    go: { detailConfiance: { niveau: 'non_calculable', causes: ['stock_fiable'] }, ecartPhysiqueTheoriqueL: null },
  });
  assert.strictEqual(res3[0].niveau, 'non_calculable');

  // Robustesse : aucune entrée / objet vide -> tableau vide, jamais une
  // exception (Article 5). (Comparaison par longueur, pas deepStrictEqual :
  // le tableau vient d'un contexte vm distinct, réalité cross-realm sans
  // rapport avec la donnée elle-même.)
  assert.strictEqual(M.resumerCausesConfirmationCommande(null).length, 0);
  assert.strictEqual(M.resumerCausesConfirmationCommande({}).length, 0);

  ok('NexusCarburantCommandeMoteur.resumerCausesConfirmationCommande — reproduit exactement le mockup de Frédéric (GO -1195 L, SP95 -1476 L), écarts jamais fabriqués');
}

// ------------------------------------------------------------
// 2) renderCommandeCarburant — intégration écran (extraction du vrai code,
//    Article 11), avec le VRAI NexusCarburantCommandeMoteur chargé.
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

// ------------------------------------------------------------
// Scénario réel exact du mockup de Frédéric : GO -1195 L, SP95 -1476 L
// (anomalie_majeure avec écart connu pour les deux), Verify Q2 du 27/08
// non contrôlé.
// ------------------------------------------------------------
{
  const { zone, render } = construireRender();
  const evaluation = {
    ok: true, etatGlobal: 'securite', modeFinDeMois: false,
    dateISO: '2026-08-28',
    config: { cutoff_heure: '11:00' },
    parCarburant: {
      go: {
        carburant: 'go', etat: 'securite', confiance: 'a_confirmer', joursAvantBesoin: 0,
        jaugeageOuvertureL: 10496, jaugeageOuvertureLe: '2026-08-28T09:52:00.000Z',
        stockEstimeMaintenantL: 10496, stockFiable: true,
        scenarioMaintenant: { dateEffective: '2026-08-28', livraisonISO: '2026-08-29', margeJours: -0.8, ventesPrevuesL: 3000, stockPrevuLivraisonL: 2500, securiteL: 3000, margeL: -500 },
        attente: { motif: "Commander maintenant évite de passer sous la réserve de sécurité avant le prochain créneau de livraison." },
        detailConfiance: { niveau: 'a_confirmer', causes: ['anomalie_majeure'], raison: 'Écart physique/théorique confirmé.' },
      },
      sp95: {
        carburant: 'sp95', etat: 'securite', confiance: 'a_confirmer', joursAvantBesoin: 0,
        jaugeageOuvertureL: 8200, jaugeageOuvertureLe: '2026-08-28T09:52:00.000Z',
        stockEstimeMaintenantL: 8200, stockFiable: true,
        scenarioMaintenant: { dateEffective: '2026-08-28', livraisonISO: '2026-08-29', margeJours: -0.5, ventesPrevuesL: 2200, stockPrevuLivraisonL: 1800, securiteL: 2000, margeL: -200 },
        attente: { motif: "Marge insuffisante avant le prochain créneau." },
        detailConfiance: { niveau: 'a_confirmer', causes: ['anomalie_majeure'], raison: 'Écart physique/théorique confirmé.' },
      },
    },
    // Sortie réelle attendue de resumerCausesConfirmationCommande (v2.263) —
    // câblée directement ici comme le fait evaluerCommandeCarburantSite en
    // production (Article 11, aucun second calcul dans l'écran).
    causesAConfirmer: [
      { carburant: 'go', cause: 'anomalie_majeure', niveau: 'a_confirmer', libelle: 'Anomalie détectée (écart physique/théorique au-delà du seuil de tolérance)', cta: 'Ouvrir Verify →', cible: 'verify_jour', ecartL: -1195 },
      { carburant: 'sp95', cause: 'anomalie_majeure', niveau: 'a_confirmer', libelle: 'Anomalie détectée (écart physique/théorique au-delà du seuil de tolérance)', cta: 'Ouvrir Verify →', cible: 'verify_jour', ecartL: -1476 },
    ],
    // Avis Verify élargi (v2.263) — entrée avec date+quart précis, exemple
    // exact de Frédéric ("Quart 2 du 27/08 non contrôlé").
    avisVerifyJour: [
      { date: '2026-08-27', quart: 2, statut: { etat: 'aucun' } },
    ],
    optimisation: { decision: 'commander', motif: null, volumesRetenus: { go: 3000, sp95: 6000 } },
    commandeRecommandee: { volumes: { go: 3000, sp95: 6000 }, total: 9000 },
  };
  render(evaluation);
  const out = zone.innerHTML;

  // 1) Bloc "Commande : À CONFIRMER" — jamais un état sans sortie.
  assert.ok(out.includes('Commande : À CONFIRMER'), 'titre du bloc "à confirmer" attendu : ' + out);
  assert.ok(out.includes('2 éléments à résoudre'), 'compte exact des éléments à résoudre attendu : ' + out);
  // Note : le séparateur de milliers réel de toLocaleString('fr-FR') est
  // U+202F (espace fine insécable), jamais un espace ASCII ordinaire.
  assert.ok(out.includes(`Écart GO de -1 195 L à qualifier`), 'écart GO chiffré exact attendu (signe + valeur réelle, jamais un texte vague) : ' + out);
  assert.ok(out.includes(`Écart SP95 de -1 476 L à qualifier`), 'écart SP95 chiffré exact attendu : ' + out);

  // 2) Bandeau Verify — SÉPARÉ, quart+date précis, lien profond vers le
  // quart concerné (jamais la page d'accueil de Verify).
  assert.ok(out.includes('Verify : 1 contrôle en attente'), 'titre du bandeau Verify attendu, distinct du bloc "à confirmer" : ' + out);
  assert.ok(out.includes('Quart 2 du 27 août'), 'quart+date précis attendus (exemple exact de Frédéric) : ' + out);
  assert.ok(out.includes('NEXUS-Verify-v1.html?ouvrir_date=2026-08-27&ouvrir_quart=2'), 'lien profond vers CE quart précis attendu, jamais NEXUS-Verify-v1.html seul : ' + out);

  // 3) Séparation stricte : le mot "Verify" ne doit jamais apparaître DANS
  // le bloc "à confirmer" (principe explicite de Frédéric : Verify n'a
  // aujourd'hui aucun impact démontré sur le calcul carburant, donc jamais
  // une cause de "à confirmer").
  const debutConfirmer = out.indexOf('Commande : À CONFIRMER');
  const finConfirmer = out.indexOf('</div>\n        ', debutConfirmer + 200); // fin approximative du bloc (avant objectifHTML)
  const blocConfirmer = out.slice(debutConfirmer, out.indexOf('Verify :', debutConfirmer));
  assert.ok(!blocConfirmer.includes('Verify'), 'le bloc "à confirmer" ne doit jamais mentionner Verify (mécanismes reliés fonctionnellement, jamais fusionnés) : ' + blocConfirmer);

  ok('renderCommandeCarburant — scénario réel du mockup de Frédéric : "Commande : À CONFIRMER" (2 éléments, écarts GO/SP95 exacts) et "Verify : 1 contrôle en attente" (Quart 2 du 27 août, lien profond) restent deux blocs strictement séparés');
}

// ------------------------------------------------------------
// Cas sans anomalie carburant : Verify seul en attente -> AUCUN bloc "à
// confirmer" ne doit apparaître (Verify n'a aucun impact démontré sur le
// calcul carburant, donc n'y crée jamais artificiellement une cause).
// ------------------------------------------------------------
{
  const { zone, render } = construireRender();
  const evaluation = {
    ok: true, etatGlobal: 'moment_ideal', modeFinDeMois: false,
    dateISO: '2026-08-28',
    config: { cutoff_heure: '11:00' },
    parCarburant: {
      gnr: {
        carburant: 'gnr', etat: 'moment_ideal', confiance: 'fiable', joursAvantBesoin: 0,
        scenarioMaintenant: { dateEffective: '2026-08-28', livraisonISO: '2026-08-29', margeJours: 2 },
        attente: { motif: 'x' },
        detailConfiance: { niveau: 'fiable', causes: [], raison: null },
      },
    },
    causesAConfirmer: [],
    avisVerifyJour: [
      { date: '2026-08-27', quart: 1, statut: { etat: 'aucun' } },
    ],
    optimisation: { decision: 'commander', motif: null, volumesRetenus: { gnr: 5000 } },
    commandeRecommandee: { volumes: { gnr: 5000 }, total: 5000 },
  };
  render(evaluation);
  const out = zone.innerHTML;
  assert.ok(!out.includes('Commande : À CONFIRMER') && !out.includes('Commande : CALCUL SUSPENDU'), 'aucun bloc "à confirmer" quand tous les carburants sont fiables, même si Verify a un contrôle en attente : ' + out);
  assert.ok(out.includes('Verify : 1 contrôle en attente') && out.includes('Quart 1 du 27 août'), 'le bandeau Verify reste affiché indépendamment de la fiabilité carburant : ' + out);
  ok('renderCommandeCarburant — Verify seul en attente (carburant fiable) : aucune dépendance artificielle créée, "à confirmer" absent, bandeau Verify présent et indépendant');
}

console.log(`\n${n} tests passés.`);
