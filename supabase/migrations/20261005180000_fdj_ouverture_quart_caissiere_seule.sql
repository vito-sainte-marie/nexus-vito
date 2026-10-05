-- =============================================================================
-- FDJ — Seule une prise de poste « caissiere » ouvre un quart FDJ.
-- =============================================================================
--
-- DÉFAUT
-- ------
-- fdj_ouvrir_quart_depuis_prise_de_poste (20260916220500) ne refusait que
-- role = 'manager'. Le 05/10/2026, une prise de poste « pompiste » a ouvert le
-- Q1 FDJ de vito-sainte-marie et en est devenue titulaire : la caissière,
-- arrivée ensuite, avait l'écran FDJ grisé jusqu'à un transfert manager.
--
-- ARBITRAGE (Frédéric, 05/10/2026)
-- --------------------------------
-- « un renfort ne peut pas tenir la caisse FDJ » ; caissière seule ouvre.
-- Pompiste, renfort, polyvalent et manager n'ouvrent rien.
--
-- PORTÉE
-- ------
-- Corps identique à 20260916220500 (md5(prosrc) Production 1f5cd304… mesuré le
-- 05/10/2026) sauf l'étape 5, devenue liste blanche. Nouveau motif de refus
-- `prise_de_poste_hors_caisse` ; `prise_de_poste_managerial` inchangé.
-- `create or replace` conserve propriétaire et ACL : aucun grant ni revoke ici.
-- Aucune donnée n'est touchée : les quarts déjà ouverts par un rôle hors caisse
-- restent tels quels (transfert manager existant).
-- Le front (NEXUS-Prise-De-Poste-v1.html) affiche déjà `message` quand
-- `ouvert` vaut false : aucun changement d'écran requis.
--
-- RETOUR ARRIÈRE
-- --------------
-- Réappliquer le bloc `create or replace function
-- public.fdj_ouvrir_quart_depuis_prise_de_poste` de 20260916220500 tel quel.
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

  -- 5. Seule une prise de poste « caissiere » ouvre un quart FDJ.
  --    Liste blanche, jamais liste noire : un rôle hors caisse (pompiste,
  --    renfort, polyvalent, ou tout rôle ajouté plus tard) qui arrive avant la
  --    caissière deviendrait titulaire du quart et la bloquerait.
  --    « Un manager ne devient responsable d'un quart que s'il prend réellement
  --      son poste en mode employé. » — le motif managérial est conservé.
  if v_pdp.role = 'manager' then
    return jsonb_build_object(
      'ouvert', false,
      'motif', 'prise_de_poste_managerial',
      'message', 'Une prise de poste en mode manager n''ouvre pas de quart FDJ.'
    );
  end if;

  if v_pdp.role is distinct from 'caissiere' then
    return jsonb_build_object(
      'ouvert', false,
      'motif', 'prise_de_poste_hors_caisse',
      'role_prise_de_poste', v_pdp.role,
      'message', 'Une prise de poste ' || coalesce(v_pdp.role, 'sans rôle')
                 || ' n''ouvre pas de quart FDJ : seule la caissière tient la caisse FDJ.'
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
