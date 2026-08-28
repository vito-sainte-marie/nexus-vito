// Test — Carte "🚚 Prochaine commande" : cutoff/livraison, fiabilité,
// explication multi-produit, badge qualifié (25/08/2026, retour de Frédéric
// sur v2.239, cahier "NEXUS Carburants — moteur de recommandation", points
// 1/3/4/5). Extrait les fonctions réelles depuis
// NEXUS-Carburants-Pilotage-v1.html (jamais réécrites à la main) et vérifie
// la structure HTML produite par renderCommandeCarburant() pour les cas
// réels : commande sûre + fiable, commande "à confirmer" (données
// provisoires), et un carburant actif non inclus dans la recommandation.

const fs = require('fs');
const assert = require('assert');

const html = fs.readFileSync(__dirname + '/NEXUS-Carburants-Pilotage-v1.html', 'utf8');
const script = html.match(/<script>([\s\S]*)<\/script>/)[1];

function extraire(nomFonction) {
  const debut = script.indexOf(`function ${nomFonction}(`);
  assert.ok(debut !== -1, `Fonction ${nomFonction} introuvable dans NEXUS-Carburants-Pilotage-v1.html`);
  let i = script.indexOf('{', debut);
  let profondeur = 1, j = i + 1;
  while (profondeur > 0) {
    if (script[j] === '{') profondeur++;
    else if (script[j] === '}') profondeur--;
    j++;
  }
  return script.slice(debut, j);
}

function extraireConst(nomConst) {
  const debut = script.indexOf(`const ${nomConst} = {`);
  assert.ok(debut !== -1, `Constante ${nomConst} introuvable dans NEXUS-Carburants-Pilotage-v1.html`);
  let i = script.indexOf('{', debut);
  let profondeur = 1, j = i + 1;
  while (profondeur > 0) {
    if (script[j] === '{') profondeur++;
    else if (script[j] === '}') profondeur--;
    j++;
  }
  return script.slice(debut, j) + ';';
}

// Même principe qu'extraireConst mais pour un tableau littéral (ex.
// JOURS_SEMAINE_FR = [...]) — ajoutée ce lot (25/08/2026, dates avec jour
// de semaine), jamais recopiée à la main (Article 11).
function extraireConstTableau(nomConst) {
  const debut = script.indexOf(`const ${nomConst} = [`);
  assert.ok(debut !== -1, `Constante ${nomConst} introuvable dans NEXUS-Carburants-Pilotage-v1.html`);
  let i = script.indexOf('[', debut);
  let profondeur = 1, j = i + 1;
  while (profondeur > 0) {
    if (script[j] === '[') profondeur++;
    else if (script[j] === ']') profondeur--;
    j++;
  }
  return script.slice(debut, j) + ';';
}

const src = [
  extraireConst('COURT_CARBURANT'),
  extraireConst('ETAT_COMMANDE_STYLE'),
  extraire('fmtL'),
  extraire('formaterDateFrCourt'),
  // formaterDateFrAvecJour/formaterDateHeureFr (25/08/2026, retour de
  // Frédéric — "À commander mardi 25 août avant 11h" / jaugeage horodaté) :
  // ajoutées ce lot, renderCommandeCarburant() en dépend désormais.
  extraireConstTableau('JOURS_SEMAINE_FR'),
  extraire('formaterDateFrAvecJour'),
  'let FUSEAU_STATION = \'America/Martinique\';',
  extraire('formaterDateHeureFr'),
  // renderCommandeCarburant() lit CONTROLE_CTX (module-level, hors scope
  // ici) pour le "stock physique" affiché sur chaque ligne — non pertinent
  // pour les assertions de ce test (cutoff/livraison/fiabilité/explication),
  // laissé null comme le ferait un écran juste après changement de site.
  'let CONTROLE_CTX = null;',
  // formaterCouvertureEstimeeTexte / construireBlocFiabilite (28/08/2026,
  // refonte qualitative v2.260, points 2 et 4/6) : renderCommandeCarburant()
  // en dépend désormais pour la ligne "Couverture estimée : ..." et le bloc
  // fiabilité par carburant (🟢/🟠/🔴 + raisons/actions). extraireConst
  // pour NIVEAU_FIABILITE_BADGE, référencée en variable libre par
  // construireBlocFiabilite (Article 11, aucune copie manuelle des
  // libellés/emoji). NexusCarburantCommandeMoteur n'est volontairement PAS
  // simulé ici : construireBlocFiabilite se replie honnêtement sur
  // detailConfiance.raison quand ce moteur est absent (comme un écran
  // chargé avant nexus-carburant-commande-moteur.js), exactement le
  // comportement à vérifier.
  extraire('formaterCouvertureEstimeeTexte'),
  extraireConst('NIVEAU_FIABILITE_BADGE'),
  extraire('construireBlocFiabilite'),
  extraire('renderCommandeCarburant'),
  // ouvrirFicheCommande n'est référencée que dans la closure du listener de
  // clic (jamais appelée pendant le rendu lui-même) : inutile de l'extraire
  // pour ce test, JS ne résout les variables libres d'une closure qu'à
  // l'exécution, jamais à la définition.
  // fmtL également exposée (jamais une chaîne de test recopiée à la main
  // avec l'espace insécable fin de toLocaleString('fr-FR') — Article 11,
  // même formateur que l'écran, jamais un second recopié divergent).
  'globalThis.__test = { renderCommandeCarburant, fmtL };',
].join('\n\n');

const vm = require('vm');

// Fausse DOM minimale : une seule zone (`commandeCarburantZone`) dont on
// capture le innerHTML écrit par renderCommandeCarburant(). Pas besoin de
// jsdom (indisponible en sandbox, cf. tests carburant précédents) : seule
// l'écriture de innerHTML est utile ici, pas la lecture d'inputs.
function nouveauContexteDom() {
  const zone = { _html: '', set innerHTML(v) { this._html = v; }, get innerHTML() { return this._html; }, addEventListener() {} };
  const document = { getElementById: (id) => (id === 'commandeCarburantZone' ? zone : null) };
  const ctx = { globalThis: {}, console, document };
  ctx.globalThis = ctx;
  vm.runInNewContext(src, ctx);
  return { zone, render: ctx.__test.renderCommandeCarburant, fmtL: ctx.__test.fmtL };
}

let n = 0;
function ok(label) { n++; console.log('OK —', label); }

// ------------------------------------------------------------
// 1) Commande sûre + fiable (moment_ideal, confiance 'fiable') — cutoff,
//    date de livraison et fiabilité "Élevée" visibles ; badge SANS "à
//    confirmer" (rien n'est provisoire).
// ------------------------------------------------------------
{
  const { zone, render, fmtL } = nouveauContexteDom();
  const evaluation = {
    ok: true, etatGlobal: 'moment_ideal',
    config: { cutoff_heure: '11:00' },
    parCarburant: {
      sp95: {
        carburant: 'sp95', etat: 'moment_ideal', confiance: 'fiable', joursAvantBesoin: 0,
        // 25/08/2026 (retour Frédéric) — champs "stock estimé maintenant"
        // (task #189) et scénario complet (dateEffective, ventesPrevuesL,
        // stockPrevuLivraisonL) désormais lus par la carte.
        jaugeageOuvertureL: 12048, jaugeageOuvertureLe: '2026-08-24T05:12:00.000Z',
        stockEstimeMaintenantL: 11200, stockFiable: true,
        capaciteDisponibleL: 11761,
        scenarioMaintenant: { dateEffective: '2026-08-25', livraisonISO: '2026-08-26', margeJours: 0.5, ventesPrevuesL: 6448, stockPrevuLivraisonL: 5591 },
        attente: { motif: 'Commander maintenant évite de passer sous la réserve de sécurité avant le prochain créneau de livraison.' },
        // 28/08/2026 (refonte qualitative v2.260, point 4/6) — forme réelle
        // exposée par evaluerCarburant()/detailQualiteDonneesCommande sur
        // chaque évaluation (jamais fabriquée ici à la main pour le test,
        // Article 5 : même champ que celui réellement branché en
        // production).
        detailConfiance: { niveau: 'fiable', causes: ['stock_fiable'], raison: 'stock fiable' },
      },
      go: { carburant: 'go', etat: 'confortable', confiance: 'fiable', scenarioMaintenant: { dateEffective: '2026-08-25', livraisonISO: '2026-08-26' } },
    },
    optimisation: { decision: 'commander', motif: null, volumesRetenus: { sp95: 23170 } },
    commandeRecommandee: { volumes: { sp95: 23170 }, total: 23170 },
  };
  render(evaluation);
  const out = zone.innerHTML;
  // Date limite de commande et date de livraison SÉPARÉES, chacune avec son
  // jour de semaine en toutes lettres (25/08/2026, retour de Frédéric :
  // "À commander mardi 25 août avant 11h" / "Livraison prévue mercredi 26
  // août", jamais une ligne unique ambiguë).
  assert.ok(out.includes('À commander mardi 25 août avant 11:00'), 'date limite de commande avec jour attendue : ' + out);
  assert.ok(out.includes('Livraison prévue mercredi 26 août'), 'date de livraison avec jour attendue : ' + out);
  // 28/08/2026 (refonte qualitative v2.260, point 4/6) — l'ancien bloc
  // fiabilité unique "Fiabilité : Élevée" est remplacé par un badge PAR
  // CARBURANT "🟢 Confirmée" (jamais de raisons/actions affichées pour ce
  // niveau — "À confirmer"/"Calcul suspendu" seuls doivent en montrer,
  // citation exacte de Frédéric).
  assert.ok(out.includes('🟢 Confirmée'), 'badge fiabilité "🟢 Confirmée" attendu : ' + out);
  assert.ok(!out.includes('fiabilite-raisons'), 'niveau fiable -> aucun bloc de raisons/actions affiché : ' + out);
  assert.ok(!out.includes('à confirmer'), 'aucune qualification "à confirmer" quand confiance=fiable : ' + out);
  // Libellé mis à jour le 27/08/2026 (nouvelle règle de Frédéric §9-10) —
  // remplace l'ancien "Moment idéal pour commander" ; le CALCUL de l'état
  // (moment_ideal) reste inchangé, seul l'habillage texte change.
  assert.ok(out.includes('Commander aujourd\'hui'), 'libellé de badge à jour (27/08/2026, nouveau vocabulaire à 4 états) : ' + out);
  // GO confortable, absent de la recommandation -> raison explicite.
  assert.ok(out.includes('GO'), 'ligne GO attendue : ' + out);
  assert.ok(out.includes('autonomie suffisante'), 'raison "autonomie suffisante" pour GO confortable non inclus : ' + out);
  // Affichage minimal exigé par Frédéric (25/08/2026) : jaugeage d'ouverture
  // horodaté, stock estimé maintenant, ventes prévues jusqu'à livraison,
  // stock prévu avant livraison, capacité disponible — jamais confondus.
  assert.ok(out.includes('Jaugeage'), 'ligne jaugeage attendue : ' + out);
  assert.ok(out.includes(fmtL(12048)), 'jaugeage d\'ouverture affiché : ' + out);
  assert.ok(out.includes(`stock maintenant ${fmtL(11200)}`), 'stock estimé maintenant affiché, distinct du jaugeage brut : ' + out);
  // Libellé précisé le 27/08/2026 (retour de Frédéric — audit écran
  // Prochaine commande, point 1 : "les nombres ne racontent pas la même
  // chronologie") : "depuis le jaugeage" rend explicite que ces ventes
  // partent du jaugeage brut, jamais du "stock maintenant" affiché juste
  // au-dessus — le calcul lui-même reste inchangé (v2.255).
  assert.ok(out.includes(`Ventes prévues depuis le jaugeage jusqu'à livraison ${fmtL(6448)}`), 'ventes prévues jusqu\'à livraison (ancre jaugeage explicite) affichées : ' + out);
  assert.ok(out.includes('prévu avant livraison'), 'stock prévu avant livraison affiché : ' + out);
  assert.ok(out.includes(fmtL(5591)), 'stock prévu avant livraison (valeur) affiché : ' + out);
  assert.ok(out.includes(`capacité dispo. ${fmtL(11761)}`), 'capacité disponible à la livraison affichée séparément du volume recommandé : ' + out);
  ok('moment_ideal + confiance fiable -> cutoff/livraison avec jour, jaugeage/stock maintenant/ventes prévues/capacité, fiabilité Élevée, badge non qualifié, GO expliqué (confortable)');
}

// ------------------------------------------------------------
// 2) Sécurité (rouge) mais données encore provisoires (confiance
//    'a_confirmer') — bascule vers le badge ORANGE dédié "🟠 Commande
//    probable — à confirmer" (retour Frédéric du 25/08/2026 : le rouge
//    "Sécurité — commande urgente" reste trop alarmiste tant que la
//    fiabilité affichée est faible ; le rouge ne doit apparaître que
//    lorsque le risque est confirmé par des données fiables). Le calcul
//    lui-même (etatGlobal='securite') reste inchangé, jamais assoupli
//    (Article 5) — seul l'AFFICHAGE (couleur + libellé du badge, couleur de
//    bordure/bouton) bascule. Fiabilité "Moyenne".
// ------------------------------------------------------------
{
  const { zone, render } = nouveauContexteDom();
  const evaluation = {
    ok: true, etatGlobal: 'securite',
    config: { cutoff_heure: '11:00' },
    parCarburant: {
      sp95: {
        carburant: 'sp95', etat: 'securite', confiance: 'a_confirmer', joursAvantBesoin: 0,
        // Jaugeage pris EN COURS d'un quart (chevauchement, task #189/#191) —
        // stock estimé maintenant honnêtement non calculable, jamais un
        // chiffre fabriqué (Article 5).
        jaugeageOuvertureL: 9000, jaugeageOuvertureLe: '2026-08-25T07:00:00.000Z',
        stockEstimeMaintenantL: null, stockFiable: false,
        scenarioMaintenant: { dateEffective: '2026-08-25', livraisonISO: '2026-08-26', margeJours: -1.3 },
        attente: { motif: 'x' },
        // 28/08/2026 (refonte qualitative v2.260, point 4/6) — même forme
        // réelle que detailQualiteDonneesCommande ; NexusCarburantCommandeMoteur
        // n'étant pas chargé dans ce sandbox de test, construireBlocFiabilite
        // se replie honnêtement sur `raison` (Article 5, jamais un plantage ni
        // une action fabriquée sans le moteur pur pour la produire).
        detailConfiance: { niveau: 'a_confirmer', causes: ['prevision_incertaine'], raison: 'ventes prévues encore incertaines' },
      },
    },
    optimisation: { decision: 'commander', motif: null, volumesRetenus: { sp95: 23170 } },
    commandeRecommandee: { volumes: { sp95: 23170 }, total: 23170 },
  };
  render(evaluation);
  const out = zone.innerHTML;
  // Libellé mis à jour le 27/08/2026 (nouvelle règle de Frédéric §9-10) —
  // "Risque de rupture probable — à confirmer" remplace l'ancien "🟠
  // Commande probable — à confirmer" ; le comportement de downgrade
  // (orange tant que la confiance n'est pas fiable) reste inchangé.
  assert.ok(out.includes('Risque de rupture probable — à confirmer'), 'badge orange dédié attendu (jamais un simple suffixe sur le rouge) : ' + out);
  assert.ok(!out.includes('>Risque de rupture<'), 'le libellé rouge alarmiste ne doit plus apparaître quand la confiance n\'est pas fiable : ' + out);
  assert.ok(out.includes('border-color:var(--amber)'), 'bordure de carte également basculée en orange (couleur ET libellé, jamais un correctif partiel) : ' + out);
  // 28/08/2026 (refonte qualitative v2.260) — badge "🟠 À confirmer" + raison
  // précise TOUJOURS visible (citation exacte de Frédéric : "à confirmer" ne
  // s'affiche jamais seul).
  assert.ok(out.includes('🟠 À confirmer'), 'badge fiabilité "🟠 À confirmer" attendu : ' + out);
  assert.ok(out.includes('ventes prévues encore incertaines'), 'raison de fiabilité à confirmer attendue : ' + out);
  assert.ok(out.includes('stock maintenant non calculable (quart en cours au jaugeage)'), 'stock maintenant non calculable affiché honnêtement, jamais un chiffre fabriqué (Article 5) : ' + out);
  ok('securite + confiance a_confirmer -> badge orange dédié "Risque de rupture probable — à confirmer" (couleur + libellé), fiabilité Moyenne, stock maintenant honnêtement non calculable si chevauchement (le calcul rouge/etatGlobal reste inchangé)');
}

// ------------------------------------------------------------
// 3) Carburant actif "à anticiper" au-delà du seuil, non inclus -> raison
//    "échéance encore à N j" (retour Frédéric, point 3 : jamais un silence
//    sur un carburant actif absent de la recommandation).
// ------------------------------------------------------------
{
  const { zone, render } = nouveauContexteDom();
  const evaluation = {
    ok: true, etatGlobal: 'moment_ideal',
    config: { cutoff_heure: '11:00' },
    parCarburant: {
      sp95: {
        carburant: 'sp95', etat: 'moment_ideal', confiance: 'fiable', joursAvantBesoin: 0,
        scenarioMaintenant: { livraisonISO: '2026-08-26', margeJours: 0.5 },
        attente: { motif: 'x' },
      },
      go: {
        carburant: 'go', etat: 'a_anticiper', confiance: 'fiable', joursAvantBesoin: 3,
        scenarioMaintenant: { livraisonISO: '2026-08-26' },
      },
    },
    optimisation: { decision: 'commander', motif: null, volumesRetenus: { sp95: 23170 } },
    commandeRecommandee: { volumes: { sp95: 23170 }, total: 23170 },
  };
  render(evaluation);
  const out = zone.innerHTML;
  // Reformulation raccourcie (27/08/2026, retour de Frédéric — audit écran
  // Prochaine commande, point 3) : même information (délai avant échéance),
  // texte plus court.
  assert.ok(out.includes('échéance 3 j'), 'raison "à anticiper" avec délai attendue : ' + out);
  ok('go a_anticiper (3 j) non inclus -> raison explicite avec échéance, pas de silence');
}

// ------------------------------------------------------------
// 4) Lisibilité écran (27/08/2026, retour de Frédéric — audit complet de la
//    carte) : (a) un carburant non_calculable (ex. GNR sans historique
//    fiable) n'affiche JAMAIS un chiffre de prévision, même "0 L" — bug
//    réel signalé par Frédéric, un 0 littéral étant indiscernable d'une
//    vraie prévision nulle ; (b) securiteL/margeL/margeJours (déjà calculés
//    par le moteur, jamais un second calcul ici) sont exposés en chiffres
//    bruts ; (c) résumé niveau 1 "Commande recommandée : X L de Y" présent,
//    carburant à volume nul exclu.
// ------------------------------------------------------------
{
  const { zone, render, fmtL } = nouveauContexteDom();
  const evaluation = {
    ok: true, etatGlobal: 'securite',
    config: { cutoff_heure: '11:00' },
    parCarburant: {
      go: {
        carburant: 'go', etat: 'securite', confiance: 'fiable', joursAvantBesoin: 0,
        jaugeageOuvertureL: 13250, jaugeageOuvertureLe: '2026-08-27T10:15:00.000Z',
        stockEstimeMaintenantL: 10560, stockFiable: true,
        scenarioMaintenant: { dateEffective: '2026-08-28', livraisonISO: '2026-08-31', margeJours: -0.3, ventesPrevuesL: 11516, stockPrevuLivraisonL: 1734, securiteL: 2050, margeL: -316 },
        attente: { motif: 'x' },
      },
      sp95: {
        // Confortable : NE DOIT PAS apparaître dans le résumé "Commande
        // recommandée" (volume 0, filtré) mais reste expliqué en détail.
        carburant: 'sp95', etat: 'confortable', confiance: 'fiable',
        scenarioMaintenant: { dateEffective: '2026-08-28', livraisonISO: '2026-08-31' },
      },
      gnr: {
        // Historique GNR toujours à 0 (site sans vraie donnée) -> le moteur
        // calcule un total de ventes prévues littéralement 0, mais l'état
        // reste 'non_calculable' (stock non fiable). Reproduit le cas
        // signalé par Frédéric ("Ventes prévues d'ici livraison 0 L" à côté
        // de "GNR : non évalué").
        carburant: 'gnr', etat: 'non_calculable', confiance: 'non_calculable',
        scenarioMaintenant: { dateEffective: '2026-08-28', livraisonISO: '2026-08-31', ventesPrevuesL: 0, stockPrevuLivraisonL: null },
      },
    },
    optimisation: { decision: 'commander', motif: null, volumesRetenus: { go: 11000, sp95: 0 } },
    commandeRecommandee: { volumes: { go: 11000, sp95: 0 }, total: 11000 },
  };
  render(evaluation);
  const out = zone.innerHTML;
  assert.ok(out.includes(`Commande recommandée : ${fmtL(11000)} de GO`), 'résumé niveau 1, SP95 (0 L) exclu : ' + out);
  assert.ok(!out.includes(`${fmtL(11000)} de GO + `), 'jamais un carburant à volume nul dans le résumé : ' + out);
  assert.ok(out.includes('réserve de sécurité visée'), 'réserve de sécurité exposée en chiffre : ' + out);
  assert.ok(out.includes('marge après livraison') && out.includes(fmtL(-316)) && out.includes('-0.3 j'), 'marge après livraison (L et j) exposée : ' + out);
  assert.ok(out.includes('non évalué'), 'GNR toujours signalé non évalué : ' + out);
  assert.ok(out.includes('Prévision de consommation non disponible'), 'GNR : aucun chiffre de prévision affiché malgré ventesPrevuesL=0 en interne : ' + out);
  assert.ok(!/GNR[\s\S]{0,400}?Ventes prévues[\s\S]{0,20}?0 L/.test(out), 'GNR ne doit jamais afficher un "0 L" littéral pour une donnée en réalité indisponible : ' + out);
  assert.ok(out.includes('Distinct de l\'autonomie physique'), 'note de distinction autonomie physique / marge de sécurité présente : ' + out);
  ok('écran lisibilité (audit Frédéric 27/08) — GNR non_calculable sans "0 L" fabriqué, sécurité/marge exposées, résumé niveau 1 filtré, note de distinction autonomie/sécurité');
}

console.log(`\n${n}/${n} tests passés.`);
