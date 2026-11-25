-- Connexion lot 1, étape 2g : budget global d'appels à Auth sur le chemin a_migrer (arbitrage Guardian, 7149651796).
-- Mesure du 25/11 sur Test : environ 0,4 appel/s sans 429, environ 0,8/s avec 429 intermittents (IP de sortie de l'Edge partagée).
-- Seul le chemin a_migrer appelle Auth sur un échec. Au-delà de 20 appels par minute, la fonction répond 503 « indisponible »
-- sans appeler Auth et sans toucher aucun compteur de compte ; journal 'budget_auth' avec le nombre de comptes a_migrer restants.
-- Test uniquement. Service_role seul.

alter table nexus_connexion.parametres add column if not exists budget_auth_min int not null default 20;

create or replace function nexus_connexion.budget_auth() returns jsonb
language plpgsql volatile security definer set search_path = nexus_connexion, public, pg_temp as
$$
declare n int; m int; reste int;
begin
  perform pg_advisory_xact_lock(hashtext('nexus_connexion.budget_auth'));
  select budget_auth_min into m from nexus_connexion.parametres where id = 1;
  select count(*) into n from nexus_connexion.journal where evenement = 'appel_auth' and at > now() - interval '1 minute';
  if n >= m then
    select count(*) into reste from nexus_connexion.compte where etat = 'a_migrer';
    if not exists (select 1 from nexus_connexion.journal where evenement = 'budget_auth' and at > now() - interval '1 minute') then
      insert into nexus_connexion.journal (evenement, detail) values ('budget_auth', jsonb_build_object('n', n, 'budget_min', m, 'a_migrer_restants', reste));
    end if;
    return jsonb_build_object('ok', false, 'n', n);
  end if;
  insert into nexus_connexion.journal (evenement, detail) values ('appel_auth', '{}'::jsonb);
  return jsonb_build_object('ok', true, 'n', n + 1);
end $$;

do $g$
declare f text;
begin
  for f in select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'nexus_connexion' loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $g$;
