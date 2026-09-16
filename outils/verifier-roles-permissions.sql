-- NEXUS — les permissions restent sur la fiche, le poste du jour sur le service
-- (05/09/2026, audit A11).
--
-- Deux garanties que seule une vraie base peut donner, et que la suite de
-- non-régression ne peut pas éprouver puisqu'elle n'ouvre aucune connexion :
--
--   1. un employé qui n'est pas manager sur sa FICHE ne peut pas prendre un
--      service « manager » — le poste du jour ne doit jamais devenir un
--      ascenseur d'habilitations ;
--   2. les politiques RLS continuent de lire le rôle ADMINISTRATIF.
--
-- Transaction close par ROLLBACK : rien n'est conservé.
--
--   psql "$URL" -v ON_ERROR_STOP=1 -f outils/verifier-roles-permissions.sql

begin;

do $$
declare
  CAISSIER uuid := (select id from public.employees where username = 'employe-test-b');
  MANAGER  uuid := (select id from public.employees where username = 'manager-test');
  n int; r text := '';
begin
  if CAISSIER is null or MANAGER is null then
    raise exception 'Base inattendue : comptes de recette introuvables.';
  end if;

  -- Le rôle de la fiche est bien « caissier », celui du service « pompiste ».
  select role into r from public.employees where id = CAISSIER;
  if r <> 'caissier' then raise exception 'Scénario attendu : fiche caissier, trouvé %.', r; end if;

  perform set_config('role', 'authenticated', true);

  -- ── 1. Un non-manager ne peut pas prendre un service « manager » ───────
  perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', CAISSIER), true);
  begin
    insert into public.shifts (employee_id, role, role_prevu, confirmed_by, quart, site, statut)
    values (CAISSIER, 'manager', 'caissier', 'employe', 'nuit',
            public.current_employee_site_id(), 'en_cours');
    raise exception 'ÉCHEC — un caissier a pu prendre un service « manager ».';
  exception when insufficient_privilege then
    raise notice 'OK — service « manager » refusé à un non-manager (42501)';
  end;

  -- ── 2. Prendre un poste opérationnel ne retire rien au manager ─────────
  perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', MANAGER), true);
  if public.current_employee_role() <> 'manager' then
    raise exception 'ÉCHEC — le rôle administratif du manager n''est plus lu depuis la fiche.';
  end if;
  select count(*) into n from public.shifts;
  if n < 1 then raise exception 'ÉCHEC — le manager ne voit plus les services de son site.'; end if;
  raise notice 'OK — le manager conserve son rôle administratif et la vue de son équipe (% services)', n;

  -- ── 3. Le poste du jour ne change pas le rôle administratif ────────────
  perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', CAISSIER), true);
  if public.current_employee_role() <> 'caissier' then
    raise exception 'ÉCHEC — current_employee_role() ne lit plus la fiche : %', public.current_employee_role();
  end if;
  select role into r from public.shifts where employee_id = CAISSIER limit 1;
  if r is null or r = 'caissier' then
    raise exception 'Scénario attendu : un service dont le rôle diffère de la fiche, trouvé « % ».', coalesce(r, '∅');
  end if;
  raise notice 'OK — fiche « caissier », service « % » : les deux coexistent sans se contaminer', r;

  raise notice 'OK — les permissions restent adossées au rôle administratif.';
end $$;

-- ── 4. Où chaque politique RLS puise son rôle ───────────────────────────
--
-- 137 politiques lisent le rôle ADMINISTRATIF via current_employee_role() :
-- c'est la couche d'habilitation, elle ne doit jamais suivre le poste du jour.
--
-- UNE politique lit `shifts.role`, et c'est volontaire :
-- `select_mission_assignments` rend visibles les assignations adressées au
-- poste TENU AUJOURD'HUI (`shifts.statut = 'en_cours'`). Un travail confié au
-- pompiste doit s'afficher chez qui est pompiste ce jour-là — c'est une portée
-- opérationnelle, pas une habilitation. Sa branche manager, elle, passe bien
-- par current_employee_role().
--
-- Ce compteur n'est donc pas « attendu à zéro » : il est attendu à UN. S'il
-- augmente, c'est qu'une nouvelle politique s'est mise à dériver des droits du
-- poste du jour — à relire avant de l'accepter.
do $$
declare n_fiche int; n_jour int;
begin
  select count(*) into n_fiche from pg_policies where schemaname='public'
    and (coalesce(qual,'') || coalesce(with_check,'')) like '%current_employee_role%';
  select count(*) into n_jour from pg_policies where schemaname='public'
    and (coalesce(qual,'') || coalesce(with_check,'')) ~ 'shifts\.role';

  if n_fiche < 137 then
    raise exception 'ÉCHEC — % politiques sur le rôle administratif, 137 attendues au minimum.', n_fiche;
  end if;
  if n_jour <> 1 then
    raise exception 'ÉCHEC — % politique(s) dérivent du poste du jour, une seule est prévue (select_mission_assignments).', n_jour;
  end if;
  if not exists (select 1 from pg_policies where schemaname='public'
                 and policyname = 'select_mission_assignments'
                 and coalesce(qual,'') ~ 'shifts\.role') then
    raise exception 'ÉCHEC — la politique attendue sur le poste du jour n''est plus celle qu''on croit.';
  end if;
  raise notice 'OK — % politiques sur la fiche, 1 sur le poste du jour (assignations), comme prévu', n_fiche;
end $$;

rollback;
