-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260731121603 · nexus_api_auth_integrations_layer
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- ============================================================
-- NEXUS API — Couche authentification & intégrations
-- Master prompt : Déploiement de l'infrastructure API NEXUS
-- Accès : uniquement via service_role (Edge Functions). RLS deny-all
-- pour anon/authenticated — défense en profondeur, l'isolation par
-- site est appliquée dans le code de l'Edge Function à partir de la
-- clé API validée, jamais par une policy basée sur une session employé
-- (ces tables ne sont pas consultées par des utilisateurs connectés).
-- ============================================================

create table if not exists public.api_keys (
  id              uuid primary key default gen_random_uuid(),
  site            text not null references public.sites(site_id),
  source          text not null,                     -- 'decenium' | 'pennylane' | 'worldline' | 'nepting' | 'excel' | 'csv' | 'simulateur' | ...
  label           text,
  cle_hash        text not null,                      -- hash de la clé — jamais la clé en clair
  cle_prefix      text not null,                       -- préfixe visible pour identification (ex. 'nx_live_ab12')
  scopes          text[] not null default '{}',        -- ex. {'sales:read','products:read','employees:read','stock:read','cash:read','campaigns:write','controls:write','marge_exceptions:write'}
  actif           boolean not null default true,
  cree_le         timestamptz not null default now(),
  cree_par        uuid references public.employees(id),
  expire_le       timestamptz,
  dernier_appel_le timestamptz,
  revoque_le      timestamptz,
  revoque_par     uuid references public.employees(id),
  unique (cle_prefix)
);
comment on table public.api_keys is 'Clés API émises par NEXUS pour les déclarations terrain (écriture) et pour les connecteurs caisse en lecture. Jamais la clé en clair, uniquement le hash. Gérées via l''écran d''administration NEXUS-Admin-API-v1.html.';
create table if not exists public.api_logs (
  id              uuid primary key default gen_random_uuid(),
  api_key_id      uuid references public.api_keys(id),
  site            text not null,
  endpoint        text not null,
  method          text not null,
  status_code     int not null,
  request_id      text not null,
  ip              text,
  duree_ms        integer,
  cree_le         timestamptz not null default now()
);
comment on table public.api_logs is 'Journal d''audit de chaque appel authentifié à l''API NEXUS — indépendant des logs applicatifs génériques.';
create index if not exists idx_api_logs_site_date on public.api_logs(site, cree_le desc);
create index if not exists idx_api_logs_key on public.api_logs(api_key_id, cree_le desc);
create table if not exists public.integration_sources (
  id                uuid primary key default gen_random_uuid(),
  code              text not null unique,             -- 'decenium' | 'pennylane' | 'worldline' | 'nepting' | 'excel' | 'csv'
  nom               text not null,
  type              text not null,                     -- 'caisse' | 'comptabilite' | 'import_manuel'
  description       text,
  documentation_url text,
  cree_le           timestamptz not null default now()
);
comment on table public.integration_sources is 'Catalogue des logiciels/formats pouvant s''intégrer à NEXUS. Alimente l''interface Intégrations.';
create table if not exists public.integration_status (
  id                  uuid primary key default gen_random_uuid(),
  site                text not null references public.sites(site_id),
  source_code         text not null references public.integration_sources(code),
  statut              text not null default 'non_connecte' check (statut in ('non_connecte','en_attente','connecte','erreur','desactive')),
  derniere_sync_le     timestamptz,
  derniere_sync_statut text,                            -- 'succes' | 'echec_partiel' | 'echec'
  message             text,
  maj_le              timestamptz not null default now(),
  unique(site, source_code)
);
comment on table public.integration_status is 'État de connexion par établissement et par source, affiché sur l''écran d''administration et sur la page publique (panneau illustratif).';
alter table public.api_keys enable row level security;
alter table public.api_logs enable row level security;
alter table public.integration_sources enable row level security;
alter table public.integration_status enable row level security;
-- Aucune policy permissive : seul service_role (Edge Functions) accède à ces tables.

insert into public.integration_sources (code, nom, type, description) values
  ('decenium',  'Decenium',  'caisse',          'Logiciel de caisse actuellement en place — connecteur en lecture seule, en cours de négociation de la clé API.'),
  ('pennylane', 'Pennylane', 'comptabilite',    'Logiciel de comptabilité — intégration future envisagée.'),
  ('worldline', 'Worldline', 'caisse',          'Terminal de paiement / caisse — intégration future envisagée.'),
  ('nepting',   'Nepting',   'caisse',          'Solution de paiement/caisse — intégration future envisagée.'),
  ('excel',     'Excel',     'import_manuel',   'Export manuel — chemin actuel tant que le connecteur caisse n''est pas en service.'),
  ('csv',       'CSV',       'import_manuel',   'Import manuel générique.')
on conflict (code) do nothing;
insert into public.integration_status (site, source_code, statut, message) values
  ('vito-sainte-marie', 'decenium',  'en_attente',    'Clé API demandée à Decenium — connecteur prêt côté NEXUS, en attente de mise à disposition.'),
  ('vito-sainte-marie', 'pennylane', 'non_connecte',  null),
  ('vito-sainte-marie', 'worldline', 'non_connecte',  null),
  ('vito-sainte-marie', 'nepting',   'non_connecte',  null),
  ('vito-sainte-marie', 'excel',     'connecte',      'Export manuel actif — chemin de secours tant que le connecteur API n''est pas en service.'),
  ('vito-sainte-marie', 'csv',       'non_connecte',  null)
on conflict (site, source_code) do nothing;
