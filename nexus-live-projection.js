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
        // `event_id` transporté : une autorisation doit pouvoir DÉSIGNER la
        // question à laquelle elle répond. Sans cette référence, elle flotte
        // sans objet et rien ne permet de rapprocher la réponse du gate.
        gateActif = { event_id: evt.event_id || null, lot_id: evt.lot_id,
          reason_code: evt.human_gate.reason_code || null, question: evt.human_gate.question };
      // `evt.lot_id === gateActif.lot_id` : le commentaire ci-dessus promettait
      // « du même lot » depuis le premier jour, le code ne le vérifiait pas.
      // N'importe quel événement DONE, même d'un autre lot, éteignait donc le
      // gate — et avec lui le compteur « en attente de ton arbitrage ».
      } else if (gateActif && evt.lot_id === gateActif.lot_id
        && (evt.phase === 'DONE' || (evt.human_gate && evt.human_gate.required === false))) {
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

  // ── Fraîcheur du journal ────────────────────────────────────────────
  //
  // Le 08/09/2026, l'écran Live affichait huit événements vieux de treize
  // heures sans le dire : un journal mort ressemblait exactement à un journal
  // vivant. C'est le mode de défaillance que NEXUS combat partout ailleurs —
  // « une anomalie ne doit jamais être masquée par un affichage rassurant »
  // (Bible, Philosophie).
  //
  // Cette fonction ne décide de rien : elle rend l'âge et un niveau, l'écran
  // choisit comment le montrer. Sans horodatage exploitable, elle rend
  // `INCONNU` — jamais « frais ».
  const SEUIL_TIEDE_MIN = 30;
  const SEUIL_FROID_MIN = 180;

  function fraicheurJournal(events, maintenantISO) {
    const t1 = Date.parse(maintenantISO);
    if (!Array.isArray(events) || !events.length || !Number.isFinite(t1)) {
      return { niveau: 'INCONNU', ageMinutes: null, dernierISO: null };
    }
    let dernier = null;
    for (const e of events) {
      const t = Date.parse(e && e.occurred_at);
      if (!Number.isFinite(t)) continue;
      if (dernier === null || t > dernier) dernier = t;
    }
    if (dernier === null) return { niveau: 'INCONNU', ageMinutes: null, dernierISO: null };
    const ageMinutes = Math.max(0, Math.round((t1 - dernier) / 60000));
    const niveau = ageMinutes >= SEUIL_FROID_MIN ? 'FROID'
      : ageMinutes >= SEUIL_TIEDE_MIN ? 'TIEDE' : 'FRAIS';
    return { niveau, ageMinutes, dernierISO: new Date(dernier).toISOString() };
  }

  // ── Bloc « Déploiements » ───────────────────────────────────────────
  //
  // Les trois compteurs demandés par Frédéric. Ils sont LUS dans la preuve du
  // dernier événement de type `deploiement`, jamais recalculés ici : leur
  // propriétaire logique est `outils/etat-deploiement.js` (Bible,
  // « Architecture de vérité »).
  //
  // En l'absence d'un tel événement, on rend `null` — et l'écran doit alors
  // dire qu'il ne sait pas, jamais afficher trois zéros. Un tableau de bord
  // qui montre des zéros faute de données ment plus qu'un tableau vide.
  function extraireDeploiements(events) {
    if (!Array.isArray(events)) return null;
    let retenu = null, tRetenu = -Infinity;
    for (const e of events) {
      const ev = e && e.evidence;
      if (!ev || ev.type !== 'deploiement' || !ev.compteurs) continue;
      const t = Date.parse(e.occurred_at);
      if (!Number.isFinite(t) || t < tRetenu) continue;
      retenu = e; tRetenu = t;
    }
    if (!retenu) return null;
    const ev = retenu.evidence;
    return {
      compteurs: ev.compteurs,
      dette: ev.dette || null,
      ecart: ev.ecart || null,
      // Jamais un fait : l'écran doit l'afficher comme une proposition.
      pretProductionEstUneProposition: ev.pret_production_est_une_proposition !== false,
      occurredAt: retenu.occurred_at,
      source: ev.ref || null,
    };
  }

  const api = { STATUT_SYSTEME_LIVE: STATUT_SYSTEME, projectionVide, construireProjectionLive,
    fraicheurJournal, extraireDeploiements, SEUIL_TIEDE_MIN, SEUIL_FROID_MIN };

  global.NexusLiveProjection = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
