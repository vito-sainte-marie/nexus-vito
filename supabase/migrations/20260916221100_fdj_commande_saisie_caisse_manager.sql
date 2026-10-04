-- =============================================================================
-- FDJ — VAGUE 1 — PHASE A (« ÉTENDRE »)
-- La feuille de caisse saisie PAR LE MANAGER, et la projection des demandes
-- de correction pour qu'il puisse les arbitrer.
-- =============================================================================
--
-- POURQUOI CETTE DOUZIÈME MIGRATION EXISTE
-- ----------------------------------------
-- Les commandes managériales de 20260916220700 partent toutes du même
-- postulat : l'employé a confirmé sa caisse, le manager arbitre ensuite.
-- `fdj_ouvrir_controle_caisse`, `fdj_valider_caisse` et
-- `fdj_corriger_caisse_manager` répondent donc `caisse_non_confirmee` — et
-- ne font rien — quand `confirme_le` est NULL.
--
-- Or l'écran manager sert AUSSI à un geste que ces trois commandes ne
-- couvrent pas : la saisie de rattrapage. Un quart passé n'a jamais été
-- saisi (employé absent, poste en panne, oubli constaté le lendemain), et
-- le manager reconstitue la feuille de toutes pièces. C'est le chemin
-- « Créer un quart FDJ » de NEXUS-FDJ-Manager-v1.html.
--
-- Sans commande pour ce chemin, la Phase C n'a que deux issues, toutes deux
-- mauvaises :
--   · fermer l'écriture directe sur fdj_cash_controls → l'écran manager
--     casse sur le geste le plus courant de régularisation ;
--   · la laisser ouverte → basculer la validation ne garantit plus rien,
--     puisqu'un manager conserverait l'écriture directe de `valide_par` par
--     l'API REST.
-- D'où cette commande : le chemin de rattrapage devient lui aussi une
-- commande serveur, et la porte directe peut être fermée.
--
-- CE QU'ELLE NE FAIT PAS
-- ----------------------
-- Elle ne pose JAMAIS `confirme_par` / `confirme_le`. Ces deux colonnes
-- signifient « l'employé a constaté et transmis sa caisse » (20260916220100).
-- Les renseigner depuis un geste du manager fabriquerait une confirmation
-- d'employé qui n'a pas eu lieu — exactement la falsification que le journal
-- des événements existe pour rendre impossible. Une feuille reconstituée
-- reste donc, à jamais, une feuille sans confirmation d'employé : `saisi_par`
-- porte l'auteur réel, l'événement `saisie_manager` porte la justification.
--
-- Elle REFUSE de s'appliquer à une caisse déjà confirmée par l'employé : ce
-- chemin ne doit jamais écraser un constat d'employé. Le geste à utiliser
-- est alors `fdj_corriger_caisse_manager`, qui conserve le constat d'origine.
--
-- AUCUNE DONNÉE EXISTANTE N'EST LUE, ÉCRITE NI CORRIGÉE PAR CETTE MIGRATION.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. VOCABULAIRE DU JOURNAL — un geste de plus, deux contraintes à étendre
-- -----------------------------------------------------------------------------
-- `saisie_manager` rejoint les sept événements de 20260916220200. Deux CHECK
-- doivent l'admettre :
--   · la liste des événements ;
--   · la forme des versions. Une saisie de rattrapage CRÉE la caisse : elle
--     part donc de (version_avant NULL → version_apres 1), forme jusqu'ici
--     réservée à `confirmation_initiale`. Une re-saisie sur une feuille
--     reconstituée garde la forme ordinaire (n → n+1).
-- L'index unique `fdj_caisse_evenements_confirmation_unique` ne porte que sur
-- `confirmation_initiale` : il n'est pas touché, et une caisse reconstituée
-- peut recevoir plusieurs `saisie_manager` sans conflit.

alter table public.fdj_caisse_evenements
  drop constraint if exists fdj_caisse_evenements_evenement_check;

alter table public.fdj_caisse_evenements
  add constraint fdj_caisse_evenements_evenement_check check (evenement in (
    'confirmation_initiale',
    'correction_employe',
    'ouverture_controle',
    'correction_manager',
    'validation',
    'reouverture',
    'demande_correction',
    'saisie_manager'
  ));

alter table public.fdj_caisse_evenements
  drop constraint if exists fdj_caisse_evenements_versions_check;

alter table public.fdj_caisse_evenements
  add constraint fdj_caisse_evenements_versions_check check (
    (version_avant is null and version_apres is null)
    or (version_avant is null and version_apres is not null
        and evenement in ('confirmation_initiale', 'saisie_manager'))
    or (version_avant is not null and version_apres is not null
        and version_apres >= version_avant)
  );

-- -----------------------------------------------------------------------------
-- 2. LA COMMANDE — feuille de caisse saisie par le manager
-- -----------------------------------------------------------------------------
-- Comme `fdj_corriger_caisse_manager`, elle ne reçoit du navigateur que la
-- caisse réelle et les régularisations : les ventes, la caisse attendue et
-- l'écart sont établis par `fdj_calculer_caisse` à partir des comptages et
-- des rapports déjà enregistrés en base.
create or replace function public.fdj_saisir_caisse_manager(
  p_shift_id          uuid,
  p_caisse_reelle     numeric,
  p_justification     text,
  p_regularisations   numeric default 0,
  p_resultat_controle text default null,
  p_motif_interne     text default null,
  p_motif_ecart       text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_shift  public.fdj_shifts;
  v_uid    uuid := (select auth.uid());
  v_avant  public.fdj_cash_controls;
  v_existe boolean := false;
  v_calc   jsonb;
  v_apres  public.fdj_cash_controls;
  v_valide boolean := false;
  v_statut text;
  v_motif  text;
  v_motif_ecart text;
  v_valeurs_avant jsonb;
begin
  v_shift := public.fdj_quart_du_manager(p_shift_id);

  if p_justification is null or length(btrim(p_justification)) < 5 then
    raise exception 'Une justification d''au moins 5 caractères est obligatoire : cette feuille n''a pas été confirmée par un employé.'
      using errcode = 'invalid_parameter_value';
  end if;

  if p_resultat_controle is not null
     and p_resultat_controle not in ('conforme', 'avec_ecart', 'a_regulariser', 'a_revoir', 'non_comparable') then
    raise exception 'Résultat de contrôle inconnu : %', p_resultat_controle
      using errcode = 'invalid_parameter_value';
  end if;

  v_motif := nullif(btrim(coalesce(p_motif_interne, '')), '');

  -- Mêmes exigences que `fdj_valider_caisse` : un résultat qui constate un
  -- problème n'est pas rendu sans motif interne.
  if p_resultat_controle in ('avec_ecart', 'a_regulariser', 'a_revoir')
     and (v_motif is null or length(v_motif) < 3) then
    raise exception 'Un motif interne est obligatoire pour le résultat « % ».', p_resultat_controle
      using errcode = 'invalid_parameter_value';
  end if;

  -- Code énuméré du motif d'écart — même liste et même contrôle que
  -- `fdj_valider_caisse` (voir 20260916220700).
  v_motif_ecart := nullif(btrim(coalesce(p_motif_ecart, '')), '');
  if v_motif_ecart is not null
     and v_motif_ecart not in ('remboursement', 'erreur_saisie', 'erreur_comptage',
                               'erreur_montant_caisse', 'carnet_non_declare',
                               'mouvement_oublie', 'erreur_rapport',
                               'correction_verification', 'autre', 'non_explique') then
    raise exception 'Motif d''écart inconnu : %', p_motif_ecart
      using errcode = 'invalid_parameter_value';
  end if;

  select * into v_avant from public.fdj_cash_controls c where c.shift_id = p_shift_id for update;
  v_existe := found;

  -- Ce chemin n'écrase JAMAIS un constat d'employé.
  if v_existe and v_avant.confirme_le is not null then
    return jsonb_build_object(
      'saisi', false,
      'motif', 'caisse_confirmee_par_employe',
      'message', 'Cette caisse a été confirmée par l''employé : utilisez la correction managériale, qui conserve le constat d''origine.'
    );
  end if;

  v_calc := public.fdj_calculer_caisse(p_shift_id, p_caisse_reelle, coalesce(p_regularisations, 0));

  if (v_calc->>'ecart') is null then
    return jsonb_build_object(
      'saisi', false,
      'motif', 'saisie_incomplete',
      'message', 'Il manque une information pour établir cette caisse (lots payés, caisse tirages ou caisse réelle).'
    );
  end if;

  v_valide := p_resultat_controle in ('conforme', 'avec_ecart', 'a_regulariser');
  v_statut := case
                when p_resultat_controle is null       then 'a_controler'
                when p_resultat_controle = 'conforme'  then 'conforme'
                when p_resultat_controle = 'avec_ecart' then 'valide_avec_ecart'
                when p_resultat_controle = 'a_regulariser' then 'a_regulariser'
                else 'en_attente'
              end;

  if v_existe then
    v_valeurs_avant := jsonb_build_object(
      'ventes_grattage_valeur', v_avant.ventes_grattage_valeur,
      'lots_payes_grattage',    v_avant.lots_payes_grattage,
      'caisse_tirages',         v_avant.caisse_tirages,
      'caisse_grattage',        v_avant.caisse_grattage,
      'regularisations',        v_avant.regularisations,
      'caisse_attendue',        v_avant.caisse_attendue,
      'caisse_reelle',          v_avant.caisse_reelle,
      'ecart',                  v_avant.ecart
    );
  end if;

  -- Une commande managériale n'est pas une correction d'employé : les GUC du
  -- trigger de relevés sont remises explicitement, comme dans
  -- `fdj_corriger_caisse_manager`.
  perform set_config('nexus.fdj_correction_employe', 'false', true);
  perform set_config('nexus.fdj_correction_motif', btrim(p_justification), true);
  perform set_config('nexus.fdj_correction_commentaire', coalesce(v_motif, ''), true);

  insert into public.fdj_cash_controls as c (
    site, shift_id, ventes_grattage_valeur, lots_payes_grattage, caisse_grattage,
    caisse_tirages, regularisations, caisse_attendue, caisse_reelle, ecart,
    caisse_reelle_origine, ecart_origine,
    statut, resultat_controle, motif_ecart, motif_ecart_texte,
    saisi_par, controle_par, controle_le,
    valide_par, valide_le,
    version, nb_corrections, derniere_correction_le, updated_at
  )
  values (
    v_shift.site, p_shift_id,
    (v_calc->>'ventes_grattage_valeur')::numeric,
    (v_calc->>'lots_payes_grattage')::numeric,
    (v_calc->>'caisse_grattage')::numeric,
    (v_calc->>'caisse_tirages')::numeric,
    (v_calc->>'regularisations')::numeric,
    (v_calc->>'caisse_attendue')::numeric,
    (v_calc->>'caisse_reelle')::numeric,
    (v_calc->>'ecart')::numeric,
    -- Le « constat d'origine » d'une feuille reconstituée est celui du
    -- manager : c'est le seul qui ait jamais existé, et il est posé une fois.
    (v_calc->>'caisse_reelle')::numeric,
    (v_calc->>'ecart')::numeric,
    v_statut, p_resultat_controle, v_motif_ecart, v_motif,
    v_uid, v_uid, now(),
    case when v_valide then v_uid else null end,
    case when v_valide then now() else null end,
    1, 0, null, now()
  )
  on conflict (shift_id) do update
    set ventes_grattage_valeur = excluded.ventes_grattage_valeur,
        lots_payes_grattage    = excluded.lots_payes_grattage,
        caisse_grattage        = excluded.caisse_grattage,
        caisse_tirages         = excluded.caisse_tirages,
        regularisations        = excluded.regularisations,
        caisse_attendue        = excluded.caisse_attendue,
        caisse_reelle          = excluded.caisse_reelle,
        ecart                  = excluded.ecart,
        caisse_reelle_origine  = coalesce(c.caisse_reelle_origine, excluded.caisse_reelle_origine),
        ecart_origine          = coalesce(c.ecart_origine, excluded.ecart_origine),
        statut                 = excluded.statut,
        resultat_controle      = excluded.resultat_controle,
        motif_ecart            = case when p_motif_ecart is null
                                      then c.motif_ecart
                                      else excluded.motif_ecart end,
        motif_ecart_texte      = excluded.motif_ecart_texte,
        saisi_par              = excluded.saisi_par,
        controle_par           = coalesce(c.controle_par, excluded.controle_par),
        controle_le            = coalesce(c.controle_le, excluded.controle_le),
        valide_par             = excluded.valide_par,
        valide_le              = excluded.valide_le,
        -- Le CHECK de 20260916220100 impose version = nb_corrections + 1 :
        -- les deux avancent ensemble.
        version                = c.version + 1,
        nb_corrections         = c.nb_corrections + 1,
        derniere_correction_le = now(),
        updated_at             = now()
    -- Ceinture et bretelles : la garde `confirme_le is not null` a déjà
    -- rendu plus haut. Ce WHERE fait que même une exécution concurrente ne
    -- peut pas écraser une confirmation d'employé arrivée entre-temps.
    where c.confirme_le is null;

  select * into v_apres from public.fdj_cash_controls c where c.shift_id = p_shift_id;

  insert into public.fdj_caisse_evenements (
    site, cash_control_id, shift_id, evenement, auteur_id, auteur_role,
    employe_responsable_id, confirmation_initiale_le,
    version_avant, version_apres, nb_corrections_apres,
    statut_avant, statut_apres, valeurs_avant, valeurs_apres,
    ecart_avant, ecart_apres, motif, commentaire, metadata
  )
  values (
    v_shift.site, v_apres.id, p_shift_id, 'saisie_manager', v_uid, 'manager',
    -- §2.4 : l'employé opérationnel du quart reste le responsable, même
    -- quand c'est le manager qui tient la plume.
    v_shift.employee_id, null,
    case when v_existe then v_avant.version else null end,
    v_apres.version, v_apres.nb_corrections,
    case when v_existe then v_avant.statut else null end,
    v_apres.statut,
    v_valeurs_avant, v_calc,
    case when v_existe then v_avant.ecart else null end,
    (v_calc->>'ecart')::numeric,
    btrim(p_justification), v_motif,
    jsonb_build_object(
      'caisse_creee', not v_existe,
      'confirmation_employe', false,
      'resultat_controle', p_resultat_controle,
      'validee', v_valide,
      'source', 'fdj_saisir_caisse_manager'
    )
  );

  insert into public.fdj_audit_log (site, shift_id, entite_type, entite_id, action, acteur_id, ancienne_valeur, nouvelle_valeur, motif)
  values (
    v_shift.site, p_shift_id, 'fdj_cash_control', v_apres.id,
    'fdj_caisse_saisie_par_manager', v_uid,
    v_valeurs_avant, v_calc, btrim(p_justification)
  );

  return jsonb_build_object(
    'saisi', true,
    'creee', not v_existe,
    'shift_id', p_shift_id,
    'version', v_apres.version,
    'statut', v_apres.statut,
    'ecart', v_apres.ecart,
    'libelle_ecart', public.fdj_libelle_ecart_manager(v_apres.ecart),
    'validee', v_valide,
    'employe_responsable_id', v_shift.employee_id,
    'saisi_par', v_uid,
    'confirmation_employe', false
  );
end;
$$;

comment on function public.fdj_saisir_caisse_manager(uuid, numeric, text, numeric, text, text, text) is
  'Feuille de caisse reconstituée par le manager, pour un quart que personne n''a '
  'confirmé. Ne pose jamais confirme_par / confirme_le, et refuse une caisse déjà '
  'confirmée par l''employé (utiliser alors fdj_corriger_caisse_manager).';

-- -----------------------------------------------------------------------------
-- 3. PROJECTION — les demandes de correction d'un quart, vues du manager
-- -----------------------------------------------------------------------------
-- `fdj_demandes_correction` est fermée par défaut (20260916220300 : RLS activée,
-- aucune policy). `fdj_traiter_demande_correction` existe depuis
-- 20260916220700, mais l'écran manager n'avait aucun moyen d'apprendre qu'une
-- demande existe, ni son identifiant : la commande était sans appelant possible.
-- Cette projection est ce chaînon manquant.
--
-- Elle rend `message` et `reponse_manager` — l'un et l'autre destinés à
-- circuler entre l'employé et le manager. Elle ne rend AUCUN motif interne
-- manager : ceux-ci vivent dans fdj_cash_controls.motif_ecart_texte et dans le
-- journal, et ne sortent par aucune projection.
create or replace function public.fdj_demandes_correction_du_quart(p_shift_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_shift public.fdj_shifts;
  v_liste jsonb;
begin
  v_shift := public.fdj_quart_du_manager(p_shift_id);

  select coalesce(jsonb_agg(
           jsonb_build_object(
             'id', d.id,
             'cree_le', d.cree_le,
             'demandeur_id', d.demandeur_id,
             'demandeur_nom', dem.nom,
             'employe_responsable_id', d.employe_responsable_id,
             'message', d.message,
             'statut', d.statut,
             'version_caisse_au_signalement', d.version_caisse_au_signalement,
             'ecart_au_signalement', d.ecart_au_signalement,
             'valide_le_au_signalement', d.valide_le_au_signalement,
             'traite_par', d.traite_par,
             'traite_par_nom', trt.nom,
             'traite_le', d.traite_le,
             'reponse_manager', d.reponse_manager
           )
           order by d.cree_le desc
         ), '[]'::jsonb)
    into v_liste
    from public.fdj_demandes_correction d
    left join public.employees dem on dem.id = d.demandeur_id
    left join public.employees trt on trt.id = d.traite_par
   where d.shift_id = p_shift_id;

  return jsonb_build_object(
    'shift_id', p_shift_id,
    'site', v_shift.site,
    'demandes', v_liste
  );
end;
$$;

comment on function public.fdj_demandes_correction_du_quart(uuid) is
  'Demandes de correction d''un quart, réservées au manager du site. Chaînon '
  'manquant de fdj_traiter_demande_correction : sans elle, l''écran manager '
  'ignorait jusqu''à l''identifiant des demandes à arbitrer.';

-- -----------------------------------------------------------------------------
-- 4. DROITS — ACL ÉCRITE, JAMAIS HÉRITÉE
-- -----------------------------------------------------------------------------
-- `revoke … from public` ne ferme pas `anon` : Supabase accorde EXECUTE par
-- des grants nommés. `anon` est donc révoqué explicitement, fonction par
-- fonction.
do $$
declare
  v_sig text;
  v_signatures text[] := array[
    'public.fdj_saisir_caisse_manager(uuid, numeric, text, numeric, text, text, text)',
    'public.fdj_demandes_correction_du_quart(uuid)'
  ];
begin
  foreach v_sig in array v_signatures loop
    execute format('revoke all on function %s from public', v_sig);
    execute format('revoke all on function %s from anon', v_sig);
    execute format('grant execute on function %s to authenticated', v_sig);
    execute format('grant execute on function %s to service_role', v_sig);
  end loop;
end;
$$;

-- =============================================================================
-- RETOUR ARRIÈRE
-- -----------------------------------------------------------------------------
--   drop function if exists public.fdj_demandes_correction_du_quart(uuid);
--   drop function if exists public.fdj_saisir_caisse_manager(uuid, numeric, text, numeric, text, text, text);
--
--   -- Les deux CHECK ne sont remis dans leur forme d'origine que si AUCUNE
--   -- ligne `saisie_manager` n'a été écrite : sinon le retour arrière
--   -- échouerait sur une table dont le trigger d'immuabilité interdit par
--   -- ailleurs de supprimer la ligne fautive.
--   -- select count(*) from public.fdj_caisse_evenements where evenement = 'saisie_manager';
--   -- alter table public.fdj_caisse_evenements drop constraint fdj_caisse_evenements_evenement_check;
--   -- alter table public.fdj_caisse_evenements add constraint fdj_caisse_evenements_evenement_check
--   --   check (evenement in ('confirmation_initiale','correction_employe','ouverture_controle',
--   --                        'correction_manager','validation','reouverture','demande_correction'));
--   -- alter table public.fdj_caisse_evenements drop constraint fdj_caisse_evenements_versions_check;
--   -- alter table public.fdj_caisse_evenements add constraint fdj_caisse_evenements_versions_check
--   --   check ((version_avant is null and version_apres is null)
--   --          or (version_avant is null and version_apres is not null and evenement = 'confirmation_initiale')
--   --          or (version_avant is not null and version_apres is not null and version_apres >= version_avant));
-- =============================================================================
