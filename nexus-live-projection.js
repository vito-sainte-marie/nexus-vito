// NEXUS — Projection Live (07/09/2026)
//
// Origine : lot NEXUS-LIVE-CONTROL-CENTER-1-20260906, spec-1.md §6.
// Réduit un journal d'événements `nexus-execution-event/1` (déjà validés,
// cf. nexus-live-evenement.js) en une projection structurée unique. Ne relit
// jamais de texte libre : uniquement les champs structurés du contrat.
//
// « Le Centre de contrôle lit la vérité d'exécution ; il ne pilote pas
// l'exécution nominale. » (spec-1.md §5) — ce module ne fait donc que
// projeter, jamais décider.

(function (global) {
  'use strict';

  const STATUT_SYSTEME = { AUTONOME: 'AUTONOMOUS', HUMAIN_REQUIS: 'HUMAN_REQUIRED', BLOQUE: 'FAIL_CLOSED', REPOS: 'IDLE' };

  function projectionVide() {
    return {
      system_status: STATUT_SYSTEME.REPOS,
      active_lots: [],
      active_actor: null,
      current_phase: null,
      guardians: {},
      tests: {},
      ci: {},
      next_automatic_step: null,
      last_event_id: null,
      updated_at: null,
    };
  }

  function parAntecedenceOccurredAt(a, b) {
    return Date.parse(a.occurred_at) - Date.parse(b.occurred_at);
  }

  // events : liste d'événements déjà validés (nexus-live-evenement.js).
  // Événements non conformes ou non fournis => projection vide (fail
  // closed sur l'affichage, jamais une projection inventée).
  function construireProjectionLive(events) {
    if (!Array.isArray(events) || events.length === 0) return projectionVide();

    const tries = events.slice().sort(parAntecedenceOccurredAt);
    const parLot = new Map();
    for (const evt of tries) {
      if (!parLot.has(evt.lot_id)) parLot.set(evt.lot_id, []);
      parLot.get(evt.lot_id).push(evt);
    }

    const dernier = tries[tries.length - 1];
    const projection = projectionVide();
    projection.active_lots = Array.from(parLot.keys());
    projection.last_event_id = dernier.event_id;
    projection.updated_at = dernier.occurred_at;
    projection.current_phase = dernier.phase;
    projection.active_actor = dernier.actor ? dernier.actor.id : null;
    projection.next_automatic_step = dernier.next_step != null ? dernier.next_step : null;

    // Guardians : dernier statut connu par acteur de rôle "guardian" et par lot.
    for (const evt of tries) {
      if (evt.actor && evt.actor.role === 'guardian') {
        projection.guardians[evt.actor.id] = evt.status;
      }
    }

    // Tests/CI : dernier statut connu pour les phases TEST / CI.
    for (const evt of tries) {
      if (evt.phase === 'TEST') projection.tests[evt.lot_id] = evt.status;
      if (evt.phase === 'CI') projection.ci[evt.lot_id] = evt.status;
    }

    // Gate humain : un événement human_gate.required=true non suivi d'un
    // événement plus récent qui le referme reste actif. On ne referme un
    // gate que si un événement postérieur du même lot déclare
    // human_gate.required=false ou atteint DONE.
    let gateActif = null;
    for (const evt of tries) {
      if (evt.human_gate && evt.human_gate.required) {
        gateActif = { lot_id: evt.lot_id, reason_code: evt.human_gate.reason_code || null, question: evt.human_gate.question };
      } else if (gateActif && (evt.phase === 'DONE' || (evt.human_gate && evt.human_gate.required === false))) {
        gateActif = null;
      }
    }

    if (dernier.status === 'BLOCKED' && !gateActif) {
      projection.system_status = STATUT_SYSTEME.BLOQUE;
    } else if (gateActif) {
      projection.system_status = STATUT_SYSTEME.HUMAIN_REQUIS;
      projection.human_gate = gateActif;
    } else if (dernier.phase === 'DONE' && dernier.status === 'PASSED') {
      projection.system_status = STATUT_SYSTEME.REPOS;
    } else {
      projection.system_status = STATUT_SYSTEME.AUTONOME;
    }

    return projection;
  }

  const api = { STATUT_SYSTEME_LIVE: STATUT_SYSTEME, projectionVide, construireProjectionLive };

  global.NexusLiveProjection = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
