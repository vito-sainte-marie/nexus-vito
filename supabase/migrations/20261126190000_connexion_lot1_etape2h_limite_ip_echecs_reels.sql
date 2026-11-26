-- Connexion lot 1, étape 2h : la limite par IP ne compte que les échecs réels (arbitrage Guardian, 7150200238).
-- Avant : chaque appel inscrivait une ligne, refus compris. Une IP qui réessayait prolongeait son propre blocage,
-- et une station de plusieurs employés se bloquait avec des connexions réussies.
-- Après : essais_ip.type vaut echec | succes | refus_ip | refus_verrou. Seuls les 'echec' entrent dans les fenêtres de 10 min et 1 h.
-- Limite connue : des essais simultanés passent tous avant_essai avant que le premier échec soit inscrit.
-- Test uniquement. Les lignes antérieures (type nul) ne comptent pas.

alter table nexus_connexion.essais_ip add column if not exists type text;
create index if not exists essais_ip_type_idx on nexus_connexion.essais_ip (ip_fp, type, at desc);

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

  -- La fenêtre ne compte que les échecs réels (code faux sur un compte existant, prénom inconnu ou ambigu). Ni succès ni refus.
  select count(*), count(distinct alias) into n10, comptes10
  from nexus_connexion.essais_ip where ip_fp = p_ip_fp and type = 'echec' and at > now() - interval '10 minutes';
  select count(*) into n60 from nexus_connexion.essais_ip where ip_fp = p_ip_fp and type = 'echec' and at > now() - interval '1 hour';
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

  -- Lecture : refus_ip et refus_verrou sont tracés mais ne comptent pas. Un prénom inconnu ou ambigu est un échec certain (dec = ok).
  -- Un code faux sur un compte existant est inscrit par apres_echec, un succès par apres_succes.
  if dec = 'ip_limite' then
    insert into nexus_connexion.essais_ip (ip_fp, alias, decision, type) values (p_ip_fp, r.alias, dec, 'refus_ip');
  elsif dec <> 'ok' then
    insert into nexus_connexion.essais_ip (ip_fp, alias, decision, type) values (p_ip_fp, r.alias, dec, 'refus_verrou');
  elsif r.user_id is null then
    insert into nexus_connexion.essais_ip (ip_fp, alias, decision, type) values (p_ip_fp, r.alias, dec, 'echec');
  end if;
  if dec <> 'ok' then
    insert into nexus_connexion.journal (user_id, evenement, ip_fp, detail)
    values (r.user_id, 'refus_' || dec, p_ip_fp, jsonb_build_object('attente_s', att));
  end if;

  return jsonb_build_object(
    'decision', dec, 'alias', r.alias, 'user_id', r.user_id, 'attente_s', att,
    'etat', c.etat, 'version', c.version,
    'code_hash', case when dec = 'ok' then c.code_hash end);
end $$;

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
  insert into nexus_connexion.essais_ip (ip_fp, alias, decision, type)
  values (p_ip_fp, nexus_connexion.alias_de('u:' || p_user_id::text), 'ok', 'echec');
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

create or replace function nexus_connexion.apres_succes(p_user_id uuid, p_ip_fp text) returns jsonb
language plpgsql volatile security definer set search_path = nexus_connexion, public, extensions, pg_temp as
$$
declare c nexus_connexion.compte%rowtype;
begin
  update nexus_connexion.compte set echecs = 0, dernier_echec = null, prochain_essai = null, maj = now()
  where user_id = p_user_id returning * into c;
  insert into nexus_connexion.journal (user_id, evenement, ip_fp) values (p_user_id, 'succes', p_ip_fp);
  insert into nexus_connexion.essais_ip (ip_fp, alias, decision, type)
  values (p_ip_fp, nexus_connexion.alias_de('u:' || p_user_id::text), 'ok', 'succes');
  return jsonb_build_object('etat', c.etat, 'version', c.version, 'echeance', c.echeance);
end $$;
