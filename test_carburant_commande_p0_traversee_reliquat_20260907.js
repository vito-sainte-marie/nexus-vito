// Test de contrat P0 — traversée de `reliquatArrondi` (CARB-004, Q65 de
// `decision-1.md`, lot CARBURANTS-PERFORMANCE-OPTIMISATION-CAMION-20260906).
//
// decision-1.md exigeait de vérifier — pas de supposer — que la sortie
// `reliquatArrondi` du moteur (`nexus-carburant-commande-moteur.js`) traverse
// la couche `nexus-carburants-p0-fixes.js` sans être avalée, renommée ou
// recalculée silencieusement (même défaut que le Brief en A3, où un
// enrobage nommait mal un paramètre et le laissait tomber en silence).
//
// Ce test charge le VRAI P0 (`installer()` s'exécute au chargement) par-dessus
// le VRAI moteur et appelle la fonction réellement exposée à l'écran
// (`NexusCarburantCommandeDonnees.evaluerCommandeCarburantSite`, wrappée par
// P0) — jamais une réimplémentation, jamais un appel direct au moteur qui
// contournerait la couche à prouver.
//
// BUG TROUVÉ EN ÉCRIVANT CE TEST (corrigé dans ce même lot, voir
// nexus-carburant-commande-moteur.js, bloc "RÉCUPÉRATION DU RELIQUAT
// D'ARRONDI") : la phase de récupération lisait `ev.stockPrevuLivraisonL` à
// la racine de l'évaluation par carburant — un champ qui n'existe QUE dans
// la fixture plate du test moteur isolé
// (test_carburant_commande_reliquat_arrondi_20260906.js). Pour toute
// évaluation réelle produite par `evaluerCarburant`, ce champ est niché sous
// `scenarioMaintenant.stockPrevuLivraisonL` — exactement comme
// `pourOptimisation` (quelques lignes plus haut dans le même fichier) le
// sait déjà et l'aplatit pour l'optimiseur. Sans ce correctif, la
// récupération du reliquat retombait TOUJOURS sur "rotation prévisionnelle
// inconnue" avec de vraies données — la traversée P0 était donc invérifiable
// : il n'y avait rien à traverser, la sortie ne se produisait jamais. Ce
// test aurait échoué (recupereL bloqué à 0) sans cette correction.
'use strict';
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

const HORAIRES = { quart1: { normal: '06:00', fin_normal: '14:00' }, quart2: { normal: '14:00', fin_normal: '22:00' } };
const FUSEAU = 'UTC';
const DATE_CMD = '2026-09-10'; // jeudi, loin de toute fin de mois (30/09)

const CONFIG_COMMANDE = {
  cutoff_heure: '11:00', jours_livraison_iso: [1, 2, 3, 4, 5],
  maximum_camion_litres: 36000, minimum_camion_litres: 10000,
  stock_securite_jours_normal: 2, stock_securite_jours_fin_mois: 1,
};
// Mêmes cuves que le cas terrain réel (audit CARB-004, cf.
// test_carburant_commande_ancre_jaugeage_v2255.js) : sp95 limite 28 761 L,
// go limite 19 019 + 9 534 = 28 553 L.
const CUVES_VITO = {
  sp95: { actif: true, label: 'SP95', cuves: [{ id: 'unique', capacite: 30276, limite_remplissage: 28761 }] },
  go: { actif: true, label: 'GO', cuves: [{ id: 'cuve1', capacite: 20020, limite_remplissage: 19019 }, { id: 'cuve2', capacite: 10036, limite_remplissage: 9534 }] },
  gnr: { actif: false, label: 'GNR', cuves: [{ id: 'unique', capacite: 30000, limite_remplissage: 28500 }] },
};

function jourDepuisCmd(offset) {
  const d = new Date(DATE_CMD + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

// Historique QUALIFIÉ (quart1 + quart2 chaque jour, valeurs distinctes pour
// ne jamais déclencher la suspicion de duplication de
// `chargerHistoriqueVentesQualifie`) — 14 jours, consommation stable :
// sp95 ~3 250 L/j, go ~2 780 L/j.
let HISTO_ROWS = [];
for (let i = 14; i >= 1; i--) {
  const d = jourDepuisCmd(-i);
  HISTO_ROWS.push({ date: d, quart: '1', litrage_sp95: 1600, litrage_gazole: 1400, litrage_gnr: null });
  HISTO_ROWS.push({ date: d, quart: '2', litrage_sp95: 1650, litrage_gazole: 1380, litrage_gnr: null });
}
const QUART1_AUJOURDHUI = [{ date: DATE_CMD, quart: '1', litrage_sp95: 1600, litrage_gazole: 1400, litrage_gnr: null }];

function creerClient() {
  return {
    from(table) {
      if (table === 'station_config') {
        const data = { carburant_commande_config: CONFIG_COMMANDE, cuves_carburants: CUVES_VITO, horaires: HORAIRES };
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
      if (table === 'carburant_recommandation_journal') {
        // Non mocké au-delà de "vide" : ce test porte sur la traversée
        // reliquatArrondi, pas sur le journal (déjà couvert par
        // test_carburant_commande_journal_recommandation_v2259.js).
        const chain = {
          select() { return chain; }, eq() { return chain; }, order() { return chain; }, limit() { return chain; }, insert() { return chain; },
          async maybeSingle() { return { data: null, error: null }; },
          then(resolve) { return Promise.resolve({ data: [], error: null }).then(resolve); },
        };
        return chain;
      }
      if (table === 'carburant_reception_visites') {
        // Aucune réception documentaire dans ce scénario.
        const chain = {
          select() { return chain; }, eq() { return chain; }, gte() { return chain; }, lt() { return chain; },
          neq() { return chain; }, order() { return chain; },
          then(resolve) { return Promise.resolve({ data: [], error: null }).then(resolve); },
        };
        return chain;
      }
      if (table === 'audits_caisse') {
        let estPlage = false;
        let filtreQuart = false;
        const chain = {
          select() { return chain; },
          eq(k) { if (k === 'quart') filtreQuart = true; return chain; },
          gte() { estPlage = true; return chain; },
          lt() { estPlage = true; return chain; },
          then(resolve) {
            const data = filtreQuart ? [] : (estPlage ? HISTO_ROWS : QUART1_AUJOURDHUI);
            return Promise.resolve({ data, error: null }).then(resolve);
          },
        };
        return chain;
      }
      throw new Error('Table non mockée par ce test : ' + table);
    },
  };
}

// Jaugeage du matin construit pour reproduire, via le VRAI pipeline (jamais
// des évaluations fabriquées à la main comme dans le test moteur isolé) :
//   - sp95 en sécurité (etat 'securite'), rattrapé à sa capacité physique
//     exacte (28 000 L) — AUCUNE marge pour un compartiment de plus ;
//   - go confortable (etat 'confortable', margeJours >= 5), complété par la
//     phase "camion complet" à un total non multiple de 1 000, qui perd un
//     compartiment à l'arrondi (7 000 au lieu de 7 739) — c'est CE
//     compartiment que la récupération du reliquat doit restituer.
function creerClientAvecJaugeage(jaugeageSp95, jaugeageGo) {
  return { client: creerClient(), jaugeageSp95, jaugeageGo };
}

async function evaluer(jaugeageSp95, jaugeageGo) {
  const sandbox = { console, window: undefined };
  vm.createContext(sandbox);
  sandbox.window = sandbox;
  charger(sandbox, 'nexus-carburant-moteur.js');
  sandbox.NexusCarburantDonnees = {
    chargerControleJour: async () => ({
      aucunReleve: false,
      releveDuJour: { date: DATE_CMD, mesure_le: DATE_CMD + 'T05:30:00.000Z', origine: 'manager' },
      dernierReleve: null,
      parCarburant: {
        sp95: { reelDuJour: jaugeageSp95, dernierReel: jaugeageSp95 - 2000, statut: 'Sous contrôle' },
        go: { reelDuJour: jaugeageGo, dernierReel: jaugeageGo - 2000, statut: 'Sous contrôle' },
      },
    }),
  };
  charger(sandbox, 'nexus-carburant-commande-moteur.js');
  charger(sandbox, 'nexus-carburant-commande-donnees-core.js');
  // Chargé EN DERNIER, comme dans l'application réelle : `installer()`
  // s'exécute immédiatement et remplace
  // `NexusCarburantCommandeDonnees.evaluerCommandeCarburantSite` par la
  // version enveloppée. Si cette étape échouait silencieusement, l'appel
  // ci-dessous testerait l'original, pas la traversée P0 — d'où l'assertion
  // explicite sur `NexusCarburantsP0.actif` plus bas.
  charger(sandbox, 'nexus-carburants-p0-fixes.js');
  assert.strictEqual(sandbox.NexusCarburantsP0 && sandbox.NexusCarburantsP0.actif, true,
    'P0 doit être réellement installé, sinon ce test n\'exercerait pas la couche à prouver');

  const Donnees = sandbox.NexusCarburantCommandeDonnees;
  const client = creerClient();
  return Donnees.evaluerCommandeCarburantSite(client, 'vito-sainte-marie', {
    timezone: FUSEAU, dateISO: DATE_CMD, heureHHMM: '09:00', maintenant: DATE_CMD + 'T15:00:00.000Z',
  });
}

(async () => {
  // ------------------------------------------------------------
  // 1) Cas de référence CARB-004, à travers le VRAI P0 : 35 000 → 36 000 L,
  //    ET un refus motivé (sp95, capacité) dans la MÊME réponse.
  // ------------------------------------------------------------
  {
    const r = await evaluer(3750, 22240);
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.viserCamionComplet, true, 'mode camion complet requis pour exercer la récupération');
    assert.ok(r.commandeRecommandee, 'commandeRecommandee doit traverser jusqu\'à la réponse finale de evaluerCommandeCarburantSite (P0)');

    const c = r.commandeRecommandee;
    assert.strictEqual(c.total, 36000, `36 000 L attendus à travers P0, obtenu ${c.total}`);
    assert.strictEqual(c.volumes.sp95, 28000, 'sp95 plafonné à sa capacité physique exacte');
    assert.strictEqual(c.volumes.go, 8000, 'go doit porter le compartiment récupéré (7 000 -> 8 000)');

    // Le cœur de la preuve de traversée : `reliquatArrondi` n'est ni absent,
    // ni renommé, ni recalculé — c'est EXACTEMENT l'objet produit par le
    // moteur (mêmes clés, mêmes valeurs), simplement relayé par P0.
    assert.ok(c.reliquatArrondi, 'reliquatArrondi doit être présent sur commandeRecommandee après P0 — traversée rompue sinon');
    assert.strictEqual(c.reliquatArrondi.recupereL, 1000, `1 000 L de reliquat récupéré attendus, obtenu ${c.reliquatArrondi.recupereL}`);
    assert.strictEqual(c.reliquatArrondi.parCarburant.go, 1000, 'le compartiment récupéré doit être crédité à go, traçable après P0');
    assert.strictEqual(c.reliquatArrondi.parCarburant.sp95, undefined, 'sp95 ne doit recevoir aucun reliquat (déjà à sa capacité)');

    // Le refus motivé exigé par decision-1.md : sp95 est refusé avec un
    // motif nommant explicitement la capacité, pas un objet vide ni un
    // silence.
    assert.ok(c.reliquatArrondi.motifs.sp95, 'sp95 doit porter un motif de refus explicite après traversée P0');
    assert.ok(/[Cc]apacité disponible/.test(c.reliquatArrondi.motifs.sp95),
      'le motif de refus doit nommer la capacité, pas rester générique : ' + c.reliquatArrondi.motifs.sp95);

    ok('evaluerCommandeCarburantSite (P0) — reliquatArrondi traverse intact : 35 000 → 36 000 L sur go, refus motivé sur sp95');
  }

  // ------------------------------------------------------------
  // 2) Contrat d'architecture (Q65) — la couche P0 ne recalcule jamais le
  //    reliquat en parallèle du moteur : elle n'en a même pas connaissance
  //    lexicale. Si un futur correctif y introduisait une seconde logique
  //    de récupération, ce test doit le signaler.
  // ------------------------------------------------------------
  {
    const src = fs.readFileSync(path.join(PROJET, 'nexus-carburants-p0-fixes.js'), 'utf8');
    assert.ok(!/reliquat/i.test(src),
      'nexus-carburants-p0-fixes.js ne doit jamais mentionner "reliquat" — la valeur doit être relayée telle quelle depuis le moteur, jamais recalculée ou même référencée par nom dans P0');
    ok('nexus-carburants-p0-fixes.js — aucune trace de "reliquat" : la couche P0 relaie sans connaître ni recalculer, le moteur reste seul propriétaire (Article 11)');
  }

  console.log(`\n${n}/${n} tests passés — reliquatArrondi traverse réellement la couche P0 jusqu'à l'écran.`);
})().catch(e => { console.error(e); process.exit(1); });
