// NEXUS — Contrat d'événement d'exécution Live (07/09/2026)
//
// Origine : lot NEXUS-LIVE-CONTROL-CENTER-1-20260906, spec-1.md §5.
// Ce module ne connaît ni GitHub, ni Claude, ni Supabase : il valide et
// dédoublonne un événement conforme au protocole `nexus-execution-event/1`.
// « le fournisseur n'est pas l'identité métier de l'agent » — aucune
// dépendance à une source particulière n'est acceptable ici.

(function (global) {
  'use strict';

  const PROTOCOLE = 'nexus-execution-event/1';

  const PHASES = ['ANALYSE', 'EXECUTION', 'TEST', 'GUARDIAN_REVIEW', 'CI', 'GATE', 'DONE'];
  const STATUTS = ['STARTED', 'PROGRESS', 'PASSED', 'FAILED', 'BLOCKED', 'WAITING'];
  // `human` ajouté le 08/09/2026 : une autorisation accordée par Frédéric est
  // un fait de premier ordre. La faire passer pour un événement `orchestrator`
  // falsifierait la provenance de la seule décision qui n'appartient qu'à lui.
  // Ce rôle est aussi ce qui rend utile la borne de la politique RLS
  // `publication_ci` (`actor_role in ('ci','guardian')`) : la CI ne peut pas
  // écrire une autorisation humaine, même si elle le voulait.
  const ROLES_ACTEUR = ['execution', 'orchestrator', 'guardian', 'ci', 'human'];

  function estChaineNonVide(v) {
    return typeof v === 'string' && v.trim().length > 0;
  }

  // Retourne la liste des erreurs (vide si l'événement est conforme).
  // Ne lève jamais : un événement invalide est une donnée à rejeter, pas
  // une exception à faire remonter dans l'UI Live.
  function validerEvenementLive(evt) {
    const erreurs = [];
    if (!evt || typeof evt !== 'object') {
      return ['evenement_absent_ou_invalide'];
    }
    if (evt.protocol !== PROTOCOLE) erreurs.push('protocol_invalide');
    if (!estChaineNonVide(evt.event_id)) erreurs.push('event_id_manquant');
    if (!estChaineNonVide(evt.occurred_at) || Number.isNaN(Date.parse(evt.occurred_at))) {
      erreurs.push('occurred_at_invalide');
    }
    if (!estChaineNonVide(evt.lot_id)) erreurs.push('lot_id_manquant');
    if (!estChaineNonVide(evt.run_id)) erreurs.push('run_id_manquant');
    if (!evt.actor || !estChaineNonVide(evt.actor.id) || !ROLES_ACTEUR.includes(evt.actor.role)) {
      erreurs.push('actor_invalide');
    }
    if (!PHASES.includes(evt.phase)) erreurs.push('phase_invalide');
    if (!STATUTS.includes(evt.status)) erreurs.push('status_invalide');
    if (!estChaineNonVide(evt.summary)) erreurs.push('summary_manquant');
    if (evt.evidence != null) {
      if (typeof evt.evidence !== 'object' || !estChaineNonVide(evt.evidence.type) || !estChaineNonVide(evt.evidence.ref)) {
        erreurs.push('evidence_invalide');
      }
    }
    if (evt.human_gate != null) {
      if (typeof evt.human_gate !== 'object' || typeof evt.human_gate.required !== 'boolean') {
        erreurs.push('human_gate_invalide');
      } else if (evt.human_gate.required && !estChaineNonVide(evt.human_gate.question)) {
        erreurs.push('human_gate_sans_question');
      }
    }
    // Sécurité : aucune donnée sensible ne doit transiter dans un événement
    // Live (spec-1.md §5 « les événements ne contiennent ni secrets, ni
    // tokens, ni données clientes brutes »). Détection défensive minimale.
    const brut = JSON.stringify(evt);
    if (/service_role|eyJhbGciOi|password|PGPASSWORD/i.test(brut)) {
      erreurs.push('contenu_potentiellement_sensible_refuse');
    }
    return erreurs;
  }

  function evenementValide(evt) {
    return validerEvenementLive(evt).length === 0;
  }

  // Idempotence : le même event_id ne doit jamais créer deux entrées dans
  // le journal (spec-1.md §5 « le même événement ne crée pas deux étapes
  // Live »). `journal` est la liste déjà acceptée, la plus récente en
  // dernier ou dans un ordre quelconque : seul event_id compte.
  function estDoublon(evt, journal) {
    if (!Array.isArray(journal)) return false;
    return journal.some(e => e && e.event_id === evt.event_id);
  }

  // Insère l'événement dans le journal s'il est valide et non déjà connu.
  // Retourne { accepte, raison, journal } — ne mute jamais le journal reçu.
  function accepterEvenementLive(evt, journalExistant) {
    const journal = Array.isArray(journalExistant) ? journalExistant.slice() : [];
    const erreurs = validerEvenementLive(evt);
    if (erreurs.length) {
      return { accepte: false, raison: 'invalide', erreurs, journal };
    }
    if (estDoublon(evt, journal)) {
      return { accepte: false, raison: 'doublon_idempotent', erreurs: [], journal };
    }
    journal.push(evt);
    return { accepte: true, raison: null, erreurs: [], journal };
  }

  const api = {
    PROTOCOLE_EVENEMENT_LIVE: PROTOCOLE,
    PHASES_EVENEMENT_LIVE: PHASES,
    STATUTS_EVENEMENT_LIVE: STATUTS,
    ROLES_ACTEUR_LIVE: ROLES_ACTEUR,
    validerEvenementLive,
    evenementValide,
    estDoublon,
    accepterEvenementLive,
  };

  global.NexusLiveEvenement = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
