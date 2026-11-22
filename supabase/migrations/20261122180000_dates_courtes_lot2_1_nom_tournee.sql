-- Dates courtes, lot 2.1 : nom de tournée généré par le serveur, renommage tracé.
-- Ajout seul : une table de trace, trois fonctions nouvelles, une fonction reprise (même signature). Aucune ligne existante réécrite.
-- Décision du pilote du 22/11/2026 : « Contrôle DLC · <prénom> · <JJ/MM> », fuseau de la station, aucune saisie obligatoire.
-- Retour arrière : docs/deploiement/retour-arriere-dates-courtes-lot2-1-20261122.sql.

do $prerequis$
declare v_manque text[] := '{}'; v_n text;
begin
  if to_regclass('public.dates_courtes_tournees') is null then v_manque := v_manque || 'dates_courtes_tournees'; end if;
  foreach v_n in array array['dates_courtes_operer()', 'dates_courtes_gestion()', 'dates_courtes_caissier_autorise()', 'dates_courtes_creer_tournee(text,text)'] loop
    if to_regprocedure('public.' || v_n) is null then v_manque := v_manque || v_n; end if;
  end loop;
  if array_length(v_manque, 1) is not null then
    raise exception 'prerequis_migrations : 20261121120000 : objets absents : %', array_to_string(v_manque, ', ') using errcode = 'P0001';
  end if;
end $prerequis$;

-- 1. Trace des renommages : ancien nom, nouveau nom, auteur du geste, heure. Jamais modifiée ni supprimée.
create table if not exists dates_courtes_renommages_tournee (
  id uuid primary key default gen_random_uuid(),
  site text not null references sites(site_id),
  tournee_id uuid not null,
  ancien_nom text not null,
  nouveau_nom text not null check (char_length(nouveau_nom) between 1 and 60),
  renomme_par uuid not null references employees(id),
  renomme_le timestamptz not null default now(),
  cle_idempotence text not null check (length(btrim(cle_idempotence)) between 1 and 100),
  constraint dates_courtes_renommages_tournee_fk foreign key (tournee_id, site) references dates_courtes_tournees (id, site),
  constraint dates_courtes_renommages_idem unique (site, cle_idempotence)
);
create index if not exists dates_courtes_renommages_tournee_idx on dates_courtes_renommages_tournee (tournee_id, renomme_le);

create or replace function dates_courtes_renommage_immuable() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  raise exception 'trace_immuable : la trace des renommages ne se modifie ni ne se supprime' using errcode = 'P0001';
end $$;
drop trigger if exists dates_courtes_renommages_immuable on dates_courtes_renommages_tournee;
create trigger dates_courtes_renommages_immuable before update or delete on dates_courtes_renommages_tournee for each row execute function dates_courtes_renommage_immuable();

alter table dates_courtes_renommages_tournee enable row level security;
alter table dates_courtes_renommages_tournee force row level security;
drop policy if exists compte_actif_obligatoire on dates_courtes_renommages_tournee;
create policy compte_actif_obligatoire on dates_courtes_renommages_tournee as restrictive to authenticated
  using (exists (select 1 from employees e where e.id = (select auth.uid()) and e.actif));
drop policy if exists lecture_gestion_meme_site on dates_courtes_renommages_tournee;
create policy lecture_gestion_meme_site on dates_courtes_renommages_tournee for select to authenticated
  using (site = (select current_employee_site_id()) and (select dates_courtes_gestion()));
revoke all on dates_courtes_renommages_tournee from anon, public, authenticated, service_role;
grant select on dates_courtes_renommages_tournee to authenticated, service_role;

-- 2. Nom généré : « Contrôle DLC · prénom · JJ/MM », prénom tel que NEXUS l'affiche (employees.nom, jamais l'identifiant de connexion),
-- date au fuseau de la station (sites.timezone, Martinique à défaut). Ne répond que pour la station de l'appelant (la création, en security invoker, l'appelle).
create or replace function dates_courtes_nom_genere(p_site text, p_auteur uuid, p_instant timestamptz) returns text
language sql stable security definer set search_path = public, pg_temp as $$
  select 'Contrôle DLC · '
      || coalesce(nullif(left(btrim((select e.nom from employees e where e.id = p_auteur and e.site_id = p_site and p_site = current_employee_site_id())), 30), ''), 'équipe')
      || ' · '
      || to_char(p_instant at time zone coalesce(nullif((select s.timezone from sites s where s.site_id = p_site), ''), 'America/Martinique'), 'DD/MM')
$$;

-- 3. Création (reste security invoker, sécurité par ligne inchangée) : nom vide ou absent, le serveur le construit. Un nom fourni (ancienne page) reste accepté, nettoyé, 100 caractères au plus.
create or replace function dates_courtes_creer_tournee(p_nom text, p_cle_idempotence text) returns jsonb
language plpgsql volatile security invoker set search_path = public, pg_temp as $$
declare v_site text; v_id uuid; v_nom text := nullif(btrim(regexp_replace(coalesce(p_nom, ''), '\s+', ' ', 'g')), ''); v_cle text; v_le timestamptz; v_etat text; v_nom_ex text;
begin
  if auth.uid() is null then raise exception 'non_authentifie : connexion requise' using errcode = 'P0001'; end if;
  if not (dates_courtes_operer() or dates_courtes_caissier_autorise()) then
    raise exception 'droit_refuse : ce profil ne peut pas créer de tournée de dates courtes' using errcode = 'P0001';
  end if;
  if p_cle_idempotence is null or length(btrim(p_cle_idempotence)) not between 1 and 100 then
    raise exception 'cle_idempotence_requise : clé d''idempotence de 1 à 100 caractères' using errcode = 'P0001';
  end if;
  if v_nom is not null and char_length(v_nom) > 100 then
    raise exception 'valeur_invalide : nom de 100 caractères au plus' using errcode = 'P0001';
  end if;
  v_site := current_employee_site_id(); v_cle := btrim(p_cle_idempotence);
  perform pg_advisory_xact_lock(hashtextextended(v_site || '|tournee|' || v_cle, 0));
  select t.id, t.nom, t.saisi_le into v_id, v_nom_ex, v_le from dates_courtes_tournees t where t.site = v_site and t.cle_idempotence = v_cle;
  if found then
    return jsonb_build_object('statut', 'deja_enregistre', 'tournee_id', v_id,
      'nom', coalesce(v_nom_ex, dates_courtes_nom_genere(v_site, auth.uid(), v_le)),
      'commencee_a', to_char(v_le at time zone coalesce(nullif((select s.timezone from sites s where s.site_id = v_site), ''), 'America/Martinique'), 'FMHH24" h "MI'));
  end if;
  v_le := now();
  if v_nom is null then v_nom := dates_courtes_nom_genere(v_site, auth.uid(), v_le); end if;
  begin
    insert into dates_courtes_tournees (site, nom, cle_idempotence, saisi_le) values (v_site, v_nom, v_cle, v_le) returning id into v_id;
  exception when unique_violation then
    raise exception 'cle_deja_utilisee : cette clé d''idempotence appartient à une autre tournée' using errcode = 'P0001';
  end;
  v_etat := to_char(v_le at time zone coalesce(nullif((select s.timezone from sites s where s.site_id = v_site), ''), 'America/Martinique'), 'FMHH24" h "MI');
  return jsonb_build_object('statut', 'cree', 'tournee_id', v_id, 'nom', v_nom, 'commencee_a', v_etat);
end $$;

-- 4. Renommage : seul le libellé change. Auteur de la tournée ou gestion de la même station, jamais sur une tournée certifiée.
create or replace function dates_courtes_renommer_tournee(p_tournee uuid, p_nom text, p_cle_idempotence text) returns jsonb
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare v_site text; v_nom text; v_cle text; t dates_courtes_tournees%rowtype; v_ancien text; v_deja dates_courtes_renommages_tournee%rowtype;
begin
  if auth.uid() is null then raise exception 'non_authentifie : connexion requise' using errcode = 'P0001'; end if;
  select e.site_id into v_site from employees e where e.id = auth.uid() and e.actif;
  if v_site is null then raise exception 'compte_inactif : compte inactif ou sans station' using errcode = 'P0001'; end if;
  if p_cle_idempotence is null or length(btrim(p_cle_idempotence)) not between 1 and 100 then
    raise exception 'cle_idempotence_requise : clé d''idempotence de 1 à 100 caractères obligatoire' using errcode = 'P0001';
  end if;
  v_cle := btrim(p_cle_idempotence);
  v_nom := btrim(regexp_replace(regexp_replace(coalesce(p_nom, ''), '[[:cntrl:]]', ' ', 'g'), '\s+', ' ', 'g'));
  if char_length(v_nom) not between 1 and 60 then
    raise exception 'valeur_invalide : le nom doit faire de 1 à 60 caractères' using errcode = 'P0001';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_site || '|renommage|' || v_cle, 0));
  select * into v_deja from dates_courtes_renommages_tournee r where r.site = v_site and r.cle_idempotence = v_cle;
  if found then
    if v_deja.tournee_id <> p_tournee then raise exception 'cle_deja_utilisee : cette clé est déjà utilisée par une autre opération' using errcode = 'P0001'; end if;
    return jsonb_build_object('statut', 'deja_enregistre', 'tournee_id', p_tournee, 'nom', v_deja.nouveau_nom);
  end if;
  select * into t from dates_courtes_tournees x where x.id = p_tournee and x.site = v_site for update;
  if not found then raise exception 'tournee_introuvable : tournée introuvable dans cette station' using errcode = 'P0001'; end if;
  if not (dates_courtes_gestion() or (t.saisi_par = auth.uid() and (dates_courtes_operer() or dates_courtes_caissier_autorise()))) then
    raise exception 'droit_refuse : seul l''auteur de la tournée ou la gestion peut la renommer' using errcode = 'P0001';
  end if;
  if t.etat = 'CERTIFIEE' then
    raise exception 'tournee_certifiee : une tournée certifiée ne peut plus être renommée' using errcode = 'P0001';
  end if;
  v_ancien := coalesce(t.nom, dates_courtes_nom_genere(t.site, t.saisi_par, t.saisi_le));
  if v_ancien = v_nom then
    return jsonb_build_object('statut', 'inchange', 'tournee_id', p_tournee, 'nom', v_nom);
  end if;
  insert into dates_courtes_renommages_tournee (site, tournee_id, ancien_nom, nouveau_nom, renomme_par, cle_idempotence)
    values (v_site, p_tournee, v_ancien, v_nom, auth.uid(), v_cle);
  update dates_courtes_tournees set nom = v_nom where id = p_tournee and site = v_site;
  return jsonb_build_object('statut', 'renomme', 'tournee_id', p_tournee, 'nom', v_nom);
end $$;

-- 5. Lecture : nom affiché (nom stocké, ou nom de repli calculé à la lecture pour les anciennes tournées sans nom), heure de début au fuseau de la station.
-- Même périmètre que la sécurité par ligne : le réalisateur lit les siennes, la gestion lit toute la station.
create or replace function dates_courtes_lire_tournees(p_tournee uuid default null, p_etats text[] default null)
returns table (id uuid, nom text, nom_personnalise boolean, etat text, saisi_le timestamptz, commencee_a text, saisi_par uuid)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_site text; v_gestion boolean; v_tz text;
begin
  if auth.uid() is null then raise exception 'non_authentifie : connexion requise' using errcode = 'P0001'; end if;
  select e.site_id into v_site from employees e where e.id = auth.uid() and e.actif;
  if v_site is null then raise exception 'compte_inactif : compte inactif ou sans station' using errcode = 'P0001'; end if;
  if not (dates_courtes_gestion() or dates_courtes_operer() or dates_courtes_caissier_autorise()) then
    raise exception 'droit_refuse : cette action est réservée au personnel autorisé de la station' using errcode = 'P0001';
  end if;
  v_gestion := dates_courtes_gestion();
  v_tz := coalesce(nullif((select s.timezone from sites s where s.site_id = v_site), ''), 'America/Martinique');
  return query
    select t.id, coalesce(t.nom, dates_courtes_nom_genere(t.site, t.saisi_par, t.saisi_le)), t.nom is not null, t.etat, t.saisi_le,
           to_char(t.saisi_le at time zone v_tz, 'FMHH24" h "MI'), t.saisi_par
    from dates_courtes_tournees t
    where t.site = v_site
      and (p_tournee is null or t.id = p_tournee)
      and (p_etats is null or t.etat = any (p_etats))
      and (t.saisi_par = auth.uid() or (v_gestion and p_tournee is not null))
    order by t.saisi_le desc;
end $$;

-- 6. Droits : aucune exécution pour anon ou public.
revoke all on function dates_courtes_nom_genere(text, uuid, timestamptz) from public, anon, authenticated, service_role;
revoke all on function dates_courtes_renommage_immuable() from public, anon, authenticated, service_role;
revoke all on function dates_courtes_creer_tournee(text, text) from public, anon, authenticated, service_role;
revoke all on function dates_courtes_renommer_tournee(uuid, text, text) from public, anon, authenticated, service_role;
revoke all on function dates_courtes_lire_tournees(uuid, text[]) from public, anon, authenticated, service_role;
grant execute on function dates_courtes_nom_genere(text, uuid, timestamptz) to authenticated;
grant execute on function dates_courtes_creer_tournee(text, text) to authenticated;
grant execute on function dates_courtes_renommer_tournee(uuid, text, text) to authenticated;
grant execute on function dates_courtes_lire_tournees(uuid, text[]) to authenticated;

comment on table dates_courtes_renommages_tournee is 'Dates courtes lot 2.1 : trace des renommages de tournée (ancien nom, nouveau nom, auteur du geste, heure). Ajout seul, jamais modifiée.';
comment on function dates_courtes_nom_genere(text, uuid, timestamptz) is 'Dates courtes lot 2.1 : « Contrôle DLC · prénom · JJ/MM » au fuseau de la station. Limitée à la station de l''appelant.';
comment on function dates_courtes_renommer_tournee(uuid, text, text) is 'Dates courtes lot 2.1 : change le libellé seul d''une tournée non certifiée (auteur ou gestion de la station), trace écrite, idempotent.';
comment on function dates_courtes_lire_tournees(uuid, text[]) is 'Dates courtes lot 2.1 : tournées lisibles avec nom affiché (repli calculé pour les anciennes tournées sans nom) et heure de début locale.';
