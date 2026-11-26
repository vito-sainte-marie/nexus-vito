-- Suppression du compte témoin par id. Un seul paramètre : l'uuid littéral du témoin. Pas de métacommande psql.
do $d$
declare v_id uuid := :'id'::uuid; n int; r record;
begin
  if not exists (select 1 from public.employees where id = v_id and username = 'temoin-connexion' and compte_test = true and nom = 'Temoinconnexion')
    then raise exception 'suppression refusée : cet id n''est pas le compte témoin'; end if;
  delete from nexus_connexion.essais_ip where alias = nexus_connexion.alias_de('u:' || v_id::text);
  get diagnostics n = row_count; raise notice 'essais_ip % (variable)', n;
  delete from nexus_connexion.journal where user_id = v_id;
  get diagnostics n = row_count; raise notice 'journal % (variable)', n;
  delete from nexus_connexion.alerte where user_id = v_id;
  get diagnostics n = row_count; raise notice 'alerte % (attendu 0)', n;
  delete from nexus_connexion.sauvegarde_auth where user_id = v_id;
  get diagnostics n = row_count; raise notice 'sauvegarde_auth % (attendu 0)', n;
  delete from nexus_connexion.compte where user_id = v_id;
  get diagnostics n = row_count; raise notice 'compte % (attendu 1)', n;
  delete from auth.identities where user_id = v_id;
  get diagnostics n = row_count; raise notice 'identities % (attendu 1)', n;
  delete from auth.users where id = v_id;
  get diagnostics n = row_count; raise notice 'auth.users % (attendu 1)', n;
  delete from public.employees where id = v_id;   -- une clé étrangère d'une autre table fait échouer et annule tout
  get diagnostics n = row_count; raise notice 'employees % (attendu 1)', n;
  if n <> 1 then raise exception 'suppression incomplète'; end if;
end $d$;
select (select count(*) from public.employees where username = 'temoin-connexion') as temoins_restants,
       (select count(*) from nexus_connexion.compte c where not exists (select 1 from public.employees e where e.id = c.user_id)
          and not exists (select 1 from auth.users u where u.id = c.user_id)) as compte_orphelins;
-- attendu : 0, 0.
