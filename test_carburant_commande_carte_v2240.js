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
  assert.ok(out.includes('Fiabilité : Élevée'), 'fiabilité Élevée attendue : ' + out);
  assert.ok(out.includes('stock fiable'), 'raison de fiabilité attendue : ' + out);
  assert.ok(!out.includes('à confirmer'), 'aucune qualification "à confirmer" quand confiance=fiable : ' + out);
  assert.ok(out.includes('Moment idéal pour commander'), 'libellé de badge non altéré (Article 5) : ' + out);
  // GO confortable, absent de la recommandation -> raison explicite.
  assert.ok(out.includes('GO'), 'ligne GO attendue : ' + out);
  assert.ok(out.includes('autonomie suffisante'), 'raison "autonomie suffisante" pour GO confortable non inclus : ' + out);
  // Affichage minimal exigé par Frédéric (25/08/2026) : jaugeage d'ouverture
  // horodaté, stock estimé maintenant, ventes prévues jusqu'à livraison,
  // stock prévu avant livraison, capacité disponible — jamais confondus.
  assert.ok(out.includes('Jaugeage'), 'ligne jaugeage attendue : ' + out);
  assert.ok(out.includes(fmtL(12048)), 'jaugeage d\'ouverture affiché : ' + out);
  assert.ok(out.includes(`stock maintenant ${fmtL(11200)}`), 'stock estimé maintenant affiché, distinct du jaugeage brut : ' + out);
  assert.ok(out.includes(`Ventes prévues d'ici livraison ${fmtL(6448)}`), 'ventes prévues jusqu\'à livraison affichées : ' + out);
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
      },
    },
    optimisation: { decision: 'commander', motif: null, volumesRetenus: { sp95: 23170 } },
    commandeRecommandee: { volumes: { sp95: 23170 }, total: 23170 },
  };
  render(evaluation);
  const out = zone.innerHTML;
  assert.ok(out.includes('🟠 Commande probable — à confirmer'), 'badge orange dédié attendu (jamais un simple suffixe sur le rouge) : ' + out);
  assert.ok(!out.includes('Sécurité — commande urgente'), 'le libellé rouge alarmiste ne doit plus apparaître quand la confiance n\'est pas fiable : ' + out);
  assert.ok(out.includes('border-color:var(--amber)'), 'bordure de carte également basculée en orange (couleur ET libellé, jamais un correctif partiel) : ' + out);
  assert.ok(out.includes('Fiabilité : Moyenne'), 'fiabilité Moyenne attendue : ' + out);
  assert.ok(out.includes('ventes prévues encore incertaines'), 'raison de fiabilité Moyenne attendue : ' + out);
  assert.ok(out.includes('stock maintenant non calculable (quart en cours au jaugeage)'), 'stock maintenant non calculable affiché honnêtement, jamais un chiffre fabriqué (Article 5) : ' + out);
  ok('securite + confiance a_confirmer -> badge orange dédié "🟠 Commande probable — à confirmer" (couleur + libellé), fiabilité Moyenne, stock maintenant honnêtement non calculable si chevauchement (le calcul rouge/etatGlobal reste inchangé)');
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
  assert.ok(out.includes('échéance encore à 3 j'), 'raison "à anticiper" avec délai attendue : ' + out);
  ok('go a_anticiper (3 j) non inclus -> raison explicite avec échéance, pas de silence');
}

console.log(`\n${n}/${n} tests passés.`);
