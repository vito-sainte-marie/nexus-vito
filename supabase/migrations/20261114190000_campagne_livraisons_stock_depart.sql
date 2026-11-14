-- Campagne V2, lot C3 (Guardian, commentaires 6880117787 et 6880119890 sur #160) : livraisons, stock de départ, conditionnement d'achat.
-- Cinq tables append-only : aucune ligne n'est modifiée ni supprimée, une correction passe par une nouvelle ligne
-- (livraison de remplacement, nouvelle version de stock) ou par une annulation tracée.
-- Le stock théorique ne compte que les livraisons de `campagne_livraisons` : les livraisons déjà saisies dans
-- `inventaire_mouvements` ne sont jamais ajoutées en silence (le moteur les signale).

create table if not exists campagne_livraisons (
  id uuid primary key default gen_random_uuid(),
  site text not null,
  campagne_id uuid not null references campagnes_nexus(id) on delete cascade,
  fournisseur text,
  date_livraison date not null,
  note text,
  remplace_livraison_id uuid references campagne_livraisons(id),
  cree_par uuid references employees(id),
  cree_le timestamptz not null default now()
);
create index if not exists campagne_livraisons_campagne_idx on campagne_livraisons (campagne_id, date_livraison);

create table if not exists campagne_livraisons_annulations (
  id uuid primary key default gen_random_uuid(),
  site text not null,
  livraison_id uuid not null references campagne_livraisons(id),
  motif text not null check (length(trim(motif)) > 0),
  annule_par uuid references employees(id),
  annule_le timestamptz not null default now(),
  constraint campagne_livraisons_annulations_unique unique (livraison_id)
);

create table if not exists campagne_livraison_lignes (
  id uuid primary key default gen_random_uuid(),
  site text not null,
  livraison_id uuid not null references campagne_livraisons(id) on delete cascade,
  article text not null,
  cartons numeric check (cartons is null or cartons >= 0),
  unites_par_carton numeric check (unites_par_carton is null or unites_par_carton > 0),
  unites numeric not null check (unites >= 0),
  pa_ht_facture numeric check (pa_ht_facture is null or pa_ht_facture >= 0),
  pa_ht_propose numeric check (pa_ht_propose is null or pa_ht_propose >= 0),
  source_conditionnement text not null default 'inconnu' check (source_conditionnement in ('suffixe_np','a_l_unite','inconnu')),
  constraint campagne_livraison_lignes_unique unique (livraison_id, article)
);

-- Réglage par article, versionné : « à l'unité » vaut explicitement 1 unité par carton, ce qui n'est pas un conditionnement absent.
create table if not exists campagne_conditionnement_achat (
  id uuid primary key default gen_random_uuid(),
  site text not null,
  article text not null,
  version integer not null check (version >= 1),
  mode text not null check (mode in ('suffixe_np','a_l_unite','inconnu')),
  unites_par_carton numeric check (unites_par_carton is null or unites_par_carton > 0),
  saisi_par uuid references employees(id),
  saisi_le timestamptz not null default now(),
  constraint campagne_conditionnement_achat_unique unique (site, article, version),
  constraint campagne_conditionnement_achat_coherence check (
    (mode = 'a_l_unite' and unites_par_carton = 1)
    or (mode = 'suffixe_np' and unites_par_carton is not null)
    or (mode = 'inconnu' and unites_par_carton is null)
  )
);

create table if not exists campagne_stock_depart (
  id uuid primary key default gen_random_uuid(),
  site text not null,
  campagne_id uuid not null references campagnes_nexus(id) on delete cascade,
  article text not null,
  version integer not null check (version >= 1),
  quantite numeric not null check (quantite >= 0),
  date_stock date not null,
  source text not null check (source in ('inventaire','saisie_initiale')),
  reference_releve uuid,
  a_confirmer boolean not null default false,
  saisi_par uuid references employees(id),
  saisi_le timestamptz not null default now(),
  constraint campagne_stock_depart_unique unique (campagne_id, article, version)
);

alter table campagne_livraisons enable row level security;
alter table campagne_livraisons_annulations enable row level security;
alter table campagne_livraison_lignes enable row level security;
alter table campagne_conditionnement_achat enable row level security;
alter table campagne_stock_depart enable row level security;

do $$
declare t text;
begin
  foreach t in array array['campagne_livraisons','campagne_livraisons_annulations','campagne_livraison_lignes','campagne_conditionnement_achat','campagne_stock_depart'] loop
    if not exists (select 1 from pg_policies where schemaname='public' and tablename=t and policyname='lecture_meme_site') then
      execute format('create policy lecture_meme_site on %I for select using (site = current_employee_site_id())', t);
    end if;
    if not exists (select 1 from pg_policies where schemaname='public' and tablename=t and policyname='insertion_manager_meme_site') then
      execute format('create policy insertion_manager_meme_site on %I for insert with check (site = current_employee_site_id() and current_employee_role() in (''manager'',''gerant''))', t);
    end if;
    if not exists (select 1 from pg_policies where schemaname='public' and tablename=t and policyname='createur_lit_si_autorise') then
      execute format('create policy createur_lit_si_autorise on %I for select using (je_suis_createur() and exists (select 1 from sites s where s.site_id = %I.site and s.acces_createur_autorise = true))', t, t);
    end if;
    execute format('revoke all on %I from anon', t);
    execute format('revoke update, delete, truncate, references, trigger on %I from authenticated', t);
  end loop;
end $$;

comment on table campagne_livraisons is 'Livraison fournisseur saisie pour une promotion. Append-only : correction par livraison de remplacement ou annulation tracée.';
comment on table campagne_livraisons_annulations is 'Annulation tracée d''une livraison de promotion. Une livraison est valide tant qu''aucune ligne ne la vise et qu''aucune livraison ne la remplace.';
comment on table campagne_livraison_lignes is 'Lignes de livraison : cartons x unités par carton, ou saisie directe en unités. PA proposé conservé à côté du PA facturé.';
comment on table campagne_conditionnement_achat is 'Conditionnement d''achat par article, versionné : suffixe -NP, à l''unité (1 par carton, explicite) ou inconnu.';
comment on table campagne_stock_depart is 'Stock de départ d''une promotion par article, versionné. Une nouvelle version remplace la précédente sans l''effacer.';
