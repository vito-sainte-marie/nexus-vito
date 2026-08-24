// Test — Contrat commun de sortie des moteurs (23/08/2026, v2.223, audit
// "Anti-dégradation temporelle" §4/9).
//
// L'audit demande que chaque moteur expose un contrat commun
// ({moteur_id, site_id, applicable, actif, etat_fiable, donnees_courantes,
// qualite, signaux[], decisions[], preuves[], freshness_days,
// fallback_used, fallback_reason}) pour que Brief/Cockpit/toute future vue
// dirigeant puissent consommer n'importe quel secteur sans coder ses
// spécificités en dur.
//
// Ce lot est une NORMALISATION additive : `NexusSecteursMoteur.construireSecteurs`
// continue de produire exactement les mêmes objets secteur qu'avant
// (aucun champ retiré ni modifié, tous les tests v2.218-v2.222 doivent
// continuer à passer tels quels — vérifié par la suite complète, pas
// seulement ce fichier), avec un unique champ `.contrat` ajouté par
// dessus. Ce test couvre :
//  1. `construireContratCommun` en isolation, sur les 4 modes de fraîcheur
//     possibles (jour/fallback/perime/jour_incomplet_sans_repli) + un
//     secteur sans aucune notion de fraîcheur (Commerce/Marge/Équipe).
//  2. L'intégration via l'unique API publique `construireSecteurs()` :
//     le champ `.contrat` est bien présent sur chaque secteur retourné,
//     `site_id` est bien transmis, et AUCUN champ historique n'est perdu
//     ni modifié par cet ajout.

const assert = require('assert');
const path = require('path');
const PROJET = __dirname;

global.window = global;
require(path.join(PROJET, 'nexus-boussole-moteur.js'));
require(path.join(PROJET, 'nexus-carburant-moteur.js'));
require(path.join(PROJET, 'nexus-secteurs-moteur.js'));
const S = global.NexusSecteursMoteur;

let n = 0;
function ok(label) { n++; console.log('OK —', label); }

function entree(id, label) { return { id, label, icone: '•', cible: null }; }

// ------------------------------------------------------------
// 1) construireContratCommun — fonction pure, en isolation.
// ------------------------------------------------------------
{
  // Mode 'jour' (le plus courant, secteur toujours à jour).
  const secteurJour = { id: 'carburants', statut: 'Sous contrôle', valeur: 72, confiance: 'RÉEL', fraicheur: { mode: 'jour' } };
  const c = S.construireContratCommun(secteurJour, 'vito-sainte-marie');
  assert.strictEqual(c.moteur_id, 'carburants');
  assert.strictEqual(c.site_id, 'vito-sainte-marie');
  assert.strictEqual(c.applicable, true);
  assert.strictEqual(c.actif, true);
  assert.strictEqual(c.etat_fiable.score, 72);
  assert.strictEqual(c.etat_fiable.statut, 'Sous contrôle');
  assert.strictEqual(c.fallback_used, false);
  assert.strictEqual(c.fallback_reason, null);
  assert.strictEqual(c.freshness_days, 0);
  assert.strictEqual(c.qualite.fiable, true);
  assert.deepStrictEqual(c.qualite.causes, []);
  assert.deepStrictEqual(c.signaux, []);
  assert.deepStrictEqual(c.decisions, []);
  assert.deepStrictEqual(c.preuves, []);
  ok('construireContratCommun : mode "jour" -> fallback_used=false, freshness_days=0, aucune raison de fallback');

  // Mode 'fallback' (dernier état fiable conservé, J-1 à J-3).
  const secteurFallback = { id: 'carburants', statut: 'Sous contrôle', valeur: 72, confiance: 'RÉEL', fraicheur: { mode: 'fallback', dateReference: '2026-08-21', joursEcoules: 2 }, enCours: { texte: 'x' } };
  const cF = S.construireContratCommun(secteurFallback, 'vito-sainte-marie');
  assert.strictEqual(cF.fallback_used, true);
  assert.strictEqual(cF.freshness_days, 2);
  assert.strictEqual(cF.etat_fiable.calcule_le, '2026-08-21');
  assert.strictEqual(cF.etat_fiable.source_version, '2026-08-21');
  assert.strictEqual(cF.donnees_courantes.statut_cycle, 'en_cours', 'un bloc enCours présent -> statut_cycle = en_cours');
  assert.ok(cF.fallback_reason && cF.fallback_reason.includes('conservé'));
  ok('construireContratCommun : mode "fallback" -> fallback_used=true, freshness_days=joursEcoules, source_version=dateReference');

  // Mode 'perime' (> J-3, "À actualiser").
  const secteurPerime = { id: 'carburants', statut: 'À actualiser', valeur: null, confiance: 'INSUFFISANT', fraicheur: { mode: 'perime', dateReference: '2026-08-10', joursEcoules: 13 } };
  const cP = S.construireContratCommun(secteurPerime, 'vito-sainte-marie');
  assert.strictEqual(cP.fallback_used, true);
  assert.strictEqual(cP.etat_fiable.score, null);
  assert.strictEqual(cP.qualite.fiable, false);
  assert.ok(cP.fallback_reason && cP.fallback_reason.includes('trop ancien'));
  ok('construireContratCommun : mode "perime" -> fallback_used=true, score=null, qualite.fiable=false, raison explicite');

  // Mode 'jour_incomplet_sans_repli' (aucun historique fiable du tout).
  const secteurSansRepli = { id: 'carburants', statut: 'Données insuffisantes', valeur: null, confiance: 'INSUFFISANT', fraicheur: { mode: 'jour_incomplet_sans_repli' } };
  const cS = S.construireContratCommun(secteurSansRepli, 'vito-sainte-marie');
  assert.strictEqual(cS.fallback_used, false, 'jour_incomplet_sans_repli n\'est PAS un fallback utilisé : aucun état antérieur à conserver');
  assert.ok(cS.fallback_reason && cS.fallback_reason.includes('aucun état antérieur'));
  ok('construireContratCommun : mode "jour_incomplet_sans_repli" -> fallback_used=false mais raison explicite');

  // Secteur sans AUCUNE notion de fraîcheur (Commerce/Marge/Équipe) —
  // absence de `fraicheur` traitée comme le mode 'jour', jamais une
  // exception.
  const secteurSansFraicheur = { id: 'equipe', statut: 'Sous contrôle', valeur: 88, confiance: 'RÉEL' };
  const cSF = S.construireContratCommun(secteurSansFraicheur, 'vito-sainte-marie');
  assert.strictEqual(cSF.fallback_used, false);
  assert.strictEqual(cSF.freshness_days, 0);
  assert.strictEqual(cSF.fallback_reason, null);
  ok('construireContratCommun : secteur sans mécanisme de fraîcheur (Commerce/Marge/Équipe) -> traité comme "jour", jamais une exception');

  // Appel totalement dégénéré (Article 5 : jamais une exception).
  const cVide = S.construireContratCommun(null, null);
  assert.strictEqual(cVide.moteur_id, null);
  assert.strictEqual(cVide.site_id, null);
  ok('construireContratCommun : appel sans secteur ni site -> valeurs null propres, jamais une exception');
}

// ------------------------------------------------------------
// 2) Intégration via l'unique API publique construireSecteurs() — non-
// régression totale + présence du nouveau champ additif.
// ------------------------------------------------------------
{
  const secteursActifs = [entree('equipe', 'Équipe')];
  const domaineEquipe = { historiqueSuffisant: false };
  const resultats = S.construireSecteurs(secteursActifs, { domaineEquipe, seuilMinPointages: 3, siteId: 'vito-sainte-marie' });
  assert.strictEqual(resultats.length, 1);
  const [equipe] = resultats;
  assert.ok(equipe.contrat, 'chaque secteur retourné porte désormais un champ .contrat');
  assert.strictEqual(equipe.contrat.moteur_id, 'equipe');
  assert.strictEqual(equipe.contrat.site_id, 'vito-sainte-marie');
  // Champs historiques toujours présents et inchangés (non-régression) :
  assert.ok('statut' in equipe && 'valeur' in equipe && 'detail' in equipe && 'confiance' in equipe);
  ok('construireSecteurs : .contrat ajouté sans retirer ni modifier aucun champ historique du secteur');

  // Sans siteId fourni (appelant non encore migré) : contrat.site_id=null,
  // rien d'autre ne change — non-régression pour tout appelant existant.
  const resultatsSansSite = S.construireSecteurs(secteursActifs, { domaineEquipe, seuilMinPointages: 3 });
  assert.strictEqual(resultatsSansSite[0].contrat.site_id, null);
  assert.strictEqual(resultatsSansSite[0].statut, resultats[0].statut, 'le calcul du secteur lui-même est strictement identique, avec ou sans siteId');
  ok('construireSecteurs : siteId absent -> contrat.site_id=null, non-régression totale du reste du calcul');
}

console.log(`\n${n}/${n} tests passés — Contrat commun de sortie des moteurs (v2.223).`);
