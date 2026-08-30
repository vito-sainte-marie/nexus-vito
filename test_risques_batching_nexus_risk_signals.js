// Test — Batching écriture nexus_risk_signals (30/08/2026, v2.305, suite du
// P0 v2.304 — Frédéric a confirmé "ok attaque" pour le refactor proposé).
//
// Avant ce lot, `qualifierEtEnregistrerRisquesPilote` appelait
// `enregistrerObservation` une fois PAR candidat (6 domaines confondus) —
// soit 1 SELECT + 1 INSERT/UPDATE par signal. Mesuré en production sur
// vito-sainte-marie : jusqu'à 93 produits Inventaire en écart simultané,
// soit jusqu'à ~186 requêtes HTTP pour un seul chargement de Contrôle
// Inventaire (rafale remontée par Frédéric le 30/08/2026, cf. P0 v2.304).
//
// Ce fichier vérifie :
//   1. chargerSignauxExistantsParCles — lecture groupée par cle_signal,
//      court-circuite (0 requête) si la liste de clés est vide.
//   2. construireLigneSignal — fonction pure, insert-shape et update-shape,
//      avec préservation stricte de premiere_detection_le (Article 5 : ne
//      jamais faire redémarrer "surveillé depuis N jours" à zéro) et reset
//      correct de resolu_le/resolu_note quand un signal résolu réapparaît.
//   3. enregistrerObservationsEnLot — au plus 2 requêtes Supabase (1 lecture
//      groupée + 1 upsert groupé) quel que soit le nombre de candidats, y
//      compris 0 requête si la liste de candidats est vide.
//   4. qualifierEtEnregistrerRisquesPilote — non-régression fonctionnelle
//      sur les 6 domaines pilotes (caisse, marge, carburant, inventaire,
//      fdj, equipe) avec le nouveau mécanisme en lot : même comportement de
//      filtrage par domaine qu'avant (candidat ignoré si donnée non
//      exploitable), mais 2 requêtes d'écriture au lieu de N.

global.window = global;
const path = require('path');
const assert = require('assert');
const fs = require('fs');

const CANDIDATS_DIR = [
  '/sessions/dazzling-compassionate-ride/mnt/image nexus project',
  '/Users/fredericbragance/Library/Mobile Documents/com~apple~CloudDocs/Desktop/projet NEXUS OS/Code Nexus/nexus/image nexus project',
];
const DIR = CANDIDATS_DIR.find(d => fs.existsSync(path.join(d, 'nexus-risques-donnees.js')));
if (!DIR) throw new Error('nexus-risques-donnees.js introuvable');

require(path.join(DIR, 'nexus-verify-moteur.js'));
require(path.join(DIR, 'nexus-risques-moteur.js'));
require(path.join(DIR, 'nexus-risques-donnees.js'));
const D = global.NexusRisquesDonnees;

let n = 0;
function ok(label) { n++; console.log('OK —', label); }

// Client mocké générique : table `nexus_risk_signals` en mémoire, compte
// les appels `.in(...)` (lecture groupée) et `.upsert(...)` séparément des
// simples `.select().eq(...)` (ex. chargerSignauxSite) — c'est cette
// distinction qui permet de prouver "au plus 2 requêtes d'écriture, quel
// que soit N candidats" plutôt que de simplement affirmer une amélioration.
function mockRisqueClient(seedRows) {
  const rows = (seedRows || []).slice();
  const appels = { in: 0, upsert: 0, selectSimple: 0, fromAppele: 0 };
  return {
    _rows: () => rows,
    _appels: () => appels,
    from(nomTable) {
      assert.strictEqual(nomTable, 'nexus_risk_signals', 'ce mock ne sert que nexus_risk_signals');
      appels.fromAppele++;
      const q = { _filtres: {} };
      q.select = () => q;
      q.eq = (col, val) => { q._filtres[col] = val; return q; };
      q.in = (col, vals) => { q._in = { col, vals }; appels.in++; return q; };
      q.maybeSingle = () => {
        const trouve = rows.find(r => Object.keys(q._filtres).every(k => r[k] === q._filtres[k]));
        return Promise.resolve({ data: trouve || null, error: null });
      };
      q.upsert = (lignes, opts) => {
        appels.upsert++;
        q._upsertLignes = lignes; q._upsertOpts = opts;
        lignes.forEach(ligne => {
          const idx = rows.findIndex(r => r.site_id === ligne.site_id && r.cle_signal === ligne.cle_signal);
          if (idx >= 0) rows[idx] = { ...rows[idx], ...ligne };
          else rows.push({ id: 'gen-' + rows.length, created_at: '2020-01-01T00:00:00.000Z', ...ligne });
        });
        return q;
      };
      q.then = (resolve, reject) => {
        try {
          if (q._upsertLignes) {
            const data = q._upsertLignes.map(l => rows.find(r => r.site_id === l.site_id && r.cle_signal === l.cle_signal));
            return Promise.resolve({ data, error: null }).then(resolve);
          }
          if (q._in) {
            const data = rows.filter(r => q._in.vals.includes(r.cle_signal) && Object.keys(q._filtres).every(k => r[k] === q._filtres[k]));
            return Promise.resolve({ data, error: null }).then(resolve);
          }
          appels.selectSimple++;
          const data = rows.filter(r => Object.keys(q._filtres).every(k => r[k] === q._filtres[k]));
          return Promise.resolve({ data, error: null }).then(resolve);
        } catch (e) { return Promise.reject(e).catch(reject); }
      };
      return q;
    },
  };
}

function clientInterdit() {
  return { from() { throw new Error("aucun accès à 'nexus_risk_signals' ne devrait avoir lieu ici"); } };
}

(async () => {

// ------------------------------------------------------------
// 1) chargerSignauxExistantsParCles
// ------------------------------------------------------------
{
  const map = await D.chargerSignauxExistantsParCles(clientInterdit(), 'vito-sainte-marie', []);
  assert.deepStrictEqual(map, {}, 'liste de clés vide -> {} sans requête');
  ok('chargerSignauxExistantsParCles — liste vide court-circuite (0 requête Supabase)');
}
{
  const client = mockRisqueClient([
    { site_id: 'vito-sainte-marie', cle_signal: 'inventaire:produit:HuileA', niveau: 'exposition', historique_transitions: [], premiere_detection_le: '2026-08-01T00:00:00.000Z', statut: 'surveille' },
    { site_id: 'vito-sainte-marie', cle_signal: 'caisse:quart:1', niveau: 'anomalie', historique_transitions: [], premiere_detection_le: '2026-08-15T00:00:00.000Z', statut: 'surveille' },
    { site_id: 'AUTRE-SITE', cle_signal: 'inventaire:produit:HuileA', niveau: 'risque_avere', historique_transitions: [], premiere_detection_le: '2026-01-01T00:00:00.000Z', statut: 'surveille' },
  ]);
  const map = await D.chargerSignauxExistantsParCles(client, 'vito-sainte-marie', ['inventaire:produit:HuileA', 'caisse:quart:1', 'marge:categorie:Boissons']);
  assert.strictEqual(client._appels().in, 1, 'une seule requête .in(...) quel que soit le nombre de clés');
  assert.strictEqual(Object.keys(map).length, 2, 'seuls les signaux existants du bon site apparaissent');
  assert.strictEqual(map['inventaire:produit:HuileA'].niveau, 'exposition', "le signal d'un autre site (même cle_signal) ne doit jamais être confondu");
  assert.strictEqual(map['marge:categorie:Boissons'], undefined, 'clé jamais vue -> absente de la map');
  ok('chargerSignauxExistantsParCles — lecture groupée par cle_signal, filtrée par site, 1 seule requête');
}

// ------------------------------------------------------------
// 2) construireLigneSignal (fonction pure)
// ------------------------------------------------------------
{
  const maintenant = '2026-08-30T12:00:00.000Z';
  const params = {
    domaine: 'inventaire', cleSignal: 'inventaire:produit:HuileB', typeSignal: 'alerte_inventaire_recurrente',
    secteur: 'Opérations', actionRecommandee: 'Vérifiez la fiche produit.',
    classification: { niveau: 'exposition', niveauConfiance: 'haute', preuve: { x: 1 }, impactMesureEur: 12, impactPotentielEur: 40, recurrenceCount: 2, motif: 'Écart récurrent.' },
  };
  const ligne = D.construireLigneSignal('vito-sainte-marie', params, null, maintenant);
  assert.strictEqual(ligne.premiere_detection_le, maintenant);
  assert.strictEqual(ligne.derniere_detection_le, maintenant);
  assert.strictEqual(ligne.statut, 'surveille');
  assert.strictEqual(ligne.resolu_le, null);
  assert.deepStrictEqual(ligne.historique_transitions, [{ date: maintenant, ancien_niveau: null, nouveau_niveau: 'exposition', motif: 'Écart récurrent.' }]);
  assert.ok(!('id' in ligne), "jamais de colonne 'id' dans une ligne à upserter — laisser la base gérer l'auto-incrément à l'insert");
  assert.ok(!('created_at' in ligne), "jamais de colonne 'created_at' dans une ligne à upserter — laisser la base gérer le défaut à l'insert");
  ok('construireLigneSignal — nouveau signal (insert-shape) : mêmes valeurs que l’ancienne branche insert, sans id/created_at');
}
{
  const existant = {
    id: 'sig-1', niveau: 'exposition', statut: 'surveille',
    premiere_detection_le: '2026-08-01T00:00:00.000Z', historique_transitions: [{ date: '2026-08-01T00:00:00.000Z', ancien_niveau: null, nouveau_niveau: 'exposition', motif: 'Init.' }],
    action_recommandee: 'Ancienne action.', recurrence_count: 3, secteur: 'Opérations',
  };
  const params = {
    domaine: 'inventaire', cleSignal: 'inventaire:produit:HuileB', typeSignal: 'alerte_inventaire_recurrente',
    secteur: 'Opérations', actionRecommandee: 'Nouvelle action.',
    classification: { niveau: 'exposition', niveauConfiance: 'haute', preuve: {}, impactMesureEur: 12, impactPotentielEur: 40, recurrenceCount: 4, motif: 'Toujours en écart.' },
  };
  const maintenant = '2026-08-30T12:00:00.000Z';
  const ligne = D.construireLigneSignal('vito-sainte-marie', params, existant, maintenant);
  assert.strictEqual(ligne.premiere_detection_le, existant.premiere_detection_le, 'transition stable : premiere_detection_le JAMAIS réécrit');
  assert.deepStrictEqual(ligne.historique_transitions, existant.historique_transitions, 'transition stable : historique inchangé, aucune entrée ajoutée');
  ok('construireLigneSignal — signal existant, transition stable : premiere_detection_le préservé, historique inchangé');
}
{
  const existant = {
    id: 'sig-2', niveau: 'signal_faible', statut: 'surveille',
    premiere_detection_le: '2026-08-10T00:00:00.000Z', historique_transitions: [{ date: '2026-08-10T00:00:00.000Z', ancien_niveau: null, nouveau_niveau: 'signal_faible', motif: 'Init.' }],
    action_recommandee: 'Action existante.', recurrence_count: 1,
  };
  const params = {
    domaine: 'caisse', cleSignal: 'caisse:quart:1', typeSignal: 'ecart_caisse_recurrent', secteur: 'Opérations',
    classification: { niveau: 'risque_avere', niveauConfiance: 'haute', preuve: {}, impactMesureEur: 300, impactPotentielEur: 900, recurrenceCount: 5, motif: 'Escalade confirmée.' },
  };
  const maintenant = '2026-08-30T12:00:00.000Z';
  const ligne = D.construireLigneSignal('vito-sainte-marie', params, existant, maintenant);
  assert.strictEqual(ligne.premiere_detection_le, existant.premiere_detection_le, 'escalade : premiere_detection_le toujours préservé');
  assert.strictEqual(ligne.historique_transitions.length, 2, 'escalade : une entrée ajoutée à historique_transitions');
  assert.deepStrictEqual(ligne.historique_transitions[1], { date: maintenant, ancien_niveau: 'signal_faible', nouveau_niveau: 'risque_avere', motif: 'Escalade confirmée.' });
  ok('construireLigneSignal — escalade : historique_transitions complété, premiere_detection_le préservé');
}
{
  const existant = {
    id: 'sig-3', niveau: 'anomalie', statut: 'resolu', resolu_le: '2026-08-20T00:00:00.000Z', resolu_note: 'Traité.',
    premiere_detection_le: '2026-07-01T00:00:00.000Z', historique_transitions: [], action_recommandee: null, recurrence_count: 1,
  };
  const params = {
    domaine: 'equipe', cleSignal: 'equipe:collaborateur:Jean', typeSignal: 'ponctualite_recurrente', secteur: 'Équipe',
    classification: { niveau: 'signal_faible', niveauConfiance: 'moyenne', preuve: {}, impactMesureEur: null, impactPotentielEur: null, recurrenceCount: 1, motif: 'Retard réapparu.' },
  };
  const ligne = D.construireLigneSignal('vito-sainte-marie', params, existant, '2026-08-30T12:00:00.000Z');
  assert.strictEqual(ligne.statut, 'surveille', 'un signal résolu qui réapparaît est rouvert');
  assert.strictEqual(ligne.resolu_le, null);
  assert.strictEqual(ligne.resolu_note, null);
  ok('construireLigneSignal — signal résolu qui réapparaît : rouvert (resolu_le/resolu_note remis à null)');
}

// ------------------------------------------------------------
// 3) enregistrerObservationsEnLot — au plus 2 requêtes, quel que soit N
// ------------------------------------------------------------
{
  const resultat = await D.enregistrerObservationsEnLot(clientInterdit(), 'vito-sainte-marie', []);
  assert.deepStrictEqual(resultat, []);
  ok('enregistrerObservationsEnLot — liste de candidats vide -> [] sans aucune requête Supabase');
}
{
  // Simule un mini-"rafale" : 20 candidats, dont 1 déjà connu (avec une
  // ancienneté à préserver) — reproduit à petite échelle le cas réel des 93
  // produits Inventaire simultanés.
  const seed = [{ site_id: 'vito-sainte-marie', cle_signal: 'inventaire:produit:P0', niveau: 'exposition', statut: 'surveille', historique_transitions: [], premiere_detection_le: '2026-08-01T00:00:00.000Z', action_recommandee: 'Ancienne action.', recurrence_count: 2 }];
  const client = mockRisqueClient(seed);
  const candidats = [];
  for (let i = 0; i < 20; i++) {
    candidats.push({
      domaine: 'inventaire', cleSignal: `inventaire:produit:P${i}`, typeSignal: 'alerte_inventaire_recurrente', secteur: 'Opérations',
      actionRecommandee: `Vérifiez P${i}.`,
      classification: { niveau: 'exposition', niveauConfiance: 'haute', preuve: {}, impactMesureEur: 10, impactPotentielEur: 30, recurrenceCount: 2, motif: `Écart sur P${i}.` },
    });
  }
  const resultat = await D.enregistrerObservationsEnLot(client, 'vito-sainte-marie', candidats);
  assert.strictEqual(client._appels().in, 1, '1 seule lecture groupée pour 20 candidats');
  assert.strictEqual(client._appels().upsert, 1, '1 seul upsert groupé pour 20 candidats');
  assert.strictEqual(resultat.length, 20);
  const p0 = client._rows().find(r => r.cle_signal === 'inventaire:produit:P0');
  assert.strictEqual(p0.premiere_detection_le, '2026-08-01T00:00:00.000Z', 'le signal déjà connu conserve sa premiere_detection_le après upsert en lot');
  assert.strictEqual(client._appels().selectSimple, 0, "l'upsert ne doit jamais transiter par le chemin 'simple select'");
  ok('enregistrerObservationsEnLot — 20 candidats (1 déjà connu) -> exactement 2 requêtes (1 lecture groupée + 1 upsert), ancienneté préservée');
}

// ------------------------------------------------------------
// 4) qualifierEtEnregistrerRisquesPilote — non-régression 6 domaines +
//    volume de requêtes indépendant du nombre de candidats.
// ------------------------------------------------------------
{
  const client = mockRisqueClient([]);
  const alertesInventaire = {};
  for (let i = 0; i < 15; i++) {
    alertesInventaire[`prod-${i}`] = { designation: `Huile ${i}`, gravite: 'attention', valeurEstimeeTotal: 20, nbAlertesRecentes: 2 };
  }
  alertesInventaire['prod-ignore'] = null; // donnée non exploitable -> aucun candidat, comme avant le refactor.

  const params = {
    agregationCaisseParQuart: {
      '1': { total: 10, ecartCumule: 5, parStatut: { conforme: 8, surveiller: 1, anomalie: 1, critique: 0 } },
      '2': { total: 0, ecartCumule: 0, parStatut: { conforme: 0, surveiller: 0, anomalie: 0, critique: 0 } }, // total=0 -> ignoré, comme avant.
    },
    periodeAffichage: { debut: '2026-08-01', fin: '2026-08-31' },
    categoriesEnEcart: ['Boissons'],
    rowsBrut: [
      { categorie: 'Boissons', periode_debut: '2026-08-01', ca: 1000, marge: 150 },
    ],
    autonomiesCarburant: {
      go: { autonomieJours: 2, historiqueAutonomieJours: [3, 4], seuilAlerteJours: 3, seuilVigilanceJours: 5 },
      sp95: null, // non exploitable -> ignoré.
    },
    alertesInventaire,
    agregationCaisseFdjParQuart: {
      '1': { total: 5, ecartCumule: 20, parStatut: { conforme: 4, surveiller: 1, anomalie: 0, critique: 0 } },
    },
    ponctualiteCollaborateurs: {
      'emp-1': { nom: 'Jean', nbRetards: 3, totalPointages: 20 },
      'emp-2': { nom: 'Marie', nbRetards: 0, totalPointages: 15 }, // 0 retard -> ignoré, comme avant.
    },
  };

  const signaux = await D.qualifierEtEnregistrerRisquesPilote(client, 'vito-sainte-marie', params);

  // Volume : 1 lecture groupée + 1 upsert groupé pour l'écriture, peu
  // importe que les 6 domaines totalisent 15(inventaire)+1(caisse)+1(marge)+1(carburant)+1(fdj)+1(equipe) = 20 candidats.
  assert.strictEqual(client._appels().in, 1, "l'écriture des 20 candidats des 6 domaines tient en 1 seule lecture groupée");
  assert.strictEqual(client._appels().upsert, 1, "l'écriture des 20 candidats des 6 domaines tient en 1 seul upsert groupé");

  const parCle = {}; signaux.forEach(s => { parCle[s.cle_signal] = s; });
  assert.ok(parCle['caisse:quart:1'], 'domaine caisse : signal du quart avec audits présent');
  assert.ok(!parCle['caisse:quart:2'], 'domaine caisse : quart sans audit (total=0) ignoré, comme avant le refactor');
  assert.ok(parCle['marge:categorie:Boissons'], 'domaine marge : catégorie en écart présente');
  assert.ok(parCle['carburant:autonomie:go'], 'domaine carburant : go présent');
  assert.ok(!parCle['carburant:autonomie:sp95'], 'domaine carburant : sp95 sans donnée ignoré');
  assert.strictEqual(Object.keys(alertesInventaire).filter(k => parCle[`inventaire:produit:${alertesInventaire[k] ? alertesInventaire[k].designation : ''}`]).length, 15, 'domaine inventaire : les 15 produits exploitables sont bien enregistrés');
  assert.ok(parCle['fdj:quart:1'], 'domaine fdj : signal du quart présent');
  assert.ok(parCle['equipe:collaborateur:Jean'], 'domaine équipe : collaborateur avec retard présent');
  assert.ok(!parCle['equipe:collaborateur:Marie'], 'domaine équipe : collaborateur sans retard ignoré');
  assert.strictEqual(signaux.length, 20, '20 signaux au total (1 caisse + 1 marge + 1 carburant + 15 inventaire + 1 fdj + 1 équipe)');
  signaux.forEach(s => assert.strictEqual(s.statut, 'surveille'));

  ok('qualifierEtEnregistrerRisquesPilote — 6 domaines, 20 candidats -> 2 requêtes d’écriture (au lieu de 20), non-régression du filtrage par domaine');
}
{
  // Non-régression : periodeAffichage absent -> volet Marge entièrement
  // ignoré (aucun candidat), exactement comme avant le refactor.
  const client = mockRisqueClient([]);
  const signaux = await D.qualifierEtEnregistrerRisquesPilote(client, 'vito-sainte-marie', {
    categoriesEnEcart: ['Boissons'], rowsBrut: [{ categorie: 'Boissons', periode_debut: '2026-08-01', ca: 1000, marge: 150 }],
    periodeAffichage: null,
  });
  assert.strictEqual(signaux.length, 0, 'sans periodeAffichage, aucun candidat marge -> aucune écriture');
  assert.strictEqual(client._appels().in, 0, 'aucun candidat du tout -> enregistrerObservationsEnLot court-circuite avant toute requête');
  ok('qualifierEtEnregistrerRisquesPilote — periodeAffichage absent : volet Marge ignoré, 0 requête (court-circuit total si aucun candidat)');
}

console.log(`\n${n} test(s) passé(s) — test_risques_batching_nexus_risk_signals.js`);
})();
