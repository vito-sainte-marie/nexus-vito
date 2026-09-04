-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260829155631 · nexus_ecarts_qualifications_contestation
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- v2.287 (29/08/2026) — Extension additive de nexus_ecarts_qualifications
-- pour porter un second type_qualification, 'contestation', réutilisant la
-- table générique existante (Article 11 — jamais une nouvelle table pour
-- une qualification qui se pose PAR-DESSUS un écart déjà normalisé par
-- nexus-ecarts-moteur.js/nexus-ecarts-donnees.js). Aucune colonne existante
-- retirée ni retypée : les lignes 'activite_inhabituelle' déjà en place
-- restent valides à l'identique.

-- 1) Colonnes de cycle de vie de la contestation (toutes nullables : sans
--    objet pour 'activite_inhabituelle', jamais renseignées pour ce type).
alter table public.nexus_ecarts_qualifications
  add column if not exists statut_contestation text,
  add column if not exists resolue_par uuid references public.employees(id),
  add column if not exists resolue_le timestamptz,
  add column if not exists resolution_motif text;

alter table public.nexus_ecarts_qualifications
  add constraint nexus_ecarts_qualifications_statut_contestation_check
  check (statut_contestation is null or statut_contestation = any (array['ouverte','en_reexamen','resolue']));

-- 2) Le CHECK sur `motif` était une liste unique pensée pour
--    'activite_inhabituelle' uniquement — devient conditionnelle au
--    type_qualification pour accueillir le vocabulaire de contestation
--    (différent par nature : l'employé explique pourquoi il conteste,
--    pas pourquoi une activité de caisse est inhabituelle) sans jamais
--    élargir la liste existante par erreur.
alter table public.nexus_ecarts_qualifications
  drop constraint nexus_ecarts_qualifications_motif_check;

alter table public.nexus_ecarts_qualifications
  add constraint nexus_ecarts_qualifications_motif_check
  check (
    (type_qualification = 'activite_inhabituelle' and motif = any (array['remplacement_absent','modification_planning','intervention_ponctuelle','erreur_attribution','autre']))
    or (type_qualification = 'contestation' and motif = any (array['montant_incorrect','poste_mal_attribue','explication_manquante','erreur_supposee','autre']))
  );

comment on column public.nexus_ecarts_qualifications.statut_contestation is 'v2.287 — cycle de vie d''une contestation employé : ouverte -> en_reexamen -> resolue. NULL pour tout autre type_qualification.';
comment on column public.nexus_ecarts_qualifications.resolue_par is 'v2.287 — manager ayant résolu la contestation (NULL tant que non résolue).';
comment on column public.nexus_ecarts_qualifications.resolue_le is 'v2.287 — horodatage de résolution.';
comment on column public.nexus_ecarts_qualifications.resolution_motif is 'v2.287 — explication libre du manager à la résolution (ex. correction appliquée, écart confirmé).';
