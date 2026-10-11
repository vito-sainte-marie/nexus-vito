-- FDJ (anomalie A6) : relevés de clôture, rapports et journal d'audit ne
-- s'écrivent plus que par des commandes.
--
-- Pourquoi. anon et authenticated détenaient INSERT, UPDATE, DELETE, TRUNCATE
-- et MAINTAIN sur fdj_releves_cloture, fdj_reports et fdj_audit_log (ACL
-- `arwdDxtm`, identique sur Test et en Production au 10/10). Les politiques
-- RLS ne filtrent que le site (`site = current_employee_site_id()`) : un
-- caissier pouvait, par un simple appel REST,
--   * fabriquer une ligne d'audit au nom de n'importe quel acteur de son site
--     (le journal censé prouver qui a fait quoi était falsifiable) ;
--   * poser une version de relevé de clôture « conforme » sur le quart d'un
--     collègue, ou une validation employé à sa place ;
--   * réécrire les tirages (fdj_reports, politique UPDATE ouverte) ;
--   * et, par TRUNCATE (qui ignore la RLS), vider les trois tables de tous
--     les sites. MAINTAIN (PG17) n'avait jamais été retiré non plus.
-- Constaté en recette le 10/10 (C17b–C17d, recette de la PR #98) ; annoncé
-- « lot suivant » par 20261010150000.
--
-- Correctif.
--   1. Quatre commandes SECURITY DEFINER (search_path vide, rôle et site lus
--      en base par les gardes de 20261010150000) couvrent les quatorze
--      écritures directes des deux écrans :
--        fdj_manager_journaliser          — 11 lignes d'audit de l'écran
--                                           Manager, liste fermée d'actions ;
--        fdj_journaliser_ouverture_validee — l'audit `ouverture_validee` de
--                                           l'écran employé ;
--        fdj_manager_poser_releve_cloture — les 4 poses de relevé de
--                                           l'écran Manager ;
--        fdj_manager_enregistrer_rapports — l'upsert des tirages (étape 3).
--      Site, quart, identité de l'auteur et horodatage viennent du serveur ;
--      l'écran ne fournit plus que le contenu métier.
--   2. Les écrivains serveur déjà en place (fdj_confirmer_caisse,
--      fdj_corriger_caisse_manager, déclencheurs de fdj_cash_controls et de
--      fdj_shift_counts, fdj_synchroniser_releves_courants, …) sont tous
--      SECURITY DEFINER, propriété de postgres : ils ne dépendent pas des
--      droits retirés ici (inventaire du 11/10, Test et Production).
--   3. Retrait de INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER et
--      MAINTAIN à public, anon et authenticated ; retrait de SELECT à anon.
--      authenticated garde SELECT sous RLS (écrans, exports).
--   4. fdj_synchroniser_releves_courants(text) : EXECUTE retiré à public et
--      anon (ouvert sur Test, déjà fermé en Production) — aligne les deux.
--
-- Les politiques INSERT/UPDATE existantes deviennent inertes (aucun rôle
-- client n'a plus le droit qu'elles filtrent). Elles sont laissées en place :
-- les supprimer n'ajoute rien à la fermeture et compliquerait le retour
-- arrière.
--
-- Écart de comportement assumé : le contenu chiffré d'un relevé (snapshot,
-- statut, caractère, diff) reste calculé par l'écran Manager, comme avant ;
-- ce lot ferme l'écriture par un non-manager et fixe l'identité de la ligne,
-- il ne déplace pas le calcul côté serveur.
--
-- Ordre de déploiement : migration et code dans la même fenêtre. Migration
-- seule : l'écran Manager servi reçoit 42501 sur ses quatorze écritures.
-- Code seul : les nouvelles RPC répondent PGRST202 (fonction inconnue).
--
-- Épreuve : outils/epreuve-fdj-a6-ecriture-directe-20261011/ (sur Test, en
-- une transaction annulée, avec un caissier et un manager Auth réels).
--
-- Retour arrière (dans cet ordre, en une transaction) :
--   grant insert, update, delete, truncate, references, trigger, maintain
--     on public.fdj_releves_cloture, public.fdj_reports, public.fdj_audit_log
--     to anon, authenticated;
--   grant select on public.fdj_releves_cloture, public.fdj_reports,
--     public.fdj_audit_log to anon;
--   puis resservir les écrans d'avant ce lot. Les quatre commandes peuvent
--   rester : elles n'ouvrent rien. Pour les retirer aussi :
--   drop function public.fdj_manager_journaliser(uuid, text, uuid, text, text, jsonb, jsonb);
--   drop function public.fdj_journaliser_ouverture_validee(uuid, jsonb);
--   drop function public.fdj_manager_poser_releve_cloture(uuid, jsonb);
--   drop function public.fdj_manager_enregistrer_rapports(uuid, numeric, numeric);
--   (Sur Test seulement, pour retrouver l'état d'avant : grant execute on
--   function public.fdj_synchroniser_releves_courants(text) to public, anon.)
--   Enfin `delete from supabase_migrations.schema_migrations where version =
--   '20261011090000';` si la ligne de registre a été posée.
--
-- Hors lot (A5, documenté) : fdj_alertes, fdj_booklets, fdj_corrections,
-- fdj_discrepancies, fdj_employee_shift_locks, fdj_games, fdj_locations,
-- fdj_stock_* … restent écrivables par authenticated ; aucune n'alimente les
-- trois tables fermées ici (aucun déclencheur, aucune cascade).

-- ----------------------------------------------------------------------------
-- 1. Journal d'audit — écran Manager
-- ----------------------------------------------------------------------------

create or replace function public.fdj_manager_journaliser(
  p_shift_id        uuid,
  p_entite_type     text,
  p_entite_id       uuid,
  p_action          text,
  p_motif           text,
  p_ancienne_valeur jsonb,
  p_nouvelle_valeur jsonb
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid;
  v_site  text;
  v_shift public.fdj_shifts;
  v_auto  boolean;
  v_id    uuid;
begin
  -- Garde : manager ou gérant actif ; site lu en base, jamais reçu.
  if p_shift_id is not null then
    v_shift := public.fdj_quart_du_manager(p_shift_id);
    v_site  := v_shift.site;
  else
    v_site := public.fdj_site_du_manager();
  end if;
  v_uid := (select auth.uid());

  if p_entite_id is null then
    raise exception 'Entité journalisée manquante.'
      using errcode = 'invalid_parameter_value';
  end if;

  -- Liste fermée : chaque action a son type d'entité, et l'entité doit
  -- appartenir au site (et au quart quand il y en a un).
  case p_action
    when 'exception_ecart_recalcule_revalide' then
      if p_entite_type is distinct from 'fdj_releves_cloture' or p_shift_id is null
         or not exists (select 1 from public.fdj_releves_cloture r
                         where r.id = p_entite_id and r.shift_id = p_shift_id) then
        raise exception 'Relevé de clôture inconnu pour ce quart.'
          using errcode = 'invalid_parameter_value';
      end if;

    when 'fdj_chaine_retablie_automatiquement',
         'fdj_continuite_stock_a_verifier_posee',
         'fdj_continuite_stock_retablie_automatiquement' then
      if p_entite_type is distinct from 'fdj_alerte'
         or not exists (select 1 from public.fdj_alertes a
                         where a.id = p_entite_id and a.site = v_site
                           and a.shift_id is not distinct from p_shift_id) then
        raise exception 'Alerte FDJ inconnue pour ce site et ce quart.'
          using errcode = 'invalid_parameter_value';
      end if;

    when 'derogation_manager' then
      if p_entite_type is distinct from 'fdj_employee_shift_lock' or p_shift_id is not null
         or not exists (select 1 from public.fdj_employee_shift_locks l
                         where l.id = p_entite_id and l.site = v_site) then
        raise exception 'Verrou de quart inconnu pour ce site.'
          using errcode = 'invalid_parameter_value';
      end if;

    when 'inventaire_reference_valide' then
      if p_entite_type is distinct from 'fdj_stock_reference' or p_shift_id is not null
         or not exists (select 1 from public.fdj_stock_references r
                         where r.id = p_entite_id and r.site = v_site) then
        raise exception 'Inventaire de référence inconnu pour ce site.'
          using errcode = 'invalid_parameter_value';
      end if;

    when 'creation_manager', 'correction_manager' then
      if p_entite_type is distinct from 'fdj_shift' or p_entite_id is distinct from p_shift_id then
        raise exception 'Une trace de quart porte sur le quart lui-même.'
          using errcode = 'invalid_parameter_value';
      end if;

    when 'fdj_propagation_correction_stock_amont' then
      if p_entite_type is distinct from 'fdj_shift_counts' or p_entite_id is distinct from p_shift_id then
        raise exception 'Une trace de propagation porte sur le quart corrigé.'
          using errcode = 'invalid_parameter_value';
      end if;

    else
      raise exception 'Action d''audit FDJ non prévue : %', coalesce(p_action, '(nulle)')
        using errcode = 'invalid_parameter_value';
  end case;

  -- Les trois réconciliations automatiques n'ont pas d'acteur humain : c'est
  -- l'écran qui constate, pas le manager qui décide (acteur_id null, comme
  -- avant). La metadata garde qui a déclenché l'écriture.
  v_auto := p_action in ('fdj_chaine_retablie_automatiquement',
                         'fdj_continuite_stock_a_verifier_posee',
                         'fdj_continuite_stock_retablie_automatiquement');

  insert into public.fdj_audit_log (
    site, shift_id, entite_type, entite_id, action, acteur_id, motif,
    ancienne_valeur, nouvelle_valeur, metadata
  ) values (
    v_site, p_shift_id, p_entite_type, p_entite_id, p_action,
    case when v_auto then null else v_uid end,
    p_motif, p_ancienne_valeur, p_nouvelle_valeur,
    jsonb_build_object('ecrit_par', v_uid, 'via', 'fdj_manager_journaliser')
  )
  returning id into v_id;
  return v_id;
end;
$$;

comment on function public.fdj_manager_journaliser(uuid, text, uuid, text, text, jsonb, jsonb) is
  'A6 (20261011090000) : seule voie d''écriture de l''écran Manager dans '
  'fdj_audit_log. Liste fermée d''actions ; site, acteur et horodatage posés '
  'par le serveur.';

-- ----------------------------------------------------------------------------
-- 2. Journal d'audit — ouverture validée par l'employé
-- ----------------------------------------------------------------------------

create or replace function public.fdj_journaliser_ouverture_validee(
  p_shift_id      uuid,
  p_jeux_modifies jsonb
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shift public.fdj_shifts;
  v_uid   uuid;
  v_id    uuid;
begin
  v_shift := public.fdj_quart_ouvert_de_l_employe(p_shift_id);
  v_uid := (select auth.uid());

  if v_shift.ouverture_validee is not true then
    raise exception 'L''ouverture de ce quart FDJ n''est pas validée.'
      using errcode = 'invalid_parameter_value';
  end if;
  if p_jeux_modifies is not null and jsonb_typeof(p_jeux_modifies) <> 'array' then
    raise exception 'Liste des jeux modifiés invalide.'
      using errcode = 'invalid_parameter_value';
  end if;

  insert into public.fdj_audit_log (
    site, shift_id, entite_type, entite_id, action, acteur_id, nouvelle_valeur, metadata
  ) values (
    v_shift.site, v_shift.id, 'fdj_shift', v_shift.id, 'ouverture_validee', v_uid,
    jsonb_build_object('jeux_modifies', coalesce(p_jeux_modifies, '[]'::jsonb)),
    jsonb_build_object('ecrit_par', v_uid, 'via', 'fdj_journaliser_ouverture_validee')
  )
  returning id into v_id;
  return v_id;
end;
$$;

comment on function public.fdj_journaliser_ouverture_validee(uuid, jsonb) is
  'A6 (20261011090000) : trace `ouverture_validee` du titulaire du quart, '
  'tant que le quart n''est pas validé.';

-- ----------------------------------------------------------------------------
-- 3. Relevés de clôture — écran Manager
-- ----------------------------------------------------------------------------

-- p_releve porte le contenu métier calculé par l'écran (instantané chiffré,
-- statut, caractère, diff, motif, signature) et version_num. L'identité de la
-- ligne est posée ici :
--   regularisation_manager      : date, quart, employé du quart ; cree_par =
--                                 le manager authentifié ;
--   recalcul_automatique_chaine : exige une version précédente ; date, quart,
--                                 employé repris de la dernière version (comme
--                                 l'écran le faisait) ; cree_par null ;
--   validation_employe          : reprise d'un relevé manquant ; version 1,
--                                 quart validé, cree_par = titulaire du quart.
-- Une version déjà prise lève 23505 (la contrainte unique), que l'écran traite
-- comme idempotent ; une version qui saute un rang lève 22023.
create or replace function public.fdj_manager_poser_releve_cloture(
  p_shift_id uuid,
  p_releve   jsonb
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shift   public.fdj_shifts;
  v_uid     uuid;
  v_type    text;
  v_version int;
  v_max     int;
  v_prec    public.fdj_releves_cloture;
  v_r       public.fdj_releves_cloture;
  v_date    date;
  v_quart   text;
  v_employe uuid;
  v_auteur  uuid;
  v_id      uuid;
begin
  v_shift := public.fdj_quart_du_manager(p_shift_id);
  v_uid := (select auth.uid());

  if p_releve is null or jsonb_typeof(p_releve) <> 'object' then
    raise exception 'Relevé de clôture manquant.'
      using errcode = 'invalid_parameter_value';
  end if;

  v_type := p_releve ->> 'type_version';
  begin
    v_version := (p_releve ->> 'version_num')::int;
  exception when others then
    raise exception 'Numéro de version invalide.' using errcode = 'invalid_parameter_value';
  end;
  if v_version is null or v_version < 1 then
    raise exception 'Numéro de version invalide.' using errcode = 'invalid_parameter_value';
  end if;

  select max(r.version_num) into v_max
    from public.fdj_releves_cloture r where r.shift_id = v_shift.id;
  if v_version > coalesce(v_max, 0) + 1 then
    raise exception 'Version % hors séquence (dernière : %).', v_version, coalesce(v_max, 0)
      using errcode = 'invalid_parameter_value';
  end if;

  case v_type
    when 'regularisation_manager' then
      v_date := v_shift.date; v_quart := v_shift.quart; v_employe := v_shift.employee_id;
      v_auteur := v_uid;

    when 'recalcul_automatique_chaine' then
      select * into v_prec from public.fdj_releves_cloture r
       where r.shift_id = v_shift.id order by r.version_num desc limit 1;
      if not found then
        raise exception 'Un recalcul exige une version précédente du relevé.'
          using errcode = 'invalid_parameter_value';
      end if;
      v_date := v_prec.date; v_quart := v_prec.quart; v_employe := v_prec.employee_id;
      v_auteur := null;

    when 'validation_employe' then
      if v_version <> 1 then
        raise exception 'Une validation employé est toujours la version 1.'
          using errcode = 'invalid_parameter_value';
      end if;
      if v_shift.statut is distinct from 'valide' or v_shift.employee_id is null then
        raise exception 'Seul un quart validé avec un titulaire se reprend ainsi.'
          using errcode = 'invalid_parameter_value';
      end if;
      v_date := v_shift.date; v_quart := v_shift.quart; v_employe := v_shift.employee_id;
      v_auteur := v_shift.employee_id;

    else
      raise exception 'Type de version non autorisé : %', coalesce(v_type, '(nul)')
        using errcode = 'invalid_parameter_value';
  end case;

  v_r := jsonb_populate_record(null::public.fdj_releves_cloture, p_releve);

  insert into public.fdj_releves_cloture (
    site, shift_id, date, quart, employee_id, version_num, type_version, cree_par,
    stock_initial_par_jeu, appro_par_jeu, stock_final_par_jeu, ventes_par_jeu,
    ventes_grattage_valeur, lots_payes_grattage, caisse_tirages, regularisations,
    caisse_attendue, caisse_reelle, ecart, anomalie_chaine, statut,
    motif_regularisation, diff_vs_precedent, signature, caractere
  ) values (
    v_shift.site, v_shift.id, v_date, v_quart, v_employe, v_version, v_type, v_auteur,
    case when p_releve ? 'stock_initial_par_jeu' then v_r.stock_initial_par_jeu else '{}'::jsonb end,
    case when p_releve ? 'appro_par_jeu'         then v_r.appro_par_jeu         else '{}'::jsonb end,
    case when p_releve ? 'stock_final_par_jeu'   then v_r.stock_final_par_jeu   else '{}'::jsonb end,
    case when p_releve ? 'ventes_par_jeu'        then v_r.ventes_par_jeu        else '{}'::jsonb end,
    v_r.ventes_grattage_valeur, v_r.lots_payes_grattage, v_r.caisse_tirages,
    case when p_releve ? 'regularisations' then v_r.regularisations else 0 end,
    v_r.caisse_attendue, v_r.caisse_reelle, v_r.ecart, v_r.anomalie_chaine, v_r.statut,
    v_r.motif_regularisation, v_r.diff_vs_precedent,
    coalesce(v_r.signature, '{}'::jsonb) || jsonb_build_object('ecrit_par', v_uid),
    case when p_releve ? 'caractere' then v_r.caractere else 'definitif' end
  )
  returning id into v_id;
  return v_id;
end;
$$;

comment on function public.fdj_manager_poser_releve_cloture(uuid, jsonb) is
  'A6 (20261011090000) : seule voie d''écriture de l''écran Manager dans '
  'fdj_releves_cloture. Types regularisation_manager, '
  'recalcul_automatique_chaine, validation_employe (reprise). Identité de la '
  'ligne posée par le serveur ; 23505 sur une version déjà prise.';

-- ----------------------------------------------------------------------------
-- 4. Rapports (tirages) — écran Manager, étape 3
-- ----------------------------------------------------------------------------

-- Même effet que l'upsert supabase-js d'avant (tableau de deux lignes, union
-- des colonnes, absentes à null) : `journalier` porte les lots payés et met
-- caisse_tirages à null ; `temps_reel` l'inverse. justificatif_url et
-- created_at ne sont pas touchés.
create or replace function public.fdj_manager_enregistrer_rapports(
  p_shift_id            uuid,
  p_lots_payes_grattage numeric,
  p_caisse_tirages      numeric
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shift public.fdj_shifts;
  v_uid   uuid;
begin
  v_shift := public.fdj_quart_du_manager(p_shift_id);
  v_uid := (select auth.uid());

  insert into public.fdj_reports as r
    (site, shift_id, type_rapport, lots_payes_grattage, caisse_tirages, saisi_par)
  values
    (v_shift.site, v_shift.id, 'journalier', p_lots_payes_grattage, null, v_uid),
    (v_shift.site, v_shift.id, 'temps_reel', null, p_caisse_tirages, v_uid)
  on conflict (shift_id, type_rapport) do update
    set site                = excluded.site,
        lots_payes_grattage = excluded.lots_payes_grattage,
        caisse_tirages      = excluded.caisse_tirages,
        saisi_par           = excluded.saisi_par;
end;
$$;

comment on function public.fdj_manager_enregistrer_rapports(uuid, numeric, numeric) is
  'A6 (20261011090000) : seule voie d''écriture de l''écran Manager dans '
  'fdj_reports (lots payés grattage, caisse tirages).';

-- ----------------------------------------------------------------------------
-- 5. Droits d'exécution
-- ----------------------------------------------------------------------------

do $$
declare
  v_sig text;
begin
  foreach v_sig in array array[
    'public.fdj_manager_journaliser(uuid, text, uuid, text, text, jsonb, jsonb)',
    'public.fdj_journaliser_ouverture_validee(uuid, jsonb)',
    'public.fdj_manager_poser_releve_cloture(uuid, jsonb)',
    'public.fdj_manager_enregistrer_rapports(uuid, numeric, numeric)',
    'public.fdj_synchroniser_releves_courants(text)'
  ] loop
    execute 'revoke all on function ' || v_sig || ' from public';
    execute 'revoke all on function ' || v_sig || ' from anon';
    execute 'grant execute on function ' || v_sig || ' to authenticated';
    execute 'grant execute on function ' || v_sig || ' to service_role';
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 6. Retrait de l'écriture directe
-- ----------------------------------------------------------------------------

revoke insert, update, delete, truncate, references, trigger, maintain
  on public.fdj_releves_cloture from public, anon, authenticated;
revoke select on public.fdj_releves_cloture from public, anon;

revoke insert, update, delete, truncate, references, trigger, maintain
  on public.fdj_reports from public, anon, authenticated;
revoke select on public.fdj_reports from public, anon;

revoke insert, update, delete, truncate, references, trigger, maintain
  on public.fdj_audit_log from public, anon, authenticated;
revoke select on public.fdj_audit_log from public, anon;
