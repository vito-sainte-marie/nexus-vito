-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260903113558 · indisponibilites_qualification_evenement_rh
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- Un événement RH est une période qualifiée une seule fois (03/09/2026,
-- doctrine de Frédéric : « NEXUS ne doit jamais demander au manager de
-- valider plusieurs fois une information qu'il peut déduire d'une seule
-- décision »). Colonnes additives : aucune ligne existante n'est touchée,
-- aucun comportement actuel ne change tant qu'elles restent nulles.
alter table public.employee_indisponibilites
  add column if not exists motif text,
  add column if not exists confirme_le timestamptz,
  add column if not exists confirme_par uuid,
  add column if not exists fin_indeterminee boolean not null default false,
  add column if not exists date_reprise date;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'employee_indisponibilites_motif_check') then
    alter table public.employee_indisponibilites
      add constraint employee_indisponibilites_motif_check
      check (motif is null or motif in ('conge','conge_maternite','conge_paternite','arret_maladie','formation','autre'));
  end if;
end $$;

comment on column public.employee_indisponibilites.motif is
'Qualification de l''événement par le manager (congé, congé maternité, arrêt maladie...). DISTINCT de `type`, qui dit seulement ce qui a été saisi dans le Planning. Seul un motif accompagné de confirme_le fait passer l''événement de « décision à prendre » à « information à reporter » dans NEXUS PAYE.';

comment on column public.employee_indisponibilites.confirme_le is
'Horodatage de la qualification manager. Tant qu''il est nul, PAYE demande l''arbitrage — une seule fois pour toute la période, jamais un par jour.';

comment on column public.employee_indisponibilites.fin_indeterminee is
'true quand la date de retour n''est pas connue. date_fin sert alors d''horizon provisoire : NEXUS maintient l''indisponibilité sans réafficher le salarié dans « À vérifier » à chaque période.';

comment on column public.employee_indisponibilites.date_reprise is
'Date de reprise effective, posée à la clôture de l''événement. Renseignée, elle prime sur date_fin.';
