-- ============================================================================
-- FDJ — Vague 1, Phase A (« ÉTENDRE ») — Commandes serveur du manager
--
-- Mandat « Refonte FDJ, Vague 1 », §3.5 (alertes managériales),
-- §3.6 (validation managériale), §3.7 (suite d'une demande après validation)
-- et §5.3 (« des commandes serveur distinctes »).
--
-- Commandes créées :
--   1. public.fdj_ouvrir_controle_caisse(...)       — §3.6 « Contrôler la caisse »
--   2. public.fdj_valider_caisse(...)               — §3.6 « Valider la caisse »
--   3. public.fdj_rouvrir_caisse(...)               — §3.6 réouverture justifiée
--   4. public.fdj_corriger_caisse_manager(...)      — §3.6 correction managériale
--   5. public.fdj_traiter_demande_correction(...)   — §3.7
-- Lectures de contrôle :
--   6. public.fdj_chronologie_caisse(...)           — §3.4 « chronologie manager
--                                                     intelligible »
--   7. public.fdj_alertes_caisse(...)               — §3.5
--
-- ---------------------------------------------------------------------------
-- §3.6 — CE QUE L'EMPLOYÉ NE DOIT JAMAIS POUVOIR ÉCRIRE
--   l'état « validée » ; valide_par ; valide_le ; un motif interne manager ;
--   le résultat définitif.
-- Ces cinq écritures n'existent QUE dans les fonctions ci-dessous, qui
-- vérifient toutes le rôle EN BASE (public.employees.role), jamais une
-- métadonnée fournie par le client (§5.2).
--
-- ---------------------------------------------------------------------------
-- VOCABULAIRE IMPOSÉ (§3.6) — côté manager : « Contrôler la caisse »,
-- « Valider la caisse », « Excédent », « Manquant », « Conforme ».
-- Ce vocabulaire est produit ici par fdj_libelle_ecart_manager(), afin que
-- les écrans ne le réinventent pas chacun de leur côté.
--
-- ---------------------------------------------------------------------------
-- ARBITRAGES DOCUMENTÉS
--
-- (a) LES INDICATEURS DU §3.5 SONT CALCULÉS, JAMAIS STOCKÉS.
--     La table fdj_alertes existe déjà mais porte un autre objet (les
--     anomalies de stock : type défaut 'stock_initial_modifie',
--     valeur_quart_precedent, game_id…). Y écrire des alertes de caisse
--     mélangerait deux registres et fabriquerait des lignes historiques.
--     fdj_alertes_caisse() les DÉRIVE du journal fdj_caisse_evenements à
--     chaque appel. Aucune donnée n'est inventée, rien n'est à purger, et
--     l'indicateur suit automatiquement les corrections ultérieures.
--
-- (b) LES SEUILS SONT DES VALEURS PAR DÉFAUT EN ATTENTE D'ARBITRAGE.
--     Le §3.5 nomme « correction tardive » et « variation importante » sans
--     fixer de seuil, et le §3.3 interdit le vocabulaire « petit / grand
--     écart ». Les seuils sont donc des PARAMÈTRES de fdj_alertes_caisse(),
--     avec des valeurs par défaut explicites et signalées comme telles dans
--     la réponse (clé 'seuils_appliques'). Aucun de ces seuils ne qualifie
--     quoi que ce soit de fraude : le §3.5 l'interdit explicitement — ils
--     ordonnent le travail de contrôle, rien de plus.
--
-- (c) « a_revoir » ET « non_comparable » NE SONT PAS DES VALIDATIONS.
--     resultat_controle accepte cinq valeurs. Trois closent le contrôle
--     (conforme, avec_ecart, a_regulariser) et posent valide_par/valide_le.
--     Deux ne le closent pas (a_revoir, non_comparable) : la caisse retourne
--     à l'employé en 'en_attente', SANS valide_le. Poser valide_le sur une
--     caisse « à revoir » interdirait à l'employé de corriger (§3.4) tout en
--     lui demandant de le faire.
--
-- (d) LA CORRECTION MANAGÉRIALE NE TOUCHE PAS LE CONSTAT D'ORIGINE.
--     caisse_reelle_origine et ecart_origine sont protégés par le trigger
--     fdj_cash_controls_proteger_origine_trg. Ils ne figurent dans aucun
--     UPDATE ici : la déclaration initiale de l'employé reste lisible après
--     n'importe quelle correction managériale.
--
-- AUCUNE DONNÉE EXISTANTE N'EST LUE, ÉCRITE NI CORRIGÉE PAR CETTE MIGRATION.
-- Elle ne crée que des fonctions.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. VOCABULAIRE MANAGER (§3.6)
-- ----------------------------------------------------------------------------

create or replace function public.fdj_libelle_ecart_manager(p_ecart numeric)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
           when p_ecart is null then 'Non comparable'
           when p_ecart = 0     then 'Conforme'
           when p_ecart > 0     then 'Excédent : +' || to_char(p_ecart, 'FM999999990.00') || ' €'
           else                      'Manquant : ' || to_char(p_ecart, 'FM999999990.00') || ' €'
         end;
$$;

comment on function public.fdj_libelle_ecart_manager(numeric) is
  'Mandat §3.6 — vocabulaire manager : Conforme / Excédent / Manquant. Jamais « petit » ni « grand » écart (§3.3).';

-- ----------------------------------------------------------------------------
-- 2. GARDE D'ACCÈS MANAGER (§5.2)
--    « Les contrôles doivent être fondés sur l'utilisateur authentifié, son
--      rôle enregistré en base, son rattachement au site […]. Ne pas fonder
--      une décision de sécurité sur une métadonnée modifiable côté client. »
-- ----------------------------------------------------------------------------

create or replace function public.fdj_quart_du_manager(p_shift_id uuid)
returns public.fdj_shifts
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid   uuid;
  v_role  text;
  v_site  text;
  v_shift public.fdj_shifts;
begin
  v_uid := (select auth.uid());
  if v_uid is null then
    raise exception 'Aucune session authentifiée : opération refusée.'
      using errcode = 'insufficient_privilege';
  end if;

  if p_shift_id is null then
    raise exception 'Identifiant de quart FDJ manquant.'
      using errcode = 'invalid_parameter_value';
  end if;

  -- Rôle ET site lus en base, sur la ligne employees de l'utilisateur
  -- authentifié. Rien de tout cela ne transite par le navigateur.
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

  select * into v_shift from public.fdj_shifts s where s.id = p_shift_id;
  if not found then
    raise exception 'Quart FDJ introuvable.' using errcode = 'no_data_found';
  end if;

  if v_shift.site is distinct from v_site then
    raise exception 'Ce quart FDJ appartient à un autre site.'
      using errcode = 'insufficient_privilege';
  end if;

  return v_shift;
end;
$$;

comment on function public.fdj_quart_du_manager(uuid) is
  'Garde commune aux commandes manager : identité authentifiée, rôle et site lus en base (§5.2). Lève une exception sinon.';

-- ----------------------------------------------------------------------------
-- 3. COMMANDE §3.6 — « Contrôler la caisse »
--    Ouvre le contrôle. N'arrête RIEN : l'employé peut encore corriger tant
--    que la validation n'est pas prononcée (§3.4). Le fait que le contrôle
--    ait commencé est simplement horodaté, et alimente l'indicateur
--    « correction après début du contrôle manager » (§3.5).
-- ----------------------------------------------------------------------------

create or replace function public.fdj_ouvrir_controle_caisse(p_shift_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shift public.fdj_shifts;
  v_uid   uuid := (select auth.uid());
  v_cash  public.fdj_cash_controls;
begin
  v_shift := public.fdj_quart_du_manager(p_shift_id);

  select * into v_cash from public.fdj_cash_controls c where c.shift_id = p_shift_id for update;
  if not found then
    raise exception 'Aucune caisse enregistrée pour ce quart.' using errcode = 'no_data_found';
  end if;

  if v_cash.confirme_le is null then
    return jsonb_build_object(
      'controle_ouvert', false,
      'motif', 'caisse_non_confirmee',
      'message', 'Cette caisse n''a pas encore été confirmée par l''employé.'
    );
  end if;

  if v_cash.valide_le is not null then
    return jsonb_build_object(
      'controle_ouvert', false,
      'motif', 'caisse_deja_validee',
      'message', 'Cette caisse est déjà validée. Une réouverture explicite est nécessaire.'
    );
  end if;

  -- IDEMPOTENCE (§5.3) : rouvrir l'écran de contrôle ne réécrit pas
  -- controle_le et ne produit pas un second événement.
  if v_cash.controle_le is not null then
    return jsonb_build_object(
      'controle_ouvert', true,
      'idempotent', true,
      'controle_par', v_cash.controle_par,
      'controle_le', v_cash.controle_le,
      'ecart', v_cash.ecart,
      'libelle_ecart', public.fdj_libelle_ecart_manager(v_cash.ecart)
    );
  end if;

  update public.fdj_cash_controls
     set controle_par = v_uid,
         controle_le  = now(),
         statut       = 'a_controler',
         updated_at   = now()
   where shift_id = p_shift_id;

  insert into public.fdj_caisse_evenements (
    site, cash_control_id, shift_id, evenement, auteur_id, auteur_role,
    employe_responsable_id, confirmation_initiale_le,
    version_avant, version_apres, nb_corrections_apres,
    statut_avant, statut_apres, ecart_avant, ecart_apres, metadata
  )
  values (
    v_shift.site, v_cash.id, p_shift_id, 'ouverture_controle', v_uid, 'manager',
    v_shift.employee_id, v_cash.confirme_le,
    v_cash.version, v_cash.version, v_cash.nb_corrections,
    v_cash.statut, 'a_controler', v_cash.ecart, v_cash.ecart,
    jsonb_build_object('source', 'fdj_ouvrir_controle_caisse')
  );

  return jsonb_build_object(
    'controle_ouvert', true,
    'idempotent', false,
    'controle_par', v_uid,
    'ecart', v_cash.ecart,
    'libelle_ecart', public.fdj_libelle_ecart_manager(v_cash.ecart),
    'version', v_cash.version,
    'nb_corrections', v_cash.nb_corrections
  );
end;
$$;

comment on function public.fdj_ouvrir_controle_caisse(uuid) is
  'Mandat §3.6 — « Contrôler la caisse ». Horodate l''ouverture du contrôle sans figer la caisse : l''employé peut encore corriger (§3.4).';

-- ----------------------------------------------------------------------------
-- 4. COMMANDE §3.6 — « Valider la caisse »
--    Seul le manager retient le résultat définitif et saisit le motif interne.
--    p_resultat_controle ∈ conforme | avec_ecart | a_regulariser  → validation
--                        ∈ a_revoir | non_comparable             → renvoi (c)
-- ----------------------------------------------------------------------------

create or replace function public.fdj_valider_caisse(
  p_shift_id          uuid,
  p_resultat_controle text,
  p_motif_interne     text default null,
  p_motif_ecart       text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shift  public.fdj_shifts;
  v_uid    uuid := (select auth.uid());
  v_cash   public.fdj_cash_controls;
  v_statut text;
  v_valide boolean;
  v_motif_ecart text;
begin
  v_shift := public.fdj_quart_du_manager(p_shift_id);

  if p_resultat_controle is null
     or p_resultat_controle not in ('conforme', 'avec_ecart', 'a_regulariser', 'a_revoir', 'non_comparable') then
    raise exception 'Résultat de contrôle inconnu : %', coalesce(p_resultat_controle, '(vide)')
      using errcode = 'invalid_parameter_value';
  end if;

  select * into v_cash from public.fdj_cash_controls c where c.shift_id = p_shift_id for update;
  if not found then
    raise exception 'Aucune caisse enregistrée pour ce quart.' using errcode = 'no_data_found';
  end if;

  if v_cash.confirme_le is null then
    return jsonb_build_object(
      'valide', false,
      'motif', 'caisse_non_confirmee',
      'message', 'Cette caisse n''a pas encore été confirmée par l''employé.'
    );
  end if;

  -- IDEMPOTENCE : valider deux fois ne produit pas deux validations.
  if v_cash.valide_le is not null then
    return jsonb_build_object(
      'valide', true,
      'idempotent', true,
      'motif', 'caisse_deja_validee',
      'valide_par', v_cash.valide_par,
      'valide_le', v_cash.valide_le,
      'resultat_controle', v_cash.resultat_controle,
      'ecart_retenu', v_cash.ecart,
      'libelle_ecart', public.fdj_libelle_ecart_manager(v_cash.ecart)
    );
  end if;

  -- Un résultat « avec écart » ou « à régulariser » sans motif interne
  -- laisserait le contrôle sans trace de raisonnement.
  if p_resultat_controle in ('avec_ecart', 'a_regulariser', 'a_revoir')
     and (p_motif_interne is null or length(btrim(p_motif_interne)) < 3) then
    raise exception 'Un motif interne d''au moins 3 caractères est obligatoire pour ce résultat de contrôle.'
      using errcode = 'invalid_parameter_value';
  end if;

  -- `motif_ecart` est un CODE énuméré (le menu déroulant de l'écran
  -- manager), distinct de `motif_ecart_texte` qui est le commentaire
  -- interne. Il était jusqu'ici la seule colonne du cycle de caisse
  -- qu'aucune commande serveur n'écrivait : la bascule de l'écran manager
  -- (Vague 1, point 4) l'aurait donc silencieusement perdue. Trois cas :
  --   null  → la colonne n'est pas touchée (appelants à trois arguments) ;
  --   ''    → le motif est effacé (il n'y a plus rien à expliquer) ;
  --   code  → contrôlé contre la liste, puis retenu.
  v_motif_ecart := nullif(btrim(coalesce(p_motif_ecart, '')), '');
  if v_motif_ecart is not null
     and v_motif_ecart not in ('remboursement', 'erreur_saisie', 'erreur_comptage',
                               'erreur_montant_caisse', 'carnet_non_declare',
                               'mouvement_oublie', 'erreur_rapport',
                               'correction_verification', 'autre', 'non_explique') then
    raise exception 'Motif d''écart inconnu : %', p_motif_ecart
      using errcode = 'invalid_parameter_value';
  end if;

  -- (c) — seules trois valeurs closent le contrôle.
  v_valide := p_resultat_controle in ('conforme', 'avec_ecart', 'a_regulariser');
  v_statut := case p_resultat_controle
                when 'conforme'       then 'conforme'
                when 'avec_ecart'     then 'valide_avec_ecart'
                when 'a_regulariser'  then 'a_regulariser'
                else 'en_attente'
              end;

  update public.fdj_cash_controls
     set statut            = v_statut,
         resultat_controle = p_resultat_controle,
         motif_ecart       = case when p_motif_ecart is null
                                  then v_cash.motif_ecart
                                  else v_motif_ecart end,
         motif_ecart_texte = nullif(btrim(coalesce(p_motif_interne, '')), ''),
         valide_par        = case when v_valide then v_uid else null end,
         valide_le         = case when v_valide then now() else null end,
         controle_par      = coalesce(v_cash.controle_par, v_uid),
         controle_le       = coalesce(v_cash.controle_le, now()),
         updated_at        = now()
   where shift_id = p_shift_id;

  insert into public.fdj_caisse_evenements (
    site, cash_control_id, shift_id, evenement, auteur_id, auteur_role,
    employe_responsable_id, confirmation_initiale_le,
    version_avant, version_apres, nb_corrections_apres,
    statut_avant, statut_apres, ecart_avant, ecart_apres, commentaire, metadata
  )
  values (
    v_shift.site, v_cash.id, p_shift_id, 'validation', v_uid, 'manager',
    v_shift.employee_id, v_cash.confirme_le,
    v_cash.version, v_cash.version, v_cash.nb_corrections,
    v_cash.statut, v_statut, v_cash.ecart, v_cash.ecart,
    -- Le motif interne est conservé dans le journal, qui n'est lisible ni
    -- par anon ni par authenticated (§4 : « aucun commentaire interne
    -- manager » ne doit atteindre l'employé).
    nullif(btrim(coalesce(p_motif_interne, '')), ''),
    jsonb_build_object(
      'resultat_controle', p_resultat_controle,
      'validation_prononcee', v_valide,
      'source', 'fdj_valider_caisse'
    )
  );

  insert into public.fdj_audit_log (site, shift_id, entite_type, entite_id, action, acteur_id, ancienne_valeur, nouvelle_valeur, motif)
  values (
    v_shift.site, p_shift_id, 'fdj_cash_control', v_cash.id,
    case when v_valide then 'fdj_caisse_validee_par_manager' else 'fdj_caisse_renvoyee_par_manager' end,
    v_uid,
    jsonb_build_object('statut', v_cash.statut),
    jsonb_build_object('statut', v_statut, 'resultat_controle', p_resultat_controle),
    nullif(btrim(coalesce(p_motif_interne, '')), '')
  );

  return jsonb_build_object(
    'valide', v_valide,
    'idempotent', false,
    'statut', v_statut,
    'resultat_controle', p_resultat_controle,
    'ecart_retenu', case when v_valide then v_cash.ecart else null end,
    'libelle_ecart', public.fdj_libelle_ecart_manager(v_cash.ecart),
    'message', case when v_valide
                    then 'Caisse validée.'
                    else 'Caisse renvoyée à l''employé pour révision : elle reste corrigeable.' end
  );
end;
$$;

comment on function public.fdj_valider_caisse(uuid, text, text, text) is
  'Mandat §3.6 — « Valider la caisse ». Seul un manager habilité écrit valide_par / valide_le / resultat_controle / motif interne.';

-- ----------------------------------------------------------------------------
-- 5. COMMANDE §3.6 / §3.7 — réouverture explicite
--    « Toute réouverture doit être justifiée et journalisée. »
-- ----------------------------------------------------------------------------

create or replace function public.fdj_rouvrir_caisse(
  p_shift_id uuid,
  p_motif    text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shift public.fdj_shifts;
  v_uid   uuid := (select auth.uid());
  v_cash  public.fdj_cash_controls;
begin
  v_shift := public.fdj_quart_du_manager(p_shift_id);

  if p_motif is null or length(btrim(p_motif)) < 5 then
    raise exception 'Un motif d''au moins 5 caractères est obligatoire pour rouvrir une caisse validée.'
      using errcode = 'invalid_parameter_value';
  end if;

  select * into v_cash from public.fdj_cash_controls c where c.shift_id = p_shift_id for update;
  if not found then
    raise exception 'Aucune caisse enregistrée pour ce quart.' using errcode = 'no_data_found';
  end if;

  if v_cash.valide_le is null then
    return jsonb_build_object(
      'rouverte', false,
      'motif', 'caisse_non_validee',
      'message', 'Cette caisse n''est pas validée : il n''y a rien à rouvrir.'
    );
  end if;

  -- La validation est retirée : la caisse redevient une caisse confirmée
  -- en attente de contrôle, donc à nouveau corrigeable par l'employé (§3.4).
  -- Le CHECK fdj_cash_controls_validation_complete_check impose que
  -- valide_par et valide_le soient nuls ou non nuls ENSEMBLE.
  update public.fdj_cash_controls
     set statut            = 'confirmee',
         valide_par        = null,
         valide_le         = null,
         resultat_controle = null,
         updated_at        = now()
   where shift_id = p_shift_id;

  insert into public.fdj_caisse_evenements (
    site, cash_control_id, shift_id, evenement, auteur_id, auteur_role,
    employe_responsable_id, confirmation_initiale_le,
    version_avant, version_apres, nb_corrections_apres,
    statut_avant, statut_apres, ecart_avant, ecart_apres, motif, metadata
  )
  values (
    v_shift.site, v_cash.id, p_shift_id, 'reouverture', v_uid, 'manager',
    v_shift.employee_id, v_cash.confirme_le,
    v_cash.version, v_cash.version, v_cash.nb_corrections,
    v_cash.statut, 'confirmee', v_cash.ecart, v_cash.ecart,
    btrim(p_motif),
    jsonb_build_object(
      'validation_retiree_de', v_cash.valide_par,
      'validation_retiree_le', v_cash.valide_le,
      'resultat_controle_retire', v_cash.resultat_controle,
      'source', 'fdj_rouvrir_caisse'
    )
  );

  insert into public.fdj_audit_log (site, shift_id, entite_type, entite_id, action, acteur_id, ancienne_valeur, nouvelle_valeur, motif)
  values (
    v_shift.site, p_shift_id, 'fdj_cash_control', v_cash.id,
    'fdj_caisse_rouverte_par_manager', v_uid,
    jsonb_build_object('statut', v_cash.statut, 'valide_par', v_cash.valide_par, 'valide_le', v_cash.valide_le),
    jsonb_build_object('statut', 'confirmee'),
    btrim(p_motif)
  );

  return jsonb_build_object(
    'rouverte', true,
    'statut', 'confirmee',
    'message', 'Caisse rouverte. Elle est de nouveau en attente du contrôle du manager.'
  );
end;
$$;

comment on function public.fdj_rouvrir_caisse(uuid, text) is
  'Mandat §3.6/§3.7 — réouverture explicite, justifiée et journalisée. Retire la validation ; ne modifie aucun montant.';

-- ----------------------------------------------------------------------------
-- 6. COMMANDE §3.6 — correction managériale
--    Distincte de la correction employé : elle s'applique aussi APRÈS
--    validation (le manager corrige ce qu'il a validé), et elle produit une
--    version de relevé de type 'regularisation_manager', pas
--    'correction_employe'.
-- ----------------------------------------------------------------------------

create or replace function public.fdj_corriger_caisse_manager(
  p_shift_id        uuid,
  p_motif           text,
  p_caisse_reelle   numeric default null,
  p_regularisations numeric default null,
  p_commentaire     text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shift public.fdj_shifts;
  v_uid   uuid := (select auth.uid());
  v_avant public.fdj_cash_controls;
  v_calc  jsonb;
  v_valeurs_avant jsonb;
begin
  v_shift := public.fdj_quart_du_manager(p_shift_id);

  if p_motif is null or length(btrim(p_motif)) < 5 then
    raise exception 'Un motif d''au moins 5 caractères est obligatoire pour une correction managériale.'
      using errcode = 'invalid_parameter_value';
  end if;

  select * into v_avant from public.fdj_cash_controls c where c.shift_id = p_shift_id for update;
  if not found then
    raise exception 'Aucune caisse enregistrée pour ce quart.' using errcode = 'no_data_found';
  end if;

  if v_avant.confirme_le is null then
    return jsonb_build_object(
      'corrige', false,
      'motif', 'caisse_non_confirmee',
      'message', 'Cette caisse n''a pas encore été confirmée par l''employé.'
    );
  end if;

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

  -- Le manager ne saisit pas les comptages par jeu ici : cette commande
  -- corrige les montants de caisse. La correction des comptages relève de
  -- l'outillage stock existant (nexus-fdj-correction-stock-depart.js), hors
  -- périmètre de cette vague.
  v_calc := public.fdj_calculer_caisse(
    p_shift_id,
    coalesce(p_caisse_reelle,   v_avant.caisse_reelle),
    coalesce(p_regularisations, v_avant.regularisations)
  );

  -- GUC remises à leur valeur « manager » de façon EXPLICITE : une commande
  -- employé exécutée plus tôt dans la même transaction aurait pu laisser
  -- nexus.fdj_correction_employe à 'true', et le trigger
  -- trg_fdj_sync_releve_apres_cash_control produirait alors une version de
  -- relevé étiquetée 'correction_employe' pour un geste du manager.
  perform set_config('nexus.fdj_correction_employe', 'false', true);
  perform set_config('nexus.fdj_correction_motif', p_motif, true);
  perform set_config('nexus.fdj_correction_commentaire', coalesce(p_commentaire, ''), true);

  update public.fdj_cash_controls
     set ventes_grattage_valeur = (v_calc->>'ventes_grattage_valeur')::numeric,
         lots_payes_grattage    = (v_calc->>'lots_payes_grattage')::numeric,
         caisse_grattage        = (v_calc->>'caisse_grattage')::numeric,
         caisse_tirages         = (v_calc->>'caisse_tirages')::numeric,
         regularisations        = (v_calc->>'regularisations')::numeric,
         caisse_attendue        = (v_calc->>'caisse_attendue')::numeric,
         caisse_reelle          = (v_calc->>'caisse_reelle')::numeric,
         ecart                  = (v_calc->>'ecart')::numeric,
         -- (d) : caisse_reelle_origine et ecart_origine restent intacts.
         version                = v_avant.version + 1,
         nb_corrections         = v_avant.nb_corrections + 1,
         derniere_correction_le = now(),
         updated_at             = now()
   where shift_id = p_shift_id;

  insert into public.fdj_caisse_evenements (
    site, cash_control_id, shift_id, evenement, auteur_id, auteur_role,
    employe_responsable_id, confirmation_initiale_le,
    version_avant, version_apres, nb_corrections_apres,
    statut_avant, statut_apres, valeurs_avant, valeurs_apres,
    ecart_avant, ecart_apres, motif, commentaire, metadata
  )
  values (
    v_shift.site, v_avant.id, p_shift_id, 'correction_manager', v_uid, 'manager',
    -- §2.4 : l'auteur de la saisie (le manager) et l'employé opérationnel
    -- concerné restent deux notions distinctes.
    v_shift.employee_id, v_avant.confirme_le,
    v_avant.version, v_avant.version + 1, v_avant.nb_corrections + 1,
    v_avant.statut, v_avant.statut,
    v_valeurs_avant, v_calc,
    v_avant.ecart, (v_calc->>'ecart')::numeric,
    btrim(p_motif), nullif(btrim(coalesce(p_commentaire, '')), ''),
    jsonb_build_object(
      'caisse_etait_validee', v_avant.valide_le is not null,
      'source', 'fdj_corriger_caisse_manager'
    )
  );

  if (v_calc->>'caisse_reelle')::numeric is distinct from v_avant.caisse_reelle then
    insert into public.fdj_corrections (
      site, shift_id, game_id, correction_type, old_value, new_value,
      reason_code, commentaire, created_by
    )
    values (
      v_shift.site, p_shift_id, null, 'caisse_reelle_manager',
      v_avant.caisse_reelle, (v_calc->>'caisse_reelle')::numeric,
      btrim(p_motif), nullif(btrim(coalesce(p_commentaire, '')), ''), v_uid
    );
  end if;

  insert into public.fdj_audit_log (site, shift_id, entite_type, entite_id, action, acteur_id, ancienne_valeur, nouvelle_valeur, motif)
  values (
    v_shift.site, p_shift_id, 'fdj_cash_control', v_avant.id,
    'fdj_caisse_corrigee_par_manager', v_uid,
    v_valeurs_avant, v_calc, btrim(p_motif)
  );

  return jsonb_build_object(
    'corrige', true,
    'version_precedente', v_avant.version,
    'version', v_avant.version + 1,
    'ecart_avant', v_avant.ecart,
    'ecart', (v_calc->>'ecart')::numeric,
    'libelle_ecart', public.fdj_libelle_ecart_manager((v_calc->>'ecart')::numeric),
    'caisse_reelle_origine_preservee', v_avant.caisse_reelle_origine,
    'ecart_origine_preserve', v_avant.ecart_origine
  );
end;
$$;

comment on function public.fdj_corriger_caisse_manager(uuid, text, numeric, numeric, text) is
  'Mandat §3.6 — correction managériale. Motif obligatoire, constat d''origine préservé, version de relevé « regularisation_manager ».';

-- ----------------------------------------------------------------------------
-- 7. COMMANDE §3.7 — suite donnée à une demande « Signaler une erreur »
--    « Le manager peut refuser, rouvrir explicitement, corriger, ou orienter
--      vers une régularisation. »
--    Cette commande N'ENCHAÎNE RIEN automatiquement : elle enregistre la
--    décision et sa justification. Rouvrir ou corriger reste un geste
--    explicite (fdj_rouvrir_caisse / fdj_corriger_caisse_manager), pour que
--    la réouverture porte toujours son propre motif journalisé.
-- ----------------------------------------------------------------------------

create or replace function public.fdj_traiter_demande_correction(
  p_demande_id uuid,
  p_decision   text,
  p_reponse    text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_demande public.fdj_demandes_correction;
  v_shift   public.fdj_shifts;
  v_uid     uuid := (select auth.uid());
begin
  if p_demande_id is null then
    raise exception 'Identifiant de demande manquant.' using errcode = 'invalid_parameter_value';
  end if;

  if p_decision is null
     or p_decision not in ('refusee', 'acceptee_reouverture', 'corrigee_par_manager', 'orientee_regularisation') then
    raise exception 'Décision inconnue : %', coalesce(p_decision, '(vide)')
      using errcode = 'invalid_parameter_value';
  end if;

  if p_reponse is null or length(btrim(p_reponse)) < 3 then
    raise exception 'Une réponse d''au moins 3 caractères est obligatoire : l''employé doit savoir ce qui a été décidé.'
      using errcode = 'invalid_parameter_value';
  end if;

  select * into v_demande from public.fdj_demandes_correction d where d.id = p_demande_id for update;
  if not found then
    raise exception 'Demande de correction introuvable.' using errcode = 'no_data_found';
  end if;

  -- La garde manager valide aussi le site, à partir du quart concerné.
  v_shift := public.fdj_quart_du_manager(v_demande.shift_id);

  if v_demande.statut <> 'ouverte' then
    return jsonb_build_object(
      'traitee', true,
      'idempotent', true,
      'motif', 'demande_deja_traitee',
      'statut', v_demande.statut,
      'traite_par', v_demande.traite_par,
      'traite_le', v_demande.traite_le
    );
  end if;

  update public.fdj_demandes_correction
     set statut          = p_decision,
         traite_par      = v_uid,
         traite_le       = now(),
         reponse_manager = btrim(p_reponse)
   where id = p_demande_id;

  insert into public.fdj_audit_log (site, shift_id, entite_type, entite_id, action, acteur_id, ancienne_valeur, nouvelle_valeur, motif)
  values (
    v_demande.site, v_demande.shift_id, 'fdj_demande_correction', p_demande_id,
    'fdj_demande_correction_traitee', v_uid,
    jsonb_build_object('statut', 'ouverte'),
    jsonb_build_object('statut', p_decision),
    btrim(p_reponse)
  );

  return jsonb_build_object(
    'traitee', true,
    'idempotent', false,
    'statut', p_decision,
    'reponse_manager', btrim(p_reponse),
    'geste_suivant', case p_decision
      when 'acceptee_reouverture'    then 'Rouvrir la caisse (fdj_rouvrir_caisse) avec son propre motif.'
      when 'corrigee_par_manager'    then 'Corriger la caisse (fdj_corriger_caisse_manager) avec son propre motif.'
      when 'orientee_regularisation' then 'Enregistrer un versement de régularisation (procédure distincte).'
      else 'Aucun : la demande est refusée et la caisse validée reste inchangée.'
    end
  );
end;
$$;

comment on function public.fdj_traiter_demande_correction(uuid, text, text) is
  'Mandat §3.7 — enregistre la décision du manager sur un signalement après validation. N''enchaîne aucune réouverture automatique.';

-- ----------------------------------------------------------------------------
-- 8. LECTURE §3.4 — chronologie manager intelligible
--    « Le manager doit pouvoir lire une chronologie intelligible. »
--    Une ligne par événement, dans l'ordre, avec ce qui a changé.
-- ----------------------------------------------------------------------------

create or replace function public.fdj_chronologie_caisse(p_shift_id uuid)
returns table (
  survenu_le              timestamptz,
  evenement               text,
  libelle                 text,
  auteur_id               uuid,
  auteur_nom              text,
  auteur_role             text,
  employe_responsable_id  uuid,
  version_avant           int,
  version_apres           int,
  nb_corrections_apres    int,
  statut_avant            text,
  statut_apres            text,
  ecart_avant             numeric,
  ecart_apres             numeric,
  libelle_ecart_apres     text,
  motif                   text,
  commentaire             text,
  valeurs_avant           jsonb,
  valeurs_apres           jsonb,
  delai_depuis_confirmation interval
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    e.survenu_le,
    e.evenement,
    case e.evenement
      when 'confirmation_initiale' then 'Caisse confirmée et transmise par l''employé'
      when 'correction_employe'    then 'Saisie corrigée par l''employé'
      when 'ouverture_controle'    then 'Contrôle ouvert par le manager'
      when 'correction_manager'    then 'Correction managériale'
      when 'validation'            then 'Caisse validée par le manager'
      when 'reouverture'           then 'Caisse rouverte par le manager'
      when 'demande_correction'    then 'Erreur signalée par l''employé après validation'
      else e.evenement
    end as libelle,
    e.auteur_id,
    emp.nom,
    e.auteur_role,
    e.employe_responsable_id,
    e.version_avant,
    e.version_apres,
    e.nb_corrections_apres,
    e.statut_avant,
    e.statut_apres,
    e.ecart_avant,
    e.ecart_apres,
    public.fdj_libelle_ecart_manager(e.ecart_apres),
    e.motif,
    e.commentaire,
    e.valeurs_avant,
    e.valeurs_apres,
    case when e.confirmation_initiale_le is null then null
         else e.survenu_le - e.confirmation_initiale_le end
  from public.fdj_caisse_evenements e
  left join public.employees emp on emp.id = e.auteur_id
  where e.shift_id = p_shift_id
    -- Le site du manager est vérifié ici : cette fonction est SECURITY
    -- DEFINER et contourne donc la RLS, comme toutes celles de ce fichier.
    and e.site = (select emp2.site_id from public.employees emp2 where emp2.id = (select auth.uid()))
    and (select emp3.role from public.employees emp3 where emp3.id = (select auth.uid())) in ('manager', 'gerant')
  order by e.survenu_le asc, e.version_apres asc nulls first;
$$;

comment on function public.fdj_chronologie_caisse(uuid) is
  'Mandat §3.4 — chronologie manager d''une caisse. Réservée aux managers du site : renvoie zéro ligne à tout autre appelant.';

-- ----------------------------------------------------------------------------
-- 9. LECTURE §3.5 — indicateurs d'aide au contrôle
--    « Ces indicateurs doivent aider au contrôle sans qualifier
--      automatiquement la correction de fraude. »
--    Aucun libellé produit ici ne porte de jugement : ce sont des faits
--    datés et des comptages.
-- ----------------------------------------------------------------------------

create or replace function public.fdj_alertes_caisse(
  p_shift_id                  uuid,
  p_seuil_correction_tardive_heures     numeric default 2,
  p_seuil_variation_importante_euros    numeric default 10,
  p_seuil_corrections_successives       int     default 2,
  p_seuil_frequence_employe_30j         int     default 5
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_shift  public.fdj_shifts;
  v_cash   public.fdj_cash_controls;
  v_nb_corr            int := 0;
  v_tardive            boolean := false;
  v_apres_controle     boolean := false;
  v_variation_max      numeric := 0;
  v_tentative_apres_validation int := 0;
  v_freq_employe       int := 0;
begin
  -- Réservé au manager du site.
  v_shift := public.fdj_quart_du_manager(p_shift_id);

  select * into v_cash from public.fdj_cash_controls c where c.shift_id = p_shift_id;
  if not found then
    return jsonb_build_object('caisse', null, 'indicateurs', '[]'::jsonb);
  end if;

  select count(*)::int,
         bool_or(e.survenu_le > e.confirmation_initiale_le
                 + make_interval(hours => floor(p_seuil_correction_tardive_heures)::int,
                                 mins  => round((p_seuil_correction_tardive_heures - floor(p_seuil_correction_tardive_heures)) * 60)::int)),
         bool_or((e.metadata->>'controle_manager_deja_ouvert')::boolean),
         coalesce(max(abs(coalesce(e.ecart_apres, 0) - coalesce(e.ecart_avant, 0))), 0)
    into v_nb_corr, v_tardive, v_apres_controle, v_variation_max
    from public.fdj_caisse_evenements e
   where e.shift_id = p_shift_id
     and e.evenement = 'correction_employe';

  -- « Tentative de modification après validation » : le §3.5 la demande en
  -- indicateur. Les tentatives REFUSÉES ne laissent volontairement aucune
  -- ligne (une commande qui refuse n'écrit rien). Ce qui est mesurable, et
  -- qui a le même sens de gestion, ce sont les signalements déposés après
  -- validation.
  select count(*)::int into v_tentative_apres_validation
    from public.fdj_demandes_correction d
   where d.cash_control_id = v_cash.id;

  -- Fréquence pour un même employé, tous quarts confondus, sur 30 jours.
  select count(*)::int into v_freq_employe
    from public.fdj_caisse_evenements e
   where e.evenement = 'correction_employe'
     and e.employe_responsable_id = v_shift.employee_id
     and e.site = v_shift.site
     and e.survenu_le >= now() - interval '30 days';

  return jsonb_build_object(
    'caisse', jsonb_build_object(
      'shift_id', p_shift_id,
      'statut', v_cash.statut,
      'version', v_cash.version,
      'nb_corrections', v_cash.nb_corrections,
      'confirme_le', v_cash.confirme_le,
      'controle_le', v_cash.controle_le,
      'valide_le', v_cash.valide_le,
      'ecart', v_cash.ecart,
      'libelle_ecart', public.fdj_libelle_ecart_manager(v_cash.ecart),
      'ecart_origine', v_cash.ecart_origine
    ),
    'indicateurs', jsonb_build_object(
      'corrigee_apres_confirmation',          v_nb_corr > 0,
      'corrections_successives',              v_nb_corr >= p_seuil_corrections_successives,
      'correction_tardive',                   coalesce(v_tardive, false),
      'variation_importante',                 v_variation_max >= p_seuil_variation_importante_euros,
      'variation_maximale_euros',             v_variation_max,
      'correction_apres_debut_controle',      coalesce(v_apres_controle, false),
      'signalements_apres_validation',        v_tentative_apres_validation,
      'corrections_employe_30_jours',         v_freq_employe,
      'frequence_inhabituelle_employe',       v_freq_employe >= p_seuil_frequence_employe_30j
    ),
    'seuils_appliques', jsonb_build_object(
      'correction_tardive_heures',   p_seuil_correction_tardive_heures,
      'variation_importante_euros',  p_seuil_variation_importante_euros,
      'corrections_successives',     p_seuil_corrections_successives,
      'frequence_employe_30j',       p_seuil_frequence_employe_30j,
      'valeurs_par_defaut_en_attente_arbitrage', true
    ),
    'avertissement',
      'Ces indicateurs aident au contrôle. Ils ne qualifient aucune correction de fraude.'
  );
end;
$$;

comment on function public.fdj_alertes_caisse(uuid, numeric, numeric, int, int) is
  'Mandat §3.5 — indicateurs d''aide au contrôle, dérivés du journal. Seuils paramétrables, valeurs par défaut en attente d''arbitrage.';

-- ----------------------------------------------------------------------------
-- 10. DROITS (§4) — ACL écrite, jamais héritée. anon révoqué explicitement.
--     `authenticated` reçoit EXECUTE, mais chaque fonction refuse elle-même
--     tout appelant qui n'est pas manager ou gérant du site : le droit
--     d'appeler n'est pas le droit d'agir.
-- ----------------------------------------------------------------------------

do $$
declare
  v_sig text;
  v_signatures text[] := array[
    'public.fdj_libelle_ecart_manager(numeric)',
    'public.fdj_quart_du_manager(uuid)',
    'public.fdj_ouvrir_controle_caisse(uuid)',
    'public.fdj_valider_caisse(uuid, text, text, text)',
    'public.fdj_rouvrir_caisse(uuid, text)',
    'public.fdj_corriger_caisse_manager(uuid, text, numeric, numeric, text)',
    'public.fdj_traiter_demande_correction(uuid, text, text)',
    'public.fdj_chronologie_caisse(uuid)',
    'public.fdj_alertes_caisse(uuid, numeric, numeric, int, int)'
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

-- ============================================================================
-- RETOUR ARRIÈRE (Phase A) — à exécuter tel quel, dans cet ordre.
-- Ne supprime que des fonctions créées ici ; aucune donnée n'est touchée.
--
--   drop function if exists public.fdj_alertes_caisse(uuid, numeric, numeric, int, int);
--   drop function if exists public.fdj_chronologie_caisse(uuid);
--   drop function if exists public.fdj_traiter_demande_correction(uuid, text, text);
--   drop function if exists public.fdj_corriger_caisse_manager(uuid, text, numeric, numeric, text);
--   drop function if exists public.fdj_rouvrir_caisse(uuid, text);
--   drop function if exists public.fdj_valider_caisse(uuid, text, text, text);
--   drop function if exists public.fdj_ouvrir_controle_caisse(uuid);
--   drop function if exists public.fdj_quart_du_manager(uuid);
--   drop function if exists public.fdj_libelle_ecart_manager(numeric);
--
-- Condition d'arrêt : sûr tant que le front servi n'appelle pas encore ces
-- fonctions. Après bascule du front manager (Phase B), les supprimer coupe
-- la validation des caisses — rebasculer le front d'abord.
-- ============================================================================
