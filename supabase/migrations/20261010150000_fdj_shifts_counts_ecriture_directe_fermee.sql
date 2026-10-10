-- FDJ : un quart et ses comptages ne s'écrivent plus que par des commandes.
--
-- Défaut (même nature que 20261008125000 pour fdj_cash_controls) : anon et
-- authenticated détenaient INSERT, UPDATE, DELETE et TRUNCATE sur fdj_shifts
-- et fdj_shift_counts. Les politiques ne filtrent que le site : un employé
-- pouvait, par un simple appel REST, passer son quart à `valide`, effacer
-- `a_revoir`, réécrire `version` ou `needs_replay`, ou réécrire les comptages
-- du quart d'un collègue — et même ceux d'un quart déjà validé.
-- fdj_incrementer_appro_shift_count était SECURITY INVOKER et exécutable par
-- anon : elle tombait sous les mêmes politiques.
--
-- Partage arbitré par Frédéric le 10/10 (« partage validé ») :
--   * employé, sur SON quart et tant qu'il n'est pas validé : saisir ses
--     comptages, valider son ouverture, poser previous_shift_id, incrémenter
--     l'appro ;
--   * manager seulement : créer un quart, changer son statut, poser a_revoir,
--     version, needs_replay, releve_cloture_statut, corriger des comptages.
--
-- Correctif : douze commandes SECURITY DEFINER (search_path vide, gardes
-- fdj_quart_de_l_employe / fdj_quart_du_manager : site et rôle lus en base),
-- portage des deux écrans, puis retrait de l'écriture directe. Les écrivains
-- serveur déjà en place (fdj_ouvrir_quart, fdj_ecrire_saisies_caisse,
-- fdj_confirmer_caisse, …) sont SECURITY DEFINER, propriété de postgres : ils
-- ne dépendent pas de ces droits. La lecture reste ouverte à authenticated
-- sous RLS ; anon perd aussi la lecture, dont il n'a pas l'usage.
--
-- Hors lot : fdj_audit_log (lot suivant), fdj_games / fdj_locations /
-- fdj_site_settings (plus tard), fdj_alertes (reste ouverte).
--
-- Épreuve : outils/epreuve-fdj-shifts-ecriture-directe-20261010/executer.sh
-- Retour arrière : grant insert, update, delete, truncate, references, trigger
--   on public.fdj_shifts, public.fdj_shift_counts to anon, authenticated;
--   grant select on … to anon; puis rétablir 20260818135117 pour
--   fdj_incrementer_appro_shift_count (security invoker, execute à public).
--   Les nouvelles commandes peuvent rester : elles n'ouvrent rien.

-- ----------------------------------------------------------------------------
-- 0. Aides internes (non exposées)
-- ----------------------------------------------------------------------------

-- Quart de l'employé, encore ouvert. Un quart validé est clos : l'employé n'y
-- écrit plus, seul le manager le corrige.
create or replace function public.fdj_quart_ouvert_de_l_employe(p_shift_id uuid)
returns public.fdj_shifts
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_shift public.fdj_shifts;
begin
  v_shift := public.fdj_quart_de_l_employe(p_shift_id);
  if v_shift.statut = 'valide' then
    raise exception 'Ce quart FDJ est validé : seul un manager peut encore le corriger.'
      using errcode = 'insufficient_privilege';
  end if;
  return v_shift;
end;
$$;

-- Manager actif de l'utilisateur authentifié, sans quart (création).
-- Renvoie son site ; lève une exception sinon.
create or replace function public.fdj_site_du_manager()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid  uuid;
  v_role text;
  v_site text;
begin
  v_uid := (select auth.uid());
  if v_uid is null then
    raise exception 'Aucune session authentifiée : opération refusée.'
      using errcode = 'insufficient_privilege';
  end if;

  select e.role, e.site_id into v_role, v_site
    from public.employees e
   where e.id = v_uid and e.actif is not false;

  if v_role is null then
    raise exception 'Utilisateur inconnu ou inactif : opération refusée.'
      using errcode = 'insufficient_privilege';
  end if;
  if v_role not in ('manager', 'gerant') then
    raise exception 'Seul un manager habilité peut effectuer cette opération.'
      using errcode = 'insufficient_privilege';
  end if;
  if v_site is null then
    raise exception 'Utilisateur sans rattachement de site : opération refusée.'
      using errcode = 'insufficient_privilege';
  end if;
  return v_site;
end;
$$;

-- Un jeu n'est comptable que sur son site. Lève une exception sinon.
create or replace function public.fdj_exiger_jeu_du_site(p_game_id uuid, p_site text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_game_id is null then
    raise exception 'Identifiant de jeu FDJ manquant.'
      using errcode = 'invalid_parameter_value';
  end if;
  if not exists (select 1 from public.fdj_games g where g.id = p_game_id and g.site = p_site) then
    raise exception 'Ce jeu FDJ n''appartient pas au site du quart.'
      using errcode = 'insufficient_privilege';
  end if;
end;
$$;

revoke all on function public.fdj_quart_ouvert_de_l_employe(uuid) from public, anon, authenticated;
revoke all on function public.fdj_site_du_manager() from public, anon, authenticated;
revoke all on function public.fdj_exiger_jeu_du_site(uuid, text) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 1. Commandes employé
-- ----------------------------------------------------------------------------

-- Incrément atomique de l'appro (activation de carnet). Même signature et
-- même corps que 20260818135117 ; ce qui change : SECURITY DEFINER, garde
-- employé, quart ouvert, site exigé égal à celui du quart.
create or replace function public.fdj_incrementer_appro_shift_count(
  p_site text,
  p_shift_id uuid,
  p_game_id uuid,
  p_delta numeric
) returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shift public.fdj_shifts;
  v_nouvel_appro numeric;
begin
  v_shift := public.fdj_quart_ouvert_de_l_employe(p_shift_id);
  if p_site is distinct from v_shift.site then
    raise exception 'Site incohérent avec le quart FDJ.'
      using errcode = 'insufficient_privilege';
  end if;
  perform public.fdj_exiger_jeu_du_site(p_game_id, v_shift.site);
  if p_delta is null then
    raise exception 'Quantité d''appro manquante.'
      using errcode = 'invalid_parameter_value';
  end if;

  insert into public.fdj_shift_counts (site, shift_id, game_id, appro, updated_at)
  values (v_shift.site, p_shift_id, p_game_id, p_delta, now())
  on conflict (shift_id, game_id) do update
    set appro = coalesce(public.fdj_shift_counts.appro, 0) + excluded.appro,
        updated_at = now()
  returning appro into v_nouvel_appro;
  return v_nouvel_appro;
end;
$$;

comment on function public.fdj_incrementer_appro_shift_count(text, uuid, uuid, numeric) is
  'Incrément atomique de fdj_shift_counts.appro (activation de carnet). '
  'SECURITY DEFINER depuis 20261010150000 : réservé au titulaire du quart, '
  'tant que le quart n''est pas validé.';

-- Lien explicite vers le quart précédent. N'écrit qu'une fois : un lien déjà
-- posé n'est jamais écrasé (renvoie alors false).
create or replace function public.fdj_lier_quart_precedent(
  p_shift_id uuid,
  p_previous_shift_id uuid
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shift public.fdj_shifts;
  v_prec  public.fdj_shifts;
begin
  v_shift := public.fdj_quart_ouvert_de_l_employe(p_shift_id);
  if p_previous_shift_id is null or p_previous_shift_id = p_shift_id then
    raise exception 'Quart précédent invalide.'
      using errcode = 'invalid_parameter_value';
  end if;

  select * into v_prec from public.fdj_shifts s where s.id = p_previous_shift_id;
  if not found or v_prec.site is distinct from v_shift.site then
    raise exception 'Le quart précédent n''appartient pas au site du quart.'
      using errcode = 'insufficient_privilege';
  end if;
  if v_prec.statut <> 'valide'
     or (v_prec.date, v_prec.quart) >= (v_shift.date, v_shift.quart) then
    raise exception 'Le quart précédent doit être un quart validé antérieur.'
      using errcode = 'invalid_parameter_value';
  end if;

  update public.fdj_shifts
     set previous_shift_id = p_previous_shift_id
   where id = p_shift_id and previous_shift_id is null;
  return found;
end;
$$;

-- Validation du stock de départ : enregistre les comptages d'ouverture puis
-- pose ouverture_validee, dans la même transaction. p_comptages :
-- [ { game_id, stock_initial, appro, stock_final, stock_initial_auto }, … ]
-- (tableau vide accepté : l'ouverture est validée sans comptage).
create or replace function public.fdj_valider_ouverture_quart(
  p_shift_id uuid,
  p_comptages jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shift public.fdj_shifts;
  v_ligne jsonb;
  v_game  uuid;
  v_n     int := 0;
begin
  v_shift := public.fdj_quart_ouvert_de_l_employe(p_shift_id);
  if p_comptages is not null and jsonb_typeof(p_comptages) <> 'array' then
    raise exception 'Comptages attendus sous forme de tableau.'
      using errcode = 'invalid_parameter_value';
  end if;

  for v_ligne in select * from jsonb_array_elements(coalesce(p_comptages, '[]'::jsonb)) loop
    v_game := nullif(v_ligne->>'game_id', '')::uuid;
    perform public.fdj_exiger_jeu_du_site(v_game, v_shift.site);
    insert into public.fdj_shift_counts as c (
      site, shift_id, game_id, stock_initial, appro, stock_final,
      stock_initial_auto, updated_at
    ) values (
      v_shift.site, p_shift_id, v_game,
      nullif(v_ligne->>'stock_initial', '')::numeric,
      coalesce(nullif(v_ligne->>'appro', '')::numeric, 0),
      nullif(v_ligne->>'stock_final', '')::numeric,
      coalesce((v_ligne->>'stock_initial_auto')::boolean, false),
      now()
    )
    on conflict (shift_id, game_id) do update
      set stock_initial      = excluded.stock_initial,
          appro              = excluded.appro,
          stock_final        = excluded.stock_final,
          stock_initial_auto = excluded.stock_initial_auto,
          updated_at         = excluded.updated_at;
    v_n := v_n + 1;
  end loop;

  update public.fdj_shifts
     set ouverture_validee = true, ouverture_validee_le = now()
   where id = p_shift_id;

  return jsonb_build_object('shift_id', p_shift_id, 'comptages', v_n);
end;
$$;

-- ----------------------------------------------------------------------------
-- 2. Commandes manager
-- ----------------------------------------------------------------------------

-- Création d'un quart par un manager. Le site est celui du manager, jamais
-- reçu du client. Le 23505 (site, date, quart) remonte tel quel à l'écran.
create or replace function public.fdj_manager_creer_quart(
  p_date date,
  p_quart text,
  p_employee_id uuid,
  p_statut text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_site  text;
  v_shift public.fdj_shifts;
begin
  v_site := public.fdj_site_du_manager();
  if p_date is null or p_quart is null or p_statut is null then
    raise exception 'Date, quart et statut sont requis.'
      using errcode = 'invalid_parameter_value';
  end if;
  if p_employee_id is not null and not exists (
    select 1 from public.employees e where e.id = p_employee_id and e.site_id = v_site
  ) then
    raise exception 'Le titulaire désigné n''appartient pas à ce site.'
      using errcode = 'insufficient_privilege';
  end if;

  insert into public.fdj_shifts (
    site, date, quart, employee_id, statut, ouvert_le, valide_le,
    created_by, ouverture_source
  ) values (
    v_site, p_date, p_quart, p_employee_id, p_statut, now(),
    case when p_statut = 'valide' then now() end,
    (select auth.uid()), 'creation_manager'
  )
  returning * into v_shift;
  return to_jsonb(v_shift);
end;
$$;

-- Modification d'un quart existant : date, quart, statut (et valide_le qui
-- suit le statut). Le titulaire n'en fait pas partie : il se transfère par
-- fdj_transferer_responsabilite_quart. Le 23505 remonte tel quel.
create or replace function public.fdj_manager_modifier_quart(
  p_shift_id uuid,
  p_date date,
  p_quart text,
  p_statut text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shift public.fdj_shifts;
begin
  perform public.fdj_quart_du_manager(p_shift_id);
  if p_date is null or p_quart is null or p_statut is null then
    raise exception 'Date, quart et statut sont requis.'
      using errcode = 'invalid_parameter_value';
  end if;

  update public.fdj_shifts
     set date = p_date, quart = p_quart, statut = p_statut,
         valide_le = case when p_statut = 'valide' then now() end
   where id = p_shift_id
  returning * into v_shift;
  return to_jsonb(v_shift);
end;
$$;

-- Changement du seul statut (quart retrouvé par site, date et quart).
-- valide_le n'est pas touché, comme avant le portage.
create or replace function public.fdj_manager_changer_statut_quart(
  p_shift_id uuid,
  p_statut text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shift public.fdj_shifts;
begin
  perform public.fdj_quart_du_manager(p_shift_id);
  update public.fdj_shifts set statut = p_statut
   where id = p_shift_id
  returning * into v_shift;
  return to_jsonb(v_shift);
end;
$$;

-- Comptages saisis par le manager (édition d'un quart, même validé).
-- p_comptages : [ { game_id, stock_initial, appro, stock_final, ventes_qte,
--                   ventes_valeur, stock_initial_auto }, … ]
create or replace function public.fdj_manager_enregistrer_comptages(
  p_shift_id uuid,
  p_comptages jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shift public.fdj_shifts;
  v_ligne jsonb;
  v_game  uuid;
  v_n     int := 0;
begin
  v_shift := public.fdj_quart_du_manager(p_shift_id);
  if p_comptages is null or jsonb_typeof(p_comptages) <> 'array' then
    raise exception 'Comptages attendus sous forme de tableau.'
      using errcode = 'invalid_parameter_value';
  end if;

  for v_ligne in select * from jsonb_array_elements(p_comptages) loop
    v_game := nullif(v_ligne->>'game_id', '')::uuid;
    perform public.fdj_exiger_jeu_du_site(v_game, v_shift.site);
    insert into public.fdj_shift_counts as c (
      site, shift_id, game_id, stock_initial, appro, stock_final,
      ventes_qte, ventes_valeur, stock_initial_auto, updated_at
    ) values (
      v_shift.site, p_shift_id, v_game,
      nullif(v_ligne->>'stock_initial', '')::numeric,
      coalesce(nullif(v_ligne->>'appro', '')::numeric, 0),
      nullif(v_ligne->>'stock_final', '')::numeric,
      nullif(v_ligne->>'ventes_qte', '')::numeric,
      nullif(v_ligne->>'ventes_valeur', '')::numeric,
      coalesce((v_ligne->>'stock_initial_auto')::boolean, false),
      now()
    )
    on conflict (shift_id, game_id) do update
      set stock_initial      = excluded.stock_initial,
          appro              = excluded.appro,
          stock_final        = excluded.stock_final,
          ventes_qte         = excluded.ventes_qte,
          ventes_valeur      = excluded.ventes_valeur,
          stock_initial_auto = excluded.stock_initial_auto,
          updated_at         = excluded.updated_at;
    v_n := v_n + 1;
  end loop;

  return jsonb_build_object('shift_id', p_shift_id, 'comptages', v_n);
end;
$$;

-- Corrections ponctuelles de lignes existantes (rétablissement de chaîne) :
-- seules les clés présentes sont réécrites, parmi stock_initial, ventes_qte
-- et ventes_valeur. Aucune ligne n'est créée.
-- p_corrections : [ { game_id, stock_initial? , ventes_qte?, ventes_valeur? }, … ]
create or replace function public.fdj_manager_corriger_comptages(
  p_shift_id uuid,
  p_corrections jsonb
) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ligne jsonb;
  v_n     int := 0;
  v_k     int;
begin
  perform public.fdj_quart_du_manager(p_shift_id);
  if p_corrections is null or jsonb_typeof(p_corrections) <> 'array' then
    raise exception 'Corrections attendues sous forme de tableau.'
      using errcode = 'invalid_parameter_value';
  end if;

  for v_ligne in select * from jsonb_array_elements(p_corrections) loop
    update public.fdj_shift_counts c
       set stock_initial = case when v_ligne ? 'stock_initial'
                                then nullif(v_ligne->>'stock_initial', '')::numeric
                                else c.stock_initial end,
           ventes_qte    = case when v_ligne ? 'ventes_qte'
                                then nullif(v_ligne->>'ventes_qte', '')::numeric
                                else c.ventes_qte end,
           ventes_valeur = case when v_ligne ? 'ventes_valeur'
                                then nullif(v_ligne->>'ventes_valeur', '')::numeric
                                else c.ventes_valeur end,
           updated_at    = now()
     where c.shift_id = p_shift_id
       and c.game_id = nullif(v_ligne->>'game_id', '')::uuid;
    get diagnostics v_k = row_count;
    v_n := v_n + v_k;
  end loop;
  return v_n;
end;
$$;

create or replace function public.fdj_manager_marquer_releve_cloture(
  p_shift_id uuid,
  p_statut text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.fdj_quart_du_manager(p_shift_id);
  update public.fdj_shifts set releve_cloture_statut = p_statut where id = p_shift_id;
end;
$$;

-- Issue d'un rejeu : succès = needs_replay effacé et horodaté ; échec =
-- needs_replay posé.
create or replace function public.fdj_manager_marquer_replay(
  p_shift_id uuid,
  p_succes boolean
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.fdj_quart_du_manager(p_shift_id);
  if p_succes then
    update public.fdj_shifts
       set needs_replay = false, last_replayed_at = now()
     where id = p_shift_id;
  else
    update public.fdj_shifts set needs_replay = true where id = p_shift_id;
  end if;
end;
$$;

-- Incrément atomique côté serveur (le client lisait puis réécrivait).
create or replace function public.fdj_manager_incrementer_version(p_shift_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version int;
begin
  perform public.fdj_quart_du_manager(p_shift_id);
  update public.fdj_shifts set version = coalesce(version, 0) + 1
   where id = p_shift_id
  returning version into v_version;
  return v_version;
end;
$$;

create or replace function public.fdj_manager_marquer_a_revoir(
  p_shift_id uuid,
  p_motif text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.fdj_quart_du_manager(p_shift_id);
  if p_motif is null or btrim(p_motif) = '' then
    raise exception 'Motif de mise à revoir manquant.'
      using errcode = 'invalid_parameter_value';
  end if;
  update public.fdj_shifts
     set a_revoir = true, a_revoir_motif = p_motif, a_revoir_depuis_le = now()
   where id = p_shift_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- 3. Droits d'exécution
-- ----------------------------------------------------------------------------

do $$
declare
  v_sig text;
begin
  foreach v_sig in array array[
    'public.fdj_incrementer_appro_shift_count(text, uuid, uuid, numeric)',
    'public.fdj_lier_quart_precedent(uuid, uuid)',
    'public.fdj_valider_ouverture_quart(uuid, jsonb)',
    'public.fdj_manager_creer_quart(date, text, uuid, text)',
    'public.fdj_manager_modifier_quart(uuid, date, text, text)',
    'public.fdj_manager_changer_statut_quart(uuid, text)',
    'public.fdj_manager_enregistrer_comptages(uuid, jsonb)',
    'public.fdj_manager_corriger_comptages(uuid, jsonb)',
    'public.fdj_manager_marquer_releve_cloture(uuid, text)',
    'public.fdj_manager_marquer_replay(uuid, boolean)',
    'public.fdj_manager_incrementer_version(uuid)',
    'public.fdj_manager_marquer_a_revoir(uuid, text)'
  ] loop
    execute 'revoke all on function ' || v_sig || ' from public';
    execute 'revoke all on function ' || v_sig || ' from anon';
    execute 'grant execute on function ' || v_sig || ' to authenticated';
    execute 'grant execute on function ' || v_sig || ' to service_role';
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 4. Retrait de l'écriture directe
-- ----------------------------------------------------------------------------

revoke insert, update, delete, truncate, references, trigger
  on public.fdj_shifts from public, anon, authenticated;
revoke select on public.fdj_shifts from public, anon;

revoke insert, update, delete, truncate, references, trigger
  on public.fdj_shift_counts from public, anon, authenticated;
revoke select on public.fdj_shift_counts from public, anon;
