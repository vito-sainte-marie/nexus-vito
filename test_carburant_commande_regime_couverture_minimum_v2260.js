// Test — v2.260 (28/08/2026, retour de Frédéric : "je les intégrerais
// maintenant comme des règles métier structurantes, pas comme de simples
// retouches d'interface").
//
// Couvre 3 des sujets de ce lot :
//  1) determinerRegimeGestion — badge de régime (4 états, précédence
//     PONT_DE_FIN_DE_MOIS > APPROCHE_FIN_DE_MOIS > WEEKEND_FERIE_A_COUVRIR
//     > MODE_NORMAL, confirmée par Frédéric : "Pont de fin de mois toujours
//     prioritaire").
//  2) estimerCouvertureParQuart — projection quart par quart de la
//     couverture (remplace le langage décimal "4,3 j" dans la vue
//     principale par "Couverture estimée : jour Qn").
//  3) Le branchement donnees (evaluerCommandeCarburantSite expose
//     couvertureEstimeeParQuart par carburant) + la correction globale du
//     minimum camion 10 000 -> 3 000 L (valeur réelle désormais en base,
//     vérifiée ici via le pass-through de chargerConfigEtCuves).

const path = require('path');
const vm = require('vm');
const fs = require('fs');
const assert = require('assert');

const PROJET = __dirname;
function charger(sandbox, fichier) {
  const code = fs.readFileSync(path.join(PROJET, fichier), 'utf8');
  vm.runInContext(code, sandbox);
}
let n = 0;
function ok(label) { n++; console.log('OK —', label); }

const sandbox = { console };
vm.createContext(sandbox);
charger(sandbox, 'nexus-carburant-moteur.js');
charger(sandbox, 'nexus-carburant-commande-moteur.js');
const M = sandbox.NexusCarburantCommandeMoteur;

// ------------------------------------------------------------
// 1) determinerRegimeGestion — les 4 états + la précédence exacte.
// ------------------------------------------------------------
{
  const r = M.determinerRegimeGestion({
    modeFinDeMois: false,
    scenarioMaintenant: { pontDeMois: true, dateEffective: '2026-08-31', livraisonISO: '2026-09-01' },
  });
  assert.strictEqual(r.cle, 'PONT_DE_FIN_DE_MOIS');
  assert.strictEqual(r.libelle, 'PONT DE FIN DE MOIS');
  assert.ok(r.objectif.startsWith('Objectif :'));
  ok('determinerRegimeGestion — pont de mois détecté -> PONT_DE_FIN_DE_MOIS, libellé exact "PONT DE FIN DE MOIS"');
}
{
  const r = M.determinerRegimeGestion({
    modeFinDeMois: true,
    scenarioMaintenant: { pontDeMois: false, dateEffective: '2026-08-27', livraisonISO: '2026-08-28' },
  });
  assert.strictEqual(r.cle, 'APPROCHE_FIN_DE_MOIS');
  assert.strictEqual(r.libelle, 'APPROCHE FIN DE MOIS');
  ok('determinerRegimeGestion — fin de mois sans franchissement -> APPROCHE_FIN_DE_MOIS');
}
{
  // Vendredi -> lundi (même fait calendaire que les autres tests du
  // projet) : au moins un jour non livrable s'intercale, hors fin de mois.
  const r = M.determinerRegimeGestion({
    modeFinDeMois: false,
    scenarioMaintenant: { pontDeMois: false, dateEffective: '2026-08-21', livraisonISO: '2026-08-24' },
  });
  assert.strictEqual(r.cle, 'WEEKEND_FERIE_A_COUVRIR');
  assert.strictEqual(r.libelle, 'WEEK-END / FÉRIÉ À COUVRIR');
  ok('determinerRegimeGestion — vendredi->lundi (week-end) hors fin de mois -> WEEKEND_FERIE_A_COUVRIR');
}
{
  const r = M.determinerRegimeGestion({
    modeFinDeMois: false,
    scenarioMaintenant: { pontDeMois: false, dateEffective: '2026-08-24', livraisonISO: '2026-08-25' },
  });
  assert.strictEqual(r.cle, 'MODE_NORMAL');
  assert.strictEqual(r.libelle, 'MODE NORMAL');
  ok('determinerRegimeGestion — livraison le lendemain, hors fin de mois -> MODE_NORMAL');
}
{
  // Précédence explicite de Frédéric (28/08/2026) : le pont de mois
  // l'emporte même si un week-end se superpose ET que modeFinDeMois est
  // vrai en même temps — le badge ne doit jamais refléter que le régime le
  // plus englobant.
  const r = M.determinerRegimeGestion({
    modeFinDeMois: true,
    scenarioMaintenant: { pontDeMois: true, dateEffective: '2026-08-28', livraisonISO: '2026-08-31' },
  });
  assert.strictEqual(r.cle, 'PONT_DE_FIN_DE_MOIS', 'le pont de mois doit toujours l\'emporter, même combiné à modeFinDeMois et à un écart calendaire > 1 jour');
  ok('determinerRegimeGestion — précédence : pont de mois toujours prioritaire sur les 3 autres régimes combinés');
}

// ------------------------------------------------------------
// 2) estimerCouvertureParQuart — projection jour par jour, quart par
//    quart, à partir d'un historique constant (isole la logique de
//    projection des aléas de la prévision elle-même — même discipline que
//    historiqueConstant() dans test_carburant_commande_moteur_v2238.js).
// ------------------------------------------------------------
function historiqueQuartConstant(carburant, valeurParJour, debutISO, finISOExclu) {
  const lignes = [];
  let cursor = debutISO;
  while (cursor < finISOExclu) {
    lignes.push({ date: cursor, ventes: { [carburant]: valeurParJour } });
    cursor = M.ajouterJoursISO(cursor, 1);
  }
  return lignes;
}
// Q1 constant 1000 L/j, Q2 constant 800 L/j, sur une fenêtre large (les
// deux mois précédents) pour obtenir une confiance 'fiable' (même seuil de
// points que le reste du moteur, Article 11 — aucune règle de confiance
// dupliquée ici).
const Q1_GO = historiqueQuartConstant('go', 1000, '2026-06-01', '2026-08-27');
const Q2_GO = historiqueQuartConstant('go', 800, '2026-06-01', '2026-08-27');

{
  // Stock 5 400 L : jour0 Q1(-1000=4400) Q2(-800=3600), jour1 Q1(-1000=2600)
  // Q2(-800=1800), jour2 Q1(-1000=800) Q2(-800=0, pas encore négatif ->
  // dernier quart couvert), jour3 Q1(-1000=-200 < 0) -> arrêt. Dernier
  // quart entièrement couvert : jour2 (2026-08-29) Q2.
  const r = M.estimerCouvertureParQuart({
    stockDisponibleL: 5400, dateDebutISO: '2026-08-27', quartDepart: 'Q1',
    historiqueQuart1: Q1_GO, historiqueQuart2: Q2_GO, carburant: 'go', joursFeriesISO: [],
  });
  assert.strictEqual(r.dateISO, '2026-08-29');
  assert.strictEqual(r.quart, 'Q2');
  assert.strictEqual(r.epuise, false);
  assert.strictEqual(r.auDela, false);
  assert.strictEqual(r.confiance, 'fiable');
  ok('estimerCouvertureParQuart — projection jour par jour/quart par quart, dernier quart entièrement couvert identifié précisément (§ "Couverture estimée : mardi Q2")');
}
{
  // quartDepart='Q2' : le Q1 du jour de départ est déjà clôturé, jamais
  // évalué une seconde fois (l'appelant l'a déjà déterminé via l'heure
  // courante — cette fonction ne fait que projeter à partir de là).
  const r = M.estimerCouvertureParQuart({
    stockDisponibleL: 800, dateDebutISO: '2026-08-27', quartDepart: 'Q2',
    historiqueQuart1: Q1_GO, historiqueQuart2: Q2_GO, carburant: 'go', joursFeriesISO: [],
  });
  assert.strictEqual(r.dateISO, '2026-08-27');
  assert.strictEqual(r.quart, 'Q2', 'le Q1 du jour de départ ne doit jamais être compté quand quartDepart=Q2');
  assert.strictEqual(r.epuise, false);
  ok('estimerCouvertureParQuart — quartDepart=Q2 ignore le Q1 déjà clôturé du jour de départ');
}
{
  // Stock déjà à 0 (ou négatif) -> épuisé dès le départ, jamais une
  // couverture positive fabriquée.
  const r = M.estimerCouvertureParQuart({
    stockDisponibleL: 0, dateDebutISO: '2026-08-27', quartDepart: 'Q1',
    historiqueQuart1: Q1_GO, historiqueQuart2: Q2_GO, carburant: 'go', joursFeriesISO: [],
  });
  assert.strictEqual(r.epuise, true);
  assert.strictEqual(r.quart, null);
  ok('estimerCouvertureParQuart — stock déjà à 0 -> epuise=true dès le départ, jamais un quart positif fabriqué');
}
{
  // Stock très largement suffisant -> au-delà de l'horizon de recherche
  // (21 jours), jamais une date plus lointaine inventée (Article 5).
  const r = M.estimerCouvertureParQuart({
    stockDisponibleL: 5000000, dateDebutISO: '2026-08-27', quartDepart: 'Q1',
    historiqueQuart1: Q1_GO, historiqueQuart2: Q2_GO, carburant: 'go', joursFeriesISO: [],
  });
  assert.strictEqual(r.auDela, true);
  assert.strictEqual(r.epuise, false);
  ok('estimerCouvertureParQuart — stock couvrant au-delà de 21 j -> auDela=true, jamais un horizon plus lointain inventé');
}
{
  // Aucun historique du tout -> non_calculable, jamais un chiffre fabriqué.
  const r = M.estimerCouvertureParQuart({
    stockDisponibleL: 5000, dateDebutISO: '2026-08-27', quartDepart: 'Q1',
    historiqueQuart1: [], historiqueQuart2: [], carburant: 'go', joursFeriesISO: [],
  });
  assert.strictEqual(r.confiance, 'non_calculable');
  assert.strictEqual(r.dateISO, null);
  ok('estimerCouvertureParQuart — aucun historique par quart -> non_calculable, jamais une couverture inventée');
}
{
  // Entrée incomplète (pas de stock connu) -> jamais une exception.
  assert.doesNotThrow(() => M.estimerCouvertureParQuart({ stockDisponibleL: null, dateDebutISO: '2026-08-27', quartDepart: 'Q1' }));
  const r = M.estimerCouvertureParQuart({ stockDisponibleL: null, dateDebutISO: '2026-08-27', quartDepart: 'Q1' });
  assert.strictEqual(r.confiance, 'non_calculable');
  ok('estimerCouvertureParQuart — stock inconnu -> jamais une exception, réponse honnête non_calculable');
}

// ------------------------------------------------------------
// 3) Fiabilité 3 niveaux — "'À confirmer' doit toujours être accompagné de
//    la ou des raisons précises [...] ainsi que de l'action ou des actions
//    permettant de la résoudre" (28/08/2026, retour de Frédéric). Vérifie
//    que `detailQualiteDonneesCommande` porte désormais `causes` (version
//    machine de `raison`) et que `actionsResolutionFiabilite` retourne
//    TOUJOURS au moins une action dès que le niveau n'est pas 'fiable'.
// ------------------------------------------------------------
{
  const r = M.detailQualiteDonneesCommande({ stockFiable: true, previsionConfiance: 'fiable' });
  assert.strictEqual(r.niveau, 'fiable');
  assert.deepStrictEqual(Array.from(r.causes), []);
  assert.deepStrictEqual(Array.from(M.actionsResolutionFiabilite(r)), [], 'niveau fiable -> aucune action à afficher (le badge 🟢 Confirmée suffit)');
  ok('actionsResolutionFiabilite — niveau fiable -> aucune action (jamais un bloc de résolution superflu)');
}
{
  const r = M.detailQualiteDonneesCommande({ stockFiable: false, previsionConfiance: 'fiable' });
  assert.strictEqual(r.niveau, 'non_calculable');
  assert.deepStrictEqual(Array.from(r.causes), ['stock_fiable']);
  const actions = M.actionsResolutionFiabilite(r);
  assert.strictEqual(actions.length, 1);
  assert.ok(actions[0].action, 'chaque action doit porter une instruction concrète, jamais un libellé vide');
  ok('actionsResolutionFiabilite — stock non fiable -> 1 action concrète (jamais 0)');
}
{
  // Cas explicite de Frédéric : jaugeage incohérent (anomalie majeure) ->
  // action "Vérifier les écarts" avec CTA "Ouvrir Verify →" vers Verify
  // (cible identifiée avec certitude : le jour où l'écart a été détecté).
  const r = M.detailQualiteDonneesCommande({
    stockFiable: true, previsionConfiance: 'fiable',
    jaugeageFrais: true, couvertureVentesComplete: true, pointZeroFiable: true, livraisonsCoherentes: true,
    anomalieMajeure: true,
  });
  assert.strictEqual(r.niveau, 'a_confirmer');
  assert.deepStrictEqual(Array.from(r.causes), ['anomalie_majeure']);
  const actions = M.actionsResolutionFiabilite(r);
  assert.strictEqual(actions.length, 1);
  assert.strictEqual(actions[0].action, 'Vérifier les écarts');
  assert.strictEqual(actions[0].cta, 'Ouvrir Verify →');
  assert.strictEqual(actions[0].cible, 'verify_jour');
  ok('actionsResolutionFiabilite — anomalie majeure -> action "Vérifier les écarts" + CTA "Ouvrir Verify →" (citation exacte de Frédéric)');
}
{
  // 2 signaux secondaires négatifs simultanés -> 2 actions distinctes,
  // jamais un seul motif générique qui fusionnerait les deux causes.
  const r = M.detailQualiteDonneesCommande({
    stockFiable: true, previsionConfiance: 'fiable',
    jaugeageFrais: false, couvertureVentesComplete: true, pointZeroFiable: true, livraisonsCoherentes: false, anomalieMajeure: false,
  });
  assert.strictEqual(r.niveau, 'a_confirmer');
  assert.deepStrictEqual(Array.from(r.causes).sort(), ['jaugeage_frais', 'livraisons_coherentes'].sort());
  const actions = M.actionsResolutionFiabilite(r);
  assert.strictEqual(actions.length, 2, 'chaque cause négative doit produire sa propre action, jamais fusionnées en une seule');
  ok('actionsResolutionFiabilite — 2 signaux secondaires négatifs -> 2 actions distinctes');
}
{
  // Robustesse : jamais une exception, même sans détail du tout.
  assert.doesNotThrow(() => M.actionsResolutionFiabilite(null));
  assert.deepStrictEqual(Array.from(M.actionsResolutionFiabilite(null)), []);
  ok('actionsResolutionFiabilite — appelé sans détail -> [] honnête, jamais une exception');
}

// ------------------------------------------------------------
// 4) Branchement donnees — evaluerCommandeCarburantSite expose
//    couvertureEstimeeParQuart par carburant, et le minimum camion réel
//    (3 000 L, corrigé globalement en base le 28/08/2026 sur
//    vito-sainte-marie ET tout site utilisant encore l'ancien placeholder)
//    circule bien via un simple pass-through de config (Article 11, jamais
//    un second calcul dupliqué côté colle Supabase).
// ------------------------------------------------------------
global.window = global;
require(path.join(PROJET, 'nexus-carburant-moteur.js'));
require(path.join(PROJET, 'nexus-carburant-donnees.js'));
require(path.join(PROJET, 'nexus-carburant-commande-moteur.js'));
require(path.join(PROJET, 'nexus-verify-moteur.js'));
require(path.join(PROJET, 'nexus-carburant-commande-donnees.js'));
const Donnees = global.NexusCarburantCommandeDonnees;

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

const CONFIG_3000L = {
  cutoff_heure: '11:00', jours_livraison_iso: [1, 2, 3, 4, 5],
  minimum_camion_litres: 3000, maximum_camion_litres: 36000, stock_securite_jours: 3,
};
const CUVES = {
  sp95: { actif: true, label: 'SP95', cuves: [{ id: 'unique', capacite: 30276, limite_remplissage: 28761 }] },
  go: { actif: true, label: 'GO', cuves: [{ id: 'cuve1', capacite: 20020, limite_remplissage: 19019 }] },
  gnr: { actif: false, label: 'GNR', cuves: [{ id: 'unique', capacite: 30000, limite_remplissage: 28500 }] },
};

(async function main() {
  await (async function () {
    const nom = 'evaluerCommandeCarburantSite — expose couvertureEstimeeParQuart par carburant (branchement donnees, §2 v2.260) et respecte le minimum camion réel (3 000 L)';
    try {
      const client = creerClientMock({
        station_config: [{ data: { carburant_commande_config: CONFIG_3000L, cuves_carburants: CUVES, fuseau_horaire: 'America/Martinique' }, error: null }],
        inventaire_calendrier_site: [{ data: [], error: null }],
        // 1ʳᵉ requête audits_caisse : chargerHistoriqueVentesParJour (agrégat
        // jour). 2ᵉ et 3ᵉ : chargerHistoriqueVentesParQuart('1') puis ('2').
        // 4ᵉ : chargerAvisVerifyJour (point 245, aucune caisse pour ce jour
        // -> avis vide) — même ordre que le Promise.all() de
        // evaluerCommandeCarburantSite.
        audits_caisse: [
          { data: [], error: null },
          { data: [], error: null },
          { data: [], error: null },
          { data: [], error: null },
        ],
        carburant_releves: [{ data: null, error: null }, { data: null, error: null }],
        carburant_stock_references: [{ data: null, error: null }],
        carburant_commandes: [{ data: [], error: null }],
      });
      const r = await Donnees.evaluerCommandeCarburantSite(client, 'vito-sainte-marie', { dateISO: '2026-08-27', heureHHMM: '09:00' });
      assert.strictEqual(r.ok, true);
      assert.ok('couvertureEstimeeParQuart' in r.parCarburant.sp95, 'couvertureEstimeeParQuart doit être exposé sur chaque carburant actif, même sans historique (réponse honnête non_calculable)');
      assert.strictEqual(r.parCarburant.sp95.couvertureEstimeeParQuart.confiance, 'non_calculable', 'aucun historique par quart mocké ici -> non_calculable, jamais un chiffre fabriqué');
      // Les 2 requêtes chargerHistoriqueVentesParQuart ont bien été
      // déclenchées avec quart='1' puis quart='2' (Article 11 : réutilise
      // chargerHistoriqueVentesParQuart existant depuis v2.246, aucune
      // nouvelle requête écrite pour ce lot).
      const appelsQuart = client.appels.filter(a => a.table === 'audits_caisse' && a.type === 'select' && ('quart' in a.eq));
      assert.strictEqual(appelsQuart.length, 2);
      assert.deepStrictEqual(appelsQuart.map(a => a.eq.quart).sort(), ['1', '2']);
      assert.deepStrictEqual(Array.from(r.avisVerifyJour), [], 'aucune caisse ce jour-là -> avis Verify vide, jamais un badge fabriqué sans donnée réelle');
      ok(nom);
    } catch (e) { console.error(`FAIL — ${nom}\n  ${e.stack}`); process.exitCode = 1; }
  })();

  // ------------------------------------------------------------
  // 5) Avis Verify informatif (point 245) — "je ne veux pas de dépendance
  //    artificielle entre NEXUS Verify et NEXUS Carburants [...] tant que
  //    ce n'est pas le cas [ne bloque pas la certification des litres],
  //    affichez-le comme un signal informatif séparé, jamais fusionné dans
  //    le calcul de confiance." Vérifie que : (a) une caisse Q2 non
  //    validée aujourd'hui produit bien un avis ; (b) cet avis n'affecte
  //    JAMAIS `detailConfiance`/`confiance` d'aucun carburant (litrage
  //    disponible indépendamment de la validation manager, confirmé par
  //    l'audit #240 de ce même lot).
  // ------------------------------------------------------------
  await (async function () {
    const nom = 'evaluerCommandeCarburantSite — avis Verify informatif (caisse Q2 non validée) exposé séparément, jamais fusionné dans la fiabilité carburant';
    try {
      const client = creerClientMock({
        station_config: [{ data: { carburant_commande_config: CONFIG_3000L, cuves_carburants: CUVES, fuseau_horaire: 'America/Martinique' }, error: null }],
        inventaire_calendrier_site: [{ data: [], error: null }],
        audits_caisse: [
          { data: [], error: null }, // chargerHistoriqueVentesParJour
          { data: [], error: null }, // chargerHistoriqueVentesParQuart('1')
          { data: [], error: null }, // chargerHistoriqueVentesParQuart('2')
          // chargerAvisVerifyJour : Q1 déjà validée (piste+boutique), Q2 pas
          // encore touchée -> statutValidationQuart('en_attente') pour Q2.
          {
            data: [
              { quart: '1', ecart_piste: 0, ecart_boutique: 0, valide_le_piste: '2026-08-27T13:00:00Z', valide_le_boutique: '2026-08-27T13:00:00Z', premiere_validation_le_piste: '2026-08-27T13:00:00Z', premiere_validation_le_boutique: '2026-08-27T13:00:00Z', valide_par_piste: 'mgr1', valide_par_boutique: 'mgr1' },
              { quart: '2', ecart_piste: 0, ecart_boutique: 0, valide_le_piste: null, valide_le_boutique: null, premiere_validation_le_piste: null, premiere_validation_le_boutique: null, valide_par_piste: null, valide_par_boutique: null },
            ],
            error: null,
          },
        ],
        carburant_releves: [{ data: null, error: null }, { data: null, error: null }],
        carburant_stock_references: [{ data: null, error: null }],
        carburant_commandes: [{ data: [], error: null }],
      });
      const r = await Donnees.evaluerCommandeCarburantSite(client, 'vito-sainte-marie', { dateISO: '2026-08-27', heureHHMM: '18:00' });
      assert.strictEqual(r.ok, true);
      assert.strictEqual(r.avisVerifyJour.length, 1, 'seul le quart 2 (non validé) doit produire un avis, jamais le quart 1 déjà validé');
      assert.strictEqual(r.avisVerifyJour[0].quart, '2');
      assert.strictEqual(r.avisVerifyJour[0].statut.etat, 'en_attente');
      // Cœur du principe architectural de Frédéric : cet avis n'a AUCUN
      // effet sur la fiabilité de la recommandation carburant — aucune
      // trace de l'avis Verify ne doit apparaître dans detailConfiance.
      Object.values(r.parCarburant).forEach(ev => {
        if (!ev || !ev.detailConfiance) return;
        assert.ok(!('avisVerifyJour' in ev.detailConfiance), 'detailConfiance ne doit jamais porter la moindre trace de avisVerifyJour');
        assert.ok(Array.from(ev.detailConfiance.causes || []).every(c => c !== 'avis_verify' && c !== 'verify'), 'aucune cause de dégradation ne doit jamais provenir de avisVerifyJour (aucune dépendance artificielle Verify -> Carburants)');
      });
      ok(nom);
    } catch (e) { console.error(`FAIL — ${nom}\n  ${e.stack}`); process.exitCode = 1; }
  })();

  console.log(`\n${n + 2} tests passés (dont les 2 tests de branchement donnees ci-dessus).`);
})();
