-- LIVE-001 — le journal Live refusait l'autorisation humaine qu'il affichait.
--
-- L'écran Live propose un bouton « J'autorise » ; le contrat JS
-- `nexus-execution-event/1` accepte l'acteur `human` depuis le 08/09/2026.
-- La contrainte en base, elle, ne connaissait que execution|orchestrator|
-- guardian|ci. Frédéric aurait donc cliqué, et la base aurait refusé l'écriture
-- au moment précis où NEXUS lui demandait de décider.
--
-- Ceci N'ÉLARGIT PAS la surface : qui peut écrire reste décidé par les
-- politiques RLS, inchangées. `insert_nexus_live_events` exige toujours
-- `je_suis_createur()`, et `publication_ci` continue de n'autoriser au rôle CI
-- que les acteurs `ci` et `guardian` — donc la CI ne peut pas se faire passer
-- pour un humain. Cette contrainte dit quels acteurs EXISTENT, pas qui a le
-- droit d'écrire.
alter table public.nexus_live_events
  drop constraint if exists nexus_live_events_actor_role_check;

alter table public.nexus_live_events
  add constraint nexus_live_events_actor_role_check
  check (actor_role = any (array['execution', 'orchestrator', 'guardian', 'ci', 'human']));
