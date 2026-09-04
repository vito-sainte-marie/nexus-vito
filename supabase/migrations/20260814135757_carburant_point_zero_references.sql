-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260814135757 · carburant_point_zero_references
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.


-- NEXUS Carburants — "Point zéro" (14/08/2026, demande de Frédéric, exactement
-- le même principe que fdj_stock_references/fdj_stock_reference_lignes déjà
-- en place pour FDJ depuis le 09/08/2026) : un contrôle physique certifié
-- devient la nouvelle référence de calcul. Les relevés/écarts antérieurs
-- restent archivés dans carburant_releves mais ne sont plus utilisés comme
-- ancre de calcul pour les théoriques postérieurs au point zéro.

create table if not exists carburant_stock_references (
  id uuid primary key default gen_random_uuid(),
  site text not null,
  date date not null,
  -- Heure optionnelle : NEXUS reste globalement en granularité "jour" (voir
  -- la convention temporelle de nexus-carburant-moteur.js), mais un point
  -- zéro capture en plus la source et l'heure précise du relevé certifié
  -- pour la traçabilité — jamais utilisée dans le calcul du théorique
  -- (qui reste en jours), seulement affichée.
  heure time,
  source text not null default 'terrain', -- 'terrain' | 'insite360' | 'autre'
  controle_par uuid,
  type text not null default 'initialisation', -- 'initialisation' | 'recomptage'
  statut text not null default 'valide',
  note text,
  created_at timestamptz not null default now()
);

create table if not exists carburant_stock_reference_lignes (
  id uuid primary key default gen_random_uuid(),
  reference_id uuid not null references carburant_stock_references(id),
  site text not null,
  carburant text not null, -- 'go' | 'sp95' | 'gnr'
  stock_reel numeric not null,
  -- Théorique calculé par l'ancienne chaîne juste avant ce point zéro —
  -- conservé pour traçabilité/audit uniquement, jamais réutilisé dans un
  -- calcul (Article 5, "vérité avant certitude" : une valeur invalidée ne
  -- doit plus jamais réapparaître comme si elle était fiable).
  stock_theorique_avant numeric,
  created_at timestamptz not null default now()
);

alter table carburant_stock_references enable row level security;
alter table carburant_stock_reference_lignes enable row level security;

-- RLS alignée sur carburant_releves (lecture élargie créateur, écriture
-- manager/gérant du même site) plutôt que sur fdj_stock_references (lecture
-- simple même site) : Carburants a déjà cette politique plus riche en place,
-- on ne divise pas les conventions entre modules sans raison.
create policy select_carburant_stock_references on carburant_stock_references
  for select using (
    site = (select current_employee_site_id())
    or (
      (select je_suis_createur())
      and exists (select 1 from sites s where s.site_id = carburant_stock_references.site and s.acces_createur_autorise = true)
    )
  );

create policy ecriture_manager_meme_site_carburant_stock_references on carburant_stock_references
  for insert with check (
    (select current_employee_role()) = any (array['manager','gerant'])
    and site = (select current_employee_site_id())
  );

create policy select_carburant_stock_reference_lignes on carburant_stock_reference_lignes
  for select using (
    site = (select current_employee_site_id())
    or (
      (select je_suis_createur())
      and exists (select 1 from sites s where s.site_id = carburant_stock_reference_lignes.site and s.acces_createur_autorise = true)
    )
  );

create policy ecriture_manager_meme_site_carburant_stock_reference_lignes on carburant_stock_reference_lignes
  for insert with check (
    (select current_employee_role()) = any (array['manager','gerant'])
    and site = (select current_employee_site_id())
  );

create index if not exists idx_carburant_stock_references_site_date on carburant_stock_references(site, date desc, created_at desc);
create index if not exists idx_carburant_stock_reference_lignes_reference on carburant_stock_reference_lignes(reference_id);
