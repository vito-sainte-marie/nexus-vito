-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260818105520 · inventaire_adoption_mesure_automatique
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- Sprint 8 "Adoption" (cahier NEXUS_Inventaire_2_0_Audit_Implementation_Developpeur.pdf
-- §16, INV2-19 "Les mesures de temps/taps sont enregistrées sans action
-- supplémentaire"). Ajoute les deux compteurs automatiques manquants pour
-- compléter les colonnes papier_produits_comptes/papier_temps_minutes/
-- papier_corrections/nexus_temps_minutes/is_simulation/simulation_notes déjà
-- présentes en base (ajoutées lors d'un travail préparatoire non tracé par
-- migration, consommées par l'onglet "Simulation" de
-- NEXUS-Parametres-Inventaire-v1.html) : nexus_taps_total et
-- nexus_interruptions_total sont alimentés automatiquement pendant un
-- inventaire réel (NEXUS-Inventaire-v1.html), jamais par une action
-- supplémentaire demandée à l'employé. ouvert_le/cloture_le (déjà existants)
-- restent la seule source du temps NEXUS automatique -- pas de colonne dupliquée
-- pour la durée, qui reste calculée (Article 11).
alter table public.inventaire_quarts
  add column if not exists nexus_taps_total integer not null default 0,
  add column if not exists nexus_interruptions_total integer not null default 0;

comment on column public.inventaire_quarts.nexus_taps_total is 'Nombre de gestes de validation produit automatiquement comptés pendant ce quart (Sprint 8 Adoption, INV2-19) -- jamais saisi manuellement.';
comment on column public.inventaire_quarts.nexus_interruptions_total is 'Nombre de reprises réelles après interruption détectées automatiquement (même mécanisme que la reprise INV2-16, Sprint 4) -- jamais saisi manuellement.';
