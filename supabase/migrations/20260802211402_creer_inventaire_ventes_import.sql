-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260802211402 · creer_inventaire_ventes_import
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- Import des ventes Decenium par quart (02/08/2026, demande de Frédéric) :
-- comparer l'écoulement physique constaté (comptages ouverture/clôture +
-- mouvements) à ce que Decenium dit avoir vendu, pour détecter une démarque
-- potentielle. Table append-only, conserve TOUJOURS la ligne brute du
-- fichier (même non rapprochée) — jamais de perte silencieuse d'une ligne
-- d'import, même si le produit n'a pas pu être identifié.
create table if not exists inventaire_ventes_import (
  id uuid primary key default gen_random_uuid(),
  site text not null default 'vito-sainte-marie' references sites(site_id),
  quart_id uuid not null references inventaire_quarts(id) on delete cascade,
  produit_id uuid references inventaire_zone_produit(id),
  designation_brute text not null,
  code_barres_brut text,
  categorie_brute text,
  quantite_vendue numeric not null,
  prix_achat_ht numeric,
  prix_vente_ht numeric,
  importe_par uuid references employees(id),
  importe_le timestamptz not null default now()
);

create index if not exists idx_inventaire_ventes_import_quart on inventaire_ventes_import(quart_id);
create index if not exists idx_inventaire_ventes_import_produit on inventaire_ventes_import(produit_id);

alter table inventaire_ventes_import enable row level security;

-- Réservé aux managers/gérants : c'est un outil de contrôle, pas une saisie
-- employé (même restriction que la mise à jour des alertes).
create policy select_inventaire_ventes_import on inventaire_ventes_import
  for select using (
    site = (select current_employee_site_id())
    and (select current_employee_role()) = any(array['manager','gerant'])
  );

create policy insert_inventaire_ventes_import on inventaire_ventes_import
  for insert with check (
    site = (select current_employee_site_id())
    and (select current_employee_role()) = any(array['manager','gerant'])
  );

create policy delete_inventaire_ventes_import on inventaire_ventes_import
  for delete using (
    site = (select current_employee_site_id())
    and (select current_employee_role()) = any(array['manager','gerant'])
  );
