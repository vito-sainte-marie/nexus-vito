// Test — "Fin de mois" (mode camion complet vs minimisation) doit se lire
// sur la date de LIVRAISON, jamais sur la date de COMMANDE (27/08/2026,
// retour de Frédéric — logique explicite du passage de mois) :
//
// "quand je commande en fin de mois... je veux le moins de stock possible.
// mais le jour de livraison qui potentiellement le mois prochain est le
// mardi 1er, je veux un stock pour cette journée du mardi l'équivalent
// d'une journée [...] car en commandant le lundi même si je suis livré en
// fin de journée, j'évite la rupture et je peux me prendre un camion plein
// de 36 000 L."
//
// Exemple réel donné tel quel : dernier jour ouvré du mois = lundi (31
// août 2026), prochain créneau de livraison (calendrier lun-ven) = mardi 1er
// septembre — un jour qui appartient déjà au mois SUIVANT. Ce stock est
// donc un stock de DÉBUT de mois, pas un résiduel de fin de mois : NEXUS
// doit viser le camion complet (36 000 L), pas la minimisation.
//
// Avant ce correctif, `evaluerCommandeCarburantSite` calculait
// `modeFinDeMois = M.estFinDeMois(dateISO)` où `dateISO` est la date de
// COMMANDE (aujourd'hui) — le 31 août tombant dans les 5 derniers jours
// calendaires du mois, `modeFinDeMois` valait `true` et bloquait à tort le
// camion complet, alors même que la livraison réelle atterrit le 1er
// septembre (pas du tout "fin de mois" pour septembre). Correctif :
// `modeFinDeMois = M.estFinDeMois(livraisonISO)`, calculé via
// `M.calculerFenetreLivraison` (Article 11 — réutilise la même fonction
// pure que le reste du moteur, jamais un second calcul de calendrier).
//
// La réserve de sécurité elle-même (`reserveCibleJours`, dans
// `evaluerScenarioCommande`) N'EST PAS concernée par ce correctif : elle
// reste calculée sur la date de COMMANDE, ce qui donne bien 1 jour de
// réserve (le tampon d'une journée que Frédéric demande explicitement pour
// le mardi de livraison) — vérifié séparément ci-dessous.
//
// Même discipline que test_carburant_commande_ancre_jaugeage_v2255.js :
// mock Supabase minimal, chargerControleJour stubbé (aucunReleve: true —
// ce test porte uniquement sur le calendrier fin de mois/camion complet,
// jamais sur le stock physique, déjà couvert ailleurs), aucune
// réimplémentation du moteur testé.

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

const CONFIG_COMMANDE = {
  cutoff_heure: '11:00', jours_livraison_iso: [1, 2, 3, 4, 5],
  maximum_camion_litres: 36000, minimum_camion_litres: 10000,
  stock_securite_jours_normal: 2, stock_securite_jours_fin_mois: 1,
  compartiments_disponibles_litres: [2000, 5000, 7000],
};
const CUVES_VITO = {
  sp95: { actif: true, label: 'SP95', cuves: [{ id: 'unique', capacite: 30276, limite_remplissage: 28761 }] },
  go: { actif: true, label: 'GO', cuves: [{ id: 'cuve1', capacite: 20020, limite_remplissage: 19019 }, { id: 'cuve2', capacite: 10036, limite_remplissage: 9534 }] },
  gnr: { actif: false, label: 'GNR', cuves: [{ id: 'unique', capacite: 30000, limite_remplissage: 28500 }] },
};
const HORAIRES = { quart1: { normal: '06:00', fin_normal: '14:00' }, quart2: { normal: '14:00', fin_normal: '22:00' } };
const FUSEAU = 'UTC';

// Historique minimal (non pertinent pour ce test — seul le calendrier
// fin de mois/camion complet est vérifié ici, pas la qualité de la
// prévision, déjà couverte par d'autres tests, Article 11).
const HISTORIQUE_ROWS = [
  { date: '2026-08-13', litrage_sp95: 6000, litrage_gazole: 3400, litrage_gnr: null },
  { date: '2026-08-20', litrage_sp95: 6200, litrage_gazole: 3600, litrage_gnr: null },
];

function creerClientEvaluation() {
  return {
    from(table) {
      if (table === 'station_config') {
        const data = { carburant_commande_config: CONFIG_COMMANDE, cuves_carburants: CUVES_VITO, fuseau_horaire: FUSEAU, horaires: HORAIRES };
        const chain = { select() { return chain; }, eq() { return chain; }, async maybeSingle() { return { data, error: null }; } };
        return chain;
      }
      if (table === 'inventaire_calendrier_site') {
        const chain = { select() { return chain; }, eq() { return chain; }, then(resolve) { return Promise.resolve({ data: [], error: null }).then(resolve); } };
        return chain;
      }
      if (table === 'carburant_commandes') {
        const chain = { select() { return chain; }, eq() { return chain; }, in() { return chain; }, order() { return chain; }, then(resolve) { return Promise.resolve({ data: [], error: null }).then(resolve); } };
        return chain;
      }
      if (table === 'audits_caisse') {
        let estPlage = false;
        const chain = {
          select() { return chain; }, eq() { return chain; },
          gte() { estPlage = true; return chain; }, lt() { estPlage = true; return chain; },
          then(resolve) { return Promise.resolve({ data: estPlage ? HISTORIQUE_ROWS : [], error: null }).then(resolve); },
        };
        return chain;
      }
      throw new Error('Table non mockée par ce test : ' + table);
    },
  };
}

(async () => {
  const sandbox = { console, window: undefined };
  vm.createContext(sandbox);
  sandbox.window = sandbox;
  charger(sandbox, 'nexus-carburant-moteur.js');
  // Aucun jaugeage saisi — ce test ne porte pas sur le stock physique
  // (chargerStockEtFiabiliteParCarburant retombe honnêtement sur
  // "aucunReleve", chaque carburant restera non_calculable, ce qui
  // n'affecte en rien le calcul modeFinDeMois/viserCamionComplet, purement
  // calendaire et calculé indépendamment de la qualité du stock).
  sandbox.NexusCarburantDonnees = { chargerControleJour: async () => ({ aucunReleve: true }) };
  charger(sandbox, 'nexus-carburant-commande-moteur.js');
  charger(sandbox, 'nexus-carburant-commande-donnees-core.js');
  const Donnees = sandbox.NexusCarburantCommandeDonnees;
  const M = sandbox.NexusCarburantCommandeMoteur;

  // ------------------------------------------------------------
  // 1) Exemple exact de Frédéric — commande le lundi 31 août (dernier jour
  //    ouvré du mois), avant cutoff (11h) -> prochain créneau de livraison
  //    (lun-ven) = mardi 1er septembre, qui appartient au mois SUIVANT.
  //    -> modeFinDeMois DOIT être false, viserCamionComplet DOIT être true
  //    (camion complet autorisé, exactement ce que Frédéric demande).
  // ------------------------------------------------------------
  {
    const client = creerClientEvaluation();
    const r = await Donnees.evaluerCommandeCarburantSite(client, 'vito-sainte-marie', { timezone: 'America/Martinique', dateISO: '2026-08-31', heureHHMM: '09:00' });
    assert.strictEqual(r.ok, true);
    // Vérifie d'abord, sans dépendre du résultat, que le scénario calcule
    // bien mardi 1er septembre comme prochain créneau (sinon le test ne
    // prouverait rien) — recalcul via la même fonction pure que le moteur,
    // jamais une date recopiée à la main sans vérification (Article 5).
    const fenetre = M.calculerFenetreLivraison({ dateCommandeISO: '2026-08-31', heureCommandeHHMM: '09:00', config: CONFIG_COMMANDE, joursFeriesISO: [] });
    assert.strictEqual(fenetre.livraisonISO, '2026-09-01', 'prémisse du test : la livraison doit bien tomber le 1er septembre (mardi) pour que le cas soit celui décrit par Frédéric');
    assert.strictEqual(r.modeFinDeMois, false, 'commande le 31/08 mais livraison le 01/09 (mois suivant) -> NE DOIT PLUS être traité comme "fin de mois" (c\'est un stock de début de mois suivant)');
    assert.strictEqual(r.viserCamionComplet, true, 'camion complet doit être visé quand la livraison atterrit sur le mois suivant, même si la commande est passée en fin de mois courant');
    ok('commande fin de mois (31/08, lundi) mais livraison le mois suivant (01/09, mardi) -> camion complet autorisé (correctif appliqué sur la date de LIVRAISON, pas de commande)');
  }

  // ------------------------------------------------------------
  // 2) Régression — commande fin de mois SANS franchissement du mois
  //    (jeudi 27 août -> prochain créneau vendredi 28 août, toujours en
  //    août) : le comportement historique de minimisation doit rester
  //    inchangé (modeFinDeMois=true, viserCamionComplet=false).
  // ------------------------------------------------------------
  {
    const client = creerClientEvaluation();
    const r = await Donnees.evaluerCommandeCarburantSite(client, 'vito-sainte-marie', { timezone: 'America/Martinique', dateISO: '2026-08-27', heureHHMM: '09:00' });
    assert.strictEqual(r.ok, true);
    const fenetre = M.calculerFenetreLivraison({ dateCommandeISO: '2026-08-27', heureCommandeHHMM: '09:00', config: CONFIG_COMMANDE, joursFeriesISO: [] });
    assert.strictEqual(fenetre.livraisonISO, '2026-08-28', 'prémisse du test : la livraison doit rester dans le même mois (28 août, vendredi)');
    assert.strictEqual(r.modeFinDeMois, true, 'commande et livraison toutes deux fin août -> reste "fin de mois", comportement historique inchangé');
    assert.strictEqual(r.viserCamionComplet, false, 'pas de camion complet quand la livraison reste dans la fenêtre fin de mois du même mois — régression du comportement existant (v2.245/v2.253)');
    ok('commande fin de mois (27/08, jeudi) avec livraison qui reste en août (28/08, vendredi) -> minimisation inchangée (aucune régression)');
  }

  // ------------------------------------------------------------
  // 3) La réserve de sécurité (jours de tampon) reste bien calculée sur la
  //    date de COMMANDE, jamais sur la date de livraison — c'est elle qui
  //    donne le "stock équivalent à une journée" que Frédéric demande pour
  //    le mardi de livraison, sans changement de ce côté (Article 11,
  //    portée du correctif strictement limitée au camion complet).
  // ------------------------------------------------------------
  {
    assert.strictEqual(M.reserveCibleJours('2026-08-31', CONFIG_COMMANDE), 1, 'réserve de sécurité calculée sur la date de commande (31/08, fin de mois) -> 1 jour, inchangé par ce correctif');
    assert.strictEqual(M.reserveCibleJours('2026-09-01', CONFIG_COMMANDE), 2, 'à titre de contraste : le 1er septembre lui-même (hors fin de mois) donnerait 2 jours -> preuve que reserveCibleJours n\'est PAS ce qui a été modifié ici, seul le calendrier camion complet l\'a été');
    ok('réserve de sécurité (reserveCibleJours) toujours ancrée sur la date de commande — correctif strictement limité au calendrier camion complet/fin de mois, aucun changement du tampon de sécurité');
  }

  console.log(`\n${n}/${n} tests passés.`);
})();
