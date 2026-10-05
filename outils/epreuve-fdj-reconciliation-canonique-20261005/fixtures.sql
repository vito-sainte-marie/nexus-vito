-- Fixtures (dans la transaction du scénario ; tout est annulé par rollback)
insert into public.sites(site_id, nom_entreprise, timezone) values ('site-reco', 'Reco', 'Indian/Reunion');
insert into public.employees(id, username, nom, role, site_id) values
  ('00000000-0000-0000-0000-0000000000e1', 'reco-e1', 'Loane', 'caissier', 'site-reco'),
  ('00000000-0000-0000-0000-0000000000e2', 'reco-e2', 'Second', 'caissier', 'site-reco'),
  ('00000000-0000-0000-0000-0000000000a1', 'reco-mg', 'Manager', 'manager', 'site-reco');
insert into public.fdj_games(id, site, nom, prix, tickets_par_carnet) values
  ('00000000-0000-0000-0000-0000000000b1', 'site-reco', 'JEU BUREAU5', 3, 50),
  ('00000000-0000-0000-0000-0000000000b2', 'site-reco', 'JEU VIDE', 10, 30),
  ('00000000-0000-0000-0000-0000000000b3', 'site-reco', 'JEU NORMAL', 5, 40);
insert into public.fdj_locations(id, site, nom, type, actif) values
  ('00000000-0000-0000-0000-0000000000c1', 'site-reco', 'Caisse', 'caisse', true),
  ('00000000-0000-0000-0000-0000000000c2', 'site-reco', 'Bureau', 'bureau', true),
  ('00000000-0000-0000-0000-0000000000c3', 'site-reco', 'Bloqué', 'bloque', true);
insert into public.fdj_stock_references(id, site, date, statut, created_at) values
  ('00000000-0000-0000-0000-0000000000d1', 'site-reco', current_date - 2, 'valide', now() - interval '2 days');
insert into public.fdj_stock_reference_lignes(reference_id, site, game_id, bureau_reel, caisse_reel) values
  ('00000000-0000-0000-0000-0000000000d1', 'site-reco', '00000000-0000-0000-0000-0000000000b1', 5, 0),
  ('00000000-0000-0000-0000-0000000000d1', 'site-reco', '00000000-0000-0000-0000-0000000000b2', 0, 0),
  ('00000000-0000-0000-0000-0000000000d1', 'site-reco', '00000000-0000-0000-0000-0000000000b3', 2, 1);
insert into public.fdj_shifts(id, site, date, quart, employee_id, statut, ouvert_le) values
  ('00000000-0000-0000-0000-0000000000f1', 'site-reco', current_date, '1', '00000000-0000-0000-0000-0000000000e1', 'brouillon', now() - interval '3 hours'),
  ('00000000-0000-0000-0000-0000000000f2', 'site-reco', current_date, '2', '00000000-0000-0000-0000-0000000000e2', 'brouillon', now() - interval '1 hour');

create function pg_temp.qui(p uuid) returns void language sql as
  $$ select set_config('request.jwt.claim.sub', p::text, true) $$;
create function pg_temp.ok(c boolean, m text) returns void language plpgsql as
  $$ begin if c is not true then raise exception 'ÉCHEC : %', m; end if; end $$;
create function pg_temp.n_auto(g uuid, t text) returns bigint language sql as
  $$ select count(*) from public.fdj_stock_movements
      where site = 'site-reco' and game_id = g and type_mouvement = t
        and source = 'reconciliation_automatique' $$;
create function pg_temp.q_auto(g uuid, t text) returns numeric language sql as
  $$ select coalesce(sum(quantite), 0) from public.fdj_stock_movements
      where site = 'site-reco' and game_id = g and type_mouvement = t
        and source = 'reconciliation_automatique' $$;
create function pg_temp.n_mvt() returns bigint language sql as
  $$ select count(*) from public.fdj_stock_movements where site = 'site-reco' $$;
create function pg_temp.alertes(g uuid) returns bigint language sql as
  $$ select count(*) from public.fdj_alertes where site = 'site-reco' and game_id = g
      and type = 'activation_sans_carnet_confie' $$;
create function pg_temp.alertes_ouvertes(g uuid) returns bigint language sql as
  $$ select count(*) from public.fdj_alertes where site = 'site-reco' and game_id = g
      and type = 'activation_sans_carnet_confie' and resolue_le is null and resolue_automatiquement is false $$;
create function pg_temp.audit(a text) returns bigint language sql as
  $$ select count(*) from public.fdj_audit_log where site = 'site-reco' and action = a $$;
