-- Campagne V2, lot C5 (schéma soumis à Guardian, commentaire 6885626717 sur #160) : PMP Decenium avant promotion.
-- Table append-only : une correction passe par une nouvelle version, motivée et tracée.
-- Migration nouvelle : aucune migration précédente n'est modifiée.

create table if not exists campagne_pmp_reference (
  id uuid primary key default gen_random_uuid(),
  site text not null,
  campagne_id uuid not null references campagnes_nexus(id) on delete cascade,
  article text not null,
  version integer not null check (version >= 1),
  pmp_ht numeric not null check (pmp_ht >= 0),
  date_reference date not null,
  source text not null check (source in ('products','saisie','reprise_objectif')),
  periode_debut date,
  periode_fin date,
  import_batch_id uuid references import_batches(id),
  motif text,
  saisi_par uuid references employees(id),
  saisi_le timestamptz not null default now(),
  constraint campagne_pmp_reference_unique unique (campagne_id, article, version),
  constraint campagne_pmp_reference_periode check (periode_debut is null or periode_fin is null or periode_fin >= periode_debut),
  constraint campagne_pmp_reference_source_products check (source <> 'products' or periode_fin = date_reference),
  constraint campagne_pmp_reference_motif check (version = 1 or (motif is not null and length(trim(motif)) > 0))
);
create index if not exists campagne_pmp_reference_campagne_idx on campagne_pmp_reference (campagne_id, article);

alter table campagne_pmp_reference enable row level security;

do $$
declare
  t text := 'campagne_pmp_reference';
  manager text := 'site = current_employee_site_id() and current_employee_role() in (''manager'',''gerant'')';
  controle text := format(' and exists (select 1 from campagnes_nexus c where c.id = %I.campagne_id and c.site = %I.site)', t, t);
begin
  execute format('drop policy if exists lecture_manager_meme_site on %I', t);
  execute format('create policy lecture_manager_meme_site on %I for select using (%s)', t, manager);
  execute format('drop policy if exists insertion_manager_meme_site on %I', t);
  execute format('create policy insertion_manager_meme_site on %I for insert with check (%s%s)', t, manager, controle);
  execute format('drop policy if exists createur_lit_si_autorise on %I', t);
  execute format('create policy createur_lit_si_autorise on %I for select using (je_suis_createur() and exists (select 1 from sites s where s.site_id = %I.site and s.acces_createur_autorise = true))', t, t);
  execute format('revoke all on %I from anon', t);
  execute format('revoke update, delete, truncate, references, trigger on %I from authenticated', t);
end $$;

comment on table campagne_pmp_reference is 'PMP Decenium avant promotion, mémorisé et daté à la validation des objectifs. Append-only : correction par nouvelle version motivée. La fiabilité (fiable, à confirmer, absent) est calculée par le moteur, jamais stockée.';
