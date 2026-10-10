# Procédure — 20261010150000, écriture directe fermée sur `fdj_shifts` et `fdj_shift_counts` (Production)

**Statut : non exécutée.** Chaque geste exige un GO distinct de Frédéric. Projet `uzhjpqpctpvxytxpxoqz`.
Fichier : `supabase/migrations/20261010150000_fdj_shifts_counts_ecriture_directe_fermee.sql`, blob git `79fc02bb727af3ed8c942bf88d06358bc6ebb660`.

## Pourquoi une procédure

Aucun ordre n'est sans rupture : les deux sens cassent l'écran pendant l'intervalle.

- **Migration d'abord** : l'écran servi écrit directement dans `fdj_shifts` et `fdj_shift_counts` (`insert`, `update`, `upsert`). Le revoke de la migration ferme ces chemins, et chaque enregistrement échoue en `42501`.
- **Code d'abord** : l'écran du candidat appelle onze RPC qui n'existent pas en Production, de `fdj_valider_ouverture_quart` à `fdj_manager_marquer_a_revoir`, sauf `fdj_incrementer_appro_shift_count`. Chaque appel échoue en `PGRST202` (fonction introuvable).

Dans les deux cas, l'échec est franc : il n'y a ni écriture partielle ni donnée corrompue, puisque chaque RPC est une transaction. Le critère qui reste est la **durée de l'intervalle**. La garde détecte aussi `truncate` (dans un `revoke`), ce qui exige d'office cet état.

Ordre retenu : **code d'abord, migration aussitôt après**. On l'applique hors des changements de quart, pour que l'intervalle se compte en minutes et tombe là où personne n'ouvre ni ne clôt un quart.

## Gestes

1. **Fusion** de la PR vers `production`, sur GO.
2. **Déploiement constaté** : relire `NEXUS-FDJ-v1.html` et `NEXUS-FDJ-Manager-v1.html` servis, puis comparer leur sha256 à l'artefact construit. Un 200 ne suffit pas.
3. **Préflight en lecture seule** (`begin read only … rollback`), rejoué juste avant d'écrire :
   - le registre vaut exactement la valeur mesurée, et `20261010150000` en est absente ;
   - parmi les quinze fonctions, seule `fdj_incrementer_appro_shift_count(text,uuid,uuid,numeric)` existe, avec un md5 de `pg_get_functiondef` égal à `775d78d5103b3b9056fa43c9089db08d`. Toute autre valeur arrête la procédure.
4. **Application**, sur un GO distinct. On passe par le connecteur `execute_sql`, jamais par `apply_migration`, qui réestampille la version. Une seule transaction exécute un bloc `DO` gardé (registre exact, version absente, md5 du texte transmis), puis le texte, puis la ligne du registre.
5. **Constat** en lecture seule :
   - les quinze fonctions sont présentes, `security definer`, avec `EXECUTE` pour `authenticated` et `service_role` seulement ;
   - sur les deux tables, `anon` n'a plus aucun privilège ; `authenticated` garde `SELECT` seul ;
   - l'estampille figure au registre.
6. **Recette navigateur** : ouverture d'un quart, comptages, appro et validation côté employé ; création et correction côté manager. Aucun bouton d'écriture n'est cliqué sans désignation de Frédéric.

## Retour arrière

Sur GO distinct :
- regrant des privilèges mesurés (voir la fiche de qualification) ;
- restauration de `fdj_incrementer_appro_shift_count` depuis `20260818135117_fdj_fiabilisation_etape5_idempotence.sql` (security invoker, `EXECUTE` à `PUBLIC`) ;
- suppression des quatorze fonctions nouvelles ;
- suppression de la ligne du registre.

Les écrans du candidat ne fonctionnent plus après ce retour arrière : il s'accompagne du retour de l'écran.
