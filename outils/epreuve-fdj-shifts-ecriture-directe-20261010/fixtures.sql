-- Fixtures de l'épreuve « quarts et comptages FDJ : écriture directe fermée ».
-- Deux stations ; aucune donnée réelle.

insert into public.sites (site_id, nom_entreprise, timezone) values
  ('site-a', 'Station A (épreuve)', 'America/Martinique'),
  ('site-b', 'Station B (épreuve)', 'America/Martinique');

insert into public.employees (id, username, nom, role, site_id, actif) values
  ('a0000000-0000-0000-0000-000000000001', 'fds-manager-a',   'Manager A',   'manager',  'site-a', true),
  ('a0000000-0000-0000-0000-000000000004', 'fds-caissier-a',  'Caissier A',  'caissier', 'site-a', true),
  ('a0000000-0000-0000-0000-000000000005', 'fds-collegue-a',  'Collègue A',  'caissier', 'site-a', true),
  ('b0000000-0000-0000-0000-000000000004', 'fds-caissier-b',  'Caissier B',  'caissier', 'site-b', true);

insert into public.fdj_games (id, site, nom, prix) values
  ('9a000000-0000-0000-0000-000000000001', 'site-a', 'Jeu A (épreuve)', 2),
  ('9b000000-0000-0000-0000-000000000001', 'site-b', 'Jeu B (épreuve)', 2);

create function pg_temp.j(n integer) returns date language sql as
  $$ select (now() at time zone 'America/Martinique')::date + n $$;
create function pg_temp.qui(p uuid) returns void language sql as
  $$ select set_config('request.jwt.claim.sub', coalesce(p::text, ''), true) $$;
create function pg_temp.ok(c boolean, m text) returns void language plpgsql as
  $$ begin if c is not true then raise exception 'ÉCHEC : %', m; end if; end $$;
create function pg_temp.refus(q text, attendu text) returns void language plpgsql as $$
begin
  begin
    execute q;
  exception when others then
    if position(attendu in sqlerrm) = 0 then
      raise exception 'ÉCHEC : refus inattendu « % » au lieu de « % »', sqlerrm, attendu;
    end if;
    return;
  end;
  raise exception 'ÉCHEC : accepté alors que « % » était attendu', attendu;
end $$;

-- Quart 1 : brouillon du caissier A (son quart ouvert).
-- Quart 2 : quart validé du caissier A, antérieur (clos ; précédent légitime).
-- Quart 3 : brouillon d'un collègue, même site.
-- Quart 4 : brouillon de la station B.
insert into public.fdj_shifts (id, site, date, quart, employee_id, statut) values
  ('fd000000-0000-0000-0000-000000000001', 'site-a', pg_temp.j(0),  '1', 'a0000000-0000-0000-0000-000000000004', 'brouillon'),
  ('fd000000-0000-0000-0000-000000000002', 'site-a', pg_temp.j(-3), '1', 'a0000000-0000-0000-0000-000000000004', 'valide'),
  ('fd000000-0000-0000-0000-000000000003', 'site-a', pg_temp.j(0),  '2', 'a0000000-0000-0000-0000-000000000005', 'brouillon'),
  ('fd000000-0000-0000-0000-000000000004', 'site-b', pg_temp.j(0),  '1', 'b0000000-0000-0000-0000-000000000004', 'brouillon');
insert into public.fdj_shift_counts (site, shift_id, game_id, stock_initial, appro, stock_final) values
  ('site-a', 'fd000000-0000-0000-0000-000000000002', '9a000000-0000-0000-0000-000000000001', 50, 0, 40);

create function pg_temp.muter(f text, ancre text, remplacement text) returns void language plpgsql as $$
declare d text := pg_get_functiondef(f::regproc);
begin
  if (length(d) - length(replace(d, ancre, ''))) / length(ancre) <> 1 then
    raise exception 'MUTATION MANQUÉE : « % » non unique dans %', ancre, f;
  end if;
  execute replace(d, ancre, remplacement);
end $$;

-- Contre-témoin : `psql -v mutation=mutations/X.sql` débranche une règle.
\if :{?mutation}
\i :mutation
\endif
