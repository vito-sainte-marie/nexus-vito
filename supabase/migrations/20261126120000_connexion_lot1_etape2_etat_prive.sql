-- Connexion, lot 1, étape 2 (Guardian #160, 7147734665, point 1) : tables et fonctions PRIVÉES de la connexion durcie.
-- Schéma nexus_connexion : aucun droit pour public, anon, authenticated. Seul service_role (Edge Function `connexion`) y accède.
-- Aucun secret n'entre ici : le poivre du code, le secret maître Auth et l'empreinte d'IP vivent dans l'Edge Function.
-- Postgres ne reçoit jamais le code ni le poivre : il reçoit un alias, une empreinte d'IP, un hash bcrypt déjà calculé.
-- Retour arrière : outils/recette/connexion_lot1/99b_retour_arriere_etape2.sql. Idempotente.

create schema if not exists nexus_connexion;

-- Réglages (valeurs par défaut de Test ; les valeurs de Production sont validées par le gérant avant GO).
create table if not exists nexus_connexion.parametres (
  id int primary key default 1 check (id = 1),
  premier_palier int not null default 3,                      -- n° de l'échec à partir duquel une attente s'applique
  paliers_s int[] not null default '{5,30,300,900}',          -- attentes successives, en secondes
  seuil_verrou_s int not null default 300,                    -- une attente >= seuil compte comme un verrouillage
  remise_a_zero_min int not null default 30,                  -- sans échec pendant ce délai, le compteur repart de 0
  escalade_verrous int not null default 3,                    -- verrouillages dans la fenêtre => déblocage par un manager
  escalade_fenetre_h int not null default 24,
  ip_essais_10min int not null default 20,
  ip_comptes_10min int not null default 8,
  ip_essais_heure int not null default 60,
  migration_jours int not null default 14,
  retention_journal_j int not null default 90
);
insert into nexus_connexion.parametres (id) values (1) on conflict (id) do nothing;

-- État par compte (user_id = employees.id = auth.users.id).
create table if not exists nexus_connexion.compte (
  user_id uuid primary key,
  etat text not null default 'a_migrer' check (etat in ('a_migrer','migre','code_temporaire_requis')),
  version int not null default 1,                              -- version du secret Auth dérivé
  code_hash text,                                              -- bcrypt(HMAC(poivre, alias||code)), calculé hors Postgres
  echecs int not null default 0,
  dernier_echec timestamptz,
  prochain_essai timestamptz,
  a_deverrouiller boolean not null default false,              -- vrai : seul un manager lève le verrou
  echeance timestamptz,
  maj timestamptz not null default now()
);

create table if not exists nexus_connexion.journal (
  id bigserial primary key,
  at timestamptz not null default now(),
  user_id uuid,
  evenement text not null,
  ip_fp text,
  detail jsonb
);
create index if not exists journal_user_evt_idx on nexus_connexion.journal (user_id, evenement, at desc);
create index if not exists journal_at_idx on nexus_connexion.journal (at);

create table if not exists nexus_connexion.essais_ip (
  id bigserial primary key,
  at timestamptz not null default now(),
  ip_fp text not null,
  alias text not null,
  decision text
);
create index if not exists essais_ip_idx on nexus_connexion.essais_ip (ip_fp, at desc);

create table if not exists nexus_connexion.alerte (
  id bigserial primary key,
  at timestamptz not null default now(),
  site_id text,
  user_id uuid not null,
  type text not null,
  traitee_le timestamptz,
  traitee_par uuid
);

alter table nexus_connexion.parametres enable row level security;
alter table nexus_connexion.compte enable row level security;
alter table nexus_connexion.journal enable row level security;
alter table nexus_connexion.essais_ip enable row level security;
alter table nexus_connexion.alerte enable row level security;
alter table nexus_connexion.secret enable row level security;
alter table nexus_connexion.sauvegarde_auth enable row level security;

revoke all on schema nexus_connexion from public, anon, authenticated;
revoke all on all tables in schema nexus_connexion from public, anon, authenticated;
revoke all on all sequences in schema nexus_connexion from public, anon, authenticated;
grant usage on schema nexus_connexion to service_role;

-- Un compte lié à un employé démarre « à migrer », échéance dans migration_jours.
insert into nexus_connexion.compte (user_id, etat, echeance)
select e.id, 'a_migrer', now() + make_interval(days => (select migration_jours from nexus_connexion.parametres where id = 1))
from public.employees e join auth.users u on u.id = e.id
on conflict (user_id) do nothing;

-- Attente (secondes) après le n-ième échec consécutif.
create or replace function nexus_connexion.attente_pour(p_n int, p_premier int, p_paliers int[]) returns int
language sql immutable set search_path = pg_catalog as
$$ select case when p_n < p_premier then 0 else p_paliers[least(p_n - p_premier + 1, array_length(p_paliers, 1))] end $$;

-- Prénom -> (user_id, alias, n). Même calcul d'alias que la RPC anonyme ; un seul passage, mêmes opérations dans tous les cas.
create or replace function nexus_connexion.resoudre(p_prenom text) returns table (user_id uuid, alias text, n int)
language sql stable security definer set search_path = nexus_connexion, public, extensions, pg_temp as
$$
  with m as (
    select count(*)::int n, min(e.id::text) id
    from public.employees e
    where (e.actif = true or e.compte_test = true)
      and lower(btrim(e.nom)) = lower(btrim(coalesce(p_prenom, '')))
  )
  select case when n = 1 then id::uuid end,
         nexus_connexion.alias_de(case when n = 1 then 'u:' || id else 'x:' || lower(btrim(coalesce(p_prenom, ''))) end),
         n
  from m
$$;

-- Avant la vérification du code : limites par IP, état du compte. Renvoie la décision et, si elle est « ok », le hash à vérifier.
-- decision : ok | attente | verrouille | ip_limite. Le client ne voit jamais la décision : l'Edge Function répond comme à un échec ordinaire.
create or replace function nexus_connexion.avant_essai(p_prenom text, p_ip_fp text) returns jsonb
language plpgsql volatile security definer set search_path = nexus_connexion, public, extensions, pg_temp as
$$
declare
  p nexus_connexion.parametres%rowtype;
  r record; c nexus_connexion.compte%rowtype;
  n10 int; comptes10 int; n60 int; dec text := 'ok'; att int := 0;
begin
  select * into p from nexus_connexion.parametres where id = 1;
  select * into r from nexus_connexion.resoudre(p_prenom);
  if p_ip_fp = 'inconnue' then
    insert into nexus_connexion.journal (evenement, ip_fp) values ('ip_inconnue', p_ip_fp);
  end if;

  select count(*), count(distinct alias) into n10, comptes10
  from nexus_connexion.essais_ip where ip_fp = p_ip_fp and at > now() - interval '10 minutes';
  select count(*) into n60 from nexus_connexion.essais_ip where ip_fp = p_ip_fp and at > now() - interval '1 hour';
  if n10 >= p.ip_essais_10min or comptes10 >= p.ip_comptes_10min or n60 >= p.ip_essais_heure then
    dec := 'ip_limite';
  end if;

  if r.user_id is not null then
    select * into c from nexus_connexion.compte where user_id = r.user_id;
    if found then
      if c.a_deverrouiller then dec := case when dec = 'ok' then 'verrouille' else dec end;
      elsif c.prochain_essai is not null and c.prochain_essai > now() then
        dec := case when dec = 'ok' then 'attente' else dec end;
        att := ceil(extract(epoch from (c.prochain_essai - now())))::int;
      end if;
    end if;
  end if;

  insert into nexus_connexion.essais_ip (ip_fp, alias, decision) values (p_ip_fp, r.alias, dec);
  if dec <> 'ok' then
    insert into nexus_connexion.journal (user_id, evenement, ip_fp, detail)
    values (r.user_id, 'refus_' || dec, p_ip_fp, jsonb_build_object('attente_s', att));
  end if;

  return jsonb_build_object(
    'decision', dec, 'alias', r.alias, 'user_id', r.user_id, 'attente_s', att,
    'etat', c.etat, 'version', c.version,
    'code_hash', case when dec = 'ok' then c.code_hash end);
end $$;

-- Après un échec de code : compteur, attente, verrouillage, escalade vers un manager au n-ième verrouillage dans la fenêtre.
create or replace function nexus_connexion.apres_echec(p_user_id uuid, p_ip_fp text) returns jsonb
language plpgsql volatile security definer set search_path = nexus_connexion, public, extensions, pg_temp as
$$
declare
  p nexus_connexion.parametres%rowtype; c nexus_connexion.compte%rowtype;
  n int; att int; avant int; verrou boolean := false; nv int; escalade boolean := false; site text;
begin
  select * into p from nexus_connexion.parametres where id = 1;
  if p_user_id is null then return jsonb_build_object('attente_s', 0, 'verrou', false); end if;
  select * into c from nexus_connexion.compte where user_id = p_user_id for update;
  if not found then return jsonb_build_object('attente_s', 0, 'verrou', false); end if;

  n := case when c.dernier_echec is null or c.dernier_echec < now() - make_interval(mins => p.remise_a_zero_min) then 1 else c.echecs + 1 end;
  att := nexus_connexion.attente_pour(n, p.premier_palier, p.paliers_s);
  avant := case when n = 1 then 0 else nexus_connexion.attente_pour(n - 1, p.premier_palier, p.paliers_s) end;
  verrou := att >= p.seuil_verrou_s and avant < p.seuil_verrou_s;

  insert into nexus_connexion.journal (user_id, evenement, ip_fp, detail)
  values (p_user_id, 'echec', p_ip_fp, jsonb_build_object('n', n, 'attente_s', att));
  if verrou then
    insert into nexus_connexion.journal (user_id, evenement, ip_fp) values (p_user_id, 'verrou', p_ip_fp);
    select count(*) into nv from nexus_connexion.journal
      where user_id = p_user_id and evenement = 'verrou' and at > now() - make_interval(hours => p.escalade_fenetre_h);
    escalade := nv >= p.escalade_verrous and not c.a_deverrouiller;
  end if;

  update nexus_connexion.compte set echecs = n, dernier_echec = now(),
    prochain_essai = case when att > 0 then now() + make_interval(secs => att) else null end,
    a_deverrouiller = c.a_deverrouiller or escalade, maj = now()
  where user_id = p_user_id;

  if escalade then
    select e.site_id into site from public.employees e where e.id = p_user_id;
    insert into nexus_connexion.alerte (site_id, user_id, type) values (site, p_user_id, 'verrou_manager');
    insert into nexus_connexion.journal (user_id, evenement, ip_fp, detail) values (p_user_id, 'escalade', p_ip_fp, jsonb_build_object('verrous', nv));
  end if;
  return jsonb_build_object('attente_s', att, 'verrou', verrou, 'escalade', escalade);
end $$;

-- Après un succès : remise à zéro. Renvoie l'état pour que l'Edge Function décide (migration, changement de code).
create or replace function nexus_connexion.apres_succes(p_user_id uuid, p_ip_fp text) returns jsonb
language plpgsql volatile security definer set search_path = nexus_connexion, public, extensions, pg_temp as
$$
declare c nexus_connexion.compte%rowtype;
begin
  update nexus_connexion.compte set echecs = 0, dernier_echec = null, prochain_essai = null, maj = now()
  where user_id = p_user_id returning * into c;
  insert into nexus_connexion.journal (user_id, evenement, ip_fp) values (p_user_id, 'succes', p_ip_fp);
  return jsonb_build_object('etat', c.etat, 'version', c.version, 'echeance', c.echeance);
end $$;

-- Pose le hash d'un code (déjà calculé hors Postgres) et l'état qui en découle.
create or replace function nexus_connexion.poser_code(p_user_id uuid, p_hash text, p_etat text, p_version int) returns void
language plpgsql volatile security definer set search_path = nexus_connexion, public, pg_temp as
$$
begin
  if p_etat not in ('a_migrer','migre','code_temporaire_requis') then raise exception 'etat invalide'; end if;
  if p_hash is null or p_hash !~ '^\$2[aby]\$[0-9]{2}\$.{53}$' then raise exception 'hash bcrypt attendu'; end if;
  update nexus_connexion.compte set code_hash = p_hash, etat = p_etat, version = p_version, maj = now() where user_id = p_user_id;
  insert into nexus_connexion.journal (user_id, evenement, detail) values (p_user_id, 'code_pose', jsonb_build_object('etat', p_etat, 'version', p_version));
end $$;

-- Lève le verrou d'un compte. L'autorisation (manager ou gérant de la même station) est vérifiée par l'Edge Function.
create or replace function nexus_connexion.lever_verrou(p_user_id uuid, p_par uuid) returns void
language plpgsql volatile security definer set search_path = nexus_connexion, public, pg_temp as
$$
begin
  update nexus_connexion.compte set a_deverrouiller = false, echecs = 0, dernier_echec = null, prochain_essai = null, maj = now() where user_id = p_user_id;
  update nexus_connexion.alerte set traitee_le = now(), traitee_par = p_par where user_id = p_user_id and traitee_le is null;
  insert into nexus_connexion.journal (user_id, evenement, detail) values (p_user_id, 'verrou_leve', jsonb_build_object('par', p_par));
end $$;

-- Purge de rétention (non planifiée ici : la durée de Production est validée par le gérant).
create or replace function nexus_connexion.purger() returns jsonb
language plpgsql volatile security definer set search_path = nexus_connexion, pg_temp as
$$
declare j int; e int; r int;
begin
  select retention_journal_j into r from nexus_connexion.parametres where id = 1;
  delete from nexus_connexion.journal where at < now() - make_interval(days => r); get diagnostics j = row_count;
  delete from nexus_connexion.essais_ip where at < now() - interval '2 hours'; get diagnostics e = row_count;
  return jsonb_build_object('journal', j, 'essais_ip', e);
end $$;

do $g$
declare f text;
begin
  for f in select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'nexus_connexion' loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
  grant all on all tables in schema nexus_connexion to service_role;
  grant all on all sequences in schema nexus_connexion to service_role;
end $g$;
