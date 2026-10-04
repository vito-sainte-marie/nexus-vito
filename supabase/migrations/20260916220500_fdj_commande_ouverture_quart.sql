-- =============================================================================
-- FDJ — VAGUE 1 — PHASE A (« ÉTENDRE »)
-- Commande serveur : ouvrir le quart FDJ à partir d'une prise de poste explicite.
-- =============================================================================
--
-- CE QUE CETTE COMMANDE REMPLACE
-- ------------------------------
-- Aujourd'hui, `obtenirOuCreerShift()` (NEXUS-FDJ-v1.html) fait un INSERT direct
-- depuis le navigateur, au chargement de l'écran, en attribuant le quart à
-- quiconque a ouvert la page. Cette commande fait l'inverse sur les trois points
-- qui comptent :
--   * elle n'est appelable qu'à partir d'un événement de prise de poste réel ;
--   * elle attribue le quart au titulaire de cette prise de poste, jamais au
--     visiteur ;
--   * elle refuse de réattribuer silencieusement un quart déjà porté par
--     quelqu'un d'autre.
--
-- CE QU'ELLE NE CRÉE PAS
-- ----------------------
-- « L'ouverture ne doit créer aucune caisse confirmée, aucune validation, aucun
--   mouvement de livret, aucune activation, aucun stock fictif, aucune valeur
--   d'inventaire inventée. »
-- Elle écrit dans EXACTEMENT une table : public.fdj_shifts. Rien d'autre.
--
-- CE QU'ELLE N'EST PAS
-- --------------------
-- Elle n'est pas appelée à la connexion, ni à l'arrivée sur l'accueil, ni à
-- l'ouverture de l'écran FDJ, ni lors d'une consultation, ni lors d'une
-- navigation hors service, ni lors de la consultation d'un manager. Elle est
-- appelée par le parcours de prise de poste, et seulement par lui.
-- =============================================================================

create or replace function public.fdj_ouvrir_quart_depuis_prise_de_poste(
  p_prise_de_poste_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_pdp record;
  v_numero text;
  v_date date;
  v_existant record;
begin
  -- 1. Identité — jamais un identifiant fourni par le navigateur.
  if v_uid is null then
    raise exception 'Authentification requise' using errcode = 'insufficient_privilege';
  end if;

  if p_prise_de_poste_id is null then
    raise exception 'Prise de poste non identifiée' using errcode = 'invalid_parameter_value';
  end if;

  -- 2. L'événement source doit exister.
  select s.id, s.employee_id, s.site_id, s.quart, s.role, s.statut, s.heure_debut
    into v_pdp
    from public.shifts s
   where s.id = p_prise_de_poste_id;

  if not found then
    raise exception 'Prise de poste introuvable' using errcode = 'no_data_found';
  end if;

  -- 3. Nul ne prend son poste à la place d'un autre.
  --    Une reprise par un tiers passe par fdj_transferer_responsabilite_quart().
  if v_pdp.employee_id is distinct from v_uid then
    raise exception 'Cette prise de poste appartient à un autre employé'
      using errcode = 'insufficient_privilege';
  end if;

  -- 4. Seule une prise de poste EN COURS ouvre un quart. Une prise de poste
  --    terminée, close ou de test n'ouvre rien.
  if v_pdp.statut is distinct from 'en_cours' then
    return jsonb_build_object(
      'ouvert', false,
      'motif', 'prise_de_poste_non_active',
      'message', 'Cette prise de poste n''est plus en cours.'
    );
  end if;

  -- 5. Le mode managérial n'ouvre pas de quart FDJ.
  --    « Un manager ne devient responsable d'un quart que s'il prend réellement
  --      son poste en mode employé. »
  if v_pdp.role = 'manager' then
    return jsonb_build_object(
      'ouvert', false,
      'motif', 'prise_de_poste_managerial',
      'message', 'Une prise de poste en mode manager n''ouvre pas de quart FDJ.'
    );
  end if;

  -- 6. Quel numéro de quart FDJ ? On ne redécide rien : on traduit la décision
  --    déjà prise et tracée au moment de la prise de poste.
  v_numero := public.fdj_numero_quart_depuis_prise_de_poste(v_pdp.quart);
  if v_numero is null then
    return jsonb_build_object(
      'ouvert', false,
      'motif', 'quart_non_applicable',
      'quart_prise_de_poste', v_pdp.quart,
      'message', 'Ce quart ne correspond à aucun quart FDJ numéroté.'
    );
  end if;

  -- 7. Date métier depuis le fuseau du site, jamais depuis l'appareil.
  v_date := public.fdj_date_metier(v_pdp.site_id, v_pdp.heure_debut);

  -- 8. Idempotence forte : le même événement de prise de poste ne peut pas
  --    ouvrir deux quarts. C'est le cas d'un double clic, d'un rechargement,
  --    ou d'un retour en arrière du navigateur.
  select f.* into v_existant
    from public.fdj_shifts f
   where f.prise_de_poste_id = p_prise_de_poste_id;

  if found then
    return jsonb_build_object(
      'ouvert', true,
      'deja_ouvert', true,
      'motif', 'idempotence_prise_de_poste',
      'shift_id', v_existant.id,
      'site', v_existant.site,
      'date', v_existant.date,
      'quart', v_existant.quart,
      'employee_id', v_existant.employee_id
    );
  end if;

  -- 9. Un quart existe-t-il déjà pour ce site, cette date métier et ce numéro ?
  select f.* into v_existant
    from public.fdj_shifts f
   where f.site = v_pdp.site_id
     and f.date = v_date
     and f.quart = v_numero;

  if found then
    -- 9a. Même responsable : on retourne l'existant et on le relie à son
    --     événement source s'il ne l'était pas encore. On ne réécrit ni le
    --     responsable, ni la date, ni le statut.
    if v_existant.employee_id = v_uid then
      if v_existant.prise_de_poste_id is null then
        update public.fdj_shifts
           set prise_de_poste_id = p_prise_de_poste_id,
               ouverture_source  = coalesce(ouverture_source, 'prise_de_poste')
         where id = v_existant.id;
      end if;

      return jsonb_build_object(
        'ouvert', true,
        'deja_ouvert', true,
        'motif', 'quart_existant_meme_responsable',
        'shift_id', v_existant.id,
        'site', v_existant.site,
        'date', v_existant.date,
        'quart', v_existant.quart,
        'employee_id', v_existant.employee_id
      );
    end if;

    -- 9b. Autre responsable — ou responsable inconnu. On ne réattribue JAMAIS
    --     silencieusement. On signale le conflit et on exige une reprise
    --     managériale explicite, justifiée et journalisée.
    --     Le cas « responsable inconnu » (employee_id NULL, présent sur des
    --     quarts historiques) est traité comme un conflit et non comme une
    --     place vacante : personne ne devient responsable d'un quart existant
    --     par le seul fait d'arriver après.
    return jsonb_build_object(
      'ouvert', false,
      'conflit', true,
      'motif', case when v_existant.employee_id is null
                    then 'quart_existant_responsable_inconnu'
                    else 'quart_existant_autre_responsable' end,
      'shift_id', v_existant.id,
      'site', v_existant.site,
      'date', v_existant.date,
      'quart', v_existant.quart,
      'responsable_actuel_id', v_existant.employee_id,
      'message', 'Ce quart FDJ est déjà ouvert au nom d''une autre personne. '
                 'Une reprise doit être décidée et motivée par un manager.'
    );
  end if;

  -- 10. Ouverture. Une seule écriture, une seule table.
  begin
    insert into public.fdj_shifts (
      site, date, quart, employee_id, statut, ouvert_le,
      prise_de_poste_id, created_by, ouverture_source
    ) values (
      v_pdp.site_id, v_date, v_numero, v_uid, 'brouillon', now(),
      p_prise_de_poste_id, v_uid, 'prise_de_poste'
    )
    returning * into v_existant;
  exception
    when unique_violation then
      -- Concurrence : deux appels simultanés, ou deux employés qui prennent
      -- leur poste au même instant sur le même quart. On relit et on applique
      -- exactement la même règle qu'au point 9.
      select f.* into v_existant
        from public.fdj_shifts f
       where (f.prise_de_poste_id = p_prise_de_poste_id)
          or (f.site = v_pdp.site_id and f.date = v_date and f.quart = v_numero)
       limit 1;

      if not found then
        raise;
      end if;

      if v_existant.employee_id is distinct from v_uid then
        return jsonb_build_object(
          'ouvert', false,
          'conflit', true,
          'motif', 'quart_existant_autre_responsable',
          'shift_id', v_existant.id,
          'responsable_actuel_id', v_existant.employee_id,
          'message', 'Ce quart FDJ vient d''être ouvert au nom d''une autre personne.'
        );
      end if;

      return jsonb_build_object(
        'ouvert', true,
        'deja_ouvert', true,
        'motif', 'concurrence_resolue',
        'shift_id', v_existant.id,
        'site', v_existant.site,
        'date', v_existant.date,
        'quart', v_existant.quart,
        'employee_id', v_existant.employee_id
      );
  end;

  -- Journal : l'ouverture est un fait, pas une valeur. Aucune caisse n'est
  -- créée, aucun stock n'est posé, aucun inventaire n'est supposé.
  insert into public.fdj_audit_log (
    site, shift_id, entite_type, entite_id, action,
    ancienne_valeur, nouvelle_valeur, acteur_id, motif, metadata
  ) values (
    v_pdp.site_id, v_existant.id, 'fdj_shift', v_existant.id,
    'fdj_quart_ouvert_par_prise_de_poste',
    null,
    jsonb_build_object(
      'date', v_existant.date,
      'quart', v_existant.quart,
      'employee_id', v_existant.employee_id,
      'prise_de_poste_id', p_prise_de_poste_id
    ),
    v_uid,
    'Ouverture naturelle depuis la prise de poste',
    jsonb_build_object('quart_prise_de_poste', v_pdp.quart, 'role_prise_de_poste', v_pdp.role)
  );

  return jsonb_build_object(
    'ouvert', true,
    'deja_ouvert', false,
    'motif', 'ouverture_naturelle',
    'shift_id', v_existant.id,
    'site', v_existant.site,
    'date', v_existant.date,
    'quart', v_existant.quart,
    'employee_id', v_existant.employee_id
  );
end;
$$;

comment on function public.fdj_ouvrir_quart_depuis_prise_de_poste(uuid) is
  'Ouvre le quart FDJ correspondant à une prise de poste opérationnelle '
  'explicite. Idempotente. N''écrit que dans fdj_shifts. Ne réattribue jamais '
  'un quart existant : elle signale le conflit.';

revoke all on function public.fdj_ouvrir_quart_depuis_prise_de_poste(uuid) from public;
revoke all on function public.fdj_ouvrir_quart_depuis_prise_de_poste(uuid) from anon;
grant execute on function public.fdj_ouvrir_quart_depuis_prise_de_poste(uuid) to authenticated;
grant execute on function public.fdj_ouvrir_quart_depuis_prise_de_poste(uuid) to service_role;


-- =============================================================================
-- Commande serveur : transférer explicitement la responsabilité d'un quart FDJ.
-- =============================================================================
-- C'est la seule voie par laquelle un quart change de responsable. Elle est
-- réservée au manager, elle exige un motif, et elle laisse une trace qui dit
-- qui était responsable avant.
create or replace function public.fdj_transferer_responsabilite_quart(
  p_shift_id uuid,
  p_nouveau_responsable_id uuid,
  p_motif text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_role text;
  v_site text;
  v_shift record;
  v_cible record;
begin
  if v_uid is null then
    raise exception 'Authentification requise' using errcode = 'insufficient_privilege';
  end if;

  -- Rôle et site lus EN BASE, jamais dans une métadonnée du client.
  select e.role, e.site_id into v_role, v_site
    from public.employees e where e.id = v_uid;

  if v_role is null or v_role not in ('manager', 'gerant') then
    raise exception 'Seul un manager peut transférer la responsabilité d''un quart'
      using errcode = 'insufficient_privilege';
  end if;

  if p_motif is null or length(btrim(p_motif)) < 5 then
    raise exception 'Un transfert de responsabilité exige un motif explicite'
      using errcode = 'invalid_parameter_value';
  end if;

  select f.* into v_shift from public.fdj_shifts f where f.id = p_shift_id;
  if not found then
    raise exception 'Quart FDJ introuvable' using errcode = 'no_data_found';
  end if;

  if v_shift.site is distinct from v_site then
    raise exception 'Ce quart ne relève pas de votre site'
      using errcode = 'insufficient_privilege';
  end if;

  select e.id, e.site_id into v_cible
    from public.employees e where e.id = p_nouveau_responsable_id;
  if not found then
    raise exception 'Nouveau responsable introuvable' using errcode = 'no_data_found';
  end if;
  if v_cible.site_id is distinct from v_site then
    raise exception 'Le nouveau responsable ne relève pas de ce site'
      using errcode = 'insufficient_privilege';
  end if;

  if v_shift.employee_id is not distinct from p_nouveau_responsable_id then
    return jsonb_build_object(
      'transfere', false,
      'motif', 'deja_responsable',
      'shift_id', v_shift.id
    );
  end if;

  update public.fdj_shifts
     set responsable_precedent_id   = employee_id,
         employee_id                = p_nouveau_responsable_id,
         responsable_transfere_par  = v_uid,
         responsable_transfere_le   = now(),
         motif_transfert            = btrim(p_motif),
         ouverture_source           = coalesce(ouverture_source, 'reprise_manager')
   where id = p_shift_id;

  insert into public.fdj_audit_log (
    site, shift_id, entite_type, entite_id, action,
    ancienne_valeur, nouvelle_valeur, acteur_id, motif
  ) values (
    v_shift.site, v_shift.id, 'fdj_shift', v_shift.id,
    'fdj_quart_responsabilite_transferee',
    jsonb_build_object('employee_id', v_shift.employee_id),
    jsonb_build_object('employee_id', p_nouveau_responsable_id),
    v_uid,
    btrim(p_motif)
  );

  return jsonb_build_object(
    'transfere', true,
    'shift_id', v_shift.id,
    'responsable_precedent_id', v_shift.employee_id,
    'responsable_id', p_nouveau_responsable_id
  );
end;
$$;

comment on function public.fdj_transferer_responsabilite_quart(uuid, uuid, text) is
  'Reprise managériale explicite d''un quart FDJ : seule voie de changement de '
  'responsable. Réservée au manager du site, motif obligatoire, journalisée.';

revoke all on function public.fdj_transferer_responsabilite_quart(uuid, uuid, text) from public;
revoke all on function public.fdj_transferer_responsabilite_quart(uuid, uuid, text) from anon;
grant execute on function public.fdj_transferer_responsabilite_quart(uuid, uuid, text) to authenticated;
grant execute on function public.fdj_transferer_responsabilite_quart(uuid, uuid, text) to service_role;

-- =============================================================================
-- RETOUR ARRIÈRE
-- -----------------------------------------------------------------------------
--   drop function if exists public.fdj_transferer_responsabilite_quart(uuid, uuid, text);
--   drop function if exists public.fdj_ouvrir_quart_depuis_prise_de_poste(uuid);
-- Le front servi n'appelle pas encore ces fonctions en Phase A : les supprimer
-- ne casse rien tant que la bascule (Phase B) n'a pas eu lieu.
-- =============================================================================
