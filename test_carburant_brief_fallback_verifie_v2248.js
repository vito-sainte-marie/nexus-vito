// Test — P0 bis (27/08/2026, v2.248, retour de Frédéric "toujours anomalie"
// après le correctif crash v2.247) : la puce Carburants restait grise sur le
// Brief car `chargerCarburantsBriefAvecFallback` (nexus-brief-donnees.js)
// figeait son repli sur le 26/08 (relevé de réception sans `mesure_le`,
// v2.247) — jugé "complet" par la version approximative day-boundary de
// `chargerHistoriqueReleves`, mais "Données insuffisantes" une fois rejoué
// avec la précision horodatée réelle (`chargerControleJour`, via
// `chargerCarburantsBrief`). Deux calculs divergents de la même notion de
// "jour complet" (Article 11) — jamais détecté auparavant car personne ne
// vérifiait le candidat après coup.
//
// Correctif : `trouverJourFiableAnterieur` (nexus-carburant-moteur.js)
// accepte désormais une liste de dates à exclure, et
// `chargerCarburantsBriefAvecFallback` rejoue chaque candidat et l'écarte
// s'il reste "Données insuffisantes" réellement, jusqu'à trouver un jour
// dont le calcul RÉEL confirme la complétude — ou honnêtement conclure
// qu'aucun repli fiable n'existe (Article 5, jamais un jour cassé présenté
// comme fiable).

const assert = require('assert');
const path = require('path');
const PROJET = __dirname;

global.window = global;
require(path.join(PROJET, 'nexus-boussole-moteur.js'));
require(path.join(PROJET, 'nexus-carburant-moteur.js'));
require(path.join(PROJET, 'nexus-periodes.js'));
require(path.join(PROJET, 'nexus-brief-donnees.js'));
const M = global.NexusCarburantMoteur;
const BD = global.NexusBriefDonnees;

let n = 0;
function ok(label) { n++; console.log('OK —', label); }

const OK3 = { go: { statut: 'Sous contrôle' }, sp95: { statut: 'Sous contrôle' }, gnr: { statut: 'Sous contrôle' } };
const INSUFFISANT3 = { go: { statut: 'Données insuffisantes' }, sp95: { statut: 'Données insuffisantes' }, gnr: { statut: 'Données insuffisantes' } };

// Client minimal : les écritures du journal de fraîcheur sont best-effort et
// absorbées par leur propre try/catch (enregistrerFraicheurSecteur) — sans
// incidence sur le résultat retourné, quelle que soit la réponse ici. Un
// simple maybeSingle() vide évite juste le bruit console attendu.
const CLIENT_VIDE = {
  from() {
    const chain = {
      select() { return chain; }, eq() { return chain; },
      maybeSingle: async () => ({ data: null, error: null }),
      insert() { return chain; },
    };
    return chain;
  },
};

function fabriquerNexusCarburantDonnees(controleParDate, historiqueApprox) {
  return {
    chargerControleJour: async (client, siteId, date) => controleParDate[date] || { aucunReleve: true, parCarburant: null },
    chargerVentesPeriode: async () => ({ ventes: { go: 100, sp95: 100, gnr: 100 }, nbQuartsAvecLitrage: 2, nbQuartsTotal: 2 }),
    chargerCuvesConfig: async () => ({ config: null }),
    chargerPrixCarburantsCourant: async () => null,
    chargerLivraisonsCouteesCarburant: async () => [],
    chargerHistoriqueReleves: async () => historiqueApprox,
  };
}

async function main() {
  // ------------------------------------------------------------
  // 1) Reproduction exacte du cas réel : 27/08 sans relevé, l'historique
  //    approximatif juge le 26/08 "complet" (day-boundary, ignore
  //    mesure_le) mais le rejeu réel le dément ("Données insuffisantes",
  //    relevé de réception sans mesure_le) ; le 25/08, réellement valide,
  //    doit être retenu à la place.
  // ------------------------------------------------------------
  {
    global.NexusCarburantDonnees = fabriquerNexusCarburantDonnees(
      {
        '2026-08-27': { aucunReleve: true, parCarburant: null }, // aujourd'hui : aucun relevé
        '2026-08-26': { aucunReleve: false, parCarburant: INSUFFISANT3 }, // rejeu réel : cassé (mesure_le null)
        '2026-08-25': { aucunReleve: false, parCarburant: OK3 }, // rejeu réel : réellement valide
      },
      [
        { date: '2026-08-26', parCarburant: OK3 }, // day-boundary : jugé (à tort) complet
        { date: '2026-08-25', parCarburant: OK3 },
      ],
    );

    const resultat = await BD.chargerCarburantsBriefAvecFallback(CLIENT_VIDE, 'vito-sainte-marie', '2026-08-27');

    assert.strictEqual(resultat.fraicheur.mode, 'fallback', 'un jour réellement fiable existe (25/08) -> mode fallback, jamais gris');
    assert.strictEqual(resultat.fraicheur.dateReference, '2026-08-25', 'le 26/08 cassé doit être écarté après vérification, jamais choisi comme repli (P0 bis)');
    assert.strictEqual(M.statutGlobalControle(resultat.controle.parCarburant), 'Sous contrôle', 'le contrôle affiché doit être celui du jour réellement complet, jamais "Données insuffisantes"');
    ok('chargerCarburantsBriefAvecFallback — écarte un candidat approximativement "complet" mais réellement cassé (26/08), retient le 25/08 réel');
  }

  // ------------------------------------------------------------
  // 2) Non-régression : quand le premier candidat proposé par l'historique
  //    approximatif est AUSSI réellement complet (cas normal, sans anomalie
  //    de mesure_le), une seule vérification suffit et il est retenu tel
  //    quel — comportement identique à avant ce correctif.
  // ------------------------------------------------------------
  {
    global.NexusCarburantDonnees = fabriquerNexusCarburantDonnees(
      {
        '2026-08-27': { aucunReleve: true, parCarburant: null },
        '2026-08-26': { aucunReleve: false, parCarburant: OK3 },
      },
      [{ date: '2026-08-26', parCarburant: OK3 }],
    );

    const resultat = await BD.chargerCarburantsBriefAvecFallback(CLIENT_VIDE, 'vito-sainte-marie', '2026-08-27');
    assert.strictEqual(resultat.fraicheur.mode, 'fallback');
    assert.strictEqual(resultat.fraicheur.dateReference, '2026-08-26', 'jour réellement complet dès le premier candidat -> retenu directement, aucune régression');
    ok('chargerCarburantsBriefAvecFallback — non-régression : candidat réellement complet dès le premier essai, retenu sans détour');
  }

  // ------------------------------------------------------------
  // 3) Aucun jour réellement fiable dans toute la fenêtre (tous les
  //    candidats approximativement "complets" s'avèrent cassés au rejeu) ->
  //    honnêtement "jour_incomplet_sans_repli", JAMAIS un jour cassé figé
  //    comme s'il était fiable (Article 5).
  // ------------------------------------------------------------
  {
    global.NexusCarburantDonnees = fabriquerNexusCarburantDonnees(
      {
        '2026-08-27': { aucunReleve: true, parCarburant: null },
        '2026-08-26': { aucunReleve: false, parCarburant: INSUFFISANT3 },
      },
      [{ date: '2026-08-26', parCarburant: OK3 }], // seul candidat proposé, et il est cassé au rejeu
    );

    const resultat = await BD.chargerCarburantsBriefAvecFallback(CLIENT_VIDE, 'vito-sainte-marie', '2026-08-27');
    assert.strictEqual(resultat.fraicheur.mode, 'jour_incomplet_sans_repli', 'aucun repli réellement fiable -> honnête, jamais un jour cassé présenté comme fiable');
    assert.strictEqual(resultat.controle.aucunReleve, true, 'reste sur les données du jour telles quelles (aucun relevé), jamais un repli fabriqué');
    ok('chargerCarburantsBriefAvecFallback — aucun candidat réellement fiable dans la fenêtre -> honnêtement sans repli, jamais un jour cassé accepté');
  }

  console.log(`\n${n}/${n} tests passés — P0 bis, vérification réelle du jour de repli Carburants (v2.248).`);
}

main().catch(e => { console.error(e); process.exit(1); });
