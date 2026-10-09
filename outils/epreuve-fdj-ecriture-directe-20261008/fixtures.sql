-- Fixtures de l'épreuve « caisse FDJ : écriture directe fermée ».
-- Deux stations ; aucune donnée réelle.

insert into public.sites (site_id, nom_entreprise, timezone) values
  ('site-a', 'Station A (épreuve)', 'America/Martinique'),
  ('site-b', 'Station B (épreuve)', 'America/Martinique');

insert into public.employees (id, username, nom, role, site_id, actif) values
  ('a0000000-0000-0000-0000-000000000001', 'fde-manager-a',  'Manager A',  'manager',  'site-a', true),
  ('a0000000-0000-0000-0000-000000000004', 'fde-caissier-a', 'Caissier A', 'caissier', 'site-a', true),
  ('b0000000-0000-0000-0000-000000000004', 'fde-caissier-b', 'Caissier B', 'caissier', 'site-b', true);

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

-- Quart 1 : en brouillon, sans caisse (chaîne complète par les commandes).
-- Quart 2 : caisse validée avec écart de −15 € (cible de la tentative directe).
insert into public.fdj_shifts (id, site, date, quart, employee_id, statut) values
  ('fd000000-0000-0000-0000-000000000001', 'site-a', pg_temp.j(0),  '1', 'a0000000-0000-0000-0000-000000000004', 'brouillon'),
  ('fd000000-0000-0000-0000-000000000002', 'site-a', pg_temp.j(-3), '1', 'a0000000-0000-0000-0000-000000000004', 'valide');
insert into public.fdj_cash_controls (id, site, shift_id, ecart, resultat_controle, valide_par, valide_le) values
  ('fc000000-0000-0000-0000-000000000002', 'site-a', 'fd000000-0000-0000-0000-000000000002', -15, 'a_regulariser', 'a0000000-0000-0000-0000-000000000001', now());

-- Contre-témoin : `psql -v mutation=mutations/X.sql` rend un droit retiré.
\if :{?mutation}
\i :mutation
\endif
