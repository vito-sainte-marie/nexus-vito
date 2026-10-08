-- Fixtures de l'épreuve des versements de régularisation (P2).
-- Deux stations, dates relatives au jour de la station (America/Martinique).
-- Aucune donnée réelle : identifiants et noms fictifs.

insert into public.sites (site_id, nom_entreprise, timezone) values
  ('site-a', 'Station A (épreuve)', 'America/Martinique'),
  ('site-b', 'Station B (épreuve)', 'America/Martinique');

insert into public.employees (id, username, nom, role, site_id, actif) values
  ('a0000000-0000-0000-0000-000000000001', 'evr-manager-a',   'Manager A',   'manager',  'site-a', true),
  ('a0000000-0000-0000-0000-000000000002', 'evr-gerant-a',    'Gérant A',    'gerant',   'site-a', true),
  ('a0000000-0000-0000-0000-000000000003', 'evr-pompiste-a',  'Pompiste A',  'pompiste', 'site-a', true),
  ('a0000000-0000-0000-0000-000000000004', 'evr-caissier-a',  'Caissier A',  'caissier', 'site-a', true),
  ('a0000000-0000-0000-0000-000000000005', 'evr-inactif-a',   'Inactif A',   'manager',  'site-a', false),
  ('a0000000-0000-0000-0000-000000000006', 'evr-pompiste-a2', 'Pompiste A2', 'pompiste', 'site-a', true),
  ('b0000000-0000-0000-0000-000000000001', 'evr-manager-b',   'Manager B',   'manager',  'site-b', true),
  ('b0000000-0000-0000-0000-000000000002', 'evr-pompiste-b',  'Pompiste B',  'pompiste', 'site-b', true);

create function pg_temp.j(n integer) returns date language sql as
  $$ select (now() at time zone 'America/Martinique')::date + n $$;
create function pg_temp.qui(p uuid) returns void language sql as
  $$ select set_config('request.jwt.claim.sub', coalesce(p::text, ''), true) $$;
create function pg_temp.ok(c boolean, m text) returns void language plpgsql as
  $$ begin if c is not true then raise exception 'ÉCHEC : %', m; end if; end $$;
-- Exige un refus portant `attendu` ; tout autre résultat est un ÉCHEC.
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

-- Audits Verify (caisse piste), site A sauf mention.
insert into public.audits_caisse (id, site, date, quart, employes_piste, ecart_piste, ecart_piste_valide, valide_le_piste) values
  -- écart validé de −20 €, un seul responsable
  ('ad000000-0000-0000-0000-000000000001', 'site-a', pg_temp.j(-10), '1', '["a0000000-0000-0000-0000-000000000003"]', -20, -20, now()),
  -- écart non validé
  ('ad000000-0000-0000-0000-000000000002', 'site-a', pg_temp.j(-9),  '1', '["a0000000-0000-0000-0000-000000000003"]', -10, null, null),
  -- quart partagé : deux noms
  ('ad000000-0000-0000-0000-000000000003', 'site-a', pg_temp.j(-8),  '1', '["a0000000-0000-0000-0000-000000000003","a0000000-0000-0000-0000-000000000006"]', -12, -12, now()),
  -- excédent
  ('ad000000-0000-0000-0000-000000000004', 'site-a', pg_temp.j(-7),  '1', '["a0000000-0000-0000-0000-000000000003"]', 5, 5, now()),
  -- quart récepteur déjà validé (J−2, Q1)
  ('ad000000-0000-0000-0000-000000000005', 'site-a', pg_temp.j(-2),  '1', '["a0000000-0000-0000-0000-000000000006"]', 0, 0, now()),
  -- écart de la station B
  ('ad000000-0000-0000-0000-000000000006', 'site-b', pg_temp.j(-10), '1', '["b0000000-0000-0000-0000-000000000002"]', -30, -30, now());

-- FDJ : un quart à régulariser (−15 €) et un quart clôturé à J−3.
insert into public.fdj_shifts (id, site, date, quart, employee_id, statut) values
  ('fd000000-0000-0000-0000-000000000001', 'site-a', pg_temp.j(-10), '1', 'a0000000-0000-0000-0000-000000000004', 'valide'),
  ('fd000000-0000-0000-0000-000000000002', 'site-a', pg_temp.j(-3),  '1', 'a0000000-0000-0000-0000-000000000004', 'valide');
insert into public.fdj_cash_controls (id, site, shift_id, ecart, resultat_controle, valide_par, valide_le) values
  ('fc000000-0000-0000-0000-000000000001', 'site-a', 'fd000000-0000-0000-0000-000000000001', -15, 'a_regulariser', 'a0000000-0000-0000-0000-000000000001', now()),
  ('fc000000-0000-0000-0000-000000000002', 'site-a', 'fd000000-0000-0000-0000-000000000002', 0, 'conforme', 'a0000000-0000-0000-0000-000000000001', now());

-- Versement Verify piste de l'audit −20, reçu par défaut dans le tiroir piste de J−1 Q1.
create function pg_temp.verser(m numeric, dest text default 'tiroir_verify_piste', d date default pg_temp.j(-1),
                               q text default '1', k uuid default gen_random_uuid(),
                               audit uuid default 'ad000000-0000-0000-0000-000000000001',
                               mode text default 'especes', just text default null)
returns jsonb language sql as $$
  select public.enregistrer_versement_regularisation(audit, 'piste', null, m, mode, just, dest,
    case when dest = 'coffre' then null else d end, case when dest = 'coffre' then null else q end, k)
$$;
create function pg_temp.etat() returns jsonb language sql as
  $$ select public.ecart_regularisation_etat('ad000000-0000-0000-0000-000000000001', 'piste', null) $$;

select pg_temp.qui('a0000000-0000-0000-0000-000000000001');

-- Contre-témoin : `psql -v mutation=mutations/X.sql` débranche une règle à
-- l'intérieur de la transaction du bloc ; le rollback la rebranche.
-- L'ancre doit figurer exactement une fois, sinon la mutation viserait à côté.
create function pg_temp.muter(f text, ancre text, remplacement text) returns void language plpgsql as $$
declare d text := pg_get_functiondef(f::regproc);
begin
  if (length(d) - length(replace(d, ancre, ''))) / length(ancre) <> 1 then
    raise exception 'MUTATION MANQUÉE : « % » non unique dans %', ancre, f;
  end if;
  execute replace(d, ancre, remplacement);
end $$;
\if :{?mutation}
\i :mutation
\endif
