-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260831125516 · inventaire_reassort_interne_regles
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

create table if not exists public.inventaire_reassort_interne_regles (
  id uuid primary key default gen_random_uuid(),
  site text not null,
  categorie_id uuid null references public.inventaire_categories(id) on delete cascade,
  produit_id uuid null references public.inventaire_zone_produit(id) on delete cascade,
  zone_source_id uuid not null references public.inventaire_zones(id) on delete cascade,
  zone_destination_id uuid not null references public.inventaire_zones(id) on delete cascade,
  seuil_destination numeric not null check (seuil_destination >= 0),
  cible_destination numeric not null check (cible_destination >= seuil_destination),
  actif boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid null,
  constraint inventaire_reassort_interne_perimetre_check check ((categorie_id is not null) <> (produit_id is not null)),
  constraint inventaire_reassort_interne_zones_check check (zone_source_id <> zone_destination_id)
);

create unique index if not exists inventaire_reassort_interne_regle_categorie_uq
  on public.inventaire_reassort_interne_regles(site,categorie_id,zone_source_id,zone_destination_id)
  where categorie_id is not null;
create unique index if not exists inventaire_reassort_interne_regle_produit_uq
  on public.inventaire_reassort_interne_regles(site,produit_id,zone_source_id,zone_destination_id)
  where produit_id is not null;

comment on table public.inventaire_reassort_interne_regles is
'Règles de réassort interne entre emplacements. Ne représente jamais une commande fournisseur ni une entrée de stock global.';
