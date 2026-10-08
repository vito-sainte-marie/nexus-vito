-- Fixtures de l'épreuve des factures différées (B4, 20261008140000).
-- Deux stations, dates relatives au jour de la station (America/Martinique).
-- Aucune donnée réelle : identifiants, clients et numéros fictifs.

insert into public.sites (site_id, nom_entreprise, timezone) values
  ('site-a', 'Station A (épreuve)', 'America/Martinique'),
  ('site-b', 'Station B (épreuve)', 'America/Martinique');

insert into public.employees (id, username, nom, role, site_id, actif) values
  ('a0000000-0000-0000-0000-000000000001', 'efd-manager-a', 'Manager A', 'manager', 'site-a', true),
  ('a0000000-0000-0000-0000-000000000002', 'efd-gerant-a',  'Gérant A',  'gerant',  'site-a', true),
  ('b0000000-0000-0000-0000-000000000001', 'efd-manager-b', 'Manager B', 'manager', 'site-b', true);

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

-- Une ligne de facture différée telle que l'écran l'envoie.
create function pg_temp.ligne(num text, m numeric, incluse boolean default true, client text default 'Client fictif',
                              just text default 'Facture Back-office') returns jsonb language sql as
  $$ select jsonb_build_object('numero_facture', num, 'montant', m, 'client', client,
                               'justificatif', just, 'incluse_dans_ventes', incluse) $$;
-- Enregistre un quart comme Verify : upsert sur (site, date, quart).
create function pg_temp.enregistrer(f jsonb, vente numeric default 2432.90, d date default pg_temp.j(-1),
                                    q text default '2', s text default 'site-a') returns void language sql as $$
  insert into public.audits_caisse (site, date, quart, vente_boutique, factures_differees)
  values (s, d, q, vente, f)
  on conflict (site, date, quart) do update
    set vente_boutique = excluded.vente_boutique, factures_differees = excluded.factures_differees
$$;
create function pg_temp.audit(d date default pg_temp.j(-1), q text default '2', s text default 'site-a')
returns public.audits_caisse language sql as
  $$ select * from public.audits_caisse where site = s and date = d and quart = q $$;

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
