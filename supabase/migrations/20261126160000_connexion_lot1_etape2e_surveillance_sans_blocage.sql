-- Connexion lot 1, étape 2e : le compteur de succès devient une surveillance, sans blocage (revue Guardian sur a1c3ccab).
-- Un plafond commun à toutes les stations (IP de sortie partagée) couperait la connexion de NEXUS entier.
-- Seul un 429 d'Auth lui-même provoque un refus « indisponible », décidé dans l'Edge Function.
-- compter_succes journalise 'egress_proche' à 60 succès en 5 min et renvoie le nombre ; elle ne bloque rien.
-- Test uniquement. Service_role seul.

drop function if exists nexus_connexion.compter_succes(int, int);

create function nexus_connexion.compter_succes(p_fenetre_min int default 5, p_seuil int default 60) returns jsonb
language plpgsql volatile security definer set search_path = nexus_connexion, public, pg_temp as
$$
declare n int;
begin
  select count(*) into n from nexus_connexion.journal
   where evenement = 'succes' and at > now() - make_interval(mins => p_fenetre_min);
  if n >= p_seuil then
    insert into nexus_connexion.journal (evenement, detail) values ('egress_proche', jsonb_build_object('n', n, 'seuil', p_seuil, 'fenetre_min', p_fenetre_min));
  end if;
  return jsonb_build_object('n', n, 'proche', n >= p_seuil);
end $$;

do $g$
declare f text;
begin
  for f in select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'nexus_connexion' loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $g$;
