-- PRÉPARÉE, NON APPLIQUÉE. Ne pas déplacer dans supabase/migrations/ sans
-- l'arbitrage explicite de Frédéric Bragance.
-- ============================================================================
-- Étape 1 sur 3 : rattacher les pointages à leur service, sans rien inventer.
--
-- Aujourd'hui `public.pointages` n'a AUCUN lien vers un service : sa seule clé
-- étrangère va vers `employees`. L'unicité métier voulue — un seul pointage de
-- chaque type PAR SERVICE — est donc inexprimable en base.
--
-- CE QUE CETTE ÉTAPE FAIT : elle ajoute la colonne, nullable, et ne remplit
-- rien. Elle ne peut casser aucun écrit existant.
-- ============================================================================

alter table public.pointages
  add column if not exists service_id uuid references public.shifts(id);

comment on column public.pointages.service_id is
  'Service auquel ce pointage se rattache. NULL pour les pointages historiques dont le service est ambigu ou absent : voir 20260911_02. Obligatoire dans le chemin applicatif pour tout nouveau pointage.';

create index if not exists pointages_service_id_idx on public.pointages (service_id);
