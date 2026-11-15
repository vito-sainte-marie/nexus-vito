-- Produits V2, lot P1-B (schéma soumis à Guardian, GO migration Test sur #160, commentaire 6900970604).
-- Trois tables déclaratives. Aucune ne modifie products, ventes ou données Decenium.
--   produits_nature_reference      : nature d'une référence (produit, service, opération de caisse, à identifier).
--   produits_justifications_marge  : justification d'un déstockage à marge négative, valable pour une période.
--   produits_tva_confirmations     : taux de TVA confirmé par un responsable.
-- Append-only : une correction est une nouvelle ligne qui remplace l'ancienne (remplace_id),
-- une annulation est un UPDATE limité aux trois colonnes d'annulation. Aucun DELETE.
-- Migration nouvelle : aucune migration précédente n'est modifiée.

create table if not exists produits_nature_reference (
  id uuid primary key default gen_random_uuid(),
  site text not null,
  article text,
  code_barres text,
  nature text not null check (nature in ('produit_commercial','service_commercial','operation_caisse','a_identifier')),
  commentaire text,
  declare_par uuid references employees(id),
  declare_le timestamptz not null default now(),
  remplace_id uuid references produits_nature_reference(id),
  annule_le timestamptz,
  annule_par uuid references employees(id),
  motif_annulation text,
  constraint produits_nature_cible check (
    (article is not null and length(trim(article)) > 0) or (code_barres is not null and length(trim(code_barres)) > 0)
  ),
  constraint produits_nature_annulation check (
    (annule_le is null and annule_par is null and motif_annulation is null)
    or (annule_le is not null and motif_annulation is not null and length(trim(motif_annulation)) > 0)
  )
);
create index if not exists produits_nature_site_idx on produits_nature_reference (site, article);
create index if not exists produits_nature_site_cb_idx on produits_nature_reference (site, code_barres);

create table if not exists produits_justifications_marge (
  id uuid primary key default gen_random_uuid(),
  site text not null,
  article text not null,
  code_barres text,
  periode_debut date not null,
  periode_fin date not null,
  motif text not null check (motif in ('dlc','fin_gamme','emballage_deteriore','surstock','autre')),
  commentaire text,
  valide_par uuid references employees(id),
  valide_le timestamptz not null default now(),
  remplace_id uuid references produits_justifications_marge(id),
  annule_le timestamptz,
  annule_par uuid references employees(id),
  motif_annulation text,
  constraint produits_justif_periode check (periode_fin >= periode_debut),
  constraint produits_justif_autre check (motif <> 'autre' or (commentaire is not null and length(trim(commentaire)) > 0)),
  constraint produits_justif_annulation check (
    (annule_le is null and annule_par is null and motif_annulation is null)
    or (annule_le is not null and motif_annulation is not null and length(trim(motif_annulation)) > 0)
  )
);
create index if not exists produits_justif_site_idx on produits_justifications_marge (site, article, periode_debut, periode_fin);

create table if not exists produits_tva_confirmations (
  id uuid primary key default gen_random_uuid(),
  site text not null,
  article text,
  code_barres text,
  taux_confirme numeric not null check (taux_confirme >= 0 and taux_confirme <= 100),
  commentaire text,
  confirme_par uuid references employees(id),
  confirme_le timestamptz not null default now(),
  remplace_id uuid references produits_tva_confirmations(id),
  annule_le timestamptz,
  annule_par uuid references employees(id),
  motif_annulation text,
  constraint produits_tva_cible check (
    (article is not null and length(trim(article)) > 0) or (code_barres is not null and length(trim(code_barres)) > 0)
  ),
  constraint produits_tva_annulation check (
    (annule_le is null and annule_par is null and motif_annulation is null)
    or (annule_le is not null and motif_annulation is not null and length(trim(motif_annulation)) > 0)
  )
);
create index if not exists produits_tva_site_idx on produits_tva_confirmations (site, article);
create index if not exists produits_tva_site_cb_idx on produits_tva_confirmations (site, code_barres);

-- RLS identique sur les trois tables : même site, manager ou gérant, rien pour anon, pas de DELETE.
do $$
declare
  t text;
  annul text;
  manager text := 'site = current_employee_site_id() and current_employee_role() in (''manager'',''gerant'')';
begin
  foreach t in array array['produits_nature_reference','produits_justifications_marge','produits_tva_confirmations'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists lecture_manager_meme_site on %I', t);
    execute format('create policy lecture_manager_meme_site on %I for select using (%s)', t, manager);
    execute format('drop policy if exists insertion_manager_meme_site on %I', t);
    execute format('create policy insertion_manager_meme_site on %I for insert with check (%s)', t, manager);
    execute format('drop policy if exists annulation_manager_meme_site on %I', t);
    execute format('create policy annulation_manager_meme_site on %I for update using (%s and annule_le is null) with check (%s and annule_le is not null and annule_par is not null)', t, manager, manager);
    execute format('revoke all on %I from anon', t);
    execute format('revoke all on %I from public', t);
    execute format('revoke update, delete, truncate, references, trigger on %I from authenticated', t);
    -- L'UPDATE n'est ouvert que sur les colonnes d'annulation.
    execute format('grant update (annule_le, annule_par, motif_annulation) on %I to authenticated', t);
  end loop;
end $$;

comment on table produits_nature_reference is 'Nature déclarée d une référence (produit, service, opération de caisse, à identifier), par un responsable. Rattachée au nom normalisé (si unique sur le site) ou au code-barres exact. Une opération de caisse est exclue des indicateurs commerciaux, jamais des données importées.';
comment on table produits_justifications_marge is 'Justification d un déstockage à marge négative, valable pour la seule période indiquée. La marge et le CA ne changent jamais.';
comment on table produits_tva_confirmations is 'Taux de TVA confirmé par un responsable. Ne modifie ni products ni Decenium. Un taux importé différent du taux confirmé ramène la référence à TVA incohérente.';
