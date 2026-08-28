// Test — v2.262 (28/08/2026, retour de Frédéric sur une capture d'écran
// réelle du 31/08/2026) : deux corrections sur la carte "Commande de
// transition — fin de mois" / "Prochaine commande".
//
// 1) Erreur de logique métier : "Livraison prévue (nouveau mois) lundi 31
//    août" est faux — le 31 août est encore en août. Le suffixe "(nouveau
//    mois)" était câblé sur le RÉGIME de gestion (pont/approche fin de
//    mois), jamais sur une vraie comparaison de mois calendaires entre la
//    date de commande et la date de livraison — corrigé par la nouvelle
//    fonction pure NexusCarburantCommandeMoteur.livraisonChangeDeMois.
//
// 2) Contradiction visuelle signalée : un badge "à confirmer" affiché sans
//    aucune explication visible (le bloc fiabilité — raisons + lien Verify,
//    déjà construit en v2.260 — restait replié derrière "Voir les calculs").
//    Le détail s'ouvre désormais automatiquement dès qu'un carburant n'est
//    pas en confiance "fiable".
//
// Fonctions extraites du vrai code (Article 11, jamais recopiées à la main)
// — mêmes conventions que test_carburant_commande_carte_v2240.js et
// test_carburant_commande_regime_couverture_minimum_v2260.js.

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
// 1) livraisonChangeDeMois — fonction pure (nexus-carburant-commande-moteur.js)
// ------------------------------------------------------------
{
  const sandbox = { console };
  vm.createContext(sandbox);
  vm.runInContext(moteurCommandeSrc, sandbox);
  const M = sandbox.NexusCarburantCommandeMoteur;

  // Cas réel exact signalé par Frédéric : commande vendredi 28 août,
  // livraison lundi 31 août — les deux dates restent en août.
  assert.strictEqual(M.livraisonChangeDeMois('2026-08-28', '2026-08-31'), false, 'même mois (28->31 août) -> pas de changement de mois');
  // Cas où le changement de mois est réel (livraison début septembre).
  assert.strictEqual(M.livraisonChangeDeMois('2026-08-29', '2026-09-01'), true, 'mois différents (29 août -> 1er septembre) -> changement de mois réel');
  // Robustesse Article 5 : jamais une exception sur des dates manquantes.
  assert.strictEqual(M.livraisonChangeDeMois(null, '2026-09-01'), false, 'date de commande manquante -> false honnête, jamais une exception');
  assert.strictEqual(M.livraisonChangeDeMois('2026-08-28', null), false, 'date de livraison manquante -> false honnête, jamais une exception');
  ok('NexusCarburantCommandeMoteur.livraisonChangeDeMois — comparaison réelle de mois, reproduit exactement le cas signalé par Frédéric (28->31 août = même mois)');
}

// ------------------------------------------------------------
// 2) renderCommandeCarburant — intégration écran (extraction du vrai code,
//    Article 11), avec le VRAI NexusCarburantCommandeMoteur chargé (pas de
//    stub) pour vérifier le texte réellement affiché.
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

// NexusCarburantCommandeMoteur RÉEL, chargé une seule fois (vm), réutilisé
// tel quel dans le sandbox de renderCommandeCarburant ci-dessous — jamais
// un moteur simulé pour ce test d'intégration (contrairement à
// test_carburant_commande_carte_v2240.js qui teste volontairement le repli
// honnête SANS moteur ; ce fichier teste le cas normal, moteur chargé).
const sandboxMoteur = { console };
vm.createContext(sandboxMoteur);
vm.runInContext(moteurCommandeSrc, sandboxMoteur);
const MOTEUR_COMMANDE_REEL = sandboxMoteur.NexusCarburantCommandeMoteur;

const src = [
  extraireConst(script, 'COURT_CARBURANT'),
  extraireConst(script, 'ETAT_COMMANDE_STYLE'),
  extraire(script, 'fmtL'),
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
// Scénario réel exact de Frédéric (28/08/2026, capture d'écran) : GO en
// mode "Approche fin de mois", commande de transition vendredi 28 août,
// livraison lundi 31 août (même mois), jaugeage GO "à corriger" (écart
// -1195 L, exactement le cas réel vito-sainte-marie) -> badge "à
// confirmer", détail des calculs OUVERT PAR DÉFAUT (jamais replié quand il
// y a quelque chose à expliquer), raison précise + lien Verify visible sans
// clic, et AUCUN "(nouveau mois)" sur la date de livraison.
// ------------------------------------------------------------
{
  const { zone, render } = construireRender();
  const evaluation = {
    ok: true, etatGlobal: 'securite', modeFinDeMois: true,
    // dateISO : requis par construireBlocFiabilite pour construire le lien
    // Verify (NEXUS-Verify-v1.html?ouvrir_date=...) — toujours présent en
    // production (retour de evaluerCommandeCarburantSite), jamais omis ici.
    dateISO: '2026-08-28',
    config: { cutoff_heure: '11:00' },
    parCarburant: {
      go: {
        carburant: 'go', etat: 'securite', confiance: 'a_confirmer', joursAvantBesoin: 0,
        jaugeageOuvertureL: 10496, jaugeageOuvertureLe: '2026-08-28T09:52:00.000Z',
        stockEstimeMaintenantL: 10496, stockFiable: true,
        scenarioMaintenant: { dateEffective: '2026-08-28', livraisonISO: '2026-08-31', margeJours: -0.8, ventesPrevuesL: 3000, stockPrevuLivraisonL: 2500, securiteL: 3000, margeL: -500 },
        attente: { motif: "Commander maintenant évite de passer sous la réserve de sécurité avant le prochain créneau de livraison." },
        // Reproduit le cas réel : GO "à corriger" (écart physique/théorique
        // confirmé) -> anomalie_majeure, exactement comme
        // detailQualiteDonneesCommande le calcule (v2.259 point 15).
        detailConfiance: { niveau: 'a_confirmer', causes: ['anomalie_majeure'], raison: 'Une anomalie majeure détectée sur ce carburant (écart physique/théorique au-delà du seuil de tolérance) — jaugeage à vérifier avant de suivre cette recommandation.' },
      },
    },
    optimisation: { decision: 'commander', motif: null, volumesRetenus: { go: 3000 } },
    commandeRecommandee: { volumes: { go: 3000 }, total: 3000 },
    // 28/08/2026, v2.264, point 3 (retour de Frédéric) : le lien "Ouvrir
    // Verify" ne s'affiche désormais QUE lorsqu'un contrôle Verify identifié
    // est réellement pertinent (`avisVerifyJour` non vide) — ce test vérifie
    // justement ce lien, donc un avis réel doit être présent dans la
    // fixture, sinon la nouvelle règle (correcte) le remplacerait par
    // "Qualifier l'écart" et ce test testerait le mauvais scénario.
    avisVerifyJour: [{ date: '2026-08-27', quart: 1, statut: { etat: 'aucun' } }],
  };
  render(evaluation);
  const out = zone.innerHTML;

  // 1) Correctif "(nouveau mois)" — 28 et 31 août sont le même mois.
  assert.ok(out.includes('Livraison prévue (nouveau mois) lundi 31 août') === false, 'jamais "(nouveau mois)" quand la livraison reste dans le même mois que la commande : ' + out);
  assert.ok(out.includes('Livraison prévue lundi 31 août'), 'date de livraison exacte attendue (sans "nouveau mois") : ' + out);
  assert.ok(out.includes('Commande de transition vendredi 28 août avant 11:00'), 'date de commande de transition attendue (régime, inchangé) : ' + out);

  // 2) Fiabilité visible sans clic — détail auto-ouvert.
  assert.ok(out.includes('commande-plan-card open'), 'le détail "Voir les calculs" doit être ouvert par défaut quand un carburant n\'est pas fiable : ' + out);
  assert.ok(out.includes('🟠 À confirmer'), 'badge de fiabilité visible : ' + out);
  assert.ok(out.includes('Vérifier les écarts'), 'raison précise visible sans clic : ' + out);
  assert.ok(out.includes('Ouvrir Verify →') && out.includes('NEXUS-Verify-v1.html'), 'lien vers Verify visible sans clic (demande explicite de Frédéric) : ' + out);

  ok('renderCommandeCarburant — scénario réel exact de Frédéric (28/08, GO à corriger, livraison 31/08 même mois) : "(nouveau mois)" absent, fiabilité + lien Verify visibles sans clic sur "Voir les calculs"');
}

// ------------------------------------------------------------
// Cas où "(nouveau mois)" DOIT apparaître (livraison en septembre) — pour
// vérifier que le correctif ne supprime pas le libellé quand il est
// réellement justifié, seulement quand il ne l'est pas.
// ------------------------------------------------------------
{
  const { zone, render } = construireRender();
  const evaluation = {
    ok: true, etatGlobal: 'moment_ideal', modeFinDeMois: true,
    config: { cutoff_heure: '11:00' },
    parCarburant: {
      sp95: {
        carburant: 'sp95', etat: 'moment_ideal', confiance: 'fiable', joursAvantBesoin: 0,
        scenarioMaintenant: { dateEffective: '2026-08-29', livraisonISO: '2026-09-01', margeJours: 0.5 },
        attente: { motif: 'x' },
        detailConfiance: { niveau: 'fiable', causes: [], raison: null },
      },
    },
    optimisation: { decision: 'commander', motif: null, volumesRetenus: { sp95: 12000 } },
    commandeRecommandee: { volumes: { sp95: 12000 }, total: 12000 },
  };
  render(evaluation);
  const out = zone.innerHTML;
  assert.ok(out.includes('Livraison prévue (nouveau mois) mardi 1 sept.'), 'changement de mois réel (29 août -> 1er septembre) -> "(nouveau mois)" attendu : ' + out);
  // Tout est fiable ici -> le détail ne doit PAS s'ouvrir automatiquement
  // (comportement inchangé pour une recommandation sans réserve).
  assert.ok(!out.includes('commande-plan-card open'), 'aucune raison de forcer l\'ouverture du détail quand tout est fiable : ' + out);
  ok('renderCommandeCarburant — changement de mois réel (29 août -> 1er septembre) -> "(nouveau mois)" correctement affiché, détail replié par défaut (tout fiable)');
}

console.log(`\n${n} tests passés.`);
