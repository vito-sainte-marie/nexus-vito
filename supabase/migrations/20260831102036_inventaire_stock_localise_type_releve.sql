-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260831102036 · inventaire_stock_localise_type_releve
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

alter table public.inventaire_stock_localise_releves
  add column if not exists type_releve text not null default 'complet';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'inventaire_stock_localise_releves_type_releve_check'
      and conrelid = 'public.inventaire_stock_localise_releves'::regclass
  ) then
    alter table public.inventaire_stock_localise_releves
      add constraint inventaire_stock_localise_releves_type_releve_check
      check (type_releve in ('complet','cible'));
  end if;
end $$;

comment on column public.inventaire_stock_localise_releves.type_releve is
  'Nature du relevé physique localisé : complet = catégorie entière, cible = contrôle ponctuel d une référence.';
