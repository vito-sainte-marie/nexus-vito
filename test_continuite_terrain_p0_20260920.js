// Test — Continuité terrain, lot NEXUS-CONTINUITE-TERRAIN-1-20260920
// (decision-1.md, 20/09/2026 : autonomie terrain 7 jours pendant l'absence
// de Frédéric).
//
// Couvre le périmètre autorisé en Test uniquement (code seul, aucun
// déploiement Production) :
//
//   P0-1 — les deux chargeurs de l'Accueil dataient "aujourd'hui" en UTC
//   (`new Date().toISOString().slice(0,10)`). America/Martinique est UTC-4 :
//   dès 20 h locale, en plein service du soir, NEXUS basculait déjà sur
//   demain et affichait "à jour" ce qui ne l'était pas. Corrigés :
//     - NexusAppDonnees.chargerStatutCarburantsHome (nexus-app-donnees.js)
//     - NexusConseillerDonnees.chargerControlesVerifyRestants
//       (nexus-conseiller-donnees.js)
//   Les deux délèguent désormais à NexusStation.dateLocaleStation quand un
//   fuseau est fourni — repli UTC identique à avant sinon (compat
//   ascendante, notamment pour Brief qui ne passe pas encore le fuseau).
//
//   P0-3 — chargerControlesVerifyRestants comptait les quarts SAISIS
//   (`quart` présent dans audits_caisse), pas les audits NON VALIDÉS. Un
//   audit saisi mais jamais validé par un manager retombait donc à "aucun
//   contrôle restant". Corrigé en délégant à
//   NexusVerifyMoteur.statutValidationQuart — la même classification que
//   NEXUS Verify lui-même (Article 11), jamais une doctrine parallèle.
//
//   P0-2 (preuve, aucune écriture Production) — `station_config.raccourcis`
//   du site pilote porte `NEXUS-FDJ-Analyse-v1.html`, que
//   `urgenceRaccourci()` (NEXUS-App-v1.html) ne reconnaît pas : l'urgence
//   FDJ affichée à l'Accueil reste 0 quel que soit le nombre d'alertes non
//   vues. `urgenceRaccourci()` reconnaît en revanche `NEXUS-FDJ-Manager-
//   v1.html`. Ce test prouve mécaniquement l'écart et l'effet de la
//   correction PROPOSÉE (remplacer l'entrée dans la donnée, jamais dans le
//   code) — sans toucher station_config ni urgenceRaccourci.

'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

global.window = global;
require(path.join(__dirname, 'nexus-verify-moteur.js'));
require(path.join(__dirname, 'nexus-station.js'));
require(path.join(__dirname, 'nexus-carburant-moteur.js'));
require(path.join(__dirname, 'nexus-conseiller-donnees.js'));
require(path.join(__dirname, 'nexus-app-donnees.js'));

const NexusStationReel = global.NexusStation;
const CD = global.NexusConseillerDonnees;
const AD = global.NexusAppDonnees;

let n = 0;
function ok(label) { n++; console.log('OK —', label); }

function creerClientAuditsCaisse(lignes, capture) {
  return {
    from(table) {
      assert.strictEqual(table, 'audits_caisse', 'seule audits_caisse doit être requêtée');
      const filtres = {};
      return {
        select() { return this; },
        eq(champ, valeur) { filtres[champ] = valeur; if (capture) capture.filtres = filtres; return this; },
        then(resolve) { return Promise.resolve({ data: lignes, error: null }).then(resolve); },
      };
    },
  };
}

async function main() {
  // ============================================================
  // P0-1a — NexusStation.dateLocaleStation : le cas critique exact exigé
  // par decision-1.md (« 19:59 → 20:00 local et la continuité jusqu'à la
  // fermeture »), déjà la primitive canonique (Article 11) réutilisée par
  // les deux chargeurs corrigés ci-dessous — pas une deuxième formule.
  // ============================================================
  {
    // 19:59 locale Martinique (UTC-4) le 20/09 == 23:59 UTC le 20/09.
    const av19h59 = NexusStationReel.dateLocaleStation('America/Martinique', new Date('2026-09-20T23:59:00Z'));
    assert.strictEqual(av19h59, '2026-09-20');
    // 20:00 locale Martinique le 20/09 == 00:00 UTC le 21/09 : c'est
    // EXACTEMENT l'instant où l'ancien code (UTC seul) basculait déjà sur
    // demain, en plein service du soir.
    const a20h00 = NexusStationReel.dateLocaleStation('America/Martinique', new Date('2026-09-21T00:00:00Z'));
    assert.strictEqual(a20h00, '2026-09-20', 'à 20h locale (service du soir), la date métier doit rester le jour en cours');
    // Continuité jusqu'à la fermeture : 23:59 locale (03:59 UTC le
    // lendemain) reste le même jour métier ; minuit locale (04:00 UTC)
    // bascule enfin.
    const a23h59 = NexusStationReel.dateLocaleStation('America/Martinique', new Date('2026-09-21T03:59:00Z'));
    assert.strictEqual(a23h59, '2026-09-20');
    const minuitLocal = NexusStationReel.dateLocaleStation('America/Martinique', new Date('2026-09-21T04:00:00Z'));
    assert.strictEqual(minuitLocal, '2026-09-21');
    ok('NexusStation.dateLocaleStation — 19:59→20:00 locale ne bascule pas, continuité jusqu\'à minuit locale réel');
  }

  // ============================================================
  // P0-1b — chargerStatutCarburantsHome : wiring réel vers
  // NexusStation.dateLocaleStation quand un fuseau est fourni.
  // ============================================================
  {
    let dateRecue = null;
    let tzRecu = null;
    global.NexusStation = {
      dateLocaleStation(timezone) { tzRecu = timezone; return '2026-09-20'; },
    };
    global.NexusBriefDonnees = {
      chargerCarburantsBriefAvecFallback: async (client, siteId, date, timezone) => {
        dateRecue = date;
        return { controle: { parCarburant: null, aucunReleve: true }, fraicheur: { mode: 'jour' } };
      },
    };
    await AD.chargerStatutCarburantsHome({}, 'nexus-station-test', 'America/Martinique');
    assert.strictEqual(tzRecu, 'America/Martinique', 'le fuseau du site doit traverser jusqu\'à NexusStation.dateLocaleStation');
    assert.strictEqual(dateRecue, '2026-09-20', 'la date transmise à chargerCarburantsBriefAvecFallback doit venir de dateLocaleStation, jamais recalculée en UTC');
    global.NexusStation = NexusStationReel;
    ok('chargerStatutCarburantsHome — délègue réellement à NexusStation.dateLocaleStation(timezone) quand le fuseau est fourni');
  }

  // ------------------------------------------------------------
  // Non-régression P0-1b : fuseau absent -> comportement historique
  // (UTC), jamais un blocage de l'Accueil sur une configuration manquante.
  // ------------------------------------------------------------
  {
    let dateRecue = null;
    global.NexusBriefDonnees = {
      chargerCarburantsBriefAvecFallback: async (client, siteId, date) => { dateRecue = date; return { controle: { parCarburant: null, aucunReleve: true }, fraicheur: { mode: 'jour' } }; },
    };
    const attendu = new Date().toISOString().slice(0, 10);
    await AD.chargerStatutCarburantsHome({}, 'nexus-station-test', null);
    assert.strictEqual(dateRecue, attendu, 'fuseau absent -> repli UTC identique à avant (non-régression)');
    ok('chargerStatutCarburantsHome — fuseau absent : repli UTC inchangé, aucune régression');
  }

  // ============================================================
  // P0-3a — un audit SAISI mais NON VALIDÉ doit rester compté comme
  // travail restant (etat 'en_attente'), jamais comme "fait".
  // ============================================================
  {
    const lignes = [
      { quart: 'quart1', ecart_piste: 1.2, ecart_boutique: -0.4, valide_le_piste: null, valide_le_boutique: null },
    ];
    const client = creerClientAuditsCaisse(lignes);
    const restant = await CD.chargerControlesVerifyRestants(client, 'nexus-station-test', 'America/Martinique');
    assert.strictEqual(restant, 2, 'quart1 saisi mais NON validé doit toujours compter comme restant (2/2), l\'ancien code aurait rendu 1');
    ok('chargerControlesVerifyRestants — audit saisi non validé reste compté comme travail restant (P0-3)');
  }

  // ------------------------------------------------------------
  // P0-3b — une validation PARTIELLE (une seule caisse sur deux) ne doit
  // pas non plus compter comme "fait" : il reste un arbitrage manager.
  // ------------------------------------------------------------
  {
    const maintenant = new Date().toISOString();
    const lignes = [
      { quart: 'quart1', ecart_piste: 1.2, ecart_boutique: -0.4, valide_le_piste: maintenant, valide_le_boutique: null },
    ];
    const client = creerClientAuditsCaisse(lignes);
    const restant = await CD.chargerControlesVerifyRestants(client, 'nexus-station-test', 'America/Martinique');
    assert.strictEqual(restant, 2, 'validation partielle (1/2 caisse) ne doit pas compter comme quart fait');
    ok('chargerControlesVerifyRestants — validation partielle reste comptée comme travail restant');
  }

  // ------------------------------------------------------------
  // P0-3c — un quart RÉELLEMENT validé (les deux caisses) compte comme
  // fait ; le second quart, non saisi du tout, reste restant.
  // ------------------------------------------------------------
  {
    const maintenant = new Date().toISOString();
    const lignes = [
      { quart: 'quart1', ecart_piste: 1.2, ecart_boutique: -0.4, valide_le_piste: maintenant, valide_le_boutique: maintenant },
    ];
    const client = creerClientAuditsCaisse(lignes);
    const restant = await CD.chargerControlesVerifyRestants(client, 'nexus-station-test', 'America/Martinique');
    assert.strictEqual(restant, 1, 'quart1 réellement validé (2/2 caisses) doit compter comme fait ; quart2 jamais saisi reste restant');
    ok('chargerControlesVerifyRestants — quart réellement validé compte comme fait, le travail réellement restant ressort (1/2)');
  }

  // ------------------------------------------------------------
  // P0-3d — les deux quarts réellement validés -> 0 restant.
  // ------------------------------------------------------------
  {
    const maintenant = new Date().toISOString();
    const lignes = [
      { quart: 'quart1', ecart_piste: 1.2, ecart_boutique: -0.4, valide_le_piste: maintenant, valide_le_boutique: maintenant },
      { quart: 'quart2', ecart_piste: 0.1, ecart_boutique: 0.2, valide_le_piste: maintenant, valide_le_boutique: maintenant },
    ];
    const client = creerClientAuditsCaisse(lignes);
    const restant = await CD.chargerControlesVerifyRestants(client, 'nexus-station-test', 'America/Martinique');
    assert.strictEqual(restant, 0, 'les deux quarts réellement validés -> plus aucun contrôle restant');
    ok('chargerControlesVerifyRestants — journée entièrement validée -> 0 restant');
  }

  // ============================================================
  // P0-1c — chargerControlesVerifyRestants : wiring réel du fuseau. Stub
  // (sentinelle fixe), pas la vraie horloge : UTC et America/Martinique ne
  // divergent que ~4h/jour (00h-04h UTC) — un témoin basé sur "maintenant"
  // manquerait la régression le reste du temps. Le stub la détecte à
  // n'importe quelle heure d'exécution de la CI.
  // ============================================================
  {
    const capture = {};
    const client = creerClientAuditsCaisse([], capture);
    let tzRecu = null;
    global.NexusStation = { dateLocaleStation(timezone) { tzRecu = timezone; return 'SENTINELLE-2026-09-20'; } };
    await CD.chargerControlesVerifyRestants(client, 'nexus-station-test', 'America/Martinique');
    global.NexusStation = NexusStationReel;
    assert.strictEqual(tzRecu, 'America/Martinique', 'le fuseau du site doit traverser jusqu\'à NexusStation.dateLocaleStation');
    assert.strictEqual(capture.filtres.date, 'SENTINELLE-2026-09-20', 'le filtre de date doit venir de NexusStation.dateLocaleStation(timezone), jamais d\'un calcul UTC séparé');
    ok('chargerControlesVerifyRestants — la date requêtée vient bien de NexusStation.dateLocaleStation (preuve indépendante de l\'heure d\'exécution)');
  }

  // ------------------------------------------------------------
  // Non-régression P0-1c : fuseau absent -> comportement historique (UTC).
  // Couvre Brief, qui ne passe pas encore le fuseau (dette distincte, non
  // traitée par ce lot).
  // ------------------------------------------------------------
  {
    const capture = {};
    const client = creerClientAuditsCaisse([], capture);
    const attendu = new Date().toISOString().slice(0, 10);
    await CD.chargerControlesVerifyRestants(client, 'nexus-station-test');
    assert.strictEqual(capture.filtres.date, attendu, 'fuseau absent -> repli UTC identique à avant (non-régression, notamment pour Brief)');
    ok('chargerControlesVerifyRestants — fuseau absent : repli UTC inchangé, aucune régression (Brief non affecté)');
  }

  // ============================================================
  // P0-2 — preuve mécanique de l'écart, et de l'effet de la correction
  // proposée sur station_config.raccourcis (DONNÉE, non appliquée ici).
  // ============================================================
  {
    const APP = fs.readFileSync(path.join(__dirname, 'NEXUS-App-v1.html'), 'utf8');
    const bloc = APP.match(/function urgenceRaccourci\(([\s\S]*?)\n  \}/);
    assert.ok(bloc, 'urgenceRaccourci doit être extractible de NEXUS-App-v1.html');
    const urgenceRaccourci = new Function(`${bloc[0]}; return urgenceRaccourci;`)();

    const ctx = { alertesFdjNonVues: 22 };
    const urgenceValeurActuelle = urgenceRaccourci('NEXUS-FDJ-Analyse-v1.html', ctx);
    const urgenceValeurProposee = urgenceRaccourci('NEXUS-FDJ-Manager-v1.html', ctx);
    assert.strictEqual(urgenceValeurActuelle, 0, 'valeur ACTUELLE (NEXUS-FDJ-Analyse-v1.html) : urgenceRaccourci ne la reconnaît pas -> urgence 0 malgré 22 alertes non vues');
    assert.strictEqual(urgenceValeurProposee, 2, 'valeur PROPOSÉE (NEXUS-FDJ-Manager-v1.html) : urgenceRaccourci la reconnaît -> urgence 2, alertes visibles');
    ok('P0-2 — preuve non-Production : remplacer NEXUS-FDJ-Analyse-v1.html par NEXUS-FDJ-Manager-v1.html dans station_config.raccourcis rend l\'urgence FDJ visible (0 -> 2)');
  }

  console.log(`\n${n}/${n} tests passés — Continuité terrain P0-1/P0-3/P0-2 (NEXUS-CONTINUITE-TERRAIN-1-20260920).`);
}

main().catch(e => { console.error(e); process.exit(1); });
