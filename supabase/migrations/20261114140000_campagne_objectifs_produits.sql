-- Campagne V2, lot C1 (Guardian, commentaire 6878700837 sur #160) : objectifs de vente par produit.
-- Table append-only et versionnée : chaque modification crée une nouvelle version, l'ancienne reste.
-- Aucun UPDATE ni DELETE pour `authenticated` (privilèges retirés, aucune politique correspondante).
-- RLS sur le modèle des tables #299 : lecture du même site, écriture manager ou gérant du même site
-- (insertion seulement), lecture du créateur si le site l'autorise, `anon` fermé. Idempotente.

create table if not exists campagne_objectifs_produits (
  id uuid primary key default gen_random_uuid(),
  site text not null,
  campagne_id uuid not null references campagnes_nexus(id) on delete cascade,
  article text not null,
  version integer not null check (version >= 1),
  pa_habituel_ht numeric,
  pa_promo_ht numeric,
  pv_habituel_ttc numeric,
  pv_promo_ttc numeric,
  tva_pct numeric,
  ventes_ref_jour numeric,
  periode_ref_debut date,
  periode_ref_fin date,
  seuil_unites integer,
  rythme_min_jour numeric,
  objectif_propose_jour integer,
  objectif_valide_jour integer,
  valide_par uuid references employees(id),
  valide_le timestamptz,
  moteur_version text not null,
  provenance jsonb not null default '{}'::jsonb,
  calcule_le timestamptz not null default now(),
  constraint campagne_objectifs_produits_unique unique (campagne_id, article, version)
);

create index if not exists campagne_objectifs_produits_campagne_idx on campagne_objectifs_produits (campagne_id);

alter table campagne_objectifs_produits enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='campagne_objectifs_produits' and policyname='lecture_meme_site') then
    create policy lecture_meme_site on campagne_objectifs_produits for select
      using (site = current_employee_site_id());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='campagne_objectifs_produits' and policyname='insertion_manager_meme_site') then
    create policy insertion_manager_meme_site on campagne_objectifs_produits for insert
      with check (site = current_employee_site_id() and current_employee_role() in ('manager','gerant'));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='campagne_objectifs_produits' and policyname='createur_lit_si_autorise') then
    create policy createur_lit_si_autorise on campagne_objectifs_produits for select
      using (je_suis_createur() and exists (select 1 from sites s where s.site_id = campagne_objectifs_produits.site and s.acces_createur_autorise = true));
  end if;
end $$;

revoke all on campagne_objectifs_produits from anon;
revoke update, delete, truncate, references, trigger on campagne_objectifs_produits from authenticated;

comment on table campagne_objectifs_produits is 'Objectifs de vente par produit et par promotion. Append-only : une ligne par version, jamais modifiée ni supprimée par l''application.';
