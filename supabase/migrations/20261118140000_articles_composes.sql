-- NEXUS Scanner, articles composés : liste déclarée par le gérant, applicable après la migration 20261118120000.
-- Dépend des migrations T2 (20261117020430 à 20261117161325) et de 20261118120000.
-- Additive : une table d'ajout seul, une fonction de normalisation, une fonction de déclaration SECURITY INVOKER. Aucune donnée existante modifiée.
-- Le registre produits_nature_reference n'est pas touché. Aucune écriture Decenium.
-- Le site n'est jamais un paramètre : il est lu dans la ligne employees de la personne connectée.
-- Retour arrière : docs/deploiement/retour-arriere-tarif-articles-composes-20261118.sql (exporte d'abord en lecture seule, ne retire que ces trois objets).

do $prerequis$
declare v_manque text;
begin
  select string_agg(o, ', ') into v_manque from unnest(array['public.sites', 'public.employees', 'public.tarif_anomalies_verifications', 'public.tarif_anomalies_reevaluations']) o where to_regclass(o) is null;
  if v_manque is not null then
    raise exception 'prerequis_migrations : 20261118140000 (appliquer 20261117020430 à 20261118120000 avant) : objets absents : %', v_manque;
  end if;
end $prerequis$;

do $$ begin
  if to_regprocedure('public.tarif_marquer_verifie(jsonb)') is null
     or not exists (select 1 from pg_policies where schemaname = 'public' and policyname = 'compte_actif_obligatoire') then
    raise exception 'ordre_migrations : appliquer 20261118120000 avant 20261118140000';
  end if;
end $$;

-- 1. Normalisation unique (SQL et JS identiques) : minuscules, accents retirés (table explicite), espaces multiples réduits, trim, rien d'autre.
create or replace function articles_composes_normaliser(p_nom text)
returns text language sql immutable parallel safe set search_path = pg_catalog as $$
  select btrim(regexp_replace(translate(lower(p_nom), 'àáâãäåçèéêëìíîïñòóôõöùúûüýÿ', 'aaaaaaceeeeiiiinooooouuuuyy'), '\s+', ' ', 'g'))
$$;

-- 2. Articles déclarés composés. Ajout seul ; l'annulation est tracée (qui, quand, pourquoi).
create table if not exists articles_composes (
  id uuid primary key default gen_random_uuid(),
  site text not null references sites(site_id),
  nom text not null check (length(btrim(nom)) > 0 and char_length(nom) <= 300),
  nom_normalise text generated always as (articles_composes_normaliser(nom)) stored,
  source text not null default 'catalogue Decenium, filtre Comp' check (length(btrim(source)) > 0 and char_length(source) <= 200),
  date_releve date,
  saisi_par uuid not null default auth.uid() references employees(id),
  saisi_le timestamptz not null default now(),
  annule_le timestamptz, annule_par uuid references employees(id), motif_annulation text,
  constraint articles_composes_nom_non_vide check (length(articles_composes_normaliser(nom)) > 0),
  constraint articles_composes_annulation check ((annule_le is null and annule_par is null and motif_annulation is null)
    or (annule_le is not null and annule_par is not null and length(btrim(coalesce(motif_annulation, ''))) > 0)),
  constraint articles_composes_motif_long check (motif_annulation is null or char_length(motif_annulation) <= 500),
  constraint articles_composes_id_site unique (id, site)
);
create unique index if not exists articles_composes_actif_uq on articles_composes (site, nom_normalise) where annule_le is null;
comment on table articles_composes is 'Articles déclarés composés par le gérant (vente croisée, marge volontairement réduite). Ajout seul, annulation tracée. Ne modifie aucun prix ni aucune donnée Decenium.';

-- 3. RLS : lecture manager et gérant du site (créateur si le site l autorise) ; écriture et annulation : gérant du site. Aucun DELETE ; UPDATE limité à l annulation.
alter table articles_composes enable row level security;
alter table articles_composes force row level security;
drop policy if exists lecture_meme_site on articles_composes;
create policy lecture_meme_site on articles_composes for select to authenticated using (
  (site = (select current_employee_site_id()) and (select current_employee_role()) in ('manager','gerant'))
  or ((select je_suis_createur()) and exists (select 1 from sites s where s.site_id = articles_composes.site and s.acces_createur_autorise)));
drop policy if exists insertion_gerant_meme_site on articles_composes;
create policy insertion_gerant_meme_site on articles_composes for insert to authenticated with check (
  site = (select current_employee_site_id()) and (select current_employee_role()) = 'gerant' and saisi_par = (select auth.uid()) and annule_le is null);
drop policy if exists annulation_gerant_meme_site on articles_composes;
create policy annulation_gerant_meme_site on articles_composes for update to authenticated
  using (site = (select current_employee_site_id()) and (select current_employee_role()) = 'gerant' and annule_le is null)
  with check (annule_le is not null and annule_par = (select auth.uid()) and site = (select current_employee_site_id()));
drop policy if exists compte_actif_obligatoire on articles_composes;
create policy compte_actif_obligatoire on articles_composes as restrictive for all to authenticated
  using (exists (select 1 from employees e where e.id = (select auth.uid()) and e.actif))
  with check (exists (select 1 from employees e where e.id = (select auth.uid()) and e.actif));
revoke all on articles_composes from anon, public, authenticated, service_role;
grant select, insert on articles_composes to authenticated, service_role;
grant update (annule_le, annule_par, motif_annulation) on articles_composes to authenticated, service_role;

-- 4. Déclarer des articles composés, par lot, tout ou rien, idempotent. SECURITY INVOKER : la RLS s applique.
--    Champs admis par ligne : nom, source, date_releve. Le site est refusé. Un nom déjà déclaré (même forme normalisée) n est pas dupliqué (o_deja = true).
create or replace function declarer_articles_composes(p_lignes jsonb)
returns table (o_id uuid, o_nom_normalise text, o_deja boolean)
language plpgsql volatile security invoker set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_emp record;
  l jsonb;
  v_norm text;
  v_id uuid;
begin
  if v_uid is null then raise exception 'compose_session_absente : aucune personne connectée' using errcode = 'P0001'; end if;
  select e.actif, e.role, e.site_id, e.est_createur into v_emp from employees e where e.id = v_uid;
  if not found then raise exception 'compose_compte_illisible : fiche employé introuvable' using errcode = 'P0001'; end if;
  if not v_emp.actif then raise exception 'compose_compte_inactif : compte désactivé' using errcode = 'P0001'; end if;
  if v_emp.est_createur then raise exception 'compose_createur_lecture_seule : le créateur ne déclare pas' using errcode = 'P0001'; end if;
  if v_emp.role is distinct from 'gerant' then raise exception 'compose_reservee_gerant : réservé au gérant' using errcode = 'P0001'; end if;
  if p_lignes is null or jsonb_typeof(p_lignes) <> 'array' or jsonb_array_length(p_lignes) not between 1 and 200 then
    raise exception 'compose_lot_invalide : de 1 à 200 articles par appel' using errcode = 'P0001';
  end if;
  for l in select value from jsonb_array_elements(p_lignes) loop
    if jsonb_typeof(l) <> 'object' or exists (select 1 from jsonb_object_keys(l) k where k not in ('nom','source','date_releve')) then
      raise exception 'compose_champ_inconnu : champ non admis (le site n est jamais transmis)' using errcode = 'P0001';
    end if;
    if jsonb_typeof(l->'nom') is distinct from 'string' then raise exception 'compose_nom_absent : nom obligatoire' using errcode = 'P0001'; end if;
    v_norm := articles_composes_normaliser(l->>'nom');
    if v_norm = '' or char_length(l->>'nom') > 300 then raise exception 'compose_nom_invalide : nom vide ou trop long' using errcode = 'P0001'; end if;
    select a.id into v_id from articles_composes a where a.site = v_emp.site_id and a.nom_normalise = v_norm and a.annule_le is null;
    if v_id is not null then
      o_id := v_id; o_nom_normalise := v_norm; o_deja := true; return next;
    else
      insert into articles_composes (site, nom, source, date_releve)
      values (v_emp.site_id, btrim(l->>'nom'), coalesce(nullif(btrim(l->>'source'), ''), 'catalogue Decenium, filtre Comp'), nullif(l->>'date_releve', '')::date)
      returning id into v_id;
      o_id := v_id; o_nom_normalise := v_norm; o_deja := false; return next;
    end if;
  end loop;
end $$;
revoke all on function declarer_articles_composes(jsonb) from public, anon, authenticated, service_role;
grant execute on function declarer_articles_composes(jsonb) to authenticated;
revoke all on function articles_composes_normaliser(text) from public, anon;
grant execute on function articles_composes_normaliser(text) to authenticated, service_role;
