'use strict';
const assert = require('assert');
const { STATUT, VERDICT, AUTORISATION, evaluerCriteresProduction } = require('./nexus-live-criteres-production.js');

let passed = 0;
function ok(cond, msg) { assert.ok(cond, msg); passed++; console.log(`  OK — ${msg}`); }

const MAINTENANT = Date.parse('2026-09-09T12:00:00Z');
const CANDIDATE = 'ba1eed0e833c354f556128dc0ee4b0619725ed1a';

// Les dix faits qui couvrent exactement les dix critères de decision-2.md §7 —
// aucun rapport avec la gate humaine, volontairement fournie à part.
function dixCriteresOk(overrides) {
  return Object.assign({
    candidateSha: CANDIDATE,
    maintenantMs: MAINTENANT,
    ciVerteSurCandidate: true,
    guardiansRequisConformes: true,
    railHandoffConforme: true,
    manifesteMigrationsAJour: true,
    mesuresProductionFraiches: { horodatage: '2026-09-09T10:00:00Z' },
    aucunImpactDmlInconnu: true,
    preprodAnonymiseOuEquivalent: true,
    repetitionMigrationsRecetteReussie: true,
    planReparationRollbackDocumente: true,
    fenetreDeploiementConfirmee: true,
    aucunBlocageNonResolu: true,
  }, overrides || {});
}

const GATE_VALIDE = { release: CANDIDATE, autorise: true, impact: 'manifeste-migrations-production-1.md' };

// 1) Aucun fait fourni : fail-closed, jamais PRET par défaut.
{
  const r = evaluerCriteresProduction({});
  ok(r.verdict === VERDICT.INCONNU, 'aucun fait fourni -> verdict INCONNU, jamais PRET par défaut');
  ok(Object.values(r.criteres).every(v => v === STATUT.INCONNU), 'tous les dix critères INCONNU par défaut');
  ok(r.gate_humaine_frederic === STATUT.INCONNU, 'gate humaine INCONNU par défaut, elle aussi');
  ok(r.autorisation_production === AUTORISATION.NON_AUTORISEE, 'aucune autorisation Production par défaut');
}

// 2) undefined en entrée : ne plante pas, reste fail-closed.
{
  const r = evaluerCriteresProduction(undefined);
  ok(r.verdict === VERDICT.INCONNU, 'faits undefined -> INCONNU, pas d’exception');
}

// 3) Les dix critères réunis, SANS gate humaine : PRET_POUR_PRODUCTION quand même —
// c'est exactement le point de decision-2.md : "peut être soumis à Frédéric",
// pas "Frédéric a déjà tranché". La gate ne doit jamais être un onzième critère.
{
  const r = evaluerCriteresProduction(dixCriteresOk());
  ok(r.verdict === VERDICT.PRET, 'les dix critères OK -> PRET_POUR_PRODUCTION, même sans gate humaine');
  ok(r.gate_humaine_frederic === STATUT.INCONNU, 'la gate reste INCONNU tant qu’elle n’est pas fournie');
  ok(r.autorisation_production === AUTORISATION.NON_AUTORISEE, 'PRET_POUR_PRODUCTION n’autorise jamais Production à lui seul');
}

// 4) Les dix critères + une gate humaine valide et concordante : autorisation Production.
{
  const r = evaluerCriteresProduction(dixCriteresOk({ gateHumaineFrederic: GATE_VALIDE }));
  ok(r.verdict === VERDICT.PRET, 'verdict toujours PRET_POUR_PRODUCTION');
  ok(r.gate_humaine_frederic === STATUT.OK, 'gate humaine OK');
  ok(r.autorisation_production === AUTORISATION.AUTORISEE, 'PRET + gate concordante -> autorisation Production, et seulement alors');
}

// 5) Un seul critère bloquant parmi les dix suffit à interdire PRET, même gate humaine posée.
{
  const r = evaluerCriteresProduction(dixCriteresOk({ ciVerteSurCandidate: false, gateHumaineFrederic: GATE_VALIDE }));
  ok(r.verdict === VERDICT.NON_PRET, 'CI rouge -> NON_PRET même si tout le reste (dont la gate) est vert');
  ok(r.criteres.ci_et_guardians_conformes === STATUT.BLOQUE, 'le critère CI/Guardians est marqué BLOQUE');
  ok(r.autorisation_production === AUTORISATION.NON_AUTORISEE, 'aucune autorisation Production si le verdict n’est pas PRET');
}

// 6) CI/Guardians : les deux faits sont nécessaires, l'un ne compense jamais l'absence de l'autre.
{
  const r1 = evaluerCriteresProduction(dixCriteresOk({ guardiansRequisConformes: undefined }));
  ok(r1.criteres.ci_et_guardians_conformes === STATUT.INCONNU, 'Guardians non renseignés -> INCONNU même si CI verte');
  const r2 = evaluerCriteresProduction(dixCriteresOk({ guardiansRequisConformes: false }));
  ok(r2.criteres.ci_et_guardians_conformes === STATUT.BLOQUE, 'Guardians non conformes -> BLOQUE même si CI verte');
}

// 7) Candidate SHA absent ou mal formé : INCONNU, jamais déduit d'autre chose.
{
  const r1 = evaluerCriteresProduction(dixCriteresOk({ candidateSha: undefined }));
  ok(r1.criteres.candidate_immuable_identifiee === STATUT.INCONNU, 'SHA absent -> INCONNU');
  const r2 = evaluerCriteresProduction(dixCriteresOk({ candidateSha: 'pas-un-sha' }));
  ok(r2.criteres.candidate_immuable_identifiee === STATUT.INCONNU, 'SHA mal formé -> INCONNU, pas accepté tel quel');
}

// 8) Gate humaine absente : reste INCONNU, jamais déduite d'un verdict PRET.
{
  const r = evaluerCriteresProduction(dixCriteresOk({ gateHumaineFrederic: undefined }));
  ok(r.gate_humaine_frederic === STATUT.INCONNU, 'gate humaine absente -> INCONNU');
  ok(r.autorisation_production === AUTORISATION.NON_AUTORISEE, 'pas d’autorisation sans gate');
}

// 9) Gate humaine nommant une AUTRE release : BLOQUE, jamais confondue avec la candidate courante.
{
  const r = evaluerCriteresProduction(dixCriteresOk({
    gateHumaineFrederic: { release: 'un-autre-sha-1234567', autorise: true, impact: 'x' },
  }));
  ok(r.gate_humaine_frederic === STATUT.BLOQUE, 'gate sur une autre release -> BLOQUE, ne couvre pas celle-ci');
  ok(r.autorisation_production === AUTORISATION.NON_AUTORISEE, 'aucune autorisation Production en conséquence');
}

// 10) Gate humaine "autorise: true" mais sans impact nommé : forme incomplète, INCONNU (pas OK).
{
  const r = evaluerCriteresProduction(dixCriteresOk({
    gateHumaineFrederic: { release: CANDIDATE, autorise: true },
  }));
  ok(r.gate_humaine_frederic === STATUT.INCONNU, 'gate sans impact nommé -> INCONNU, pas une gate valide');
}

// 11) Mesures Production périmées (> 24h) : BLOQUE, jamais considérées valables par défaut.
{
  const r = evaluerCriteresProduction(dixCriteresOk({
    mesuresProductionFraiches: { horodatage: '2026-09-06T10:00:00Z' },
  }));
  ok(r.criteres.impacts_production_mesures_horodates === STATUT.BLOQUE, 'mesure de plus de 24h -> BLOQUE');
}

// 12) Mesures Production dans le futur (horloge incohérente) : INCONNU, jamais OK par optimisme.
{
  const r = evaluerCriteresProduction(dixCriteresOk({
    mesuresProductionFraiches: { horodatage: '2026-09-10T00:00:00Z' },
  }));
  ok(r.criteres.impacts_production_mesures_horodates === STATUT.INCONNU, 'horodatage futur -> INCONNU, pas OK');
}

// 13) Chacun des dix critères manquant isolément ramène le verdict à INCONNU (jamais PRET).
{
  const clefs = [
    'ciVerteSurCandidate', 'guardiansRequisConformes', 'railHandoffConforme', 'manifesteMigrationsAJour',
    'aucunImpactDmlInconnu', 'preprodAnonymiseOuEquivalent', 'repetitionMigrationsRecetteReussie',
    'planReparationRollbackDocumente', 'fenetreDeploiementConfirmee', 'aucunBlocageNonResolu',
  ];
  for (const clef of clefs) {
    const r = evaluerCriteresProduction(dixCriteresOk({ [clef]: undefined }));
    assert.notStrictEqual(r.verdict, VERDICT.PRET, `${clef} manquant -> jamais PRET_POUR_PRODUCTION`);
  }
  passed++;
  console.log(`  OK — chacun des dix critères, retiré isolément, empêche PRET_POUR_PRODUCTION (${clefs.length} clefs éprouvées)`);
}

// 14) Mutation négative : si statutBooleen(false) devait par erreur retourner OK,
// le critère rail Handoff resterait vert malgré railHandoffConforme=false — ce test échouerait.
{
  const r = evaluerCriteresProduction(dixCriteresOk({ railHandoffConforme: false }));
  assert.notStrictEqual(r.criteres.rail_handoff_conforme, STATUT.OK,
    'mutation négative : un fait false ne doit jamais produire un statut OK');
  passed++;
  console.log('  OK — mutation négative : false ne produit jamais OK (rail Handoff)');
}

console.log(`\n${passed} vérifications passées.`);
