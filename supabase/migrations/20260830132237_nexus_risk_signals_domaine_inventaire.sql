-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260830132237 · nexus_risk_signals_domaine_inventaire
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- P0 (30/08/2026, remontée Frédéric — Safari, rafale de 400 sur
-- nexus_risk_signals depuis Contrôle Inventaire). Root cause confirmée par
-- lecture directe du schéma réel (Article 5) : la contrainte CHECK sur
-- `domaine` n'autorisait que 'marge','caisse','stock','carburant','fdj',
-- 'equipe','conformite' -- mais nexus-risques-donnees.js (Cadrage risques
-- Phase 6 "Inventaire", tâche #235, 18/08/2026) écrit systématiquement
-- domaine='inventaire' pour ce pilote (moteur, données ET tests d'origine
-- sont tous cohérents entre eux sur 'inventaire' -- vérifié par grep avant
-- ce correctif, aucun code n'utilise 'stock' pour les signaux de risque).
-- La contrainte, elle, n'a simplement jamais été mise à jour lors du
-- lancement de ce pilote le 18/08/2026 -- chaque écriture d'un signal de
-- risque Inventaire échoue au niveau base depuis cette date (silencieuse
-- car enregistrerObservation ne fait que console.error sur l'échec,
-- jamais remonté à l'écran). 'stock' est conservé (aucun code ne l'utilise
-- mais rien ne prouve qu'aucune ligne historique n'en dépend -- Article 5,
-- on élargit, on ne retire jamais sans certitude).
alter table nexus_risk_signals
  drop constraint nexus_risk_signals_domaine_check;

alter table nexus_risk_signals
  add constraint nexus_risk_signals_domaine_check
  check (domaine = any (array['marge'::text, 'caisse'::text, 'stock'::text, 'carburant'::text, 'fdj'::text, 'equipe'::text, 'conformite'::text, 'inventaire'::text]));
