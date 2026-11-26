# Procédure : créer, retrouver et vérifier un compte employé (connexion à alias opaque)

Valable après la migration `20261126090000_connexion_lot1_etape1_alias_opaque` (Test : appliquée ; Production : pas avant GO distinct).
Qui : le propriétaire du projet Supabase (console, rôle `postgres` ou `service_role`). Aucun employé, manager ou gérant ne peut créer un compte aujourd'hui (voir `docs/securite_connexion_phase_a.md`, point 2).

## Pourquoi cette procédure change
L'écran de connexion appelle la RPC `nexus_identifiant_de_connexion(prénom)`, qui renvoie un alias opaque (HMAC du `id` du compte), puis ouvre une session avec `<alias>@vito-nexus.local` et le code. Un compte créé à la main avec `<username>@vito-nexus.local` ne peut donc plus se connecter. L'e-mail doit être celui que calcule la base.

## 1. Créer le compte
1. Créer la fiche : `public.employees` avec `id`, `nom` (le prénom saisi à l'écran, unique parmi les actifs), `username`, `site_id`, rôle, `actif = true`.
2. Console Supabase, Authentication > Users > Add user : créer l'utilisateur avec **le même `id`** que la fiche (`employees.id` = `auth.users.id`). Si la console ne permet pas de fixer l'id, créer l'utilisateur d'abord, puis créer la fiche avec l'id obtenu. E-mail provisoire : n'importe quelle valeur en `@vito-nexus.local`. Mot de passe : le code court (6 caractères maximum, pavé numérique), confirmé automatiquement.
3. Poser l'e-mail définitif, éditeur SQL, rôle `postgres`/`service_role` (remplacer `<ID>`) :
```sql
update auth.users set email = public.nexus_connexion_email_de('<ID>'::uuid), updated_at = now() where id = '<ID>'::uuid;
update auth.identities set identity_data = jsonb_set(identity_data, '{email}', to_jsonb(public.nexus_connexion_email_de('<ID>'::uuid))), updated_at = now()
 where user_id = '<ID>'::uuid and provider = 'email';
```
`nexus_connexion_email_de` n'est exécutable que par `service_role` (et `postgres`) : ni `anon` ni `authenticated` ne peuvent la lancer.

## 2. Vérifier (obligatoire après chaque création ou réinitialisation)
- Lancer `outils/recette/connexion_lot1/02_controle_email_opaque.sql` : **0 ligne attendue**. Une ligne = e-mail non opaque, différent de l'alias, ou identité Auth désaccordée.
- Essai réel : se connecter sur l'écran de connexion avec le prénom et le code. Sur Test, avec un compte fictif seulement ; en Production, par la personne concernée à son poste.

## 3. Retrouver un compte dans la console (les e-mails sont illisibles)
La console n'affiche plus que 32 caractères hexadécimaux. La clé de lecture est l'identifiant :
```sql
select e.id, e.nom, e.username, e.site_id, u.email, u.last_sign_in_at
from public.employees e join auth.users u on u.id = e.id
where lower(e.nom) like lower('%<prénom>%');
```
Dans Authentication > Users, recopier l'`id` obtenu dans le filtre « User UID ». Pour l'inverse (une ligne de la console vers l'employé) : `select nom from public.employees where id = '<UID>'`. L'ancien e-mail de chaque compte migré reste lisible dans `nexus_connexion.sauvegarde_auth` (`email_avant`), rôle `postgres`/`service_role` seulement.

## 4. Secret HMAC : nature, rotation, droits
- Le secret est une ligne de `nexus_connexion.secret` (32 octets, créée par `gen_random_bytes` dans la migration). Il n'est pas dans le dépôt. **Il diffère entre Test et Production : c'est voulu**, car la migration le crée sur chaque base. Un alias mesuré sur Test n'a aucune valeur en Production.
- Qui le lit ou le change : `postgres` et `service_role` seulement. Le schéma est fermé à `anon`, `authenticated` et `public` ; la RPC et la fonction d'alias sont `SECURITY DEFINER`.
- Quand le changer : fuite ou soupçon de fuite du secret, départ d'une personne qui y avait accès. Pas de rotation périodique nécessaire : l'alias n'est pas un mot de passe, il n'ouvre rien sans le code.
- **Effet d'une rotation : tous les alias changent, donc tous les e-mails Auth de tous les comptes liés sont à réécrire** dans la même transaction. Script prêt, non rejoué : `outils/recette/connexion_lot1/98_rotation_secret.sql` (sauvegarde de l'ancienne clé, nouvelle clé, réécriture, garde, retour arrière décrit en pied de script). En Production : GO du gérant, appliqué par Guardian, hors horaires de prise de poste. Les sessions ouvertes ne sont pas coupées ; seules les nouvelles connexions utilisent le nouvel alias.
- Un compte créé après la rotation suit la procédure ci-dessus sans changement.

## 5. Désactiver un compte
Mettre `employees.actif = false` suffit pour que la RPC renvoie un alias leurre (le compte n'est plus trouvable). Bannir en plus l'utilisateur Auth si le code est compromis. Ne pas supprimer la ligne `auth.users` d'un employé qui a de l'historique.

## 6. Retour arrière de l'étape 1
`outils/recette/connexion_lot1/99_retour_arriere.sql` : restaure `auth.users.email` et `auth.identities.identity_data->email` depuis `nexus_connexion.sauvegarde_auth` et recrée l'ancienne RPC. Limites : seuls les comptes présents dans la sauvegarde (créés avant l'étape) sont restaurés ; un compte créé après l'étape garde son e-mail opaque et ne pourra plus se connecter avec l'ancienne RPC (à recréer à la main sous `<username>@vito-nexus.local`). `updated_at` des lignes restaurées change.
