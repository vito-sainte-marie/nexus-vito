-- =====================================================================
-- Changement de quart : l'employé clôture son quart ouvert ET prend son
-- poste suivant en UNE opération atomique (16/10/2026, option A validée).
--
-- CE QUI EXISTAIT. Le déclencheur P-1 (`nexus_shifts_avant_insertion`)
-- ferme déjà le quart ouvert dans la transaction de la prise de poste
-- suivante, sans jamais inventer d'heure de fin. Mais il le fait en
-- silence : l'employé n'est pas prévenu que la clôture est définitive, ne
-- peut pas dire pourquoi, et le journal écrit « prise_de_poste_suivante »,
-- c'est-à-dire un mécanisme, jamais un auteur ni un motif.
--
-- CE QUE CETTE MIGRATION AJOUTE.
--  1. `nexus_changer_de_quart(role, quart, motif, cloture_confirmee)` —
--     fonction SECURITY INVOKER (donc soumise à la RLS de l'employé, comme
--     l'INSERT direct de l'écran) qui :
--       • sans quart ouvert : prend le poste, comme avant ;
--       • avec un quart ouvert et SANS confirmation : n'écrit RIEN et rend
--         `confirmation_requise` (le serveur, pas l'écran, tient la règle
--         « aucune clôture sans confirmation volontaire ») ;
--       • avec un quart ouvert et confirmation : transmet le motif au
--         déclencheur par une variable de TRANSACTION, puis insère le
--         nouveau quart. Tout échec annule tout : l'ancien quart reste
--         ouvert.
--  2. Le déclencheur lit cette variable. Présente ET égale à l'employé qui
--     s'insère, la clôture est journalisée à trois dimensions distinctes :
--         auteur     → cloture_par    = l'employé
--         mécanisme  → cloture_source = 'employe'
--         motif      → cloture_motif  = le motif DÉCLARÉ (NULL si aucun),
--                      jamais mélangé à un texte système
--     Absente, le déclencheur se comporte à l'identique de P-1 : les
--     anciens écrans et tout INSERT direct gardent exactement leur effet.
--
-- CE QUE CETTE MIGRATION NE FAIT PAS. Elle n'écrit aucune ligne, ne crée
-- aucune durée travaillée ni heure supplémentaire : `heure_fin` reste NULL
-- pour tout quart clos sans départ pointé, et un départ pointé reste lu
-- tel quel. Elle ne touche ni la sélection des fonctions (lot A, côté
-- écran) ni l'ouverture FDJ, ni les missions (rattachées à l'employé et à
-- la date, pas au quart).
--
-- POURQUOI UNE VARIABLE DE TRANSACTION. Le motif doit atteindre le
-- déclencheur sans ajouter de colonne à `shifts` (les insertions
-- existantes, qui n'envoient pas de motif, ne doivent pas changer) et sans
-- permettre à un client de s'attribuer une clôture « employé » : seule une
-- fonction de la base pose la variable (set_config local), le déclencheur
-- la compare à NEW.employee_id puis la remet à zéro.
-- =====================================================================

begin;

create or replace function public.nexus_shifts_avant_insertion()
returns trigger
language plpgsql
as $$
declare
  v_reference  text;
  v_ancien     record;
  v_lignes     int;
  v_depart     record;
  v_timezone   text;
  v_fin        timestamptz;
  v_motif      text;
  v_declare    boolean;
  v_source     text;
  v_par        uuid;
begin
  v_reference := public.nexus_site_de_reference(NEW.site, NEW.site_id);
  NEW.site    := v_reference;
  NEW.site_id := v_reference;

  if NEW.statut is distinct from 'en_cours' then
    return NEW;  -- une insertion d'historique ne clôture rien
  end if;

  select sh.id, sh.heure_debut into v_ancien
    from public.shifts sh
   where sh.employee_id = NEW.employee_id
     and sh.site_id     = NEW.site_id
     and sh.statut      = 'en_cours'
     and sh.id         <> NEW.id
   order by sh.heure_debut desc
   limit 1
   for update;

  if v_ancien.id is null then
    return NEW;  -- première prise de poste : rien à clôturer, rien à signaler
  end if;

  if NEW.heure_debut <= v_ancien.heure_debut then
    raise exception
      'Prise de poste refusée : le service % est actif depuis %, postérieur ou égal à la nouvelle prise (%). Une insertion antérieure à un service actif n''est pas une prise de poste suivante.',
      v_ancien.id, v_ancien.heure_debut, NEW.heure_debut
      using errcode = '22007';
  end if;

  -- Changement de quart voulu par l'employé : la variable est posée par
  -- nexus_changer_de_quart(), jamais par un client. On la compare à
  -- l'employé qui s'insère et on la remet à zéro aussitôt, pour qu'une
  -- seconde insertion de la même transaction ne puisse pas la réutiliser.
  v_declare := coalesce(current_setting('nexus.changement_quart_employe', true), '')
               = NEW.employee_id::text;
  if v_declare then
    v_source := 'employe';
    v_par    := NEW.employee_id;
    v_motif  := nullif(btrim(coalesce(current_setting('nexus.changement_quart_motif', true), '')), '');
    perform set_config('nexus.changement_quart_employe', '', true);
    perform set_config('nexus.changement_quart_motif', '', true);
  else
    v_source := 'prise_de_poste_suivante';
    v_par    := null;
  end if;

  select p.date, p.heure into v_depart
    from public.pointages p
   where p.service_id = v_ancien.id
     and p.type       = 'depart'
   order by p.date desc, p.heure desc
   limit 1;

  if v_depart.date is null then
    if not v_declare then
      v_motif := 'Fin non enregistrée — service clos par la prise de poste suivante (phase pilote)';
    end if;
  else
    select s.timezone into v_timezone
      from public.sites s
     where s.site_id = NEW.site_id;

    if v_timezone is null or btrim(v_timezone) = ''
       or not exists (select 1 from pg_timezone_names n where n.name = v_timezone) then
      if not v_declare then
        v_motif := 'Fin non enregistrée — départ pointé non convertible : le commerce ne déclare aucun fuseau horaire exploitable (phase pilote)';
      end if;
    else
      v_fin := (v_depart.date + v_depart.heure) at time zone v_timezone;

      if v_fin < v_ancien.heure_debut or v_fin > NEW.heure_debut then
        if not v_declare then
          v_motif := format(
            'Fin non enregistrée — départ pointé le %s à %s hors de l''intervalle du service, non retenu (phase pilote)',
            v_depart.date, v_depart.heure);
        end if;
        v_fin := null;
      end if;
    end if;
  end if;

  if v_fin is not null then
    update public.shifts
       set statut         = 'termine',
           heure_fin      = v_fin,           -- LU d'un pointage, jamais déduit
           cloture_source = v_source,
           cloture_par    = v_par,
           cloture_le     = now(),
           cloture_motif  = case when v_declare then v_motif else cloture_motif end
     where id = v_ancien.id;
  else
    update public.shifts
       set statut         = 'clos_sans_pointage',
           heure_fin      = null,            -- inconnue, jamais inventée (S-1)
           cloture_source = v_source,
           cloture_par    = v_par,
           cloture_le     = now(),
           cloture_motif  = v_motif
     where id = v_ancien.id;
  end if;

  get diagnostics v_lignes = row_count;
  if v_lignes <> 1 then
    raise exception
      'Clôture du service précédent % impossible : % ligne(s) modifiée(s) au lieu d''une. Prise de poste refusée plutôt que deux services actifs.',
      v_ancien.id, v_lignes
      using errcode = '25000';
  end if;

  return NEW;
end;
$$;

comment on function public.nexus_shifts_avant_insertion() is
  'P-1 + changement de quart (16/10/2026) — contrat unique de prise de poste : normalise l''identité du site PUIS ferme le service actif précédent, sans jamais inventer son heure de fin. Départ pointé : « termine », heure_fin lue. Sinon « clos_sans_pointage », heure_fin NULL. Si nexus_changer_de_quart() a posé la variable de transaction nexus.changement_quart_employe (égale à l''employé qui s''insère), la clôture est journalisée comme voulue par l''employé : cloture_source = employe, cloture_par = l''employé, cloture_motif = le motif déclaré (jamais un texte système). Sans variable : comportement P-1 inchangé.';

create or replace function public.nexus_changer_de_quart(
  p_role               text,
  p_quart              text    default null,
  p_motif              text    default null,
  p_cloture_confirmee  boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_uid       uuid := auth.uid();
  v_emp       record;
  v_ouvert    record;
  v_a_clore   boolean;
  v_motif     text;
  v_nouveau   uuid;
begin
  if v_uid is null then
    raise exception 'Prise de poste refusée : aucune session employé.' using errcode = '28000';
  end if;

  select e.role, e.site_id into v_emp from public.employees e where e.id = v_uid;
  if not found or v_emp.site_id is null then
    raise exception 'Prise de poste refusée : fiche employé ou commerce introuvable.' using errcode = '42501';
  end if;

  if p_role is null or btrim(p_role) = '' then
    raise exception 'Prise de poste refusée : fonction non précisée.' using errcode = '22023';
  end if;
  if p_quart is not null and p_quart not in ('matin', 'soir', 'renfort') then
    raise exception 'Prise de poste refusée : quart « % » inconnu.', p_quart using errcode = '22023';
  end if;

  v_motif := nullif(btrim(coalesce(p_motif, '')), '');
  if v_motif is not null and char_length(v_motif) > 200 then
    raise exception 'Motif trop long (% caractères, 200 au plus).', char_length(v_motif) using errcode = '22001';
  end if;

  -- Le quart ouvert est verrouillé ICI, avant de décider : la décision
  -- (confirmation requise ou non) et la clôture du déclencheur portent sur
  -- le même état.
  select sh.id, sh.role, sh.quart, sh.heure_debut into v_ouvert
    from public.shifts sh
   where sh.employee_id = v_uid
     and sh.site_id     = v_emp.site_id
     and sh.statut      = 'en_cours'
   order by sh.heure_debut desc
   limit 1
   for update;
  v_a_clore := found;

  if v_a_clore and not coalesce(p_cloture_confirmee, false) then
    return jsonb_build_object(
      'ok', false,
      'code', 'confirmation_requise',
      'quart_ouvert', jsonb_build_object(
        'id', v_ouvert.id, 'role', v_ouvert.role,
        'quart', v_ouvert.quart, 'heure_debut', v_ouvert.heure_debut));
  end if;

  if v_a_clore then
    perform set_config('nexus.changement_quart_employe', v_uid::text, true);
    perform set_config('nexus.changement_quart_motif', coalesce(v_motif, ''), true);
  end if;

  insert into public.shifts (employee_id, role, role_prevu, confirmed_by, quart, site, statut)
  values (v_uid, p_role, v_emp.role, 'employe', p_quart, v_emp.site_id, 'en_cours')
  returning id into v_nouveau;

  -- Filet : quoi qu'il arrive, aucune variable ne survit à l'opération.
  perform set_config('nexus.changement_quart_employe', '', true);
  perform set_config('nexus.changement_quart_motif', '', true);

  return jsonb_build_object(
    'ok', true,
    'prise_de_poste_id', v_nouveau,
    'quart_cloture_id', case when v_a_clore then v_ouvert.id else null end);
end;
$$;

comment on function public.nexus_changer_de_quart(text, text, text, boolean) is
  'Changement de quart atomique (16/10/2026). SECURITY INVOKER : soumis à la RLS de l''employé connecté (employee_own_shifts_insert, update_shifts). Quart ouvert sans p_cloture_confirmee : n''écrit rien, rend confirmation_requise. Avec confirmation : pose nexus.changement_quart_employe / nexus.changement_quart_motif (variables de transaction) lues par nexus_shifts_avant_insertion, puis insère le nouveau quart. Échec = ancien quart intact. Ne crée aucune heure de fin ni aucune durée.';

revoke all on function public.nexus_changer_de_quart(text, text, text, boolean) from public;
revoke all on function public.nexus_changer_de_quart(text, text, text, boolean) from anon;
grant execute on function public.nexus_changer_de_quart(text, text, text, boolean) to authenticated;

do $ctrl$
declare
  v_insert   int;
  v_update   int;
  v_lie      boolean;
  v_source   text;
  v_fn       oid := 'public.nexus_changer_de_quart(text, text, text, boolean)'::regprocedure;
begin
  select count(*) into v_insert from pg_trigger t
   where t.tgrelid = 'public.shifts'::regclass and not t.tgisinternal
     and t.tgtype & 4 = 4;   -- BEFORE INSERT
  select count(*) into v_update from pg_trigger t
   where t.tgrelid = 'public.shifts'::regclass and not t.tgisinternal
     and t.tgtype & 16 = 16; -- UPDATE

  select exists (
    select 1 from pg_trigger t join pg_proc p on p.oid = t.tgfoid
     where t.tgrelid = 'public.shifts'::regclass and not t.tgisinternal
       and t.tgtype & 4 = 4
       and p.proname = 'nexus_shifts_avant_insertion'
  ) into v_lie;

  select p.prosrc into v_source
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'nexus_shifts_avant_insertion';

  if v_insert <> 1 then
    raise exception 'Changement de quart interrompu : % trigger(s) BEFORE INSERT sur shifts au lieu d''un seul.', v_insert;
  end if;
  if v_update <> 1 then
    raise exception 'Changement de quart interrompu : % trigger(s) UPDATE sur shifts au lieu d''un seul.', v_update;
  end if;
  if not v_lie then
    raise exception 'Changement de quart interrompu : le trigger BEFORE INSERT de shifts n''appelle pas nexus_shifts_avant_insertion.';
  end if;
  if v_source is null or v_source not like '%clos_sans_pointage%'
     or v_source not like '%nexus.changement_quart_employe%' then
    raise exception 'Changement de quart interrompu : la fonction installée ne lit pas la variable de changement de quart — le remplacement n''a pas eu lieu.';
  end if;
  if v_source like '%heure_fin      = NEW.heure_debut%' then
    raise exception 'Changement de quart interrompu : la fonction installée écrit encore heure_fin = NEW.heure_debut.';
  end if;
  if (select prosecdef from pg_proc where oid = v_fn) then
    raise exception 'Changement de quart interrompu : nexus_changer_de_quart est SECURITY DEFINER — elle doit rester soumise à la RLS de l''employé.';
  end if;
  if has_function_privilege('anon', v_fn, 'EXECUTE') then
    raise exception 'Changement de quart interrompu : anon peut exécuter nexus_changer_de_quart.';
  end if;
  if not has_function_privilege('authenticated', v_fn, 'EXECUTE') then
    raise exception 'Changement de quart interrompu : authenticated ne peut pas exécuter nexus_changer_de_quart.';
  end if;
end;
$ctrl$;

commit;
