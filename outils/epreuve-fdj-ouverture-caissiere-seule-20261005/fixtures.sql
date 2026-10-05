-- Fixtures (dans la transaction du scénario ; tout est annulé par rollback)
insert into public.sites(site_id, nom_entreprise, timezone) values ('site-role', 'Rôle', 'Indian/Reunion');
insert into public.employees(id, username, nom, role, site_id) values
  ('00000000-0000-0000-0000-0000000000c1', 'role-caissiere', 'Caissière', 'caissier', 'site-role'),
  ('00000000-0000-0000-0000-0000000000a1', 'role-pompiste', 'Pompiste', 'pompiste', 'site-role'),
  ('00000000-0000-0000-0000-0000000000a2', 'role-renfort', 'Renfort', 'pompiste', 'site-role'),
  ('00000000-0000-0000-0000-0000000000a3', 'role-polyvalent', 'Polyvalent', 'pompiste', 'site-role'),
  ('00000000-0000-0000-0000-0000000000a4', 'role-manager', 'Manager', 'manager', 'site-role');
-- Une prise de poste « matin » en cours par rôle (le quart FDJ visé est le 1).
insert into public.shifts(id, employee_id, site, site_id, role, quart, statut, heure_debut) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000c1', 'site-role', 'site-role', 'caissiere',  'matin', 'en_cours', now()),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000a1', 'site-role', 'site-role', 'pompiste',   'matin', 'en_cours', now()),
  ('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000a2', 'site-role', 'site-role', 'renfort',    'matin', 'en_cours', now()),
  ('00000000-0000-0000-0000-0000000000d4', '00000000-0000-0000-0000-0000000000a3', 'site-role', 'site-role', 'polyvalent', 'matin', 'en_cours', now()),
  ('00000000-0000-0000-0000-0000000000d5', '00000000-0000-0000-0000-0000000000a4', 'site-role', 'site-role', 'manager',    'matin', 'en_cours', now());

create function pg_temp.qui(p uuid) returns void language sql as
  $$ select set_config('request.jwt.claim.sub', p::text, true) $$;
create function pg_temp.ok(c boolean, m text) returns void language plpgsql as
  $$ begin if c is not true then raise exception 'ÉCHEC : %', m; end if; end $$;
create function pg_temp.quarts() returns bigint language sql as
  $$ select count(*) from public.fdj_shifts where site = 'site-role' $$;
create function pg_temp.journal() returns bigint language sql as
  $$ select count(*) from public.fdj_audit_log where site = 'site-role' and action = 'fdj_quart_ouvert_par_prise_de_poste' $$;
-- Un rôle hors caisse : refusé, sans quart ni journal.
create function pg_temp.refuse(emp uuid, pdp uuid, motif text, etiquette text) returns void language plpgsql as $$
declare r jsonb;
begin
  perform pg_temp.qui(emp);
  r := public.fdj_ouvrir_quart_depuis_prise_de_poste(pdp);
  perform pg_temp.ok((r->>'ouvert')::boolean is false, etiquette || ' refusé (reçu ' || r::text || ')');
  perform pg_temp.ok(r->>'motif' = motif, etiquette || ' motif ' || motif || ' (reçu ' || coalesce(r->>'motif', 'NULL') || ')');
  perform pg_temp.ok(coalesce(r->>'message', '') <> '', etiquette || ' message affichable');
  perform pg_temp.ok(pg_temp.quarts() = 0, etiquette || ' aucun quart FDJ écrit');
  perform pg_temp.ok(pg_temp.journal() = 0, etiquette || ' aucune ouverture journalisée');
end $$;
