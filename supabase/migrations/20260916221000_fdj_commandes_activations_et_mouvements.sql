-- ============================================================================
-- FDJ — Vague 1, Phase A (« ÉTENDRE ») — Commandes serveur des activations
--                                        et des mouvements de stock
--
-- Relecture finale de la PR #62, point 3 (activations et mouvements).
--
-- CE QUE CE FICHIER CORRIGE. La migration 20260916220400 a ajouté à
-- `fdj_stock_movements` les colonnes `created_by` (QUI a saisi) et
-- `effective_at` (QUAND le mouvement a réellement pris effet). Elle a posé la
-- distinction ; elle n'a rien changé au chemin d'écriture. Les neuf gestes du
-- front — deux dans `NEXUS-FDJ-v1.html`, sept dans `NEXUS-FDJ-Manager-v1.html`
-- — continuaient d'écrire la table en direct, ne renseignaient aucune des deux
-- colonnes neuves, et composaient eux-mêmes `site`, `employee_id`, `shift_id`
-- et la clé d'idempotence. Une colonne que personne ne remplit est une colonne
-- qui n'existe pas.
--
-- Pire : six de ces gestes écrivaient l'identifiant du MANAGER dans
-- `employee_id`. C'est exactement la confusion que 20260916220400 nomme dans
-- son en-tête — « QUI a saisi, par opposition à QUI est l'employé opérationnel
-- concerné ». Quand un manager reconstitue l'activation d'un carnet pour le
-- quart d'un employé, le responsable opérationnel reste l'employé ; le manager
-- n'est que l'auteur de la saisie. La ligne écrite disait le contraire, et
-- c'est elle qui alimente ensuite l'écart de caisse de quelqu'un.
--
-- ---------------------------------------------------------------------------
-- DEUX COMMANDES, PARCE QU'IL Y A DEUX NATURES DE MOUVEMENT
--
--   `fdj_activer_carnet`              — les activations RATTACHÉES À UN QUART.
--       Trois appelants : l'employé qui active un carnet en cours de quart,
--       l'activation déduite de l'appro saisi à la clôture, et le manager qui
--       reconstitue ou annule une activation après coup. Un quart, donc un
--       responsable opérationnel, donc un `employee_id` qui n'est PAS l'auteur.
--
--   `fdj_enregistrer_mouvement_stock` — les mouvements de gestion HORS QUART.
--       Six opérations de manager : réception fournisseur, réapprovisionnement
--       de la caisse, retrait vers le bureau, blocage, retour depuis la zone
--       bloquée, rapprochement manuel. Pas de quart, donc pas de responsable
--       de quart : l'auteur est le manager, et pour le seul rapprochement —
--       qui reconstitue le geste d'un employé inconnu — `employee_id` reste
--       NULL, comme il l'était déjà.
--
-- ---------------------------------------------------------------------------
-- CE QUE L'APPELANT NE FOURNIT PLUS, ET NE PEUT PLUS FOURNIR
--
--   `site`            — lu sur le quart, ou sur la ligne `employees` de
--                       l'appelant. Jamais reçu du navigateur.
--   `employee_id`     — lu sur le quart (`fdj_shifts.employee_id`). Il n'est
--                       PARAMÈTRE D'AUCUNE des deux commandes : il n'existe
--                       aucun appel, même forgé dans la console, qui permette
--                       d'attribuer un mouvement à un collègue.
--   `created_by`      — `auth.uid()`, toujours, sans exception.
--   `shift_id`        — l'identifiant est reçu, mais il est RÉSOLU par
--                       `fdj_quart_de_l_employe` / `fdj_quart_du_manager`, qui
--                       refusent le quart d'un collègue et le quart d'un autre
--                       site. Ce qui est écrit est le quart autorisé, pas le
--                       paramètre.
--   `effective_at`    — dérivé du quart pour une activation ; borné à une
--                       fenêtre explicite pour un mouvement de gestion.
--   `idempotency_key` — construite côté serveur (voir plus bas).
--   `type_mouvement`, `methode_identification`, emplacements source et
--                       destination — déduits de l'opération nommée, jamais
--                       reçus tels quels. Un appelant ne choisit pas d'écrire
--                       un 'blocage' qui sort de la zone bloquée.
--
-- ---------------------------------------------------------------------------
-- POURQUOI LA CLÉ D'IDEMPOTENCE EST CONSTRUITE ICI
-- Le front fabriquait un `crypto.randomUUID()` et l'envoyait. Une clé fournie
-- par l'appelant est une clé qu'un appelant peut fabriquer POUR UN AUTRE : il
-- suffit de rejouer la clé d'un mouvement légitime pour en faire avaler le
-- doublon en silence — `23505` est lu partout comme un succès.
--
-- La clé est donc désormais `md5(auth.uid() || jeton d'appel || contexte)`.
-- Le jeton d'appel reste fourni par le front, et c'est lui qui porte
-- l'idempotence réseau : un double clic, un rejeu après coupure, une reprise
-- de requête retombent sur le même jeton, donc sur la même clé, donc sur le
-- même `23505` — le comportement d'aujourd'hui, inchangé. Mais comme
-- `auth.uid()` entre dans le condensat, la clé d'un autre est hors d'atteinte,
-- et l'unicité reste garantie par l'index préexistant
-- `fdj_stock_movements_idempotency_key_uniq`.
--
-- ---------------------------------------------------------------------------
-- CETTE MIGRATION NE LIT, N'ÉCRIT ET NE CORRIGE AUCUNE DONNÉE EXISTANTE.
-- Elle n'ajoute que des fonctions. Les 354 mouvements historiques ne sont pas
-- touchés : `created_by` y reste NULL, et NULL s'y lit « auteur historique
-- inconnu », jamais déduit rétroactivement (20260916220400).
--
-- La fermeture de l'écriture directe — retrait de la politique
-- `insert_fdj_stock_movements` — est en Phase C, pas ici. Cette migration est
-- sans effet sur le front existant tant qu'il n'appelle pas les commandes.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. INTERNE — l'emplacement d'un site, par type
--    `fdj_locations` est lue par le front pour composer ses mouvements. La
--    résoudre côté serveur est ce qui empêche d'écrire un mouvement vers
--    l'emplacement d'un autre site : le site n'est pas un paramètre.
--    `actif` est filtré comme le fait `chargerEmplacements()` côté front.
-- ----------------------------------------------------------------------------

create or replace function public.fdj_emplacement_du_site(p_site text, p_type text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select l.id
    from public.fdj_locations l
   where l.site = p_site
     and l.type = p_type
     and l.actif is true
   order by l.id
   limit 1;
$$;

comment on function public.fdj_emplacement_du_site(text, text) is
  'Interne (PR #62, point 3) — résout un emplacement FDJ par site et par type. '
  'Le site vient du quart ou de la ligne employees, jamais du navigateur.';

-- ----------------------------------------------------------------------------
-- 2. INTERNE — la clé d'idempotence d'un appel
--    Déterministe, donc rejouable ; liée à `auth.uid()`, donc non forgeable
--    pour le compte d'un autre. `p_jeton` est le jeton d'appel du front.
-- ----------------------------------------------------------------------------

create or replace function public.fdj_cle_idempotence(p_jeton text, p_contexte text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select md5(
           coalesce((select auth.uid())::text, '')
           || '|' || coalesce(p_jeton, '')
           || '|' || coalesce(p_contexte, '')
         )::uuid;
$$;

comment on function public.fdj_cle_idempotence(text, text) is
  'Interne (PR #62, point 3) — clé d''idempotence d''un mouvement FDJ. '
  'auth.uid() entre dans le condensat : un appelant ne peut pas fabriquer '
  'la clé d''un autre, et son propre rejeu retombe sur la même clé.';

-- ----------------------------------------------------------------------------
-- 3. COMMANDE — activer (ou corriger) des carnets SUR UN QUART
--
--    Remplace, à l'identique du geste métier :
--      NEXUS-FDJ-v1.html:1638         creerActivationImplicite
--      NEXUS-FDJ-v1.html:1809         executerActivationCarnetInterne
--      NEXUS-FDJ-Manager-v1.html:619  creerActivationReconstitueeCorrectionManager
--
--    `p_methode` est la seule façon de distinguer les trois : elle décide
--    aussi QUI a le droit d'appeler. 'reconstituee_correction_manager' est
--    réservée au manager — c'est la seule qui autorise une quantité négative,
--    c'est-à-dire l'annulation compensatoire d'une activation reconstituée
--    (jamais une suppression : le ledger reste entier).
--
--    `effective_at` N'EST PAS `now()`. C'est le moment où le carnet a été
--    activé, c'est-à-dire pendant le quart — lequel peut dater de plusieurs
--    jours quand un manager reconstitue. C'est précisément la distinction que
--    20260916220400 a créée, et elle serait perdue si l'on écrivait l'instant
--    de la saisie. `ouvert_le` quand il est connu, sinon minuit du jour métier
--    du quart, et jamais dans le futur.
-- ----------------------------------------------------------------------------

create or replace function public.fdj_activer_carnet(
  p_shift_id      uuid,
  p_game_id       uuid,
  p_quantite      numeric,
  p_methode       text,
  p_jeton         text,
  p_justification text default null,
  p_motif         text default null,
  p_booklet_id    uuid default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid         uuid;
  v_role        text;
  v_par_manager boolean;
  v_shift       public.fdj_shifts;
  v_caisse      uuid;
  v_type        text;
  v_effective   timestamptz;
  v_cle         uuid;
  v_id          uuid;
begin
  v_uid := (select auth.uid());
  if v_uid is null then
    raise exception 'Aucune session authentifiée : opération refusée.'
      using errcode = 'insufficient_privilege';
  end if;

  if p_game_id is null then
    raise exception 'Jeu FDJ manquant.' using errcode = 'invalid_parameter_value';
  end if;

  if p_jeton is null or btrim(p_jeton) = '' then
    raise exception 'Jeton d''appel manquant : l''idempotence ne peut pas être garantie.'
      using errcode = 'invalid_parameter_value';
  end if;

  if p_quantite is null or p_quantite = 0 then
    raise exception 'Quantité de carnets manquante ou nulle.'
      using errcode = 'invalid_parameter_value';
  end if;

  if p_methode not in ('quantite', 'implicite_appro', 'reconstituee_correction_manager') then
    raise exception 'Méthode d''identification inconnue pour une activation FDJ.'
      using errcode = 'invalid_parameter_value';
  end if;

  -- Le rôle est lu en base. C'est lui qui choisit la garde de quart, donc
  -- l'étendue : le titulaire n'accède qu'à SON quart, le manager à tout quart
  -- de SON site. Un employé qui forcerait la méthode manager dans sa console
  -- tomberait ici, avant toute écriture.
  select e.role into v_role
    from public.employees e
   where e.id = v_uid and e.actif is not false;

  v_par_manager := coalesce(v_role, '') in ('manager', 'gerant');

  if p_methode = 'reconstituee_correction_manager' and not v_par_manager then
    raise exception 'Seul un manager habilité peut reconstituer une activation.'
      using errcode = 'insufficient_privilege';
  end if;

  if p_quantite < 0 and p_methode <> 'reconstituee_correction_manager' then
    raise exception 'Une quantité négative n''est admise que pour une correction managériale reconstituée.'
      using errcode = 'invalid_parameter_value';
  end if;

  if v_par_manager then
    v_shift := public.fdj_quart_du_manager(p_shift_id);
  else
    v_shift := public.fdj_quart_de_l_employe(p_shift_id);
  end if;

  v_caisse := public.fdj_emplacement_du_site(v_shift.site, 'caisse');

  -- Même règle que le front remplacé : positif = activation, négatif =
  -- mouvement 'correction' compensatoire.
  v_type := case when p_quantite >= 0 then 'activation' else 'correction' end;

  -- Date d'effet autorisée : celle du quart, jamais celle de la saisie.
  v_effective := least(
    coalesce(v_shift.ouvert_le, v_shift.date::timestamptz),
    now()
  );

  v_cle := public.fdj_cle_idempotence(
    p_jeton,
    'activation|' || v_shift.id::text || '|' || p_game_id::text || '|' || p_methode
  );

  begin
    insert into public.fdj_stock_movements (
      site, game_id, shift_id, type_mouvement, quantite,
      location_source_id, location_destination_id,
      methode_identification, booklet_id,
      employee_id, created_by, effective_at,
      idempotency_key, justification
    )
    values (
      v_shift.site, p_game_id, v_shift.id, v_type, p_quantite,
      v_caisse, v_caisse,
      p_methode, p_booklet_id,
      -- Le responsable opérationnel est le titulaire du quart. Quand c'est le
      -- manager qui saisit, il devient `created_by` et RIEN DE PLUS.
      v_shift.employee_id, v_uid, v_effective,
      v_cle, p_justification
    )
    returning id into v_id;
  exception
    when unique_violation then
      -- Rejeu réseau : même appelant, même jeton, même contexte. Le front
      -- lisait déjà `23505` comme un succès ; il n'a plus à le connaître.
      return jsonb_build_object(
        'enregistre', true,
        'idempotent', true,
        'shift_id', v_shift.id,
        'par_manager', v_par_manager
      );
  end;

  insert into public.fdj_audit_log (
    site, shift_id, entite_type, entite_id, action, acteur_id, motif, nouvelle_valeur
  )
  values (
    v_shift.site, v_shift.id, 'fdj_stock_movement', v_id,
    -- Le vocabulaire du journal est celui qui existait AVANT cette bascule :
    -- `fdj_activation_implicite_appro` et les deux formes managériales sont
    -- déjà écrites dans `fdj_audit_log` en Production. Les renommer ici
    -- couperait en deux l'historique d'un même geste, sans rien y gagner.
    case
      when p_methode = 'implicite_appro' then 'fdj_activation_implicite_appro'
      when p_methode <> 'reconstituee_correction_manager' then 'fdj_activation_carnet'
      when p_quantite >= 0 then 'fdj_activation_reconstituee_correction_manager'
      else 'fdj_activation_reconstituee_annulee_correction_manager'
    end,
    -- `motif` porte le code d'exception énuméré (MOTIFS_EXCEPTION_CARNET),
    -- jamais la justification libre : c'est la colonne que l'écran Alertes
    -- recoupe.
    v_uid, nullif(btrim(coalesce(p_motif, '')), ''),
    jsonb_build_object(
      'game_id', p_game_id,
      'quantite', p_quantite,
      'type_mouvement', v_type,
      'methode_identification', p_methode,
      'motif_exception', nullif(btrim(coalesce(p_motif, '')), ''),
      'employee_id', v_shift.employee_id,
      'created_by', v_uid,
      'effective_at', v_effective,
      'par_manager', v_par_manager
    )
  );

  return jsonb_build_object(
    'enregistre', true,
    'idempotent', false,
    'mouvement_id', v_id,
    'shift_id', v_shift.id,
    'type_mouvement', v_type,
    'employee_id', v_shift.employee_id,
    'created_by', v_uid,
    'effective_at', v_effective,
    'par_manager', v_par_manager
  );
end;
$$;

comment on function public.fdj_activer_carnet(uuid, uuid, numeric, text, text, text, text, uuid) is
  'Relecture PR #62, point 3 — active ou corrige des carnets FDJ sur un quart. '
  'site, shift_id et employee_id viennent du quart autorisé ; created_by vient '
  'de auth.uid() ; effective_at vient du quart, pas de l''instant de saisie. '
  'employee_id n''est paramètre d''aucun appel : personne ne peut attribuer un '
  'mouvement à un collègue.';

-- ----------------------------------------------------------------------------
-- 4. COMMANDE — mouvements de stock de gestion, HORS QUART (manager)
--
--    Remplace :
--      NEXUS-FDJ-Manager-v1.html:3444  enregistrerReappro        ('reappro_caisse')
--      NEXUS-FDJ-Manager-v1.html:3617  enregistrerRetraitCaisse  ('retrait_caisse')
--      NEXUS-FDJ-Manager-v1.html:3910  enregistrerReception      ('reception')
--      NEXUS-FDJ-Manager-v1.html:4212  validerRapprochement      ('rapprochement_activation')
--      NEXUS-FDJ-Manager-v1.html:4274  enregistrerBlocage        ('blocage')
--      NEXUS-FDJ-Manager-v1.html:4291  retournerDepuisBloque     ('retour_bloque')
--
--    L'appelant nomme une OPÉRATION, pas un mouvement. Le type, les deux
--    emplacements et la méthode d'identification en découlent, côté serveur :
--    c'est ce qui rend impossible d'écrire un 'retour' qui sortirait du bureau
--    ou un 'blocage' qui viderait la zone bloquée.
--
--    `p_lignes` est un tableau `[{"game_id": "...", "quantite": n}, ...]` :
--    les trois écrans de saisie groupée (réappro, retrait, réception)
--    envoyaient déjà plusieurs lignes en un seul insert, et les scinder en
--    autant d'appels transformerait une coupure réseau en demi-réception.
--
--    `employee_id` : le manager EST l'acteur opérationnel de ces gestes — il
--    porte physiquement les carnets. Il est donc écrit dans les deux colonnes,
--    et c'est exact. La seule exception est le rapprochement, qui reconstitue
--    l'activation d'un employé resté inconnu : `employee_id` y demeure NULL,
--    comme le faisait déjà `validerRapprochement`. Écrire le manager y aurait
--    signifié « c'est lui qui a activé ce carnet », ce qui est faux.
-- ----------------------------------------------------------------------------

create or replace function public.fdj_enregistrer_mouvement_stock(
  p_operation           text,
  p_lignes              jsonb,
  p_jeton               text,
  p_motif               text default null,
  p_source              text default null,
  p_emplacement_source  text default null,
  p_effective_at        timestamptz default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid           uuid;
  v_role          text;
  v_site          text;
  v_type          text;
  v_methode       text;
  v_src_type      text;
  v_dst_type      text;
  v_src           uuid;
  v_dst           uuid;
  v_employee      uuid;
  v_effective     timestamptz;
  v_justification text;
  v_ligne         jsonb;
  v_game          uuid;
  v_qte           numeric;
  v_cle           uuid;
  v_id            uuid;
  v_ids           uuid[] := '{}';
  v_rejeux        int := 0;
  v_ecrits        int := 0;
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

  -- Les six opérations sont des gestes de gestion du stock : elles n'ont
  -- jamais été offertes à l'écran employé, et ne le sont pas davantage ici.
  if v_role not in ('manager', 'gerant') then
    raise exception 'Seul un manager habilité peut enregistrer un mouvement de stock FDJ.'
      using errcode = 'insufficient_privilege';
  end if;

  if v_site is null then
    raise exception 'Utilisateur sans rattachement de site : opération refusée.'
      using errcode = 'insufficient_privilege';
  end if;

  if p_jeton is null or btrim(p_jeton) = '' then
    raise exception 'Jeton d''appel manquant : l''idempotence ne peut pas être garantie.'
      using errcode = 'invalid_parameter_value';
  end if;

  if p_lignes is null or jsonb_typeof(p_lignes) <> 'array' or jsonb_array_length(p_lignes) = 0 then
    raise exception 'Aucune ligne de mouvement fournie.'
      using errcode = 'invalid_parameter_value';
  end if;

  -- L'opération décide de tout ce qui n'est pas une quantité.
  case p_operation
    when 'reception' then
      v_type := 'reception'; v_methode := 'quantite';
      v_src_type := null;      v_dst_type := 'bureau';
      v_justification := 'Réception FDJ (manager)'
        || case when coalesce(btrim(p_source), '') <> '' then ' — ' || btrim(p_source) else '' end || '.';
    when 'reappro_caisse' then
      v_type := 'transfert'; v_methode := 'quantite';
      v_src_type := 'bureau';  v_dst_type := 'caisse';
      v_justification := 'Réapprovisionnement caisse — carnets non activés (manager).';
    when 'retrait_caisse' then
      v_type := 'retour';    v_methode := 'quantite';
      v_src_type := 'caisse';  v_dst_type := 'bureau';
      v_justification := 'Retrait caisse → bureau (manager)'
        || case when coalesce(btrim(p_motif), '') <> '' then ' — ' || btrim(p_motif) else '' end || '.';
    when 'blocage' then
      v_type := 'blocage';   v_methode := 'quantite';
      -- Seule opération dont la source varie, et seules deux sources possibles.
      if coalesce(p_emplacement_source, '') not in ('bureau', 'caisse') then
        raise exception 'Emplacement de blocage inconnu : bureau ou caisse attendus.'
          using errcode = 'invalid_parameter_value';
      end if;
      v_src_type := p_emplacement_source; v_dst_type := 'bloque';
      -- « NEXUS ne modifie jamais un stock sans un fait déclaré » — la règle
      -- était côté navigateur, elle est maintenant côté serveur.
      if coalesce(btrim(p_motif), '') = '' then
        raise exception 'Un blocage exige un motif.' using errcode = 'invalid_parameter_value';
      end if;
      v_justification := 'Retrait/blocage (manager) — ' || btrim(p_motif);
    when 'retour_bloque' then
      v_type := 'retour';    v_methode := 'quantite';
      v_src_type := 'bloque';  v_dst_type := 'bureau';
      v_justification := 'Retour au bureau depuis la zone bloquée (manager).';
    when 'rapprochement_activation' then
      v_type := 'activation'; v_methode := 'saisie_manuelle';
      v_src_type := 'caisse';   v_dst_type := 'caisse';
      v_justification := 'Rapprochement manuel manager — quart(s) complété(s)/corrigé(s) après coup sans mouvement tracé.'
        || case when coalesce(btrim(p_motif), '') <> '' then ' ' || btrim(p_motif) else '' end;
    else
      raise exception 'Opération de mouvement de stock inconnue.'
        using errcode = 'invalid_parameter_value';
  end case;

  -- Le rapprochement reconstitue le geste d'un employé resté inconnu : lui
  -- attribuer le manager serait un faux. Les cinq autres sont bien le geste
  -- du manager, qui est donc à la fois l'opérateur et l'auteur.
  v_employee := case when p_operation = 'rapprochement_activation' then null else v_uid end;

  v_src := case when v_src_type is null then null
                else public.fdj_emplacement_du_site(v_site, v_src_type) end;
  v_dst := case when v_dst_type is null then null
                else public.fdj_emplacement_du_site(v_site, v_dst_type) end;

  -- Date d'effet autorisée. Par défaut l'instant de la saisie : ces gestes se
  -- constatent au moment où ils se font. Une antidate reste possible — une
  -- réception livrée la veille et saisie le lendemain — mais dans une fenêtre
  -- bornée et jamais dans le futur, la colonne devant rester lisible comme un
  -- fait et non comme une intention.
  v_effective := coalesce(p_effective_at, now());
  if v_effective > now() then
    raise exception 'Une date d''effet ne peut pas être dans le futur.'
      using errcode = 'invalid_parameter_value';
  end if;
  if v_effective < now() - interval '366 days' then
    raise exception 'Date d''effet trop ancienne : au-delà d''un an, la correction relève d''un inventaire de référence.'
      using errcode = 'invalid_parameter_value';
  end if;

  for v_ligne in select * from jsonb_array_elements(p_lignes) loop
    v_game := nullif(v_ligne->>'game_id', '')::uuid;
    v_qte  := nullif(v_ligne->>'quantite', '')::numeric;

    if v_game is null then
      raise exception 'Ligne de mouvement sans jeu FDJ.' using errcode = 'invalid_parameter_value';
    end if;
    if v_qte is null or v_qte <= 0 then
      raise exception 'Ligne de mouvement sans quantité positive.' using errcode = 'invalid_parameter_value';
    end if;

    v_cle := public.fdj_cle_idempotence(
      p_jeton,
      p_operation || '|' || v_game::text
    );

    begin
      insert into public.fdj_stock_movements (
        site, game_id, shift_id, type_mouvement, quantite,
        location_source_id, location_destination_id,
        methode_identification, booklet_id,
        employee_id, created_by, effective_at,
        idempotency_key, justification, source
      )
      values (
        v_site, v_game, null, v_type, v_qte,
        v_src, v_dst,
        v_methode, null,
        v_employee, v_uid, v_effective,
        v_cle, v_justification, nullif(btrim(coalesce(p_source, '')), '')
      )
      returning id into v_id;

      v_ids := v_ids || v_id;
      v_ecrits := v_ecrits + 1;
    exception
      when unique_violation then
        -- Rejeu de la même saisie : sans effet, et ce n'est pas une erreur.
        v_rejeux := v_rejeux + 1;
    end;
  end loop;

  if v_ecrits > 0 then
    insert into public.fdj_audit_log (
      site, shift_id, entite_type, entite_id, action, acteur_id, motif, nouvelle_valeur
    )
    values (
      v_site, null, 'fdj_stock_movement', v_ids[1],
      'fdj_mouvement_stock_' || p_operation,
      v_uid, nullif(btrim(coalesce(p_motif, '')), ''),
      jsonb_build_object(
        'operation', p_operation,
        'type_mouvement', v_type,
        'methode_identification', v_methode,
        'lignes', jsonb_array_length(p_lignes),
        'ecrits', v_ecrits,
        'rejeux', v_rejeux,
        'mouvement_ids', to_jsonb(v_ids),
        'employee_id', v_employee,
        'created_by', v_uid,
        'effective_at', v_effective
      )
    );
  end if;

  return jsonb_build_object(
    'enregistre', true,
    'idempotent', v_ecrits = 0,
    'operation', p_operation,
    'type_mouvement', v_type,
    'ecrits', v_ecrits,
    'rejeux', v_rejeux,
    'mouvement_ids', to_jsonb(v_ids),
    'employee_id', v_employee,
    'created_by', v_uid,
    'effective_at', v_effective
  );
end;
$$;

comment on function public.fdj_enregistrer_mouvement_stock(text, jsonb, text, text, text, text, timestamptz) is
  'Relecture PR #62, point 3 — mouvements de stock FDJ de gestion, hors quart, '
  'réservés au manager du site. L''appelant nomme une opération ; le type, les '
  'emplacements, la méthode, le site, l''auteur et la clé d''idempotence sont '
  'déterminés côté serveur.';

-- ----------------------------------------------------------------------------
-- 5. PRIVILÈGES
--    `revoke ... from public` NE SUFFIT PAS SUR SUPABASE (mesure du
--    16/09/2026) : il ne retire que l'entrée PUBLIC, jamais le grant nommé
--    dont `anon` dispose. `anon` est donc révoqué explicitement.
-- ----------------------------------------------------------------------------

-- 5.a — Commandes appelées par le navigateur.
do $$
declare
  v_sig text;
  v_signatures text[] := array[
    'public.fdj_activer_carnet(uuid, uuid, numeric, text, text, text, text, uuid)',
    'public.fdj_enregistrer_mouvement_stock(text, jsonb, text, text, text, text, timestamptz)'
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

-- 5.b — Fonctions internes : aucun rôle du navigateur ne les appelle.
--       `fdj_cle_idempotence` en particulier : exécutable par `authenticated`,
--       elle dirait à chacun quelle clé son propre jeton produit — inutile
--       pour lui, et une surface de moins vaut mieux.
do $$
declare
  v_sig text;
  v_signatures text[] := array[
    'public.fdj_emplacement_du_site(text, text)',
    'public.fdj_cle_idempotence(text, text)'
  ];
begin
  foreach v_sig in array v_signatures loop
    execute format('revoke all on function %s from public', v_sig);
    execute format('revoke all on function %s from anon', v_sig);
    execute format('revoke all on function %s from authenticated', v_sig);
    execute format('grant execute on function %s to service_role', v_sig);
  end loop;
end;
$$;

-- ============================================================================
-- RETOUR ARRIÈRE (Phase A) — à exécuter tel quel, dans cet ordre.
-- Ne supprime que des fonctions créées ici ; aucune donnée n'est touchée.
--
--   drop function if exists public.fdj_enregistrer_mouvement_stock(text, jsonb, text, text, text, text, timestamptz);
--   drop function if exists public.fdj_activer_carnet(uuid, uuid, numeric, text, text, text, text, uuid);
--   drop function if exists public.fdj_cle_idempotence(text, text);
--   drop function if exists public.fdj_emplacement_du_site(text, text);
--
-- Condition d'arrêt : ce retour arrière n'est sûr que tant que le front servi
-- n'appelle PAS encore ces fonctions, ET que la Phase C n'a pas retiré la
-- politique `insert_fdj_stock_movements`. Après la bascule, les supprimer
-- coupe toute activation de carnet et toute réception — il faut alors
-- rebasculer le front d'abord, et rétablir la politique d'insertion directe.
-- ============================================================================
