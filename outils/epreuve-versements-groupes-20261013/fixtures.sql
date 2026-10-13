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
  ('ad000000-0000-0000-0000-000000000006', 'site-b', pg_temp.j(-10), '1', '["b0000000-0000-0000-0000-000000000002"]', -30, -30, now()),
  -- écart du quart 2 (J−6), piste validée, boutique ouverte : chronologie au quart près
  ('ad000000-0000-0000-0000-000000000007', 'site-a', pg_temp.j(-6),  '2', '["a0000000-0000-0000-0000-000000000003"]', -8, -8, now());

-- FDJ : un quart à régulariser (−15 €) et un quart clôturé à J−3.
insert into public.fdj_shifts (id, site, date, quart, employee_id, statut) values
  ('fd000000-0000-0000-0000-000000000001', 'site-a', pg_temp.j(-10), '1', 'a0000000-0000-0000-0000-000000000004', 'valide'),
  ('fd000000-0000-0000-0000-000000000002', 'site-a', pg_temp.j(-3),  '1', 'a0000000-0000-0000-0000-000000000004', 'valide'),
  ('fd000000-0000-0000-0000-000000000003', 'site-a', pg_temp.j(-5),  '1', 'a0000000-0000-0000-0000-000000000004', 'valide');
insert into public.fdj_cash_controls (id, site, shift_id, ecart, resultat_controle, valide_par, valide_le) values
  ('fc000000-0000-0000-0000-000000000001', 'site-a', 'fd000000-0000-0000-0000-000000000001', -15, 'a_regulariser', 'a0000000-0000-0000-0000-000000000001', now()),
  ('fc000000-0000-0000-0000-000000000002', 'site-a', 'fd000000-0000-0000-0000-000000000002', 0, 'conforme', 'a0000000-0000-0000-0000-000000000001', now()),
  -- renvoyé « à revoir » : resultat_controle posé, AUCUNE validation (comme fdj_valider_caisse)
  ('fc000000-0000-0000-0000-000000000003', 'site-a', 'fd000000-0000-0000-0000-000000000003', -10, 'a_revoir', null, null);

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


-- Fixtures propres aux groupes : Angélique (FDJ) a trois manques validés et un quart à revoir.
insert into public.employees (id, username, nom, role, site_id, actif) values
  ('a0000000-0000-0000-0000-000000000007', 'evr-angelique-a', 'Angélique A', 'caissier', 'site-a', true);
insert into public.fdj_shifts (id, site, date, quart, employee_id, statut) values
  ('fd000000-0000-0000-0000-000000000011', 'site-a', pg_temp.j(-9), '1', 'a0000000-0000-0000-0000-000000000007', 'valide'),
  ('fd000000-0000-0000-0000-000000000012', 'site-a', pg_temp.j(-8), '1', 'a0000000-0000-0000-0000-000000000007', 'valide'),
  ('fd000000-0000-0000-0000-000000000013', 'site-a', pg_temp.j(-7), '1', 'a0000000-0000-0000-0000-000000000007', 'valide'),
  ('fd000000-0000-0000-0000-000000000014', 'site-a', pg_temp.j(-6), '1', 'a0000000-0000-0000-0000-000000000007', 'valide');
insert into public.fdj_cash_controls (id, site, shift_id, ecart, resultat_controle, valide_par, valide_le) values
  ('fc000000-0000-0000-0000-000000000011', 'site-a', 'fd000000-0000-0000-0000-000000000011', -4, 'a_regulariser', 'a0000000-0000-0000-0000-000000000001', now()),
  ('fc000000-0000-0000-0000-000000000012', 'site-a', 'fd000000-0000-0000-0000-000000000012', -4, 'a_regulariser', 'a0000000-0000-0000-0000-000000000001', now()),
  ('fc000000-0000-0000-0000-000000000013', 'site-a', 'fd000000-0000-0000-0000-000000000013', -3, 'a_regulariser', 'a0000000-0000-0000-0000-000000000001', now()),
  ('fc000000-0000-0000-0000-000000000014', 'site-a', 'fd000000-0000-0000-0000-000000000014', -2, 'a_revoir', null, null);

create function pg_temp.fa(n text, m numeric) returns jsonb language sql as
  $$ select jsonb_build_object('audit_id', null, 'caisse', null, 'fdj_cash_control_id', 'fc000000-0000-0000-0000-0000000000' || n, 'montant', m) $$;
create function pg_temp.va(a text, m numeric) returns jsonb language sql as
  $$ select jsonb_build_object('audit_id', 'ad000000-0000-0000-0000-00000000000' || a, 'caisse', 'piste', 'fdj_cash_control_id', null, 'montant', m) $$;
-- Versement groupé d'Angélique (FDJ) par défaut, reçu au tiroir FDJ de J−1 Q1.
create function pg_temp.groupe(m numeric, aff jsonb, conf boolean default false, dest text default 'tiroir_fdj',
                               d date default pg_temp.j(-1), q text default '1', k uuid default gen_random_uuid(),
                               emp uuid default 'a0000000-0000-0000-0000-000000000007', dom text default 'fdj',
                               mode text default 'especes', just text default null)
returns jsonb language sql as $$
  select public.enregistrer_versement_groupe(emp, dom, m, mode, just, dest,
    case when dest = 'coffre' then null else d end, case when dest = 'coffre' then null else q end, aff, conf, k)
$$;
create function pg_temp.reste(n text) returns numeric language sql as
  $$ select (public.ecart_regularisation_etat(null, null, ('fc000000-0000-0000-0000-0000000000' || n)::uuid)->>'reste_du')::numeric $$;
create function pg_temp.tiroir(dest text default 'tiroir_fdj') returns numeric language sql as
  $$ select (public._regul_tiroir_detail('site-a', dest, pg_temp.j(-1), '1')->>'net')::numeric $$;

select pg_temp.qui('a0000000-0000-0000-0000-000000000001');

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
