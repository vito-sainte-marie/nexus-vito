-- Lot « Mesure de la compensation » (Guardian, cahier des charges du commentaire 6865021911 sur #160,
-- GO de Frédéric du 13/11/2026 : commentaire 6865137328).
-- Trois tables pour mesurer si le volume compense la remise : mesures par produit et par promotion,
-- coûts d'opération, conditions fournisseur (remise habituelle seule, sans octroi de mer).
-- RLS sur le modèle de `campagnes_nexus` : lecture du même site, écriture manager ou gérant du même site,
-- lecture du créateur. Idempotente. Aucune écriture dans `products`.

create table if not exists campagne_mesures_produits (
  id uuid primary key default gen_random_uuid(),
  site text not null,
  campagne_id uuid not null references campagnes_nexus(id) on delete cascade,
  article text not null,
  produit_id uuid,
  nouveau_produit boolean not null default false,
  ventes_mois_precedent numeric,
  jours_reference integer,
  achat_avant_ht numeric,
  achat_pendant_ht numeric,
  vente_avant_ht numeric,
  vente_pendant_ht numeric,
  stock_debut numeric,
  stock_debut_source text,
  livraisons_pendant numeric,
  stock_fin numeric,
  stock_fin_source text,
  saisi_par uuid references employees(id),
  saisi_le timestamptz not null default now(),
  modifie_le timestamptz not null default now(),
  constraint campagne_mesures_produits_unique unique (campagne_id, article),
  constraint campagne_mesures_stock_debut_source_check
    check (stock_debut_source is null or stock_debut_source in ('comptage','decenium','saisie')),
  constraint campagne_mesures_stock_fin_source_check
    check (stock_fin_source is null or stock_fin_source in ('comptage','decenium','saisie')),
  constraint campagne_mesures_jours_reference_check
    check (jours_reference is null or jours_reference > 0)
);

create table if not exists campagne_couts (
  id uuid primary key default gen_random_uuid(),
  site text not null,
  campagne_id uuid not null references campagnes_nexus(id) on delete cascade,
  libelle text not null,
  montant_ht numeric not null check (montant_ht >= 0),
  saisi_par uuid references employees(id),
  saisi_le timestamptz not null default now()
);

create table if not exists fournisseurs_conditions (
  id uuid primary key default gen_random_uuid(),
  site text not null,
  fournisseur text not null,
  remise_habituelle_pct numeric not null default 0 check (remise_habituelle_pct >= 0 and remise_habituelle_pct < 100),
  maj_par uuid references employees(id),
  maj_le timestamptz not null default now(),
  constraint fournisseurs_conditions_unique unique (site, fournisseur)
);

create index if not exists campagne_mesures_produits_campagne_idx on campagne_mesures_produits (campagne_id);
create index if not exists campagne_couts_campagne_idx on campagne_couts (campagne_id);

do $$
declare t text;
begin
  foreach t in array array['campagne_mesures_produits','campagne_couts','fournisseurs_conditions'] loop
    execute format('alter table %I enable row level security', t);
    if not exists (select 1 from pg_policies where schemaname='public' and tablename=t and policyname='lecture_meme_site') then
      execute format('create policy lecture_meme_site on %I for select using (site = current_employee_site_id())', t);
    end if;
    if not exists (select 1 from pg_policies where schemaname='public' and tablename=t and policyname='ecriture_manager_meme_site') then
      execute format($p$create policy ecriture_manager_meme_site on %I for all
        using (site = current_employee_site_id() and current_employee_role() in ('manager','gerant'))
        with check (site = current_employee_site_id() and current_employee_role() in ('manager','gerant'))$p$, t);
    end if;
    if not exists (select 1 from pg_policies where schemaname='public' and tablename=t and policyname='createur_lit_si_autorise') then
      execute format('create policy createur_lit_si_autorise on %I for select using (je_suis_createur())', t);
    end if;
  end loop;
end $$;

comment on table campagne_mesures_produits is 'Mesure de la compensation : une ligne par produit et par promotion (saisie modifiable, sources du stock enregistrées).';
comment on table campagne_couts is 'Coûts d''opération d''une promotion (HT), déduits du gain avant l''état « à renouveler ».';
comment on table fournisseurs_conditions is 'Remise habituelle par fournisseur. Prix net = catalogue × (1 − remise). Pas d''octroi de mer.';

-- Les default privileges de Supabase ouvrent tout à `anon` et `authenticated` (TRUNCATE compris, que la RLS ne filtre pas).
-- On referme `anon` et on retire à `authenticated` ce que la RLS ne couvre pas.
revoke all on campagne_mesures_produits, campagne_couts, fournisseurs_conditions from anon;
revoke truncate, references, trigger on campagne_mesures_produits, campagne_couts, fournisseurs_conditions from authenticated;
