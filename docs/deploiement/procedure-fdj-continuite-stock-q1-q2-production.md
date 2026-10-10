# Procédure — 20261010170000, continuité des stocks Q1/Q2 (Production)

**Statut : non exécutée.** Projet `uzhjpqpctpvxytxpxoqz`.
Fichier : `supabase/migrations/20261010170000_fdj_continuite_stock_q1_q2.sql`, blob git `f65daf8a912121ec46621316fbfec8c81d075875`.

## Pourquoi une procédure

La migration crée `fdj_manager_aligner_fin_quart_precedent(uuid, text)` et **remplace** `fdj_manager_modifier_quart(uuid, date, text, text)`, que l'écran servi appelle déjà. La garde d'ordre refuse donc l'état « additive » (`CIBLE_DEJA_DEPENDANTE`). Le remplacement garde la signature, le type de retour et l'ACL ; seul `valide_le` change (`coalesce(valide_le, now())` au lieu de `now()`).

- **Migration d'abord** : l'écran servi continue de fonctionner ; un quart validé réenregistré garde sa date de validation au lieu de la perdre. Aucune rupture.
- **Code d'abord** : l'écran du candidat enregistre le quart, puis l'appel de `fdj_manager_aligner_fin_quart_precedent` échoue en `PGRST202` ; l'écran le signale (« la fin du quart précédent n'a pas été rapprochée ») et la rupture reste visible. Aucune écriture partielle.

Ordre retenu : **migration d'abord, code ensuite**.

## Gestes

1. **Préflight en lecture seule** (`begin read only … rollback`), rejoué juste avant d'écrire :
   - registre = 306, dernière estampille `20261010150000`, `20261010170000` absente ;
   - `fdj_manager_aligner_fin_quart_precedent` absente ;
   - md5 de `pg_get_functiondef('public.fdj_manager_modifier_quart(uuid,date,text,text)')` = `4c49e39b6aae9ed607e25dceab80bcc7` (mesuré le 10/10 23:25Z). Toute autre valeur arrête la procédure.
2. **Application Test puis Production**, chacune sur GO distinct de Frédéric, par le connecteur `execute_sql` (jamais `apply_migration`) : une transaction avec un bloc `DO` gardé (registre exact, version absente), le texte, puis la ligne du registre.
3. **Constat** en lecture seule : deux fonctions `security definer`, `search_path=''`, `EXECUTE` à `authenticated` et `service_role` seulement ; estampille au registre.
4. **Fusion** de la PR vers `production` sur GO, puis **déploiement constaté** par sha256 de `NEXUS-FDJ-Manager-v1.html` et `nexus-fdj-moteur.js` servis.
5. **Recette navigateur** sur désignation : correction d'un début Q2 avec fin Q1 enregistrée (motif exigé, alerte), renseignement d'une fin Q1 absente.

## Retour arrière

Sur GO distinct : `drop function public.fdj_manager_aligner_fin_quart_precedent(uuid, text);`, rétablir `fdj_manager_modifier_quart` depuis `20261010150000_fdj_shifts_counts_ecriture_directe_fermee.sql`, supprimer la ligne du registre. L'écran du candidat retombe alors dans le cas « code d'abord » ci-dessus.
