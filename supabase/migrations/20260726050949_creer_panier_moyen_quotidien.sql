-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260726050949 · creer_panier_moyen_quotidien
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- ------------------------------------------------------------
-- Panier moyen quotidien (25/07/2026) — export Decenium "Panier Moyen"
-- (menu Compta > Panier Moyen). Une ligne par jour calendaire : nombre
-- de tickets et panier moyen HT/TTC, BOUTIQUE UNIQUEMENT (le carburant
-- est facturé séparément, confirmé par Frédéric le 25/07/2026).
--
-- unique(site, date) : un réimport du même jour MET À JOUR la ligne
-- (upsert), jamais de doublon — contrairement à products qui ajoute
-- un import entier par période, ici chaque jour est sa propre unité,
-- comme audits_caisse.
-- ------------------------------------------------------------
create table if not exists panier_moyen_quotidien (
  id uuid primary key default gen_random_uuid(),
  site text not null references sites(site_id),
  date date not null,
  nb_tickets integer not null,
  panier_moyen_ht numeric,
  panier_moyen_ttc numeric,
  importe_par uuid references employees(id),
  importe_le timestamptz not null default now(),
  unique (site, date)
);
comment on table panier_moyen_quotidien is 'Panier moyen et nombre de tickets BOUTIQUE (hors carburant) par jour, importé depuis Decenium (menu Compta > Panier Moyen).';
alter table panier_moyen_quotidien enable row level security;
create policy "lecture_meme_site" on panier_moyen_quotidien
  for select
  using (site = current_employee_site_id());
create policy "ecriture_manager_meme_site" on panier_moyen_quotidien
  for insert
  with check (
    current_employee_role() = any (array['manager', 'gerant'])
    and site = current_employee_site_id()
  );
create policy "modification_manager_meme_site" on panier_moyen_quotidien
  for update
  using (
    current_employee_role() = any (array['manager', 'gerant'])
    and site = current_employee_site_id()
  )
  with check (
    current_employee_role() = any (array['manager', 'gerant'])
    and site = current_employee_site_id()
  );
create policy "suppression_manager_meme_site" on panier_moyen_quotidien
  for delete
  using (
    current_employee_role() = any (array['manager', 'gerant'])
    and site = current_employee_site_id()
  );
create policy "createur_lit_si_autorise" on panier_moyen_quotidien
  for select
  using (
    je_suis_createur()
    and exists (
      select 1 from sites s
      where s.site_id = panier_moyen_quotidien.site
      and s.acces_createur_autorise = true
    )
  );
