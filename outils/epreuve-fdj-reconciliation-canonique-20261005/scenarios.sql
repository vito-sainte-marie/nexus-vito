\set ON_ERROR_STOP 1
\pset tuples_only on
\pset format unaligned
begin;
\i fixtures.sql
do $$
declare
  e1 uuid := '00000000-0000-0000-0000-0000000000e1';
  e2 uuid := '00000000-0000-0000-0000-0000000000e2';
  mg uuid := '00000000-0000-0000-0000-0000000000a1';
  g1 uuid := '00000000-0000-0000-0000-0000000000b1';
  g2 uuid := '00000000-0000-0000-0000-0000000000b2';
  g3 uuid := '00000000-0000-0000-0000-0000000000b3';
  s1 uuid := '00000000-0000-0000-0000-0000000000f1';
  s2 uuid := '00000000-0000-0000-0000-0000000000f2';
  r jsonb; r2 jsonb; n bigint; v numeric; t text;
begin

  -- A. Cas normal : réappro tracé puis activation couverte. Aucun mouvement automatique.
  perform pg_temp.qui(mg);
  r := public.fdj_enregistrer_mouvement_stock('reappro_caisse', jsonb_build_array(jsonb_build_object('game_id', g3, 'quantite', 1)), 'jA-1');
  perform pg_temp.ok((r->'reconciliation'->0->>'transfert_auto')::numeric = 0, 'A réappro sans transfert auto');
  perform pg_temp.qui(e1);
  r := public.fdj_activer_carnet(s1, g3, 2, 'quantite', 'jA-2');
  perform pg_temp.ok((r->>'idempotent')::boolean = false, 'A activation écrite');
  perform pg_temp.ok((r->'reconciliation'->>'non_actives')::numeric = 0, 'A non activés = 0');
  perform pg_temp.ok(pg_temp.n_auto(g3, 'transfert') = 0 and pg_temp.n_auto(g3, 'retour') = 0, 'A aucun mouvement automatique');
  perform pg_temp.ok(pg_temp.alertes(g3) = 0, 'A aucune alerte');
  perform pg_temp.ok(pg_temp.audit('fdj_reconciliation_ambigue') = 0, 'A aucune ambiguïté');
  raise notice 'OK A';
end $$;
\set scenario A
\i ledger.sql
rollback;
begin;
\i fixtures.sql
do $$
declare
  e1 uuid := '00000000-0000-0000-0000-0000000000e1';
  e2 uuid := '00000000-0000-0000-0000-0000000000e2';
  mg uuid := '00000000-0000-0000-0000-0000000000a1';
  g1 uuid := '00000000-0000-0000-0000-0000000000b1';
  g2 uuid := '00000000-0000-0000-0000-0000000000b2';
  g3 uuid := '00000000-0000-0000-0000-0000000000b3';
  s1 uuid := '00000000-0000-0000-0000-0000000000f1';
  s2 uuid := '00000000-0000-0000-0000-0000000000f2';
  r jsonb; r2 jsonb; n bigint; v numeric; t text;
begin

  -- B1. Activation sans réappro préalable, bureau suffisant : transfert auto 1.
  perform pg_temp.qui(e1);
  r := public.fdj_activer_carnet(s1, g1, 1, 'quantite', 'jB-1');
  perform pg_temp.ok((r->'reconciliation'->>'transfert_auto')::numeric = 1, 'B1 transfert auto 1');
  perform pg_temp.ok((r->'reconciliation'->>'non_actives')::numeric = 0, 'B1 caisse non activée 0');
  perform pg_temp.ok((r->'reconciliation'->>'bureau')::numeric = 4, 'B1 bureau 4');
  perform pg_temp.ok(pg_temp.audit('fdj_reconciliation_auto_transfert') = 1, 'B1 audit transfert auto');
  perform pg_temp.ok((select count(*) from public.fdj_stock_movements
     where game_id = g1 and source = 'reconciliation_automatique' and shift_id = s1 and employee_id = e1
       and created_by = e1 and location_source_id = '00000000-0000-0000-0000-0000000000c2'
       and location_destination_id = '00000000-0000-0000-0000-0000000000c1'
       and effective_at = (select effective_at from public.fdj_stock_movements where id = (r->>'mouvement_id')::uuid)
       and justification like '%' || (r->>'mouvement_id') || '%') = 1, 'B1 transfert auto tracé (quart, auteur, emplacements, date d''effet, déclencheur)');
  perform pg_temp.ok(pg_temp.alertes(g1) = 0, 'B1 aucune alerte');
  -- B2. Livraison après activation : bureau vide, activation, puis réception.
  r := public.fdj_activer_carnet(s1, g2, 1, 'quantite', 'jB-2');
  perform pg_temp.ok((r->'reconciliation'->>'anomalie') = 'reconciliation_bureau_insuffisant', 'B2 anomalie explicite');
  perform pg_temp.ok(pg_temp.alertes_ouvertes(g2) = 1, 'B2 alerte ouverte');
  perform pg_temp.qui(mg);
  r := public.fdj_enregistrer_mouvement_stock('reception', jsonb_build_array(jsonb_build_object('game_id', g2, 'quantite', 3)), 'jB-3', null, 'BL-123');
  perform pg_temp.ok((r->'reconciliation'->0->>'transfert_auto')::numeric = 1, 'B2 réception comble le déficit');
  perform pg_temp.ok((r->'reconciliation'->0->>'non_actives')::numeric = 0, 'B2 caisse 0');
  perform pg_temp.ok((r->'reconciliation'->0->>'bureau')::numeric = 2, 'B2 bureau 2');
  perform pg_temp.ok((r->'reconciliation'->0->>'alertes_resolues')::int = 1, 'B2 alerte résolue');
  perform pg_temp.ok((select count(*) from public.fdj_alertes where game_id = g2 and resolue_automatiquement and resolue_le is not null and vue is false) = 1,
    'B2 résolue automatiquement, jamais marquée vue');
  raise notice 'OK B';
end $$;
\set scenario B
\i ledger.sql
rollback;
begin;
\i fixtures.sql
do $$
declare
  e1 uuid := '00000000-0000-0000-0000-0000000000e1';
  e2 uuid := '00000000-0000-0000-0000-0000000000e2';
  mg uuid := '00000000-0000-0000-0000-0000000000a1';
  g1 uuid := '00000000-0000-0000-0000-0000000000b1';
  g2 uuid := '00000000-0000-0000-0000-0000000000b2';
  g3 uuid := '00000000-0000-0000-0000-0000000000b3';
  s1 uuid := '00000000-0000-0000-0000-0000000000f1';
  s2 uuid := '00000000-0000-0000-0000-0000000000f2';
  r jsonb; r2 jsonb; n bigint; v numeric; t text;
begin

  -- C. Le Manager complète la caisse journalière : activation reconstituée sur le quart de Loane,
  --    puis rapprochement hors quart. Même moteur, auteur tracé.
  perform pg_temp.qui(mg);
  r := public.fdj_activer_carnet(s1, g1, 2, 'reconstituee_correction_manager', 'jC-1', 'Caisse journalière complétée');
  perform pg_temp.ok((r->>'par_manager')::boolean, 'C par_manager');
  perform pg_temp.ok((r->>'employee_id')::uuid = e1 and (r->>'created_by')::uuid = mg, 'C employee = titulaire, created_by = manager');
  perform pg_temp.ok((r->'reconciliation'->>'transfert_auto')::numeric = 2, 'C transfert auto 2');
  perform pg_temp.ok((select created_by from public.fdj_stock_movements where game_id = g1 and source = 'reconciliation_automatique') = mg,
    'C transfert auto signé par le manager');
  r := public.fdj_enregistrer_mouvement_stock('rapprochement_activation', jsonb_build_array(jsonb_build_object('game_id', g1, 'quantite', 1)), 'jC-2', 'quart 1');
  perform pg_temp.ok((r->'reconciliation'->0->>'transfert_auto')::numeric = 1, 'C rapprochement → transfert auto 1');
  perform pg_temp.ok((r->'reconciliation'->0->>'bureau')::numeric = 2 and (r->'reconciliation'->0->>'non_actives')::numeric = 0, 'C bureau 2, caisse 0');
  perform pg_temp.ok(pg_temp.q_auto(g1, 'transfert') = 3, 'C 3 carnets sortis du bureau au total');
  raise notice 'OK C';
end $$;
\set scenario C
\i ledger.sql
rollback;
begin;
\i fixtures.sql
do $$
declare
  e1 uuid := '00000000-0000-0000-0000-0000000000e1';
  e2 uuid := '00000000-0000-0000-0000-0000000000e2';
  mg uuid := '00000000-0000-0000-0000-0000000000a1';
  g1 uuid := '00000000-0000-0000-0000-0000000000b1';
  g2 uuid := '00000000-0000-0000-0000-0000000000b2';
  g3 uuid := '00000000-0000-0000-0000-0000000000b3';
  s1 uuid := '00000000-0000-0000-0000-0000000000f1';
  s2 uuid := '00000000-0000-0000-0000-0000000000f2';
  r jsonb; r2 jsonb; n bigint; v numeric; t text;
begin

  -- D1. Annulation d'une activation reconstituée : le bureau récupère exactement ce que l'auto avait sorti.
  perform pg_temp.qui(mg);
  r := public.fdj_activer_carnet(s1, g1, 2, 'reconstituee_correction_manager', 'jD-1');
  perform pg_temp.ok((r->'reconciliation'->>'transfert_auto')::numeric = 2, 'D1 transfert auto 2');
  r := public.fdj_activer_carnet(s1, g1, -2, 'reconstituee_correction_manager', 'jD-2');
  perform pg_temp.ok(r->>'type_mouvement' = 'correction', 'D1 correction');
  perform pg_temp.ok((r->'reconciliation'->>'retour_auto')::numeric = 2, 'D1 retour auto 2');
  perform pg_temp.ok((r->'reconciliation'->>'bureau')::numeric = 5 and (r->'reconciliation'->>'confies')::numeric = 0
     and (r->'reconciliation'->>'actives')::numeric = 0, 'D1 retour à la référence (5/0/0)');
  perform pg_temp.ok(pg_temp.audit('fdj_reconciliation_auto_retour') = 1, 'D1 audit retour auto');
  -- D2. Le retour est borné par le net automatique : un réappro manuel reste en caisse.
  r := public.fdj_enregistrer_mouvement_stock('reappro_caisse', jsonb_build_array(jsonb_build_object('game_id', g3, 'quantite', 1)), 'jD-3');
  r := public.fdj_activer_carnet(s1, g3, 3, 'reconstituee_correction_manager', 'jD-4');
  perform pg_temp.ok((r->'reconciliation'->>'transfert_auto')::numeric = 1, 'D2 auto 1 seulement (caisse 2 couvre 2)');
  r := public.fdj_activer_carnet(s1, g3, -3, 'reconstituee_correction_manager', 'jD-5');
  perform pg_temp.ok((r->'reconciliation'->>'retour_auto')::numeric = 1, 'D2 retour borné au net auto (1)');
  perform pg_temp.ok((r->'reconciliation'->>'confies')::numeric = 2 and (r->'reconciliation'->>'bureau')::numeric = 1,
     'D2 caisse 2 (réf 1 + réappro 1), bureau 1');
  -- D3. Rejouer la correction ne rend rien deux fois.
  r := public.fdj_activer_carnet(s1, g3, -3, 'reconstituee_correction_manager', 'jD-5');
  perform pg_temp.ok((r->>'idempotent')::boolean and pg_temp.n_auto(g3, 'retour') = 1, 'D3 rejeu correction sans second retour');
  raise notice 'OK D';
end $$;
\set scenario D
\i ledger.sql
rollback;
begin;
\i fixtures.sql
do $$
declare
  e1 uuid := '00000000-0000-0000-0000-0000000000e1';
  e2 uuid := '00000000-0000-0000-0000-0000000000e2';
  mg uuid := '00000000-0000-0000-0000-0000000000a1';
  g1 uuid := '00000000-0000-0000-0000-0000000000b1';
  g2 uuid := '00000000-0000-0000-0000-0000000000b2';
  g3 uuid := '00000000-0000-0000-0000-0000000000b3';
  s1 uuid := '00000000-0000-0000-0000-0000000000f1';
  s2 uuid := '00000000-0000-0000-0000-0000000000f2';
  r jsonb; r2 jsonb; n bigint; v numeric; t text;
begin

  -- E. Idempotence : rejeu du même jeton, Employé et Manager.
  perform pg_temp.qui(e1);
  r := public.fdj_activer_carnet(s1, g1, 1, 'quantite', 'jE-1');
  n := pg_temp.n_mvt();
  r2 := public.fdj_activer_carnet(s1, g1, 1, 'quantite', 'jE-1');
  perform pg_temp.ok((r2->>'idempotent')::boolean and not (r2 ? 'reconciliation'), 'E rejeu activation sans réconciliation');
  perform pg_temp.ok(pg_temp.n_mvt() = n and pg_temp.n_auto(g1, 'transfert') = 1, 'E aucun doublon (mouvement ni transfert auto)');
  perform pg_temp.ok(pg_temp.audit('fdj_activation_carnet') = 1 and pg_temp.audit('fdj_reconciliation_auto_transfert') = 1, 'E journal non dupliqué');
  perform pg_temp.qui(mg);
  r := public.fdj_enregistrer_mouvement_stock('reception', jsonb_build_array(jsonb_build_object('game_id', g2, 'quantite', 2)), 'jE-2');
  n := pg_temp.n_mvt();
  r2 := public.fdj_enregistrer_mouvement_stock('reception', jsonb_build_array(jsonb_build_object('game_id', g2, 'quantite', 2)), 'jE-2');
  perform pg_temp.ok((r2->>'idempotent')::boolean and (r2->>'rejeux')::int = 1 and jsonb_array_length(r2->'reconciliation') = 0, 'E rejeu réception');
  perform pg_temp.ok(pg_temp.n_mvt() = n, 'E réception non dupliquée');
  -- Même jeton, autre auteur : clé distincte (auth.uid dans la clé), pas un rejeu.
  perform pg_temp.qui(mg);
  r := public.fdj_activer_carnet(s1, g1, 1, 'reconstituee_correction_manager', 'jE-1');
  perform pg_temp.ok((r->>'idempotent')::boolean = false, 'E même jeton, autre auteur et méthode : écrit');
  raise notice 'OK E';
end $$;
\set scenario E
\i ledger.sql
rollback;
begin;
\i fixtures.sql
do $$
declare
  e1 uuid := '00000000-0000-0000-0000-0000000000e1';
  e2 uuid := '00000000-0000-0000-0000-0000000000e2';
  mg uuid := '00000000-0000-0000-0000-0000000000a1';
  g1 uuid := '00000000-0000-0000-0000-0000000000b1';
  g2 uuid := '00000000-0000-0000-0000-0000000000b2';
  g3 uuid := '00000000-0000-0000-0000-0000000000b3';
  s1 uuid := '00000000-0000-0000-0000-0000000000f1';
  s2 uuid := '00000000-0000-0000-0000-0000000000f2';
  r jsonb; r2 jsonb; n bigint; v numeric; t text;
begin

  -- F1. Ambiguïté : bureau vide. Alerte explicite + audit, pas de transfert inventé.
  perform pg_temp.qui(e1);
  r := public.fdj_activer_carnet(s1, g2, 1, 'quantite', 'jF-1');
  perform pg_temp.ok((r->'reconciliation'->>'transfert_auto')::numeric = 0, 'F1 aucun transfert inventé');
  perform pg_temp.ok((r->'reconciliation'->>'non_actives')::numeric = -1, 'F1 déficit visible -1');
  perform pg_temp.ok(pg_temp.n_auto(g2, 'transfert') = 0, 'F1 aucun mouvement auto');
  perform pg_temp.ok((select count(*) from public.fdj_alertes where game_id = g2 and motif = 'reconciliation_bureau_insuffisant'
     and valeur_saisie = -1 and shift_id = s1 and employee_id = e1) = 1, 'F1 alerte motif reconciliation_bureau_insuffisant, -1');
  perform pg_temp.ok(pg_temp.audit('fdj_reconciliation_ambigue') = 1, 'F1 audit ambigu');
  -- F2. Seconde activation ambiguë : pas de seconde alerte, un second audit.
  r := public.fdj_activer_carnet(s1, g2, 1, 'quantite', 'jF-2');
  perform pg_temp.ok(pg_temp.alertes(g2) = 1 and pg_temp.audit('fdj_reconciliation_ambigue') = 2, 'F2 une alerte, deux audits');
  -- F3. Ambiguïté hors quart (rapprochement manager) : audit seulement, aucune alerte orpheline.
  perform pg_temp.qui(mg);
  r := public.fdj_enregistrer_mouvement_stock('rapprochement_activation', jsonb_build_array(jsonb_build_object('game_id', g2, 'quantite', 1)), 'jF-3');
  perform pg_temp.ok(r->'reconciliation'->0->>'anomalie' = 'reconciliation_bureau_insuffisant', 'F3 anomalie');
  perform pg_temp.ok(pg_temp.alertes(g2) = 1 and pg_temp.audit('fdj_reconciliation_ambigue') = 3, 'F3 audit sans alerte supplémentaire');
  raise notice 'OK F';
end $$;
\set scenario F
\i ledger.sql
rollback;
begin;
\i fixtures.sql
do $$
declare
  e1 uuid := '00000000-0000-0000-0000-0000000000e1';
  e2 uuid := '00000000-0000-0000-0000-0000000000e2';
  mg uuid := '00000000-0000-0000-0000-0000000000a1';
  g1 uuid := '00000000-0000-0000-0000-0000000000b1';
  g2 uuid := '00000000-0000-0000-0000-0000000000b2';
  g3 uuid := '00000000-0000-0000-0000-0000000000b3';
  s1 uuid := '00000000-0000-0000-0000-0000000000f1';
  s2 uuid := '00000000-0000-0000-0000-0000000000f2';
  r jsonb; r2 jsonb; n bigint; v numeric; t text;
begin

  -- M. Motif d'exception déclaré par l'employé : alerte écrite par le RPC, une seule, valeur « solde à ce moment ».
  perform pg_temp.qui(e1);
  r := public.fdj_activer_carnet(s1, g2, 1, 'quantite', 'jM-1', null, 'carnet_trouve_en_caisse');
  perform pg_temp.ok(pg_temp.alertes(g2) = 1, 'M1 une seule alerte (motif), pas d''alerte helper en plus');
  perform pg_temp.ok((select count(*) from public.fdj_alertes where game_id = g2 and motif = 'carnet_trouve_en_caisse'
     and valeur_saisie = 0 and resolue_le is null) = 1, 'M1 alerte motif, solde avant = 0, ouverte');
  perform pg_temp.ok(pg_temp.audit('fdj_reconciliation_ambigue') = 1, 'M1 audit ambigu');
  -- Rejeu : aucune seconde alerte.
  r := public.fdj_activer_carnet(s1, g2, 1, 'quantite', 'jM-1', null, 'carnet_trouve_en_caisse');
  perform pg_temp.ok(pg_temp.alertes(g2) = 1, 'M1 rejeu sans seconde alerte');
  -- M2. Motif déclaré alors que le bureau couvrait : alerte écrite puis résolue automatiquement dans la même transaction.
  r := public.fdj_activer_carnet(s1, g1, 1, 'quantite', 'jM-2', null, 'carnet_trouve_en_caisse');
  perform pg_temp.ok((select count(*) from public.fdj_alertes where game_id = g1 and valeur_saisie = 0
     and resolue_automatiquement and vue is false) = 1, 'M2 alerte motif résolue automatiquement, non vue');
  perform pg_temp.ok((r->'reconciliation'->>'alertes_resolues')::int = 1, 'M2 résolution comptée');
  raise notice 'OK M';
end $$;
\set scenario M
\i ledger.sql
rollback;
begin;
\i fixtures.sql
do $$
declare
  e1 uuid := '00000000-0000-0000-0000-0000000000e1';
  e2 uuid := '00000000-0000-0000-0000-0000000000e2';
  mg uuid := '00000000-0000-0000-0000-0000000000a1';
  g1 uuid := '00000000-0000-0000-0000-0000000000b1';
  g2 uuid := '00000000-0000-0000-0000-0000000000b2';
  g3 uuid := '00000000-0000-0000-0000-0000000000b3';
  s1 uuid := '00000000-0000-0000-0000-0000000000f1';
  s2 uuid := '00000000-0000-0000-0000-0000000000f2';
  r jsonb; r2 jsonb; n bigint; v numeric; t text;
begin

  -- G. Multi-interface sur le même jeu : Employé quart 1, Manager sur le quart 2, Employé quart 2.
  perform pg_temp.qui(e1);
  r := public.fdj_activer_carnet(s1, g1, 1, 'quantite', 'jG-1');
  perform pg_temp.qui(mg);
  r := public.fdj_activer_carnet(s2, g1, 1, 'reconstituee_correction_manager', 'jG-2');
  perform pg_temp.ok((r->>'employee_id')::uuid = e2, 'G manager : employee_id = titulaire du quart 2');
  perform pg_temp.qui(e2);
  r := public.fdj_activer_carnet(s2, g1, 1, 'quantite', 'jG-3');
  perform pg_temp.ok((r->'reconciliation'->>'bureau')::numeric = 2 and (r->'reconciliation'->>'non_actives')::numeric = 0
     and (r->'reconciliation'->>'actives')::numeric = 3, 'G bureau 2, actives 3, caisse 0');
  perform pg_temp.ok(pg_temp.n_auto(g1, 'transfert') = 3, 'G trois transferts auto, un par déclencheur');
  perform pg_temp.ok((select count(distinct created_by) from public.fdj_stock_movements where game_id = g1 and source = 'reconciliation_automatique') = 3,
    'G chaque transfert auto signé par son auteur');
  -- Un employé ne peut pas activer sur le quart d'un collègue.
  perform pg_temp.qui(e1);
  begin
    r := public.fdj_activer_carnet(s2, g1, 1, 'quantite', 'jG-4');
    raise exception 'ÉCHEC : G employé sur quart d''autrui accepté';
  exception when insufficient_privilege then null;
  end;
  -- Un employé ne peut pas reconstituer.
  begin
    r := public.fdj_activer_carnet(s1, g1, 1, 'reconstituee_correction_manager', 'jG-5');
    raise exception 'ÉCHEC : G employé reconstitue';
  exception when insufficient_privilege then null;
  end;
  raise notice 'OK G';
end $$;
\set scenario G
\i ledger.sql
rollback;
begin;
\i fixtures.sql
do $$
declare
  e1 uuid := '00000000-0000-0000-0000-0000000000e1';
  e2 uuid := '00000000-0000-0000-0000-0000000000e2';
  mg uuid := '00000000-0000-0000-0000-0000000000a1';
  g1 uuid := '00000000-0000-0000-0000-0000000000b1';
  g2 uuid := '00000000-0000-0000-0000-0000000000b2';
  g3 uuid := '00000000-0000-0000-0000-0000000000b3';
  s1 uuid := '00000000-0000-0000-0000-0000000000f1';
  s2 uuid := '00000000-0000-0000-0000-0000000000f2';
  r jsonb; r2 jsonb; n bigint; v numeric; t text;
begin

  -- R. Rétroactivité : une réception saisie aujourd'hui avec date d'effet antérieure à la référence est ignorée.
  perform pg_temp.qui(mg);
  r := public.fdj_enregistrer_mouvement_stock('reception', jsonb_build_array(jsonb_build_object('game_id', g2, 'quantite', 4)), 'jR-1',
         null, null, null, now() - interval '3 days');
  perform pg_temp.ok((r->'reconciliation'->0->>'bureau')::numeric = 0, 'R mouvement antérieur à la référence non compté');
  -- Une réception datée après la référence mais avant l'activation compte, quelle que soit l'heure de saisie.
  r := public.fdj_enregistrer_mouvement_stock('reception', jsonb_build_array(jsonb_build_object('game_id', g2, 'quantite', 2)), 'jR-2',
         null, null, null, now() - interval '1 day');
  perform pg_temp.qui(e1);
  r := public.fdj_activer_carnet(s1, g2, 1, 'quantite', 'jR-3');
  perform pg_temp.ok((r->'reconciliation'->>'transfert_auto')::numeric = 1 and (r->'reconciliation'->>'bureau')::numeric = 1, 'R réception rétroactive couvre');
  perform pg_temp.ok((select effective_at from public.fdj_stock_movements where game_id = g2 and source = 'reconciliation_automatique')
     = now() - interval '3 hours', 'R transfert auto daté à l''effet du déclencheur (ouverture du quart)');
  raise notice 'OK R';
end $$;
\set scenario R
\i ledger.sql
rollback;
begin;
\i fixtures.sql
select pg_temp.qui('00000000-0000-0000-0000-0000000000e1');
set local role authenticated;
do $$ begin perform public.fdj_reconcilier_caisse_jeu(gen_random_uuid()); raise exception 'ÉCHEC : helper ouvert à authenticated'; exception when insufficient_privilege then raise notice 'OK ACL helper fermé à authenticated'; end $$;
do $$ declare r jsonb; begin r := public.fdj_activer_carnet('00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-0000000000b1',1,'quantite','jACL'); if (r->'reconciliation'->>'transfert_auto')::numeric <> 1 then raise exception 'ÉCHEC ACL : réconciliation non faite sous authenticated'; end if; raise notice 'OK ACL activation sous authenticated réconcilie'; end $$;
rollback;
