-- Campagne V2, lot C4 (schéma validé par Guardian, commentaires 6884237957 et 6884282337 sur #160) : commandes fournisseur et réglages d'achat.
-- Tables append-only : une correction passe par une commande de remplacement, une annulation ou une clôture tracée.
-- Rien n'est jamais envoyé à un fournisseur : aucune colonne d'envoi, aucune fonction.
-- Migration nouvelle : aucune migration précédente n'est modifiée.

create table if not exists campagne_commandes (
  id uuid primary key default gen_random_uuid(),
  site text not null,
  campagne_id uuid not null references campagnes_nexus(id) on delete cascade,
  fournisseur text,
  date_commande date not null,
  date_livraison_prevue date,
  note text,
  remplace_commande_id uuid references campagne_commandes(id),
  cree_par uuid references employees(id),
  cree_le timestamptz not null default now()
);
create index if not exists campagne_commandes_campagne_idx on campagne_commandes (campagne_id, date_commande);

create table if not exists campagne_commande_lignes (
  id uuid primary key default gen_random_uuid(),
  site text not null,
  commande_id uuid not null references campagne_commandes(id) on delete cascade,
  article text not null,
  unites_commandees numeric not null check (unites_commandees >= 0),
  cartons numeric check (cartons is null or cartons >= 0),
  unites_par_carton numeric check (unites_par_carton is null or unites_par_carton > 0),
  recommande_unites numeric check (recommande_unites is null or recommande_unites >= 0),
  constraint campagne_commande_lignes_unique unique (commande_id, article)
);

create table if not exists campagne_commandes_annulations (
  id uuid primary key default gen_random_uuid(),
  site text not null,
  commande_id uuid not null references campagne_commandes(id),
  motif text not null check (length(trim(motif)) > 0),
  annule_par uuid references employees(id),
  annule_le timestamptz not null default now(),
  constraint campagne_commandes_annulations_unique unique (commande_id)
);

create table if not exists campagne_commandes_clotures (
  id uuid primary key default gen_random_uuid(),
  site text not null,
  commande_id uuid not null references campagne_commandes(id),
  motif text not null check (length(trim(motif)) > 0),
  cloture_par uuid references employees(id),
  cloture_le timestamptz not null default now(),
  constraint campagne_commandes_clotures_unique unique (commande_id)
);

create table if not exists campagne_livraison_commandes (
  id uuid primary key default gen_random_uuid(),
  site text not null,
  livraison_id uuid not null references campagne_livraisons(id),
  commande_id uuid not null references campagne_commandes(id),
  lie_par uuid references employees(id),
  lie_le timestamptz not null default now(),
  constraint campagne_livraison_commandes_unique unique (livraison_id)
);

create table if not exists campagne_achats_reglages (
  id uuid primary key default gen_random_uuid(),
  site text not null,
  version integer not null check (version >= 1),
  jours_couverture_apres integer not null default 15 check (jours_couverture_apres >= 0),
  delai_commande_jours integer not null default 7 check (delai_commande_jours >= 0),
  saisi_par uuid references employees(id),
  saisi_le timestamptz not null default now(),
  constraint campagne_achats_reglages_unique unique (site, version)
);

alter table campagne_commandes enable row level security;
alter table campagne_commande_lignes enable row level security;
alter table campagne_commandes_annulations enable row level security;
alter table campagne_commandes_clotures enable row level security;
alter table campagne_livraison_commandes enable row level security;
alter table campagne_achats_reglages enable row level security;

do $$
declare
  t text;
  manager text := 'site = current_employee_site_id() and current_employee_role() in (''manager'',''gerant'')';
  controle text;
begin
  foreach t in array array['campagne_commandes','campagne_commande_lignes','campagne_commandes_annulations','campagne_commandes_clotures','campagne_livraison_commandes','campagne_achats_reglages'] loop
    controle := case
      when t = 'campagne_commandes' then format(' and exists (select 1 from campagnes_nexus c where c.id = %I.campagne_id and c.site = %I.site)', t, t)
      when t in ('campagne_commande_lignes','campagne_commandes_annulations','campagne_commandes_clotures') then format(' and exists (select 1 from campagne_commandes o where o.id = %I.commande_id and o.site = %I.site)', t, t)
      when t = 'campagne_livraison_commandes' then format(' and exists (select 1 from campagne_commandes o join campagne_livraisons l on l.id = %I.livraison_id where o.id = %I.commande_id and o.site = %I.site and l.site = %I.site and l.campagne_id = o.campagne_id)', t, t, t, t)
      else '' end;
    execute format('drop policy if exists lecture_manager_meme_site on %I', t);
    execute format('create policy lecture_manager_meme_site on %I for select using (%s)', t, manager);
    execute format('drop policy if exists insertion_manager_meme_site on %I', t);
    execute format('create policy insertion_manager_meme_site on %I for insert with check (%s%s)', t, manager, controle);
    execute format('drop policy if exists createur_lit_si_autorise on %I', t);
    execute format('create policy createur_lit_si_autorise on %I for select using (je_suis_createur() and exists (select 1 from sites s where s.site_id = %I.site and s.acces_createur_autorise = true))', t, t);
    execute format('revoke all on %I from anon', t);
    execute format('revoke update, delete, truncate, references, trigger on %I from authenticated', t);
  end loop;
end $$;

comment on table campagne_commandes is 'Commande fournisseur préparée pour une promotion. Jamais transmise au fournisseur. Append-only : correction par commande de remplacement, annulation ou clôture tracée.';
comment on table campagne_commande_lignes is 'Lignes de commande en unités, avec la recommandation affichée au moment de la commande (recommande_unites) pour tracer l''écart.';
comment on table campagne_commandes_annulations is 'Annulation tracée d''une commande, motif obligatoire.';
comment on table campagne_commandes_clotures is 'Clôture d''une commande (reliquat qui ne viendra plus), motif obligatoire. Une commande clôturée sort du reste à recevoir.';
comment on table campagne_livraison_commandes is 'Rattachement d''une livraison à une commande (même site, même campagne). Plusieurs livraisons peuvent viser la même commande : réceptions partielles.';
comment on table campagne_achats_reglages is 'Réglages d''achat par site, versionnés : couverture après promotion (15 jours) et délai de commande fournisseur (7 jours). Un changement passe par une nouvelle version.';
