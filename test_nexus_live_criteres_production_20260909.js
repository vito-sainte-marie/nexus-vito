'use strict';
const assert = require('assert');
const { STATUT, VERDICT, evaluerCriteresProduction } = require('./nexus-live-criteres-production.js');

let passed = 0;
function ok(cond, msg) { assert.ok(cond, msg); passed++; console.log(`  OK — ${msg}`); }

const MAINTENANT = Date.parse('2026-09-09T12:00:00Z');
const CANDIDATE = 'ba1eed0e833c354f556128dc0ee4b0619725ed1a';

function faitsComplets(overrides) {
  return Object.assign({
    candidateSha: CANDIDATE,
    maintenantMs: MAINTENANT,
    ciVerteSurCandidate: true,
    railHandoffConforme: true,
    manifesteMigrationsAJour: true,
    mesuresProductionFraiches: { horodatage: '2026-09-09T10:00:00Z' },
    fenetreDeploiementConfirmee: true,
    sauvegardesPrealables: true,
    gateHumaineFrederic: { release: CANDIDATE, autorise: true, impact: 'manifeste-migrations-production-1.md' },
  }, overrides || {});
}

// 1) Aucun fait fourni : fail-closed, jamais PRET par défaut.
{
  const r = evaluerCriteresProduction({});
  ok(r.verdict === VERDICT.INCONNU, 'aucun fait fourni -> verdict INCONNU, jamais PRET par défaut');
  ok(Object.values(r.criteres).every(v => v === STATUT.INCONNU), 'tous les critères INCONNU par défaut');
}

// 2) undefined en entrée : ne plante pas, reste fail-closed.
{
  const r = evaluerCriteresProduction(undefined);
  ok(r.verdict === VERDICT.INCONNU, 'faits undefined -> INCONNU, pas d’exception');
}

// 3) Tous les critères réunis, gate nommant la bonne release : PRET.
{
  const r = evaluerCriteresProduction(faitsComplets());
  ok(r.verdict === VERDICT.PRET, 'tous les critères OK + gate sur la bonne release -> PRET_POUR_PRODUCTION');
}

// 4) Un seul critère bloquant suffit à interdire PRET, même si tout le reste est vert.
{
  const r = evaluerCriteresProduction(faitsComplets({ ciVerteSurCandidate: false }));
  ok(r.verdict === VERDICT.NON_PRET, 'CI rouge -> NON_PRET même si tout le reste est vert');
  ok(r.criteres.ci_verte_sur_candidate === STATUT.BLOQUE, 'le critère CI est marqué BLOQUE');
}

// 5) Gate humaine absente : INCONNU, jamais PRET (la gate ne se déduit jamais).
{
  const r = evaluerCriteresProduction(faitsComplets({ gateHumaineFrederic: undefined }));
  ok(r.verdict === VERDICT.INCONNU, 'gate humaine absente -> INCONNU, pas PRET');
  ok(r.criteres.gate_humaine_frederic === STATUT.INCONNU, 'critère gate = INCONNU');
}

// 6) Gate humaine nommant une AUTRE release : BLOQUE, jamais confondue avec la candidate courante.
{
  const r = evaluerCriteresProduction(faitsComplets({
    gateHumaineFrederic: { release: 'un-autre-sha-1234567', autorise: true, impact: 'x' },
  }));
  ok(r.criteres.gate_humaine_frederic === STATUT.BLOQUE, 'gate sur une autre release -> BLOQUE, ne couvre pas celle-ci');
  ok(r.verdict === VERDICT.NON_PRET, 'verdict global NON_PRET en conséquence');
}

// 7) Gate humaine "autorise: true" mais sans impact nommé : forme incomplète, INCONNU (pas OK).
{
  const r = evaluerCriteresProduction(faitsComplets({
    gateHumaineFrederic: { release: CANDIDATE, autorise: true },
  }));
  ok(r.criteres.gate_humaine_frederic === STATUT.INCONNU, 'gate sans impact nommé -> INCONNU, pas une gate valide');
}

// 8) Mesures Production périmées (> 24h) : BLOQUE, jamais considérées valables par défaut.
{
  const r = evaluerCriteresProduction(faitsComplets({
    mesuresProductionFraiches: { horodatage: '2026-09-06T10:00:00Z' },
  }));
  ok(r.criteres.mesures_production_fraiches === STATUT.BLOQUE, 'mesure de plus de 24h -> BLOQUE');
}

// 9) Mesures Production dans le futur (horloge incohérente) : INCONNU, jamais OK par optimisme.
{
  const r = evaluerCriteresProduction(faitsComplets({
    mesuresProductionFraiches: { horodatage: '2026-09-10T00:00:00Z' },
  }));
  ok(r.criteres.mesures_production_fraiches === STATUT.INCONNU, 'horodatage futur -> INCONNU, pas OK');
}

// 10) Mutation négative : si statutBooleen(false) devait par erreur retourner OK,
// le critère CI resterait vert malgré ciVerteSurCandidate=false — ce test échouerait.
// Vérifié explicitement pour documenter la preuve, pas seulement l'affirmer.
{
  const r = evaluerCriteresProduction(faitsComplets({ railHandoffConforme: false }));
  assert.notStrictEqual(r.criteres.rail_handoff_conforme, STATUT.OK,
    'mutation négative : un fait false ne doit jamais produire un statut OK');
  passed++;
  console.log('  OK — mutation négative : false ne produit jamais OK (rail Handoff)');
}

console.log(`\n${passed} vérifications passées.`);
