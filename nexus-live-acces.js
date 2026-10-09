// NEXUS — Autorisation d'accès NEXUS LIVE DÉVELOPPEMENT (07/09/2026)
//
// Origine : lot NEXUS-LIVE-CONTROL-CENTER-1-20260906, spec-1.md §2-3.
//
// Décision d'architecture (à documenter dans le retour du lot, cf.
// audit-1.md) : la capacité canonique proposée par spec-1.md était
// `nexus_creator_live_development`, un nom nouveau. Ce dépôt possède déjà
// une capacité Créateur éprouvée, appliquée côté serveur : la colonne
// `employees.est_createur`, lue par la fonction SQL SECURITY DEFINER
// `je_suis_createur()` (supabase/migrations/20260101000000_baseline_pre_
// existing_schema.sql) et déjà utilisée dans les RLS d'au moins 24
// migrations (ex. 20260904130807_fermer_lecture_anonyme_sites.sql) ainsi
// que côté client par nexus-auth.js (nexusRequireAuth) et
// NEXUS-Debug-Createur-v1.html. Introduire une seconde capacité parallèle
// dupliquerait exactement le risque déjà signalé par le Guardian
// Architecture & Cohérence (audit-1.md du lot
// NEXUS-GUARDIAN-ARCHITECTURE-COHERENCE-1-20260906 : collision d'identité
// NexusStock). NEXUS LIVE DÉVELOPPEMENT réutilise donc `est_createur` /
// `je_suis_createur()` comme capacité unique — aucune capacité parallèle
// n'est créée par ce lot.
//
// Ce module est une fonction pure, testable sans DOM ni Supabase : la
// page HTML ne fait qu'appeler `nexusLiveAutorise(employee)` après
// nexusRequireAuth(), jamais un second calcul d'autorisation.

(function (global) {
  'use strict';

  function nexusLiveAutorise(employee) {
    return !!(employee && employee.est_createur === true);
  }

  // Code de refus explicite pour l'affichage / la preuve de test négatif —
  // jamais une case cochée par défaut, fail closed si l'employé est absent.
  function motifRefusLive(employee) {
    if (!employee) return 'session_absente';
    if (employee.est_createur !== true) return 'capacite_createur_absente';
    return null;
  }

  const api = { nexusLiveAutorise, motifRefusLive };

  global.NexusLiveAcces = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
