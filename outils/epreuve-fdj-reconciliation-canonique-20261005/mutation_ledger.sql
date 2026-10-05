\set ON_ERROR_STOP 0
\pset tuples_only on
\pset format unaligned
begin;
\i fixtures.sql
create or replace function public.fdj_reconcilier_caisse_jeu(p_declencheur uuid) returns jsonb language sql as $m$ select '{}'::jsonb $m$;
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
    perform pg_temp.qui(e1);
  r := public.fdj_activer_carnet(s1, g3, 2, 'quantite', 'jA-2');
            raise notice 'OK A';
end $$;
\set scenario A
\i ledger.sql
rollback;
begin;
\i fixtures.sql
create or replace function public.fdj_reconcilier_caisse_jeu(p_declencheur uuid) returns jsonb language sql as $m$ select '{}'::jsonb $m$;
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
              -- B2. Livraison après activation : bureau vide, activation, puis réception.
  r := public.fdj_activer_carnet(s1, g2, 1, 'quantite', 'jB-2');
      perform pg_temp.qui(mg);
  r := public.fdj_enregistrer_mouvement_stock('reception', jsonb_build_array(jsonb_build_object('game_id', g2, 'quantite', 3)), 'jB-3', null, 'BL-123');
            raise notice 'OK B';
end $$;
\set scenario B
\i ledger.sql
rollback;
begin;
\i fixtures.sql
create or replace function public.fdj_reconcilier_caisse_jeu(p_declencheur uuid) returns jsonb language sql as $m$ select '{}'::jsonb $m$;
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
          r := public.fdj_enregistrer_mouvement_stock('rapprochement_activation', jsonb_build_array(jsonb_build_object('game_id', g1, 'quantite', 1)), 'jC-2', 'quart 1');
        raise notice 'OK C';
end $$;
\set scenario C
\i ledger.sql
rollback;
begin;
\i fixtures.sql
create or replace function public.fdj_reconcilier_caisse_jeu(p_declencheur uuid) returns jsonb language sql as $m$ select '{}'::jsonb $m$;
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
    r := public.fdj_activer_carnet(s1, g1, -2, 'reconstituee_correction_manager', 'jD-2');
          -- D2. Le retour est borné par le net automatique : un réappro manuel reste en caisse.
  r := public.fdj_enregistrer_mouvement_stock('reappro_caisse', jsonb_build_array(jsonb_build_object('game_id', g3, 'quantite', 1)), 'jD-3');
  r := public.fdj_activer_carnet(s1, g3, 3, 'reconstituee_correction_manager', 'jD-4');
    r := public.fdj_activer_carnet(s1, g3, -3, 'reconstituee_correction_manager', 'jD-5');
      -- D3. Rejouer la correction ne rend rien deux fois.
  r := public.fdj_activer_carnet(s1, g3, -3, 'reconstituee_correction_manager', 'jD-5');
    raise notice 'OK D';
end $$;
\set scenario D
\i ledger.sql
rollback;
begin;
\i fixtures.sql
create or replace function public.fdj_reconcilier_caisse_jeu(p_declencheur uuid) returns jsonb language sql as $m$ select '{}'::jsonb $m$;
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
        perform pg_temp.qui(mg);
  r := public.fdj_enregistrer_mouvement_stock('reception', jsonb_build_array(jsonb_build_object('game_id', g2, 'quantite', 2)), 'jE-2');
  n := pg_temp.n_mvt();
  r2 := public.fdj_enregistrer_mouvement_stock('reception', jsonb_build_array(jsonb_build_object('game_id', g2, 'quantite', 2)), 'jE-2');
      -- Même jeton, autre auteur : clé distincte (auth.uid dans la clé), pas un rejeu.
  perform pg_temp.qui(mg);
  r := public.fdj_activer_carnet(s1, g1, 1, 'reconstituee_correction_manager', 'jE-1');
    raise notice 'OK E';
end $$;
\set scenario E
\i ledger.sql
rollback;
begin;
\i fixtures.sql
create or replace function public.fdj_reconcilier_caisse_jeu(p_declencheur uuid) returns jsonb language sql as $m$ select '{}'::jsonb $m$;
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
            -- F2. Seconde activation ambiguë : pas de seconde alerte, un second audit.
  r := public.fdj_activer_carnet(s1, g2, 1, 'quantite', 'jF-2');
    -- F3. Ambiguïté hors quart (rapprochement manager) : audit seulement, aucune alerte orpheline.
  perform pg_temp.qui(mg);
  r := public.fdj_enregistrer_mouvement_stock('rapprochement_activation', jsonb_build_array(jsonb_build_object('game_id', g2, 'quantite', 1)), 'jF-3');
      raise notice 'OK F';
end $$;
\set scenario F
\i ledger.sql
rollback;
begin;
\i fixtures.sql
create or replace function public.fdj_reconcilier_caisse_jeu(p_declencheur uuid) returns jsonb language sql as $m$ select '{}'::jsonb $m$;
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
        -- Rejeu : aucune seconde alerte.
  r := public.fdj_activer_carnet(s1, g2, 1, 'quantite', 'jM-1', null, 'carnet_trouve_en_caisse');
    -- M2. Motif déclaré alors que le bureau couvrait : alerte écrite puis résolue automatiquement dans la même transaction.
  r := public.fdj_activer_carnet(s1, g1, 1, 'quantite', 'jM-2', null, 'carnet_trouve_en_caisse');
      raise notice 'OK M';
end $$;
\set scenario M
\i ledger.sql
rollback;
begin;
\i fixtures.sql
create or replace function public.fdj_reconcilier_caisse_jeu(p_declencheur uuid) returns jsonb language sql as $m$ select '{}'::jsonb $m$;
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
    perform pg_temp.qui(e2);
  r := public.fdj_activer_carnet(s2, g1, 1, 'quantite', 'jG-3');
        -- Un employé ne peut pas activer sur le quart d'un collègue.
  perform pg_temp.qui(e1);
  begin
    r := public.fdj_activer_carnet(s2, g1, 1, 'quantite', 'jG-4');
    raise notice 'X : G employé sur quart d''autrui accepté';
  exception when insufficient_privilege then null;
  end;
  -- Un employé ne peut pas reconstituer.
  begin
    r := public.fdj_activer_carnet(s1, g1, 1, 'reconstituee_correction_manager', 'jG-5');
    raise notice 'X : G employé reconstitue';
  exception when insufficient_privilege then null;
  end;
  raise notice 'OK G';
end $$;
\set scenario G
\i ledger.sql
rollback;
begin;
\i fixtures.sql
create or replace function public.fdj_reconcilier_caisse_jeu(p_declencheur uuid) returns jsonb language sql as $m$ select '{}'::jsonb $m$;
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
    -- Une réception datée après la référence mais avant l'activation compte, quelle que soit l'heure de saisie.
  r := public.fdj_enregistrer_mouvement_stock('reception', jsonb_build_array(jsonb_build_object('game_id', g2, 'quantite', 2)), 'jR-2',
         null, null, null, now() - interval '1 day');
  perform pg_temp.qui(e1);
  r := public.fdj_activer_carnet(s1, g2, 1, 'quantite', 'jR-3');
      raise notice 'OK R';
end $$;
\set scenario R
\i ledger.sql
rollback;
