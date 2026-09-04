-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260830110237 · inventaire_decenium_snapshots_fondation
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- Inventaire V2 — Snapshot Decenium, Étape 1 "fondation" (30/08/2026,
-- Frédéric : "pars sur cette architecture", verrouillée explicitement) :
-- VENTES + STOCK ACTUEL = SNAPSHOT DECENIUM. Une Photo Decenium
-- appartient au SITE et à un instant de référence (snapshot_reference_at
-- = stock_export_at), jamais à un quart : elle peut servir à reconstruire
-- plusieurs contrôles antérieurs, potentiellement sur plusieurs quarts.
-- quart_id_source est un contexte de création FACULTATIF (depuis quel
-- écran le manager l'a créée) — jamais la clé métier du Snapshot.
--
-- Séparation stricte demandée par Frédéric : "Snapshot = source
-- temporelle Decenium" — aucun statut métier (sous_observation, etc.)
-- ici. Le "status" ci-dessous ne qualifie QUE le cycle de vie du
-- Snapshot en tant que source (actif / remplacé par un snapshot plus
-- récent / invalidé), jamais le résultat d'un rapprochement — ce
-- résultat reste et restera exclusivement sur inventaire_rapprochements
-- (Article 11 : ce mécanisme n'est PAS réécrit, seulement enrichi).
--
-- Vérifié avant migration (Article 5) : aucune table équivalente
-- n'existe (ni 'inventaire_decenium_snapshots' ni un générique
-- réutilisable — 'import_batches' existe mais sert un tout autre usage,
-- catalogue produits/marge/Tempo, sans aucun lien avec le rapprochement
-- Inventaire actuel, vérifié par requête directe sur ses intentions
-- réelles : 'stock_theorique'/'ventes_catalogue').

create table public.inventaire_decenium_snapshots (
  id uuid primary key default gen_random_uuid(),
  site text not null references public.sites(site_id),

  -- Fichier Ventes : heure réelle de génération si connue (jamais
  -- confondue avec l'heure d'import dans NEXUS, doctrine §8 de Frédéric).
  sales_filename text,
  sales_export_at timestamptz,
  sales_export_time_source text not null default 'import_time_estimated'
    check (sales_export_time_source = any (array['file_metadata'::text, 'manager_declared'::text, 'import_time_estimated'::text])),
  sales_imported_at timestamptz not null default now(),

  -- Fichier Stock actuel : même principe. C'est cet instant qui devient
  -- la référence temporelle du Snapshot (snapshot_reference_at).
  stock_filename text,
  stock_export_at timestamptz,
  stock_export_time_source text not null default 'import_time_estimated'
    check (stock_export_time_source = any (array['file_metadata'::text, 'manager_declared'::text, 'import_time_estimated'::text])),
  stock_imported_at timestamptz not null default now(),

  -- T1 : instant de référence Decenium du Snapshot entier. Toujours égal
  -- à stock_export_at (décision verrouillée par Frédéric) — jamais
  -- recalculé ailleurs (Article 11, une seule vérité sur "quand" ce
  -- Snapshot représente l'état Decenium).
  snapshot_reference_at timestamptz not null,

  export_order text not null default 'unknown'
    check (export_order = any (array['sales_then_stock'::text, 'stock_then_sales'::text, 'unknown'::text])),
  -- stock_export_at - sales_export_at, en secondes. Peut être négatif si
  -- le stock a été exporté avant les ventes (export_order inversé).
  delta_seconds integer,

  -- Catégories métier explicables (doctrine §17 de Frédéric) — jamais un
  -- faux score numérique de type "87,42% de confiance" sans modèle qui le
  -- justifie.
  confidence_level text not null
    check (confidence_level = any (array['haute'::text, 'moyenne'::text, 'faible'::text, 'insuffisante'::text])),
  -- Vrai si le manager a choisi "Poursuivre quand même" malgré un délai
  -- au-dessus du seuil configuré (jamais posé automatiquement).
  validated_with_reserve boolean not null default false,

  -- Cycle de vie du Snapshot EN TANT QUE SOURCE — jamais un statut de
  -- résultat de rapprochement (qui reste sur inventaire_rapprochements).
  status text not null default 'actif'
    check (status = any (array['actif'::text, 'remplace'::text, 'invalide'::text])),

  -- Contexte de création facultatif — jamais une clé métier (consigne
  -- explicite de Frédéric : 1 Snapshot -> N rapprochements -> N quarts
  -- possibles, jamais 1 quart -> 1 Snapshot).
  quart_id_source uuid references public.inventaire_quarts(id),

  created_by uuid references public.employees(id),
  created_at timestamptz not null default now()
);

alter table public.inventaire_decenium_snapshots enable row level security;
create policy inventaire_decenium_snapshots_site_isolation on public.inventaire_decenium_snapshots
  using (true) with check (true);

create index idx_inventaire_decenium_snapshots_site_reference on public.inventaire_decenium_snapshots (site, snapshot_reference_at desc);

-- Enrichissement du rapprochement EXISTANT (Article 11 : jamais réécrit)
-- pour savoir quelle Photo Decenium a servi à le produire. Nullable :
-- tous les rapprochements déjà en base ont été produits avant ce lot,
-- sans Snapshot associé — aucune reconstitution rétroactive inventée.
alter table public.inventaire_rapprochements
  add column snapshot_id uuid references public.inventaire_decenium_snapshots(id);
