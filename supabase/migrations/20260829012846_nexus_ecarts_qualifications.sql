-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260829012846 · nexus_ecarts_qualifications
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

create table if not exists nexus_ecarts_qualifications (
  id uuid primary key default gen_random_uuid(),
  site text not null,
  source_module text not null check (source_module in ('verify','fdj')),
  source_control_id uuid not null,
  activite text not null,
  type_qualification text not null default 'activite_inhabituelle',
  motif text not null check (motif in ('remplacement_absent','modification_planning','intervention_ponctuelle','erreur_attribution','autre')),
  note text,
  qualifie_par uuid references employees(id),
  qualifie_le timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (source_module, source_control_id, activite, type_qualification)
);

comment on table nexus_ecarts_qualifications is 'v2.269 — qualifications manuelles posees par le manager sur une situation signalee par "Analyse des ecarts" (ex: activite caisse inhabituelle dun manager/gerant). Jamais une conclusion automatique : NEXUS signale, le manager qualifie.';
comment on column nexus_ecarts_qualifications.source_module is 'verify | fdj — meme convention que les lignes normalisees de nexus-ecarts-donnees.js';
comment on column nexus_ecarts_qualifications.source_control_id is 'id reel de audits_caisse (verify) ou fdj_cash_controls (fdj)';
comment on column nexus_ecarts_qualifications.type_qualification is 'extensible : "activite_inhabituelle" est le seul type ecrit en v2.269, dautres controles de coherence pourront reutiliser cette meme table plus tard';

alter table nexus_ecarts_qualifications enable row level security;

create policy select_nexus_ecarts_qualifications on nexus_ecarts_qualifications
  for select using (site in (select e.site_id from employees e where e.id = auth.uid()));

create policy inserer_nexus_ecarts_qualifications on nexus_ecarts_qualifications
  for insert with check (site in (select e.site_id from employees e where e.id = auth.uid()));

create policy modifier_nexus_ecarts_qualifications on nexus_ecarts_qualifications
  for update using (site in (select e.site_id from employees e where e.id = auth.uid()));
