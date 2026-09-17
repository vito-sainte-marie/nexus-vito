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
--   ===== LES DIX MUTATIONS ONT LE COMPORTEMENT ATTENDU =====
--   ROLLBACK
--
-- Les UUID ci-dessous sont ceux d'employés de **Test**. Sur un autre
-- environnement, les remplacer : un employé non manager, un manager du
-- même site, un second employé non manager.
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
-- jeton d'un employé réel de Test. Le test échoue si la mutation PASSE.
--
-- Deux formes de refus, à ne jamais confondre :
--   · le TRIGGER lève 42501            → on attend une exception ;
--   · la RLS masque simplement la ligne → 0 ligne touchée, AUCUNE erreur.
--     Attendre une exception là serait un test qui ne mord pas.
-- =====================================================================

\set EMPLOYE  '868d0b92-bf65-4c99-be43-656911919afd'
\set MANAGER  '28810f30-8182-4126-920f-051a4c7cb596'
\set SITE     'nexus-station-test'

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

-- Un troisième quart, volontairement SANS caisse : fdj_cash_controls
-- porte un unique sur shift_id (une caisse par quart), donc la
-- contre-épreuve « le manager peut encore créer une caisse » a besoin
-- d'un quart vierge.
insert into public.fdj_shifts (id, site, date, quart, employee_id, statut, ouvert_le)
values ('55555555-5555-4555-8555-555555555555', :'SITE', '2026-09-18', '1',
        :'EMPLOYE', 'brouillon', now());

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
      '{"sub":"868d0b92-bf65-4c99-be43-656911919afd","role":"authenticated"}', true);
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
    '{"sub":"868d0b92-bf65-4c99-be43-656911919afd","role":"authenticated"}', true);
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
    '{"sub":"868d0b92-bf65-4c99-be43-656911919afd","role":"authenticated"}', true);
  update public.fdj_cash_controls
     set statut = 'conforme', valide_par = '868d0b92-bf65-4c99-be43-656911919afd', valide_le = now()
   where id = '44444444-4444-4444-8444-444444444444';
  get diagnostics v_lignes = row_count;
  execute 'reset role';
  if v_lignes <> 0 then
    raise exception 'M3 ÉCHOUE — un employé a validé la caisse d''un collègue (% ligne).', v_lignes;
  end if;
  raise notice 'M3 PASSE — un employé ne peut pas valider la caisse d''un collègue.';
end $$;

-- =====================================================================
-- M4 — L'employé ne peut plus LIRE les caisses de ses collègues.
--      AVANT la Phase C, il lisait tout le site. C'est le gain net.
-- =====================================================================
do $$
declare v_miennes integer; v_autres integer;
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    '{"sub":"868d0b92-bf65-4c99-be43-656911919afd","role":"authenticated"}', true);
  select count(*) into v_miennes from public.fdj_cash_controls
   where id = '33333333-3333-4333-8333-333333333333';
  select count(*) into v_autres from public.fdj_cash_controls
   where id = '44444444-4444-4444-8444-444444444444';
  execute 'reset role';
  if v_autres <> 0 then
    raise exception 'M4 ÉCHOUE — l''employé lit encore la caisse d''un collègue.';
  end if;
  if v_miennes <> 1 then
    raise exception 'M4 ÉCHOUE — l''employé ne lit plus sa PROPRE caisse : Ma Progression serait vidée en silence.';
  end if;
  raise notice 'M4 PASSE — l''employé lit sa caisse (1) et plus celle du collègue (0).';
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
      '{"sub":"868d0b92-bf65-4c99-be43-656911919afd","role":"authenticated"}', true);
    update public.fdj_shifts
       set employee_id = '868d0b92-bf65-4c99-be43-656911919afd'
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
      '{"sub":"868d0b92-bf65-4c99-be43-656911919afd","role":"authenticated"}', true);
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
    '{"sub":"868d0b92-bf65-4c99-be43-656911919afd","role":"authenticated"}', true);
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
      '{"sub":"868d0b92-bf65-4c99-be43-656911919afd","role":"authenticated"}', true);
    insert into public.fdj_audit_log (site, entite_type, action, acteur_id)
    values ('nexus-station-test', 'fdj_shifts', 'test_imputation',
            '28810f30-8182-4126-920f-051a4c7cb596');
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
    '{"sub":"868d0b92-bf65-4c99-be43-656911919afd","role":"authenticated"}', true);
  insert into public.fdj_audit_log (site, entite_type, action, acteur_id)
  values ('nexus-station-test', 'fdj_shifts', 'test_soi_meme',
          '868d0b92-bf65-4c99-be43-656911919afd');
  insert into public.fdj_audit_log (site, entite_type, action, acteur_id)
  values ('nexus-station-test', 'fdj_shifts', 'test_automatique', null);
  get diagnostics v_lignes = row_count;
  execute 'reset role';
  raise notice 'M8 bis PASSE — journalisation en son nom et journalisation automatique intactes.';
end $$;

-- =====================================================================
-- M9 — Le MANAGER, lui, continue de tout faire : contrôler, valider,
--      réattribuer. La fermeture ne doit pas casser l'écran qui valide.
-- =====================================================================
do $$
declare v_lignes integer;
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    '{"sub":"28810f30-8182-4126-920f-051a4c7cb596","role":"authenticated"}', true);

  update public.fdj_cash_controls
     set statut = 'conforme', valide_par = '28810f30-8182-4126-920f-051a4c7cb596',
         valide_le = now(), resultat_controle = 'avec_ecart',
         motif_ecart_texte = 'contrôle manager'
   where id = '33333333-3333-4333-8333-333333333333';
  get diagnostics v_lignes = row_count;
  if v_lignes <> 1 then
    raise exception 'M9 ÉCHOUE — le manager ne peut plus valider une caisse (% ligne).', v_lignes;
  end if;

  update public.fdj_shifts set employee_id = '755a2dc5-3390-4a29-a865-847cbebc1133'
   where id = '11111111-1111-4111-8111-111111111111';
  get diagnostics v_lignes = row_count;
  if v_lignes <> 1 then
    raise exception 'M9 ÉCHOUE — le manager ne peut plus réattribuer un quart (% ligne).', v_lignes;
  end if;

  insert into public.fdj_cash_controls (site, shift_id, caisse_attendue, statut)
  values ('nexus-station-test', '55555555-5555-4555-8555-555555555555', 10, 'provisoire');

  insert into public.fdj_reports (site, shift_id, type_rapport)
  values ('nexus-station-test', '55555555-5555-4555-8555-555555555555', 'journalier');

  execute 'reset role';
  raise notice 'M9 PASSE — le manager valide, réattribue, crée une caisse et un report.';
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
      '{"sub":"28810f30-8182-4126-920f-051a4c7cb596","role":"authenticated"}', true);
    insert into public.fdj_corrections (site, shift_id) values ('nexus-station-test', '11111111-1111-4111-8111-111111111111');
    v_passee := true;
  exception when others then raise notice 'M10 PASSE — refus (%) : %', sqlstate, sqlerrm;
  end;
  execute 'reset role';
  if v_passee then
    raise exception 'M10 ÉCHOUE — fdj_corrections accepte encore une écriture directe.';
  end if;
end $$;

do $$ begin raise notice '===== LES DIX MUTATIONS ONT LE COMPORTEMENT ATTENDU ====='; end $$;
