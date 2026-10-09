-- Fixtures de la recette C (mandat consolidé du 08/10/2026), jouées sur la
-- base NEXUS Test RÉELLE, dans une transaction annulée à la fin de chaque bloc.
-- Deux stations fictives ; aucun site réel, aucune donnée réelle, aucune
-- lecture de `clients`. Les fixtures sont posées en postgres ; chaque action
-- d'un scénario est jouée ensuite en `authenticated` avec l'identité JWT d'un
-- employé fictif, comme le fait un écran via PostgREST : RLS, droits et
-- contrôles serveur réellement déployés sur Test sont donc ceux qui jugent.

insert into public.sites (site_id, nom_entreprise, timezone) values
  ('site-a', 'Station A (recette C)', 'America/Martinique'),
  ('site-b', 'Station B (recette C)', 'America/Martinique');

insert into public.employees (id, username, nom, role, site_id, actif) values
  ('a0000000-0000-0000-0000-000000000001', 'rc-manager-a',  'Manager A',  'manager',  'site-a', true),
  ('a0000000-0000-0000-0000-000000000003', 'rc-pompiste-a', 'Pompiste A', 'pompiste', 'site-a', true),
  ('a0000000-0000-0000-0000-000000000004', 'rc-caissier-a', 'Caissier A', 'caissier', 'site-a', true),
  ('b0000000-0000-0000-0000-000000000001', 'rc-manager-b',  'Manager B',  'manager',  'site-b', true),
  ('b0000000-0000-0000-0000-000000000004', 'rc-caissier-b', 'Caissier B', 'caissier', 'site-b', true);

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

-- Audit Verify à J−10 Q1 : écart piste de −20 € validé, un seul responsable.
insert into public.audits_caisse (id, site, date, quart, employes_piste, ecart_piste, ecart_piste_valide, valide_le_piste) values
  ('ad000000-0000-0000-0000-000000000001', 'site-a', pg_temp.j(-10), '1', '["a0000000-0000-0000-0000-000000000003"]', -20, -20, now());

-- FDJ : un quart du jour en brouillon (chaîne V1 → V2 → validation), un quart
-- à J−10 validé « à régulariser » (−15 €).
insert into public.fdj_shifts (id, site, date, quart, employee_id, statut) values
  ('fd000000-0000-0000-0000-000000000001', 'site-a', pg_temp.j(0),   '1', 'a0000000-0000-0000-0000-000000000004', 'brouillon'),
  ('fd000000-0000-0000-0000-000000000002', 'site-a', pg_temp.j(-10), '1', 'a0000000-0000-0000-0000-000000000004', 'valide');
insert into public.fdj_cash_controls (id, site, shift_id, ecart, resultat_controle, valide_par, valide_le) values
  ('fc000000-0000-0000-0000-000000000002', 'site-a', 'fd000000-0000-0000-0000-000000000002', -15, 'a_regulariser', 'a0000000-0000-0000-0000-000000000001', now());

-- Versement de l'écart −20 €, reçu par défaut dans le tiroir piste de J−1 Q1.
create function pg_temp.verser(m numeric, dest text default 'tiroir_verify_piste', d date default pg_temp.j(-1),
                               q text default '1', k uuid default gen_random_uuid(),
                               audit uuid default 'ad000000-0000-0000-0000-000000000001',
                               mode text default 'especes', just text default null)
returns jsonb language sql as $$
  select public.enregistrer_versement_regularisation(audit, 'piste', null, m, mode, just, dest,
    case when dest = 'coffre' then null else d end, case when dest = 'coffre' then null else q end, k)
$$;
create function pg_temp.etat(audit uuid default 'ad000000-0000-0000-0000-000000000001') returns jsonb language sql as
  $$ select public.ecart_regularisation_etat(audit, 'piste', null) $$;
create function pg_temp.audit(d date, q text, s text default 'site-a') returns public.audits_caisse language sql as
  $$ select * from public.audits_caisse where site = s and date = d and quart = q $$;
-- Enregistre un quart comme Verify : upsert sur (site, date, quart).
create function pg_temp.enregistrer(f jsonb, vente numeric default 2432.90, d date default pg_temp.j(-2),
                                    q text default '2', s text default 'site-a') returns void language sql as $$
  insert into public.audits_caisse (site, date, quart, vente_boutique, factures_differees)
  values (s, d, q, vente, f)
  on conflict (site, date, quart) do update
    set vente_boutique = excluded.vente_boutique, factures_differees = excluded.factures_differees
$$;
create function pg_temp.ligne(num text, m numeric, incluse boolean default true) returns jsonb language sql as
  $$ select jsonb_build_object('numero_facture', num, 'montant', m, 'client', 'Client fictif',
                               'justificatif', 'Facture Back-office', 'incluse_dans_ventes', incluse) $$;

-- Contre-témoin : `psql -v mutation=mutations/X.sql` débranche une règle dans
-- la transaction du bloc ; le rollback la rebranche.
\if :{?mutation}
\i :mutation
\endif
