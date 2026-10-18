# Procédure d'application en Production — migration 20261018200000 (sécurité DEFINER, étape 5)

**Cette procédure n'est pas autorisée par sa seule existence.** Elle s'exécute sous un GO d'exécution distinct de Frédéric, après fusion et promotion (chacune sous son propre GO). Aucune fusion ni déploiement n'en découle. Lot : `SECURITE-DEFINER-ETAPE5-20261018`, request-1 sur le rail `handoff-continuite-20260920`.

Chemin d'écriture : connecteur Supabase `execute_sql` (rôle `postgres`). `apply_migration` est exclu (il horodate lui-même). Cible : `uzhjpqpctpvxytxpxoqz`.

## Avant
Relire le rail (décision matérialisée) puis la base : registre sans la version, 17 fonctions à `search_path=public`, 8 fonctions de trigger ouvertes à `anon` et `authenticated`.

## Transaction unique
```sql
begin;
select pg_advisory_xact_lock(hashtext('securite_definer_etape5'));
do $$
begin
  if exists (select 1 from supabase_migrations.schema_migrations where version = '20261018200000') then
    raise exception 'DEJA INSCRITE : version 20261018200000 presente au registre';
  end if;
  if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.prosecdef and p.proconfig::text = '{search_path=public}'
         and p.oid::regprocedure::text in ('carburant_resoudre_prix_achat_snapshot()', 'current_employee_role()', 'current_employee_site_id()', 'est_pompiste_du_jour(text)', 'est_receptionniste_livraison_du_jour(text,date)', 'fdj_sync_releve_apres_cash_control()', 'fdj_tracer_correction_stock_initial()', 'flag_modification_apres_validation()', 'flag_mouvement_non_justifie()', 'je_suis_createur()', 'nexus_clients_ecriture_ok(text)', 'nexus_clients_lecture_ok(text)', 'nexus_forcer_site_unique()', 'nexus_identifiant_de_connexion(text)', 'nexus_inventaire_detecter_conditionnement()', 'nexus_site_de_reference(text,text)', 'nexus_site_supprimable()')) <> 17 then
    raise exception 'ETAT INATTENDU : les 17 fonctions ne portent pas toutes search_path=public';
  end if;
  if (select count(*) from pg_proc p
       where p.oid::regprocedure::text in ('carburant_resoudre_prix_achat_snapshot()', 'fdj_sync_releve_apres_cash_control()', 'fdj_tracer_correction_stock_initial()', 'flag_modification_apres_validation()', 'flag_mouvement_non_justifie()', 'nexus_forcer_site_unique()', 'nexus_inventaire_detecter_conditionnement()', 'nexus_site_supprimable()')
         and has_function_privilege('anon', p.oid, 'execute')
         and has_function_privilege('authenticated', p.oid, 'execute')) <> 8 then
    raise exception 'ETAT INATTENDU : les 8 fonctions de trigger ne sont pas toutes ouvertes';
  end if;
  if not has_function_privilege('anon', 'public.nexus_identifiant_de_connexion(text)', 'execute') then
    raise exception 'EXCEPTION ETAPE 4 ROMPUE : anon a perdu EXECUTE sur nexus_identifiant_de_connexion';
  end if;
  if has_function_privilege('anon', 'public.nexus_garde_regularisation_reception()', 'execute') then
    raise exception 'ETAT INATTENDU : la garde de regularisation est ouverte a anon';
  end if;
end $$;
-- corps du fichier supabase/migrations/20261018200000_securite_definer_search_path_et_triggers_fermes.sql,
-- octet pour octet (blob Git a33ad47844d0a01cafbbd492da670164b700b09b ; verifier avant de coller)
insert into supabase_migrations.schema_migrations (version, name)
values ('20261018200000', 'securite_definer_search_path_et_triggers_fermes');
commit;
```
Un second passage échoue à la première garde (et, sans elle, à la deuxième). DDL et inscription sont dans la même transaction.

## Postconditions
1. Une seule ligne `20261018200000` au registre ; 320 lignes.
2. Les 17 fonctions portent `search_path=public, pg_temp`, restent SECURITY DEFINER et propriétaires `postgres`.
3. Les 8 fonctions de trigger n'ont plus `EXECUTE` pour `public`, `anon`, `authenticated` ; `service_role` le garde.
4. Les 9 triggers liés restent actifs (`tgenabled = 'O'`).
5. `nexus_identifiant_de_connexion(text)` garde `EXECUTE` pour `anon` ; appel sous `anon` d'un prénom connu et unique renvoie son `username`.
6. `nexus_garde_regularisation_reception()` inchangée (fermée à `anon`).
7. Le job `nexus-inventaire-reviews` a un passage `succeeded` après l'opération.
8. Insertion `shifts` et `inventaire_mouvements` sous `authenticated` (blocs annulés) : acceptées.
9. Appel direct des 8 fonctions sous `anon` et `authenticated` : refus `42501`.
10. Les autres fonctions SECURITY DEFINER : `proconfig` inchangé.

## Retour arrière
```sql
alter function public.<nom>(<arguments>) set search_path = public;                       -- x17
grant execute on function public.<nom>() to public, anon, authenticated;                  -- x8
delete from supabase_migrations.schema_migrations where version = '20261018200000';
```
