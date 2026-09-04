-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260811015350 · creer_carburant_releves
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- NEXUS Carburants — fondations (10/08/2026, demande de Frédéric)
-- Philosophie : "une donnée saisie une fois alimente tout ce qui en dépend."
-- Le litrage vendu par carburant existe déjà, quart par quart, dans
-- audits_caisse (litrage_gazole/sp95/gnr, alimenté par NEXUS Verify) — cette
-- table ne le reproduit JAMAIS. Elle capture uniquement ce qui n'existe nulle
-- part ailleurs : le stock réel mesuré physiquement (jaugeage), et les
-- mouvements qui ne sont pas des ventes (livraison, correction exceptionnelle).
-- Le calcul du théorique et de l'écart vit dans nexus-carburant-moteur.js,
-- pas ici (Article 11 — une seule vérité, jamais recalculée différemment).
create table if not exists carburant_releves (
  id uuid primary key default gen_random_uuid(),
  site text not null default 'vito-sainte-marie',
  date date not null,
  stock_reel_go numeric,
  stock_reel_sp95 numeric,
  stock_reel_gnr numeric,
  livraison_go numeric not null default 0,
  livraison_sp95 numeric not null default 0,
  livraison_gnr numeric not null default 0,
  mouvement_go numeric not null default 0,
  mouvement_sp95 numeric not null default 0,
  mouvement_gnr numeric not null default 0,
  motif_mouvement text,
  commentaire text,
  saisi_par uuid references employees(id),
  created_at timestamptz not null default now(),
  unique (site, date)
);

alter table carburant_releves enable row level security;

create policy select_carburant_releves on carburant_releves
  for select
  using (
    site = (select current_employee_site_id())
    or (
      (select je_suis_createur())
      and exists (
        select 1 from sites s
        where s.site_id = carburant_releves.site and s.acces_createur_autorise = true
      )
    )
  );

create policy ecriture_manager_meme_site on carburant_releves
  for insert
  with check (
    (select current_employee_role()) = any (array['manager','gerant'])
    and site = (select current_employee_site_id())
  );

create policy modification_manager_meme_site on carburant_releves
  for update
  using (
    (select current_employee_role()) = any (array['manager','gerant'])
    and site = (select current_employee_site_id())
  );

create index if not exists idx_carburant_releves_site_date on carburant_releves (site, date desc);
