-- =====================================================================
-- Mode d'emploi — à jouer sur **nexus-test uniquement**.
--
-- Ce fichier ne s'exécute JAMAIS seul : il suppose que le corps de la
-- Phase C vient d'être joué dans la même transaction. On le concatène
-- donc au fichier de fermeture, dont on neutralise le `commit;` final,
-- et on termine par `rollback;` :
--
--   { sed 's/^commit;$//' 20260916230000_fdj_rls_definitives_phase_c.sql
--     printf '\n'
--     cat 20260916230000_mutations_de_validation.sql
--     printf '\nrollback;\n'
--   } > /tmp/essai.sql
--   psql "<url directe de Test>" -v ON_ERROR_STOP=1 -f /tmp/essai.sql
--
-- Résultat attendu, et lui seul :
--   ===== LES TREIZE MUTATIONS ONT LE COMPORTEMENT ATTENDU =====
--   ROLLBACK
--
-- Les UUID ci-dessous sont **entièrement synthétiques** : ce fichier ne
-- dépend d'aucun compte existant, sur aucun environnement. Le dépôt est
-- public, et l'identifiant d'un employé réel y serait un identifiant
-- pseudonyme persistant — pas un secret, mais une donnée corrélable à
-- une personne. Les deux acteurs — un employé non manager, un manager
-- du même site — sont donc créés par ce fichier même, dans la
-- transaction annulée, et démontés explicitement avant la notice
-- finale. La garde `test_phase_c_identifiants_synthetiques_20260917.js`
-- refuse tout UUID de ce dossier qui ne figurerait pas dans la liste
-- déclarée des fixtures.
--
-- Dernière exécution verte : 17/09/2026, projet udljdqxerrbbbajxubfn.
-- =====================================================================

-- =====================================================================
-- MUTATIONS DE VALIDATION DE LA PHASE C
-- Se joue APRÈS le corps de la Phase C, DANS LA MÊME TRANSACTION, qui
-- est annulée. Aucune donnée n'est conservée.
--
-- Principe : une garde verte ne prouve rien. Chaque interdit du §5.1 est
-- ici une mutation réelle, jouée sous le rôle `authenticated` avec le
-- jeton d'un employé synthétique créé ci-dessous. Le test échoue si la
-- mutation PASSE.
--
-- Deux formes de refus, à ne jamais confondre :
--   · le TRIGGER lève 42501            → on attend une exception ;
--   · la RLS masque simplement la ligne → 0 ligne touchée, AUCUNE erreur.
--     Attendre une exception là serait un test qui ne mord pas.
-- =====================================================================

\set EMPLOYE  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
\set MANAGER  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
\set SITE     'nexus-station-test'

-- --- Les deux acteurs, entièrement synthétiques -----------------------
-- Ce ne sont pas des valeurs fictives posées à la place d'un vrai
-- compte : ce sont deux vraies lignes de `public.employees`, soumises à
-- la clé étrangère `employees_site_id_fkey` vers `public.sites`, à la
-- contrainte `employees_role_check` et à l'unicité de `username`. Les
-- colonnes d'acteur de la Phase C (`fdj_shifts.employee_id`,
-- `fdj_cash_controls.valide_par` et `confirme_par`,
-- `fdj_audit_log.acteur_id`, `fdj_stock_movements.employee_id` et
-- `created_by`, `fdj_reports.saisi_par`…) référencent toutes
-- `public.employees` — et non `auth.users` : les relations éprouvées
-- ici sont donc exactement celles de la production.
--
-- Le prédicat de rôle `public.fdj_je_controle_le_site()` lit lui aussi
-- `public.employees` : c'est la ligne `manager` ci-dessous, et elle
-- seule, qui fait passer les contre-épreuves managériales. Changer son
-- `role` pour `caissier` suffirait à faire rougir M9 et M11 bis — la
-- distinction des deux rôles est donc réellement exercée.
insert into public.employees
  (id, username, nom, role, actif, est_createur, site_id, compte_test)
values (:'EMPLOYE', 'recette-phase-c-employe', 'Recette Phase C — employé',
        'caissier', true, false, :'SITE', true),
       (:'MANAGER', 'recette-phase-c-manager', 'Recette Phase C — manager',
        'manager', true, false, :'SITE', true);

-- --- Données de test, créées et annulées dans cette transaction --------
insert into public.fdj_shifts (id, site, date, quart, employee_id, statut, ouvert_le)
values ('11111111-1111-4111-8111-111111111111', :'SITE', '2026-09-17', '1',
        :'EMPLOYE', 'brouillon', now());

insert into public.fdj_shifts (id, site, date, quart, employee_id, statut, ouvert_le)
values ('22222222-2222-4222-8222-222222222222', :'SITE', '2026-09-17', '2',
        :'MANAGER', 'brouillon', now());

insert into public.fdj_cash_controls (id, site, shift_id, caisse_attendue, caisse_reelle, ecart, statut, motif_ecart_texte)
values ('33333333-3333-4333-8333-333333333333', :'SITE',
        '11111111-1111-4111-8111-111111111111', 460, 455, -5, 'provisoire',
        'MOTIF INTERNE MANAGER — ne doit jamais être écrit par l''employé');

insert into public.fdj_cash_controls (id, site, shift_id, caisse_attendue, caisse_reelle, ecart, statut)
values ('44444444-4444-4444-8444-444444444444', :'SITE',
        '22222222-2222-4222-8222-222222222222', 300, 300, 0, 'provisoire');

-- Un quart CLÔTURÉ de l'employé, avec sa caisse validée et le commentaire
-- interne du manager : c'est le cobaye de la contre-épreuve M4 bis. La
-- projection `fdj_ma_progression_caisse()` ne rend que les quarts
-- `valide` (cahier FDJ-26), les trois quarts `brouillon` ci-dessus lui
-- sont donc invisibles — sans celui-ci, M4 bis serait vert pour la
-- mauvaise raison : une sortie vide ne prouve aucune fermeture.
insert into public.fdj_shifts (id, site, date, quart, employee_id, statut, ouvert_le, valide_le)
values ('66666666-6666-4666-8666-666666666666', :'SITE', '2026-09-16', '1',
        :'EMPLOYE', 'valide', now(), now());

insert into public.fdj_cash_controls
  (id, site, shift_id, caisse_attendue, caisse_reelle, caisse_reelle_origine,
   ecart, ecart_origine, motif_ecart, statut, motif_ecart_texte,
   resultat_controle, valide_par, valide_le)
values ('77777777-7777-4777-8777-777777777777', :'SITE',
        '66666666-6666-4666-8666-666666666666', 500, 499, 497.50,
        -1, -2.50, 'erreur_monnaie', 'valide_avec_ecart',
        'MOTIF INTERNE MANAGER — ne doit jamais sortir par la projection',
        'a_regulariser', :'MANAGER', now());

-- Un troisième quart, volontairement SANS caisse : fdj_cash_controls
-- porte un unique sur shift_id (une caisse par quart), donc la
-- contre-épreuve « le manager peut encore créer une caisse » a besoin
-- d'un quart vierge.
insert into public.fdj_shifts (id, site, date, quart, employee_id, statut, ouvert_le)
values ('55555555-5555-4555-8555-555555555555', :'SITE', '2026-09-18', '1',
        :'EMPLOYE', 'brouillon', now());

-- Un jeu et un emplacement de caisse : `fdj_activer_carnet` exige un
-- `game_id` réel (clé étrangère) et résout son emplacement par
-- `fdj_emplacement_du_site(site, 'caisse')`. Sans eux, M11 bis
-- échouerait sur une contrainte, pas sur la garde que l'on mesure.
insert into public.fdj_games (id, site, nom, prix, tickets_par_carnet)
values ('88888888-8888-4888-8888-888888888888', :'SITE', 'JEU DE RECETTE M11', 5, 30);

insert into public.fdj_locations (id, site, nom, type)
values ('99999999-9999-4999-8999-999999999999', :'SITE', 'Caisse de recette', 'caisse');

-- Les DEUX rapports du quart 5555 : `fdj_calculer_caisse` rend un écart
-- NULL tant que `journalier` ET `temps_reel` ne sont pas tous deux
-- présents, et `fdj_saisir_caisse_manager` répondrait alors
-- `{saisi:false, motif:'saisie_incomplete'}`. La contre-épreuve M9
-- serait verte pour la mauvaise raison : elle n'aurait rien saisi.
-- Sans comptage de jeu, ventes = 0 ; attendue = (0 - 40) + 290 + 0 = 250.
insert into public.fdj_reports (site, shift_id, type_rapport, lots_payes_grattage)
values (:'SITE', '55555555-5555-4555-8555-555555555555', 'journalier', 40);

insert into public.fdj_reports (site, shift_id, type_rapport, caisse_tirages)
values (:'SITE', '55555555-5555-4555-8555-555555555555', 'temps_reel', 290);

-- La caisse du quart 1111 est CONFIRMÉE par l'employé : sans cela,
-- `fdj_ouvrir_controle_caisse` et `fdj_valider_caisse` rendent
-- `{..., motif:'caisse_non_confirmee'}` sans lever d'exception — encore
-- une contre-épreuve verte qui n'aurait rien contrôlé.
update public.fdj_cash_controls
   set confirme_le = now(), confirme_par = :'EMPLOYE'
 where id = '33333333-3333-4333-8333-333333333333';

-- =====================================================================
-- M1 — L'employé ne peut plus INSÉRER une caisse en direct.
--      Refus attendu : exception 42501 (violation du WITH CHECK).
-- =====================================================================
do $$
declare v_passee boolean := false;
begin
  begin
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims',
      '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
    insert into public.fdj_cash_controls (site, shift_id, caisse_attendue, statut)
    values ('nexus-station-test', '11111111-1111-4111-8111-111111111111', 999, 'provisoire');
    v_passee := true;
  exception
    when insufficient_privilege then raise notice 'M1 PASSE — refus RLS : %', sqlerrm;
    when others then raise notice 'M1 PASSE — refus (%) : %', sqlstate, sqlerrm;
  end;
  execute 'reset role';
  if v_passee then
    raise exception 'M1 ÉCHOUE — un employé a pu créer une caisse FDJ en écriture directe.';
  end if;
end $$;

-- =====================================================================
-- M2 — L'employé ne peut plus MODIFIER une caisse en direct, pas même la
--      sienne : la politique UPDATE est managériale, donc la ligne lui
--      est INVISIBLE en écriture. Refus SILENCIEUX : 0 ligne.
--      C'est le test qu'il ne faut surtout pas écrire en « attend une
--      exception » — il serait vert sans rien prouver.
-- =====================================================================
do $$
declare v_lignes integer;
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
  update public.fdj_cash_controls
     set caisse_reelle = 460, ecart = 0, statut = 'conforme'
   where id = '33333333-3333-4333-8333-333333333333';
  get diagnostics v_lignes = row_count;
  execute 'reset role';
  if v_lignes <> 0 then
    raise exception 'M2 ÉCHOUE — un employé a modifié % ligne(s) de caisse en écriture directe.', v_lignes;
  end if;
  raise notice 'M2 PASSE — 0 ligne modifiée (la caisse est invisible en écriture à l''employé).';
end $$;

-- Preuve que M2 n'est pas un faux positif : la valeur est bien restée.
do $$
declare v_reelle numeric; v_statut text;
begin
  select caisse_reelle, statut into v_reelle, v_statut
    from public.fdj_cash_controls where id = '33333333-3333-4333-8333-333333333333';
  if v_reelle <> 455 or v_statut <> 'provisoire' then
    raise exception 'M2 ÉCHOUE — la caisse a changé malgré tout (% / %).', v_reelle, v_statut;
  end if;
  raise notice 'M2 bis PASSE — la caisse est intacte : 455 / provisoire.';
end $$;

-- =====================================================================
-- M3 — L'employé ne peut pas VALIDER la caisse d'un collègue.
-- =====================================================================
do $$
declare v_lignes integer;
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
  update public.fdj_cash_controls
     set statut = 'conforme', valide_par = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', valide_le = now()
   where id = '44444444-4444-4444-8444-444444444444';
  get diagnostics v_lignes = row_count;
  execute 'reset role';
  if v_lignes <> 0 then
    raise exception 'M3 ÉCHOUE — un employé a validé la caisse d''un collègue (% ligne).', v_lignes;
  end if;
  raise notice 'M3 PASSE — un employé ne peut pas valider la caisse d''un collègue.';
end $$;

-- =====================================================================
-- M4 — L'employé ne LIT plus fdj_cash_controls du tout, en direct.
--      AVANT la Phase C il lisait tout le site (mesuré le 17/09/2026 sur
--      nexus-test : deux caisses lues, dont une d'un collègue, avec
--      motif_ecart_texte en clair). APRÈS, ni celle du collègue, ni la
--      sienne. C'est la RLS : 0 ligne, AUCUNE erreur.
--
--      Cette mutation attendait auparavant `v_miennes = 1`, parce que
--      « Ma Progression » lisait la table par jointure. L'écran passe
--      désormais par la projection serveur (20260916220900) : la
--      condition s'inverse, et M4 bis vérifie qu'on n'a pas seulement
--      cassé l'écran.
-- =====================================================================
do $$
declare v_miennes integer; v_autres integer;
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
  select count(*) into v_miennes from public.fdj_cash_controls
   where id = '33333333-3333-4333-8333-333333333333';
  select count(*) into v_autres from public.fdj_cash_controls
   where id = '44444444-4444-4444-8444-444444444444';
  execute 'reset role';
  if v_autres <> 0 then
    raise exception 'M4 ÉCHOUE — l''employé lit encore la caisse d''un collègue.';
  end if;
  if v_miennes <> 0 then
    raise exception 'M4 ÉCHOUE — la lecture directe de fdj_cash_controls reste ouverte à l''employé (% ligne(s)) : les colonnes du manager repassent dans sa réponse réseau.', v_miennes;
  end if;
  raise notice 'M4 PASSE — lecture directe fermée : 0 pour sa caisse, 0 pour celle du collègue.';
end $$;

-- =====================================================================
-- M4 bis — contre-épreuve : « Ma Progression » n'est pas vidée pour
--      autant, et ce qu'elle rend ne contient AUCUN champ manager.
--      Une fermeture qui casse l'écran serait, elle aussi, verte à M4.
-- =====================================================================
do $$
declare v_lignes integer; v_dump text; v_ecart numeric; v_ecart_origine numeric;
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
  select count(*), coalesce(string_agg(to_jsonb(p)::text, ' '), '')
    into v_lignes, v_dump
    from public.fdj_ma_progression_caisse() p;
  select p.ecart, p.ecart_origine into v_ecart, v_ecart_origine
    from public.fdj_ma_progression_caisse() p
   where p.shift_id = '66666666-6666-4666-8666-666666666666';
  execute 'reset role';
  if v_lignes <> 1 then
    raise exception 'M4 bis ÉCHOUE — la projection rend % ligne(s) au lieu de 1 : Ma Progression est vidée en silence.', v_lignes;
  end if;
  if v_dump like '%MOTIF INTERNE MANAGER%'
     or v_dump like '%a_regulariser%'
     or v_dump like '%bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb%' then
    raise exception 'M4 bis ÉCHOUE — la projection transporte un champ réservé au manager (commentaire, verdict ou identité du contrôleur).';
  end if;
  if v_ecart is distinct from -1 or v_ecart_origine is distinct from -2.50 then
    raise exception 'M4 bis ÉCHOUE — écart définitif (%) ou provisoire (%) perdu : l''employé doit voir les deux.', v_ecart, v_ecart_origine;
  end if;
  raise notice 'M4 bis PASSE — 1 quart rendu, écarts -2.50 puis -1.00, aucun champ manager.';
end $$;

-- =====================================================================
-- M5 — L'employé ne peut pas se RÉATTRIBUER le quart d'un collègue.
--      Ici la RLS le laisse passer (lecture ouverte au site) : c'est le
--      TRIGGER de garde qui refuse. Exception 42501 attendue.
-- =====================================================================
do $$
declare v_passee boolean := false;
begin
  begin
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims',
      '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
    update public.fdj_shifts
       set employee_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
     where id = '22222222-2222-4222-8222-222222222222';
    v_passee := true;
  exception
    when insufficient_privilege then raise notice 'M5 PASSE — refus du trigger : %', sqlerrm;
    when others then raise notice 'M5 PASSE — refus (%) : %', sqlstate, sqlerrm;
  end;
  execute 'reset role';
  if v_passee then
    raise exception 'M5 ÉCHOUE — un employé s''est réattribué le quart d''un collègue.';
  end if;
end $$;

-- =====================================================================
-- M6 — L'employé ne peut pas faire passer son propre quart à l'état
--      « transmis » ni le valider par écriture directe.
-- =====================================================================
do $$
declare v_passee boolean := false;
begin
  begin
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims',
      '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
    update public.fdj_shifts set statut = 'valide', valide_le = now()
     where id = '11111111-1111-4111-8111-111111111111';
    v_passee := true;
  exception when others then raise notice 'M6 PASSE — refus (%) : %', sqlstate, sqlerrm;
  end;
  execute 'reset role';
  if v_passee then
    raise exception 'M6 ÉCHOUE — un employé a changé l''état de son quart en écriture directe.';
  end if;
end $$;

-- =====================================================================
-- M7 — CONTRE-ÉPREUVE : la liste blanche du trigger laisse bien passer
--      ce dont la validation d'ouverture a besoin. Une garde qui refuse
--      TOUT casserait l'écran FDJ ; ce test-là est aussi important que
--      les six précédents.
-- =====================================================================
do $$
declare v_lignes integer;
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
  update public.fdj_shifts
     set ouverture_validee = true, ouverture_validee_le = now(),
         previous_shift_id = '22222222-2222-4222-8222-222222222222'
   where id = '11111111-1111-4111-8111-111111111111';
  get diagnostics v_lignes = row_count;
  execute 'reset role';
  if v_lignes <> 1 then
    raise exception 'M7 ÉCHOUE — la validation d''ouverture est bloquée (% ligne) : l''écran FDJ casserait.', v_lignes;
  end if;
  raise notice 'M7 PASSE — validation d''ouverture et chaînage de quart toujours possibles.';
end $$;

-- =====================================================================
-- M8 — L'employé ne peut pas imputer une action du journal à un tiers.
-- =====================================================================
do $$
declare v_passee boolean := false;
begin
  begin
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims',
      '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
    insert into public.fdj_audit_log (site, entite_type, action, acteur_id)
    values ('nexus-station-test', 'fdj_shifts', 'test_imputation',
            'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
    v_passee := true;
  exception when others then raise notice 'M8 PASSE — refus (%) : %', sqlstate, sqlerrm;
  end;
  execute 'reset role';
  if v_passee then
    raise exception 'M8 ÉCHOUE — un employé a journalisé une action au nom du manager.';
  end if;
end $$;

-- M8 bis — contre-épreuve : journaliser en son propre nom reste possible,
-- et acteur_id null (recalcul automatique) aussi.
do $$
declare v_lignes integer;
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
  insert into public.fdj_audit_log (site, entite_type, action, acteur_id)
  values ('nexus-station-test', 'fdj_shifts', 'test_soi_meme',
          'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  insert into public.fdj_audit_log (site, entite_type, action, acteur_id)
  values ('nexus-station-test', 'fdj_shifts', 'test_automatique', null);
  get diagnostics v_lignes = row_count;
  execute 'reset role';
  raise notice 'M8 bis PASSE — journalisation en son nom et journalisation automatique intactes.';
end $$;

-- =====================================================================
-- M9 — Le MANAGER continue de tout faire, mais PAR LES COMMANDES.
--      La fermeture ne doit pas casser l'écran qui contrôle et valide ;
--      elle doit en revanche l'obliger à passer par le cycle prévu.
--
--      L'ancienne version de cette mutation écrivait en direct dans
--      `fdj_cash_controls` et réattribuait un quart par un `update` de
--      colonne. Les deux gestes sont désormais fermés (M12, M13) : les
--      y laisser aurait rendu M9 rouge, et la corriger en abaissant la
--      Phase C aurait été l'inverse du travail demandé.
-- =====================================================================
do $$
declare
  v_lignes  integer;
  v_ouvert  jsonb;
  v_valide  jsonb;
  v_saisi   jsonb;
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}', true);

  -- 1. Prise en contrôle de la caisse confirmée par l'employé.
  v_ouvert := public.fdj_ouvrir_controle_caisse('11111111-1111-4111-8111-111111111111');
  if coalesce((v_ouvert->>'controle_ouvert')::boolean, false) is not true then
    raise exception 'M9 ÉCHOUE — le manager ne peut plus prendre une caisse en contrôle : %', v_ouvert;
  end if;

  -- 2. Validation avec écart : motif interne ET motif d'écart énuméré.
  v_valide := public.fdj_valider_caisse(
    '11111111-1111-4111-8111-111111111111',
    'avec_ecart',
    'écart de 5 € constaté au recomptage',
    'erreur_comptage');
  if coalesce((v_valide->>'valide')::boolean, false) is not true then
    raise exception 'M9 ÉCHOUE — le manager ne peut plus valider une caisse : %', v_valide;
  end if;

  -- 3. Saisie managériale sur un quart sans caisse (feuille rendue en
  --    retard, employé absent). Les deux rapports du quart 5555 sont
  --    en fixture : sans eux, l'écart serait NULL et la commande
  --    répondrait `saisie_incomplete` — vert sans rien avoir saisi.
  v_saisi := public.fdj_saisir_caisse_manager(
    '55555555-5555-4555-8555-555555555555',
    250,
    'feuille rendue en retard, saisie par le manager',
    0,
    'conforme');
  if coalesce((v_saisi->>'saisi')::boolean, false) is not true then
    raise exception 'M9 ÉCHOUE — le manager ne peut plus saisir une caisse : %', v_saisi;
  end if;

  -- 4. Le seul geste direct qui reste légitime au manager : déposer un
  --    rapport FDJ. `fdj_reports` n'est pas dans le périmètre fermé par
  --    la Phase C, et l'écran manager l'écrit toujours en direct.
  insert into public.fdj_reports (site, shift_id, type_rapport, lots_payes_grattage)
  values ('nexus-station-test', '11111111-1111-4111-8111-111111111111', 'journalier', 120);
  get diagnostics v_lignes = row_count;
  if v_lignes <> 1 then
    raise exception 'M9 ÉCHOUE — le manager ne peut plus déposer un rapport (% ligne).', v_lignes;
  end if;

  execute 'reset role';
  raise notice 'M9 PASSE — le manager contrôle, valide, saisit une feuille et dépose un rapport.';
end $$;

-- =====================================================================
-- M10 — fdj_corrections est fermée pour TOUT LE MONDE en écriture
--       directe, manager compris : seule la commande serveur y écrit.
-- =====================================================================
do $$
declare v_passee boolean := false;
begin
  begin
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims',
      '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}', true);
    insert into public.fdj_corrections (site, shift_id) values ('nexus-station-test', '11111111-1111-4111-8111-111111111111');
    v_passee := true;
  exception when others then raise notice 'M10 PASSE — refus (%) : %', sqlstate, sqlerrm;
  end;
  execute 'reset role';
  if v_passee then
    raise exception 'M10 ÉCHOUE — fdj_corrections accepte encore une écriture directe.';
  end if;
end $$;

-- =====================================================================
-- M11 — L'employé ne peut plus écrire un mouvement de stock en direct,
--       et surtout pas en imputant le mouvement à un collègue.
--       Refus attendu : exception 42501 (aucune politique INSERT).
-- =====================================================================
do $$
declare v_passee boolean := false;
begin
  begin
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims',
      '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
    -- `employee_id` forgé sur le manager : c'est très exactement ce que
    -- le front savait faire avant cette vague.
    insert into public.fdj_stock_movements
      (site, game_id, shift_id, type_mouvement, quantite, employee_id, created_by)
    values ('nexus-station-test', '88888888-8888-4888-8888-888888888888',
            '11111111-1111-4111-8111-111111111111', 'activation', 1,
            'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
            'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
    v_passee := true;
  exception
    when insufficient_privilege then raise notice 'M11 PASSE — refus RLS : %', sqlerrm;
    when others then raise notice 'M11 PASSE — refus (%) : %', sqlstate, sqlerrm;
  end;
  execute 'reset role';
  if v_passee then
    raise exception 'M11 ÉCHOUE — un employé écrit encore un mouvement de stock en direct, au nom d''un collègue.';
  end if;
end $$;

-- =====================================================================
-- M11 bis — CONTRE-ÉPREUVE, et cœur du point 3 du mandat.
--       La même activation, par la commande serveur, passe — et
--       l'attribution est décidée par le SERVEUR :
--         · `employee_id`  = le titulaire du quart, toujours ;
--         · `created_by`   = l'appelant, employé OU manager.
--       Quand le manager saisit la feuille à la place de l'employé,
--       l'employé reste le responsable opérationnel et le manager
--       n'apparaît que comme auteur de la saisie.
-- =====================================================================
do $$
declare
  v_employe   jsonb;
  v_manager   jsonb;
  v_par_emp   integer;
  v_par_mgr   integer;
  v_usurpes   integer;
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
  v_employe := public.fdj_activer_carnet(
    '11111111-1111-4111-8111-111111111111',
    '88888888-8888-4888-8888-888888888888',
    1, 'quantite', 'jeton-recette-m11bis-employe');
  if coalesce((v_employe->>'enregistre')::boolean, false) is not true then
    raise exception 'M11 bis ÉCHOUE — l''employé ne peut plus activer un carnet : %', v_employe;
  end if;

  perform set_config('request.jwt.claims',
    '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}', true);
  v_manager := public.fdj_activer_carnet(
    '11111111-1111-4111-8111-111111111111',
    '88888888-8888-4888-8888-888888888888',
    1, 'quantite', 'jeton-recette-m11bis-manager');
  if coalesce((v_manager->>'enregistre')::boolean, false) is not true then
    raise exception 'M11 bis ÉCHOUE — le manager ne peut plus activer un carnet : %', v_manager;
  end if;

  execute 'reset role';

  select count(*) filter (where m.created_by = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
                            and m.employee_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
         count(*) filter (where m.created_by = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
                            and m.employee_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
         count(*) filter (where m.employee_id <> 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
    into v_par_emp, v_par_mgr, v_usurpes
    from public.fdj_stock_movements m
   where m.shift_id = '11111111-1111-4111-8111-111111111111';

  if v_par_emp <> 1 then
    raise exception 'M11 bis ÉCHOUE — activation de l''employé mal attribuée (% ligne).', v_par_emp;
  end if;
  if v_par_mgr <> 1 then
    raise exception 'M11 bis ÉCHOUE — saisie du manager : employee_id doit rester l''employé opérationnel et created_by devenir le manager (% ligne).', v_par_mgr;
  end if;
  if v_usurpes <> 0 then
    raise exception 'M11 bis ÉCHOUE — % mouvement(s) imputé(s) à quelqu''un d''autre que le titulaire du quart.', v_usurpes;
  end if;

  raise notice 'M11 bis PASSE — employee_id vient du quart, created_by de auth.uid(), y compris en saisie manager.';
end $$;

-- =====================================================================
-- M12 — Le manager ne réattribue plus un quart par un `update` de
--       colonne : changer de titulaire est un TRANSFERT DE
--       RESPONSABILITÉ, qui exige un motif et laisse une trace.
--       Refus attendu : exception 42501 (trigger fdj_shifts_garde_colonnes).
-- =====================================================================
do $$
declare
  v_passee    boolean := false;
  v_court     boolean := false;
  v_transfert jsonb;
  v_journal   integer;
  v_titulaire uuid;
begin
  begin
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims',
      '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}', true);
    update public.fdj_shifts
       set employee_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
     where id = '55555555-5555-4555-8555-555555555555';
    v_passee := true;
  exception
    when insufficient_privilege then raise notice 'M12 PASSE — refus du trigger : %', sqlerrm;
    when others then raise notice 'M12 PASSE — refus (%) : %', sqlstate, sqlerrm;
  end;
  if v_passee then
    execute 'reset role';
    raise exception 'M12 ÉCHOUE — un quart change encore de titulaire par une écriture de colonne, sans motif ni trace.';
  end if;

  -- Rattraper une exception annule la sous-transaction du sous-bloc, et
  -- avec elle le `set local role` et le `set_config(..., true)` qui y
  -- ont été posés. Sans ces deux lignes, la suite tournerait sous le
  -- rôle du script : `auth.uid()` serait nul et la commande refuserait
  -- pour la mauvaise raison.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}', true);

  -- Le motif n'est pas décoratif : la commande le refuse s'il est vide
  -- ou trop court. Sans ce sous-contrôle, « exiger un motif » ne serait
  -- qu'une intention écrite dans un commentaire.
  begin
    v_transfert := public.fdj_transferer_responsabilite_quart(
      '55555555-5555-4555-8555-555555555555',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      '  ');
    v_court := true;
  exception
    when invalid_parameter_value then raise notice 'M12 PASSE — transfert sans motif refusé : %', sqlerrm;
  end;
  if v_court then
    execute 'reset role';
    raise exception 'M12 ÉCHOUE — un transfert de responsabilité passe sans motif.';
  end if;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}', true);

  -- CONTRE-ÉPREUVE : le geste légitime, lui, aboutit et se journalise.
  v_transfert := public.fdj_transferer_responsabilite_quart(
    '55555555-5555-4555-8555-555555555555',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'passation de poste 14h — employé parti en pause longue');
  if coalesce((v_transfert->>'transfere')::boolean, false) is not true then
    execute 'reset role';
    raise exception 'M12 ÉCHOUE — la commande de transfert ne transfère plus : %', v_transfert;
  end if;

  execute 'reset role';

  select s.employee_id into v_titulaire
    from public.fdj_shifts s where s.id = '55555555-5555-4555-8555-555555555555';
  if v_titulaire <> 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' then
    raise exception 'M12 ÉCHOUE — le titulaire n''a pas changé après le transfert (%).', v_titulaire;
  end if;

  select count(*) into v_journal
    from public.fdj_audit_log a
   where a.shift_id = '55555555-5555-4555-8555-555555555555'
     and a.action = 'fdj_quart_responsabilite_transferee';
  if v_journal < 1 then
    raise exception 'M12 ÉCHOUE — le transfert ne produit aucun événement de journal.';
  end if;

  raise notice 'M12 PASSE — écriture directe refusée, transfert motivé accepté et journalisé.';
end $$;

-- =====================================================================
-- M13 — Le manager non plus n'écrit dans `fdj_cash_controls` en direct.
--       Refus attendu : PAS d'exception. Les politiques UPDATE ont été
--       supprimées et seules des politiques SELECT subsistent : une
--       politique de lecture n'autorise pas un UPDATE, la ligne est
--       simplement hors de portée. Attendre une exception ici serait un
--       test qui ne mord pas — il serait vert le jour où quelqu'un
--       remettrait une politique UPDATE permissive.
-- =====================================================================
do $$
declare v_lignes integer;
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}', true);

  update public.fdj_cash_controls
     set resultat_controle = 'conforme',
         valide_par = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
         valide_le = now(),
         motif_ecart_texte = 'contournement de la commande de validation'
   where id = '44444444-4444-4444-8444-444444444444';
  get diagnostics v_lignes = row_count;

  execute 'reset role';
  if v_lignes <> 0 then
    raise exception 'M13 ÉCHOUE — le manager valide encore une caisse par un update direct (% ligne), sans événement ni journal.', v_lignes;
  end if;
  raise notice 'M13 PASSE — update direct du manager sans effet : 0 ligne, aucune erreur.';
end $$;

-- =====================================================================
-- DÉMONTAGE — toutes les lignes créées ici sont retirées avant la fin.
--
-- Le `rollback;` final reste la garantie : c'est lui qui répond de
-- l'absence d'effet durable, et ce démontage ne s'y substitue pas. Il
-- répond d'autre chose — que la recette sait défaire ce qu'elle a fait,
-- et qu'elle n'a rien laissé essaimer hors des identifiants déclarés.
-- Il échouerait bruyamment sinon.
--
-- La boucle ne connaît que les onze UUID de fixture. Elle parcourt les
-- clés étrangères mono-colonne de type `uuid` du schéma `public` et ne
-- supprime que les lignes dont la valeur appartient à cette liste :
-- aucune ligne préexistante ne peut être atteinte, puisque aucune ne
-- porte ces valeurs. Plusieurs passes, car les dépendances sont
-- chaînées (carnet → mouvement → quart → employé) et parce que
-- `fdj_shifts.previous_shift_id` référence sa propre table.
-- =====================================================================
do $$
declare
  v_fixtures uuid[] := array[
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',  -- employé synthétique
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',  -- manager synthétique
    '11111111-1111-4111-8111-111111111111',  -- quart employé, brouillon
    '22222222-2222-4222-8222-222222222222',  -- quart manager, brouillon
    '33333333-3333-4333-8333-333333333333',  -- caisse du quart 1111
    '44444444-4444-4444-8444-444444444444',  -- caisse du quart 2222
    '55555555-5555-4555-8555-555555555555',  -- quart sans caisse
    '66666666-6666-4666-8666-666666666666',  -- quart clôturé
    '77777777-7777-4777-8777-777777777777',  -- caisse validée du 6666
    '88888888-8888-4888-8888-888888888888',  -- jeu de recette
    '99999999-9999-4999-8999-999999999999'   -- emplacement de caisse
  ]::uuid[];
  v_avant    bigint;
  v_passe    integer := 0;
  v_tour     bigint;
  v_lignes   bigint;
  v_total    bigint := 0;
  v_restant  bigint := 0;
  r          record;
begin
  select count(*) into v_avant
    from public.employees where id = any(v_fixtures);
  if v_avant <> 2 then
    raise exception 'DÉMONTAGE ÉCHOUE — % employé(s) synthétique(s) présent(s) au lieu de 2 : les mutations n''ont pas joué sur les identités attendues.', v_avant;
  end if;

  loop
    v_passe := v_passe + 1;
    v_tour  := 0;
    for r in
      select distinct c.relname as table_nom, a.attname as colonne
        from pg_constraint k
        join pg_class      c on c.oid = k.conrelid
        join pg_namespace  n on n.oid = c.relnamespace
        join pg_attribute  a on a.attrelid = k.conrelid and a.attnum = k.conkey[1]
       where k.contype = 'f'
         and n.nspname = 'public'
         and cardinality(k.conkey) = 1
         and a.atttypid = 'uuid'::regtype
       order by 1, 2
    loop
      execute format('delete from public.%I where %I = any($1)', r.table_nom, r.colonne)
        using v_fixtures;
      get diagnostics v_lignes = row_count;
      v_tour := v_tour + v_lignes;
    end loop;
    v_total := v_total + v_tour;
    exit when v_tour = 0;
    if v_passe >= 10 then
      raise exception 'DÉMONTAGE ÉCHOUE — dépendances non résorbées après 10 passes.';
    end if;
  end loop;

  -- Les quatre tables où la fixture EST la ligne mère : leur `id` est une
  -- clé primaire, jamais une clé étrangère, donc la boucle ne les voit pas.
  delete from public.fdj_cash_controls where id = any(v_fixtures);
  delete from public.fdj_shifts         where id = any(v_fixtures);
  delete from public.fdj_games          where id = any(v_fixtures);
  delete from public.fdj_locations      where id = any(v_fixtures);
  delete from public.employees          where id = any(v_fixtures);

  -- Contrôle de sortie : plus une seule référence, nulle part.
  for r in
    select distinct c.relname as table_nom, a.attname as colonne
      from pg_constraint k
      join pg_class      c on c.oid = k.conrelid
      join pg_namespace  n on n.oid = c.relnamespace
      join pg_attribute  a on a.attrelid = k.conrelid and a.attnum = k.conkey[1]
     where k.contype = 'f'
       and n.nspname = 'public'
       and cardinality(k.conkey) = 1
       and a.atttypid = 'uuid'::regtype
     order by 1, 2
  loop
    execute format('select count(*) from public.%I where %I = any($1)', r.table_nom, r.colonne)
      into v_lignes using v_fixtures;
    if v_lignes <> 0 then
      raise exception 'DÉMONTAGE ÉCHOUE — % ligne(s) de fixture subsistent dans public.%.%', v_lignes, r.table_nom, r.colonne;
    end if;
  end loop;

  select count(*) into v_restant
    from public.employees where id = any(v_fixtures);
  if v_restant <> 0 then
    raise exception 'DÉMONTAGE ÉCHOUE — % identité(s) synthétique(s) subsistent.', v_restant;
  end if;

  if v_total = 0 then
    raise exception 'DÉMONTAGE SUSPECT — aucune ligne supprimée : les fixtures n''avaient donc rien produit.';
  end if;
  raise notice 'DÉMONTAGE — % ligne(s) dépendante(s) retirée(s) en % passe(s), 0 fixture restante.', v_total, v_passe;
end $$;

do $$ begin raise notice '===== LES TREIZE MUTATIONS ONT LE COMPORTEMENT ATTENDU ====='; end $$;
