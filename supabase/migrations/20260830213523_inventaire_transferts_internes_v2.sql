-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260830213523 · inventaire_transferts_internes_v2
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

alter table public.inventaire_zones drop constraint if exists inventaire_zones_code_check;
alter table public.inventaire_zones add constraint inventaire_zones_code_check check (length(trim(code)) > 0);

alter table public.inventaire_mouvements
  add column if not exists unite_saisie text,
  add column if not exists quantite_saisie numeric,
  add column if not exists facteur_conditionnement numeric;

alter table public.inventaire_mouvements drop constraint if exists inventaire_mouvements_unite_saisie_check;
alter table public.inventaire_mouvements add constraint inventaire_mouvements_unite_saisie_check
  check (unite_saisie is null or unite_saisie in ('unite','paquet','cartouche','carton','caisse'));

alter table public.inventaire_mouvements drop constraint if exists inventaire_mouvements_facteur_conditionnement_check;
alter table public.inventaire_mouvements add constraint inventaire_mouvements_facteur_conditionnement_check
  check (facteur_conditionnement is null or facteur_conditionnement > 0);

insert into public.inventaire_zones (site, code, nom)
select 'vito-sainte-marie', 'bureau', 'Bureau'
where not exists (
  select 1 from public.inventaire_zones where site='vito-sainte-marie' and code='bureau'
);
