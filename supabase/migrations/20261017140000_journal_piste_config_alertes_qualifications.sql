-- =====================================================================
-- 20261017140000 — Journal Piste : configuration, alertes, qualifications
-- (TEST SEULEMENT — NON APPLIQUÉE, en attente de l'arbitrage du SQL exact)
--
-- Lot JOURNAL-PISTE-20261017, request-2. Conditions de decision-1 respectées :
--   • le site n'est JAMAIS un paramètre qui fait autorité : les deux fonctions
--     appelables par un utilisateur (`enregistrer_config_piste`,
--     `qualifier_alerte_piste`) et `evaluer_controles_piste()` le déduisent de
--     l'identité de l'appelant (piste_site_appelant()). Les seules
--     fonctions qui reçoivent un site en paramètre (`piste_evaluer_site`,
--     `evaluer_tous_sites_piste`) ne sont exécutables par NI anon NI
--     authenticated : seul le propriétaire (tâche planifiée) les appelle.
--   • aucun UPDATE/DELETE/TRUNCATE pour un utilisateur, ni sur les trois tables
--     ni via la RLS : triggers d'immutabilité en plus des grants.
--   • fail-closed : donnée absente, photographie de configuration différente,
--     relevés finaux contradictoires, fuseau invalide => « non contrôlé » ou
--     « comparaison impossible », jamais « conforme ».
--   • aucun index n'est modifié, aucune vente n'est calculée.
-- Échelle : litresParUnite = 1 (« +1 correspond à un litre », Frédéric,
-- 17/10/2026, déclaration en chat) — consignée dans la configuration initiale.
-- =====================================================================
begin;
set local lock_timeout = '2s';

-- ---------------------------------------------------------------------
-- 1. Habilitation unique (réutilise les helpers existants, fail-closed)
-- ---------------------------------------------------------------------
-- Identité de l'appelant : helpers PROPRES au lot. Les helpers partagés
-- current_employee_role()/current_employee_site_id() lisent `employees` non
-- qualifié avec search_path = public : pg_temp est alors cherché en premier et
-- une table temporaire `employees` créée par l'appelant usurpe son rôle (mesuré
-- sur la base jetable, voir request-3). Ici : tout est qualifié, pg_temp en dernier.
create or replace function public.piste_site_appelant()
 returns text
 language sql
 stable security definer
 set search_path to pg_catalog, public, pg_temp
as $$
  select e.site_id from public.employees e where e.id = auth.uid();
$$;
create or replace function public.piste_role_appelant()
 returns text
 language sql
 stable security definer
 set search_path to pg_catalog, public, pg_temp
as $$
  select e.role from public.employees e where e.id = auth.uid();
$$;
revoke all on function public.piste_site_appelant() from public, anon, authenticated;
revoke all on function public.piste_role_appelant() from public, anon, authenticated;

create or replace function public.piste_manager_du_site(p_site text)
 returns boolean
 language sql
 stable security definer
 set search_path to pg_catalog, public, pg_temp
as $$
  select p_site is not null
     and p_site = public.piste_site_appelant()
     and public.piste_role_appelant() = any (array['manager', 'gerant']);
$$;
comment on function public.piste_manager_du_site(text) is
  'Vrai seulement si l''appelant est manager ou gérant ET que p_site est SON site. Sert à la RLS de lecture ; ne confère aucune autorité sur un autre site.';
revoke all on function public.piste_manager_du_site(text) from public, anon;
grant execute on function public.piste_manager_du_site(text) to authenticated;

-- ---------------------------------------------------------------------
-- 2. carburant_index_config : versions append-only
-- ---------------------------------------------------------------------
create table public.carburant_index_config (
  id uuid primary key default gen_random_uuid(),
  site text not null references public.sites(site_id),
  version integer not null check (version >= 1),
  config jsonb not null,
  avant jsonb,
  motif text,
  modifie_par uuid references public.employees(id),
  modifie_le timestamptz not null default now(),
  constraint carburant_index_config_site_version_key unique (site, version)
);
comment on table public.carburant_index_config is
  'Configuration des compteurs piste, une ligne par version (append-only). La version courante est la plus récente ; pas de date d''effet future. Écrite uniquement par enregistrer_config_piste().';

-- ---------------------------------------------------------------------
-- 3. carburant_index_alertes : une ligne par événement et par cause
-- ---------------------------------------------------------------------
create table public.carburant_index_alertes (
  id uuid primary key default gen_random_uuid(),
  site text not null references public.sites(site_id),
  type text not null check (type in ('passation', 'nuit', 'releve_manquant')),
  evenement text not null,
  niveau text not null check (niveau in ('orange', 'rouge')),
  statut text not null default 'ouverte' check (statut in ('ouverte', 'resolue_auto', 'qualifiee')),
  constat jsonb not null,
  raison_cloture text,
  ouverte_le timestamptz not null default now(),
  cloturee_le timestamptz,
  constraint carburant_index_alertes_site_type_evenement_key unique (site, type, evenement)
);
comment on table public.carburant_index_alertes is
  'Une alerte par (site, type, événement) : l''évaluation est idempotente. Le constat liste les compteurs concernés ; jamais une alerte par compteur. Écrite uniquement par piste_evaluer_site() et qualifier_alerte_piste().';

-- ---------------------------------------------------------------------
-- 4. carburant_index_qualifications : append-only, correction = nouvelle ligne
-- ---------------------------------------------------------------------
create table public.carburant_index_qualifications (
  id uuid primary key default gen_random_uuid(),
  alerte_id uuid not null references public.carburant_index_alertes(id),
  site text not null,
  choix text not null check (choix in ('erreur_lecture', 'mouvement_confirme', 'cause_inconnue')),
  commentaire text,
  qualifie_par uuid not null references public.employees(id),
  qualifie_le timestamptz not null default now(),
  remplace_id uuid references public.carburant_index_qualifications(id)
);
create unique index carburant_index_qualifications_un_remplacement
  on public.carburant_index_qualifications (remplace_id) where remplace_id is not null;
create index idx_carburant_index_qualifications_alerte
  on public.carburant_index_qualifications (alerte_id, qualifie_le desc);
comment on table public.carburant_index_qualifications is
  'Décision humaine (manager/gérant) sur une alerte. « mouvement_confirme » = déclaration du manager, pas un fait vérifié. Append-only : corriger une qualification = en insérer une qui remplace la précédente. Ne modifie jamais un index.';

-- Le site d'une qualification est hérité de l'alerte, jamais fourni.
create or replace function public.piste_qualification_heriter_site()
 returns trigger language plpgsql security definer set search_path to pg_catalog, public, pg_temp
as $$
begin
  select a.site into new.site from public.carburant_index_alertes a where a.id = new.alerte_id;
  if new.site is null then raise exception 'ALERTE_INTROUVABLE' using errcode = 'P0001'; end if;
  return new;
end;
$$;
revoke all on function public.piste_qualification_heriter_site() from public, anon, authenticated;
create trigger carburant_index_qualifications_site before insert on public.carburant_index_qualifications
  for each row execute function public.piste_qualification_heriter_site();

-- Immutabilité : config et qualifications ne changent jamais ; une alerte ne
-- change ni son identité ni son constat d'origine (statut/clôture/niveau/constat
-- à jour seulement, par les fonctions).
create or replace function public.piste_interdire_modification()
 returns trigger language plpgsql set search_path to pg_catalog, public, pg_temp
as $$
begin
  raise exception 'APPEND_ONLY % %', tg_table_name, tg_op using errcode = 'P0001';
end;
$$;
revoke all on function public.piste_interdire_modification() from public, anon, authenticated;
create trigger carburant_index_config_immuable before update or delete on public.carburant_index_config
  for each row execute function public.piste_interdire_modification();
create trigger carburant_index_qualifications_immuable before update or delete on public.carburant_index_qualifications
  for each row execute function public.piste_interdire_modification();

create or replace function public.piste_alerte_garde_identite()
 returns trigger language plpgsql set search_path to pg_catalog, public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then raise exception 'APPEND_ONLY carburant_index_alertes DELETE' using errcode = 'P0001'; end if;
  if new.id <> old.id or new.site <> old.site or new.type <> old.type
     or new.evenement <> old.evenement or new.ouverte_le <> old.ouverte_le then
    raise exception 'IDENTITE_ALERTE_IMMUABLE' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function public.piste_alerte_garde_identite() from public, anon, authenticated;
create trigger carburant_index_alertes_identite before update or delete on public.carburant_index_alertes
  for each row execute function public.piste_alerte_garde_identite();

-- ---------------------------------------------------------------------
-- 5. RLS : lecture manager/gérant du site, aucune écriture directe
-- ---------------------------------------------------------------------
alter table public.carburant_index_config enable row level security;
alter table public.carburant_index_alertes enable row level security;
alter table public.carburant_index_qualifications enable row level security;

create policy select_carburant_index_config on public.carburant_index_config
  for select to authenticated using ((select public.piste_manager_du_site(site)));
create policy select_carburant_index_alertes on public.carburant_index_alertes
  for select to authenticated using ((select public.piste_manager_du_site(site)));
create policy select_carburant_index_qualifications on public.carburant_index_qualifications
  for select to authenticated using ((select public.piste_manager_du_site(site)));
-- Volontairement aucune policy INSERT/UPDATE/DELETE : seules les fonctions
-- SECURITY DEFINER ci-dessous écrivent.

-- Fermeture explicite (default privileges Supabase : anon reçoit tout sur une table neuve).
revoke all on public.carburant_index_config, public.carburant_index_alertes,
  public.carburant_index_qualifications from public, anon, authenticated;
grant select on public.carburant_index_config, public.carburant_index_alertes,
  public.carburant_index_qualifications to authenticated;

-- ---------------------------------------------------------------------
-- 6. Photographie de configuration, posée par le serveur avec le relevé
-- ---------------------------------------------------------------------
alter table public.carburant_index_releves add column config_snapshot jsonb;
comment on column public.carburant_index_releves.config_snapshot is
  'Photographie immuable de la configuration piste courante {version, config} au moment de l''insertion du relevé. Posée par le serveur (un client ne peut pas la fournir) ; NULL = relevé antérieur à la configuration versionnée (jamais comparé).';

create or replace function public.piste_releve_photographier()
 returns trigger language plpgsql security definer set search_path to pg_catalog, public, pg_temp
as $$
begin
  new.config_snapshot := (
    select jsonb_build_object('version', c.version, 'config', c.config)
      from public.carburant_index_config c
     where c.site = new.site order by c.version desc limit 1);
  return new;
end;
$$;
revoke all on function public.piste_releve_photographier() from public, anon, authenticated;
create trigger carburant_index_releves_photographie before insert on public.carburant_index_releves
  for each row execute function public.piste_releve_photographier();

create or replace function public.piste_releve_snapshot_immuable()
 returns trigger language plpgsql set search_path to pg_catalog, public, pg_temp
as $$
begin
  if new.config_snapshot is distinct from old.config_snapshot then
    raise exception 'SNAPSHOT_IMMUABLE' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function public.piste_releve_snapshot_immuable() from public, anon, authenticated;
create trigger carburant_index_releves_snapshot_immuable before update on public.carburant_index_releves
  for each row execute function public.piste_releve_snapshot_immuable();

-- ---------------------------------------------------------------------
-- 7. enregistrer_config_piste : site déduit de l'appelant
-- ---------------------------------------------------------------------
create or replace function public.enregistrer_config_piste(p_config jsonb, p_motif text default null)
 returns integer
 language plpgsql
 security definer
 set search_path to pg_catalog, public, pg_temp
as $$
declare
  v_site text := public.piste_site_appelant();
  v_avant jsonb;
  v_version integer;
begin
  if auth.uid() is null or not public.piste_manager_du_site(v_site) then
    raise exception 'ROLE_NON_AUTORISE' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_config) <> 'object'
     or jsonb_typeof(p_config -> 'pompes') <> 'object'
     or jsonb_typeof(p_config -> 'chiffres') <> 'object'
     or coalesce((p_config ->> 'litresParUnite')::numeric, 0) <= 0
     or coalesce((p_config ->> 'toleranceL')::numeric, -1) < 0
     or coalesce((p_config ->> 'seuilL')::numeric, 0) <= coalesce((p_config ->> 'toleranceL')::numeric, 1e9)
     or coalesce((p_config ->> 'delaiReleveManquantMin')::int, 0) not between 1 and 240 then
    raise exception 'CONFIG_INVALIDE' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtext('config_piste:' || v_site));
  select c.config, c.version into v_avant, v_version
    from public.carburant_index_config c where c.site = v_site order by c.version desc limit 1;

  insert into public.carburant_index_config (site, version, config, avant, motif, modifie_par)
  values (v_site, coalesce(v_version, 0) + 1, p_config, v_avant, nullif(btrim(p_motif), ''), auth.uid())
  returning version into v_version;
  return v_version;
end;
$$;
comment on function public.enregistrer_config_piste(jsonb, text) is
  'Insère une nouvelle version de configuration pour LE SITE DE L''APPELANT (manager/gérant). Aucun paramètre site. Conserve l''avant et le motif.';
revoke all on function public.enregistrer_config_piste(jsonb, text) from public, anon;
grant execute on function public.enregistrer_config_piste(jsonb, text) to authenticated;

-- ---------------------------------------------------------------------
-- 8. qualifier_alerte_piste : le site vient de l'alerte, vérifié contre l'appelant
-- ---------------------------------------------------------------------
create or replace function public.qualifier_alerte_piste(
  p_alerte_id uuid, p_choix text, p_commentaire text default null, p_remplace_id uuid default null)
 returns uuid
 language plpgsql
 security definer
 set search_path to pg_catalog, public, pg_temp
as $$
declare
  v_alerte public.carburant_index_alertes%rowtype;
  v_id uuid;
begin
  select * into v_alerte from public.carburant_index_alertes where id = p_alerte_id for update;
  if v_alerte.id is null then raise exception 'ALERTE_INTROUVABLE' using errcode = 'P0001'; end if;
  if auth.uid() is null or not public.piste_manager_du_site(v_alerte.site) then
    raise exception 'ROLE_NON_AUTORISE' using errcode = 'P0001';
  end if;
  if p_choix is null or p_choix not in ('erreur_lecture', 'mouvement_confirme', 'cause_inconnue') then
    raise exception 'CHOIX_INVALIDE' using errcode = 'P0001';
  end if;
  if v_alerte.statut = 'resolue_auto' then
    raise exception 'ALERTE_DEJA_RESOLUE' using errcode = 'P0001';
  end if;
  if p_remplace_id is not null and not exists (
       select 1 from public.carburant_index_qualifications q
        where q.id = p_remplace_id and q.alerte_id = p_alerte_id) then
    raise exception 'REMPLACEMENT_INVALIDE' using errcode = 'P0001';
  end if;

  insert into public.carburant_index_qualifications (alerte_id, choix, commentaire, qualifie_par, remplace_id)
  values (p_alerte_id, p_choix, nullif(btrim(p_commentaire), ''), auth.uid(), p_remplace_id)
  returning id into v_id;
  update public.carburant_index_alertes set statut = 'qualifiee' where id = p_alerte_id;
  return v_id;
end;
$$;
comment on function public.qualifier_alerte_piste(uuid, text, text, uuid) is
  'Enregistre la décision du manager/gérant du site de l''alerte (append-only, correction = remplace_id). Le site n''est pas un paramètre. Ne modifie aucun index.';
revoke all on function public.qualifier_alerte_piste(uuid, text, text, uuid) from public, anon;
grant execute on function public.qualifier_alerte_piste(uuid, text, text, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 9. Évaluation des contrôles (idempotente)
-- ---------------------------------------------------------------------
-- Relevé final d'un moment : {etat: aucun|conflit|ok, snapshot, vals}.
create or replace function public.piste_releve_final(p_site text, p_date date, p_moment text)
 returns jsonb
 language plpgsql stable set search_path to pg_catalog, public, pg_temp
as $$
declare
  v_n int; v_distincts int; v_snap jsonb; v_vals jsonb;
begin
  with r as (
    select re.config_snapshot as snap,
           (select jsonb_object_agg(v.pompe || '-' || v.produit, v.valeur_sept_chiffres)
              from public.carburant_index_valeurs v where v.releve_id = re.id) as vals
      from public.carburant_index_releves re
     where re.site = p_site and re.date = p_date and re.moment = p_moment and re.statut = 'final')
  select count(*), count(distinct (coalesce(snap::text, '') || coalesce(vals::text, ''))),
         (array_agg(snap))[1], (array_agg(vals))[1]
    into v_n, v_distincts, v_snap, v_vals from r;
  if v_n = 0 then return jsonb_build_object('etat', 'aucun'); end if;
  if v_distincts > 1 then return jsonb_build_object('etat', 'conflit'); end if;
  return jsonb_build_object('etat', 'ok', 'snapshot', v_snap, 'vals', v_vals);
end;
$$;
revoke all on function public.piste_releve_final(text, date, text) from public, anon, authenticated;

-- Comparaison de deux relevés finaux (équivalent SQL de comparerPassation).
-- Retourne {etat, raison, lignes[]} avec etat in conforme|tolere|anomalie|non_controle|impossible.
create or replace function public.piste_comparer(p_a jsonb, p_b jsonb)
 returns jsonb
 language plpgsql immutable set search_path to pg_catalog, public, pg_temp
as $$
declare
  v_cfg jsonb; v_echelle numeric; v_tol numeric; v_seuil numeric;
  v_p text; v_prod text; v_clef text; v_a text; v_b text; v_ecart numeric;
  v_lignes jsonb := '[]'::jsonb; v_manque boolean := false; v_anom boolean := false; v_tole boolean := false;
  v_etat text;
begin
  if p_a ->> 'etat' <> 'ok' or p_b ->> 'etat' <> 'ok' then
    return jsonb_build_object('etat', 'non_controle',
      'raison', case when p_a ->> 'etat' = 'conflit' or p_b ->> 'etat' = 'conflit'
                     then 'Relevés finaux contradictoires pour un même moment.'
                     else 'Donnée manquante : un des deux relevés n''est pas enregistré dans NEXUS.' end,
      'lignes', v_lignes);
  end if;
  if p_a -> 'snapshot' is null or p_b -> 'snapshot' is null
     or jsonb_typeof(p_a -> 'snapshot') = 'null' or jsonb_typeof(p_b -> 'snapshot') = 'null' then
    return jsonb_build_object('etat', 'non_controle',
      'raison', 'Relevé antérieur à la configuration versionnée : configuration d''origine non photographiée.', 'lignes', v_lignes);
  end if;
  v_cfg := p_b -> 'snapshot' -> 'config';
  if (p_a -> 'snapshot' -> 'config' -> 'pompes', p_a -> 'snapshot' -> 'config' -> 'chiffres', p_a -> 'snapshot' -> 'config' -> 'litresParUnite')
     is distinct from (v_cfg -> 'pompes', v_cfg -> 'chiffres', v_cfg -> 'litresParUnite') then
    return jsonb_build_object('etat', 'impossible',
      'raison', 'Comparaison impossible : la configuration des compteurs a changé entre les deux relevés.', 'lignes', v_lignes);
  end if;
  v_echelle := (v_cfg ->> 'litresParUnite')::numeric;
  if v_echelle is null or v_echelle <= 0 then
    return jsonb_build_object('etat', 'impossible', 'raison', 'Comparaison impossible : unité de mesure non confirmée.', 'lignes', v_lignes);
  end if;
  v_tol := (v_cfg ->> 'toleranceL')::numeric; v_seuil := (v_cfg ->> 'seuilL')::numeric;

  for v_p in select jsonb_object_keys(v_cfg -> 'pompes') order by 1 loop
    if coalesce((v_cfg -> 'pompes' -> v_p ->> 'enService')::boolean, false) is not true then continue; end if;
    foreach v_prod in array array[v_cfg -> 'pompes' -> v_p ->> 'gauche', v_cfg -> 'pompes' -> v_p ->> 'droite'] loop
      v_clef := v_p || '-' || v_prod;
      v_a := p_a -> 'vals' ->> v_clef; v_b := p_b -> 'vals' ->> v_clef;
      if v_a is null or v_b is null or v_a !~ '^[0-9]+$' or v_b !~ '^[0-9]+$' then
        v_manque := true;
        v_lignes := v_lignes || jsonb_build_object('clef', v_clef, 'etat', 'non_controle');
        continue;
      end if;
      v_ecart := (v_b::numeric - v_a::numeric) * v_echelle;
      v_etat := case when abs(v_ecart) = 0 then 'conforme' when abs(v_ecart) >= v_seuil then 'anomalie' else 'tolere' end;
      if v_etat = 'anomalie' then v_anom := true; elsif v_etat = 'tolere' then v_tole := true; end if;
      v_lignes := v_lignes || jsonb_build_object('clef', v_clef, 'ecartL', v_ecart, 'etat', v_etat);
    end loop;
  end loop;
  if v_manque then
    return jsonb_build_object('etat', 'non_controle', 'raison', 'Donnée manquante : au moins un compteur n''a pas de valeur.', 'lignes', v_lignes);
  end if;
  return jsonb_build_object('etat', case when v_anom then 'anomalie' when v_tole then 'tolere' else 'conforme' end, 'lignes', v_lignes);
end;
$$;
revoke all on function public.piste_comparer(jsonb, jsonb) from public, anon, authenticated;

-- Ouvre, met à jour ou résout UNE alerte (idempotent sur la clé unique).
create or replace function public.piste_poser_alerte(
  p_site text, p_type text, p_evenement text, p_niveau text, p_present boolean, p_constat jsonb, p_raison text)
 returns void
 language plpgsql security definer set search_path to pg_catalog, public, pg_temp
as $$
begin
  if p_present then
    insert into public.carburant_index_alertes (site, type, evenement, niveau, constat)
    values (p_site, p_type, p_evenement, p_niveau, p_constat)
    on conflict (site, type, evenement) do update
      set constat = excluded.constat, niveau = excluded.niveau,
          statut = case when carburant_index_alertes.statut = 'resolue_auto' then 'ouverte' else carburant_index_alertes.statut end,
          cloturee_le = case when carburant_index_alertes.statut = 'resolue_auto' then null else carburant_index_alertes.cloturee_le end,
          raison_cloture = case when carburant_index_alertes.statut = 'resolue_auto' then null else carburant_index_alertes.raison_cloture end;
  else
    update public.carburant_index_alertes
       set statut = 'resolue_auto', cloturee_le = now(), raison_cloture = p_raison
     where site = p_site and type = p_type and evenement = p_evenement and statut in ('ouverte', 'qualifiee');
  end if;
end;
$$;
revoke all on function public.piste_poser_alerte(text, text, text, text, boolean, jsonb, text) from public, anon, authenticated;

-- Évalue un site pour une date de référence. Site en paramètre => NON exécutable
-- par un utilisateur ; appelée seulement par la tâche planifiée ou par
-- evaluer_controles_piste() qui impose le site de l'appelant.
create or replace function public.piste_evaluer_site(p_site text, p_date date)
 returns void
 language plpgsql security definer set search_path to pg_catalog, public, pg_temp
as $$
declare
  v_tz text; v_cfg jsonb; v_delai int; v_res jsonb; v_present boolean;
  v_q text; v_moment text; v_deb time; v_fin time; v_echeance timestamptz; v_ev text;
  v_a jsonb; v_b jsonb;
begin
  select s.timezone into v_tz from public.sites s where s.site_id = p_site;
  if v_tz is null or btrim(v_tz) = '' or not exists (select 1 from pg_timezone_names where name = v_tz) then
    return; -- fail-closed : pas de fuseau, pas d'horloge, aucun verdict.
  end if;

  -- Passation (fin Q1 -> début Q2, orange) et nuit (fin Q2 de la veille -> début Q1, rouge).
  v_a := public.piste_releve_final(p_site, p_date, 'fin_q1');
  v_b := public.piste_releve_final(p_site, p_date, 'debut_q2');
  v_res := public.piste_comparer(v_a, v_b);
  -- Seul un verdict CONCLUANT ouvre ou résout : « non contrôlé » / « impossible »
  -- (donnée manquante, relevés contradictoires, configuration changée) laisse l'alerte en l'état.
  if v_res ->> 'etat' in ('conforme', 'tolere', 'anomalie') then
    perform public.piste_poser_alerte(p_site, 'passation', p_date::text, 'orange', v_res ->> 'etat' = 'anomalie', v_res, 'Recalcul sur relevés finaux : plus d''écart.');
  end if;

  v_a := public.piste_releve_final(p_site, p_date - 1, 'fin_q2');
  v_b := public.piste_releve_final(p_site, p_date, 'debut_q1');
  v_res := public.piste_comparer(v_a, v_b);
  -- Seul un verdict CONCLUANT ouvre ou résout : « non contrôlé » / « impossible »
  -- (donnée manquante, relevés contradictoires, configuration changée) laisse l'alerte en l'état.
  if v_res ->> 'etat' in ('conforme', 'tolere', 'anomalie') then
    perform public.piste_poser_alerte(p_site, 'nuit', p_date::text, 'rouge', v_res ->> 'etat' = 'anomalie', v_res, 'Recalcul sur relevés finaux : plus d''écart.');
  end if;

  -- Relevé de fin manquant : fin de quart (calculer_horaires_quart, moteur unique)
  -- + délai de la configuration courante, au fuseau du site.
  select c.config into v_cfg from public.carburant_index_config c where c.site = p_site order by c.version desc limit 1;
  if v_cfg is null then return; end if;
  v_delai := (v_cfg ->> 'delaiReleveManquantMin')::int;
  if v_delai is null then return; end if;

  foreach v_q in array array['quart1', 'quart2'] loop
    v_moment := case v_q when 'quart1' then 'fin_q1' else 'fin_q2' end;
    select h.heure_debut, h.heure_fin into v_deb, v_fin from public.calculer_horaires_quart(p_site, v_q, p_date) h;
    if v_fin is null then continue; end if;
    if not exists (select 1 from public.shifts sh
                    where sh.site = p_site and sh.role = 'pompiste'
                      and sh.quart = case v_q when 'quart1' then 'matin' else 'soir' end
                      and (sh.heure_debut at time zone v_tz)::date = p_date) then
      continue; -- pas de pompiste ce quart-là : aucun relevé attendu.
    end if;
    v_echeance := ((p_date + case when v_fin <= v_deb then 1 else 0 end)::timestamp + v_fin) at time zone v_tz
                  + make_interval(mins => v_delai);
    v_ev := v_moment || ':' || p_date::text;
    v_present := now() >= v_echeance
                 and public.piste_releve_final(p_site, p_date, v_moment) ->> 'etat' = 'aucun';
    perform public.piste_poser_alerte(p_site, 'releve_manquant', v_ev, 'rouge', v_present,
      jsonb_build_object('moment', v_moment, 'quart', v_q, 'echeance', v_echeance,
                         'message', 'Relevé de fin non enregistré dans NEXUS'),
      'Relevé final enregistré.');
  end loop;
end;
$$;
revoke all on function public.piste_evaluer_site(text, date) from public, anon, authenticated;

-- Appel manager : site déduit de l'appelant, deux jours (aujourd'hui et hier, fuseau du site).
create or replace function public.evaluer_controles_piste()
 returns void
 language plpgsql security definer set search_path to pg_catalog, public, pg_temp
as $$
declare
  v_site text := public.piste_site_appelant();
  v_tz text; v_jour date;
begin
  if auth.uid() is null or not public.piste_manager_du_site(v_site) then
    raise exception 'ROLE_NON_AUTORISE' using errcode = 'P0001';
  end if;
  select s.timezone into v_tz from public.sites s where s.site_id = v_site;
  if v_tz is null or not exists (select 1 from pg_timezone_names where name = v_tz) then return; end if;
  v_jour := (now() at time zone v_tz)::date;
  perform public.piste_evaluer_site(v_site, v_jour);
  perform public.piste_evaluer_site(v_site, v_jour - 1);
end;
$$;
comment on function public.evaluer_controles_piste() is
  'Réévalue les contrôles du site de l''appelant (manager/gérant), sans paramètre. Idempotent.';
revoke all on function public.evaluer_controles_piste() from public, anon;
grant execute on function public.evaluer_controles_piste() to authenticated;

-- Tâche planifiée : tous les sites, indépendante de l'ouverture du Journal.
create or replace function public.evaluer_tous_sites_piste()
 returns void
 language plpgsql security definer set search_path to pg_catalog, public, pg_temp
as $$
declare
  r record; v_jour date;
begin
  for r in select distinct c.site, s.timezone from public.carburant_index_config c
             join public.sites s on s.site_id = c.site loop
    if r.timezone is null or not exists (select 1 from pg_timezone_names where name = r.timezone) then continue; end if;
    v_jour := (now() at time zone r.timezone)::date;
    perform public.piste_evaluer_site(r.site, v_jour);
    perform public.piste_evaluer_site(r.site, v_jour - 1);
  end loop;
end;
$$;
revoke all on function public.evaluer_tous_sites_piste() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 10. Configuration initiale du site de Test + planification
-- ---------------------------------------------------------------------
insert into public.carburant_index_config (site, version, config, avant, motif, modifie_par)
select s.site_id, 1,
  jsonb_build_object(
    'litresParUnite', 1, 'toleranceL', 9, 'seuilL', 10, 'delaiReleveManquantMin', 30,
    'pompes', jsonb_build_object(
      '1', jsonb_build_object('gauche', 'GO', 'droite', 'SP', 'enService', true),
      '2', jsonb_build_object('gauche', 'SP', 'droite', 'GO', 'enService', true),
      '3', jsonb_build_object('gauche', 'GO', 'droite', 'SP', 'enService', true),
      '4', jsonb_build_object('gauche', 'SP', 'droite', 'GO', 'enService', true)),
    'chiffres', jsonb_build_object('mecanique', 7, 'decenium', 6),
    'ordreRecopie', jsonb_build_array('SP', 'GO'),
    'gnr', jsonb_build_object('enService', false, 'indexFige', '1191213'),
    'echelleConfirmee', jsonb_build_object('par', 'Frédéric Bragance', 'le', '2026-10-17',
                                            'mode', 'déclaration en chat : +1 correspond à un litre')),
  null, 'Configuration initiale (cahier des charges du 17/10/2026)', null
from public.sites s where s.site_id = 'vito-sainte-marie';

do $planif$
begin
  if exists (select 1 from cron.job where jobname = 'nexus-journal-piste') then
    perform cron.unschedule('nexus-journal-piste');
  end if;
  perform cron.schedule('nexus-journal-piste', '*/5 * * * *', 'select public.evaluer_tous_sites_piste();');
end
$planif$;

-- ---------------------------------------------------------------------
-- 11. Postconditions (la migration échoue, donc rien n'est appliqué, si elles ne tiennent pas)
-- ---------------------------------------------------------------------
do $ctrl$
begin
  if (select count(*) from pg_class where relname in
        ('carburant_index_config', 'carburant_index_alertes', 'carburant_index_qualifications')
        and relrowsecurity) <> 3 then raise exception 'RLS absente'; end if;
  if exists (select 1 from information_schema.role_table_grants
              where table_name in ('carburant_index_config', 'carburant_index_alertes', 'carburant_index_qualifications')
                and ((grantee = 'anon') or (grantee = 'authenticated' and privilege_type <> 'SELECT')
                     or grantee = 'PUBLIC')) then raise exception 'grant illicite'; end if;
  if has_function_privilege('anon', 'public.evaluer_controles_piste()', 'execute')
     or has_function_privilege('authenticated', 'public.piste_evaluer_site(text,date)', 'execute')
     or has_function_privilege('authenticated', 'public.evaluer_tous_sites_piste()', 'execute')
     or has_function_privilege('anon', 'public.enregistrer_config_piste(jsonb,text)', 'execute')
     or has_function_privilege('anon', 'public.qualifier_alerte_piste(uuid,text,text,uuid)', 'execute')
  then raise exception 'EXECUTE illicite'; end if;
end
$ctrl$;
commit;
