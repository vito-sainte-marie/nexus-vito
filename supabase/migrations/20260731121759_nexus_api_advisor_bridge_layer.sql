-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260731121759 · nexus_api_advisor_bridge_layer
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- ============================================================
-- NEXUS API — Pont vers le moteur décisionnel existant
-- advisor_inputs correspond à l'objet « candidat avant promotion »
-- laissé ouvert dans NEXUS-API-Specification-v4 (§3.3, note sur
-- advisor_candidates) — le master prompt lui donne un nom définitif.
-- Ne touche pas aux tables advisor_messages/advisor_rules/journal_decisions
-- existantes, s'y raccorde uniquement en référence.
-- ============================================================

create table if not exists public.advisor_inputs (
  id                    uuid primary key default gen_random_uuid(),
  site                  text not null references public.sites(site_id),
  type                  text not null check (type in (
                          'chiffre_affaires','marge','quantites','variation_prix','evolution_volume',
                          'performance_employe','performance_quart','performance_heure','performance_categorie',
                          'panier_moyen'
                        )),
  periode_debut         date,
  periode_fin           date,
  dimension             text,                          -- clé de regroupement : product_id, employee_id, category, shift_id...
  valeur                numeric,
  detail                jsonb,                          -- décomposition/traçabilité (ex. liste de normalized_sales.id impliqués)
  calcule_le            timestamptz not null default now(),
  utilise_par_advisor   boolean not null default false  -- marque la consommation par le moteur (advisor_messages/journal_decisions)
);
comment on table public.advisor_inputs is 'Calculs dérivés de la couche normalisée (CA, marge, volumes, performance...), candidats avant promotion en message ou décision du Conseiller NEXUS.';
create index if not exists idx_advisor_inputs_site_type on public.advisor_inputs(site, type, calcule_le desc);
create table if not exists public.advisor_logs (
  id                uuid primary key default gen_random_uuid(),
  site              text not null references public.sites(site_id),
  advisor_input_id  uuid references public.advisor_inputs(id),
  action            text not null check (action in ('candidat_cree','promu_en_message','rejete','ignore')),
  message_id        uuid references public.advisor_messages(id),
  detail            text,
  cree_le           timestamptz not null default now()
);
comment on table public.advisor_logs is 'Traçabilité de ce que le moteur décisionnel a fait de chaque advisor_input — vers un message affiché, un rejet ou une décision journalisée.';
create index if not exists idx_advisor_logs_site_date on public.advisor_logs(site, cree_le desc);
alter table public.advisor_inputs enable row level security;
alter table public.advisor_logs enable row level security;
-- Aucune policy permissive : accès exclusif via service_role (Edge Functions / moteur décisionnel).;
