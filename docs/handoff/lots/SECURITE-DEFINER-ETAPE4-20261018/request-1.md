---
protocol: nexus-handoff/2
kind: request
lot_id: SECURITE-DEFINER-ETAPE4-20261018
seq: 1
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: https://github.com/vito-sainte-marie/nexus-vito/issues/28
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=ff19b8a0 production=8e8b7ba2
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 157-fichiers
---
# SÉCURITÉ SECURITY DEFINER — Étape 4 : `nexus_identifiant_de_connexion(text)` doit rester exécutable par `anon` (aucun SQL, TEST et PRODUCTION lus seulement)

Suite des étapes 1 à 3 (closes). Cette demande ne propose **aucune écriture** : elle demande de constater qu'un `REVOKE … FROM anon` sur cette fonction est **impossible** sans casser la connexion, et de clore l'étape 4 comme **exception documentée**. Seules des lectures de catalogue (SELECT) sur Test et Production et une lecture du code du dépôt ont servi aux mesures. Ni Production, ni GRANT/REVOKE, ni migration, ni fusion, ni `claude.yml`.

## Constat mesuré

**Fonction (Test)** : `public.nexus_identifiant_de_connexion(p_prenom text) returns text`, SQL, STABLE, SECURITY DEFINER, propriétaire `postgres`, `search_path=public, pg_temp` (étape 2). ACL `{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}` : `PUBLIC` n'y figure pas, `anon` si. Corps :

```sql
select case when count(*) = 1 then min(e.username) end
from public.employees e
where (e.actif = true or e.compte_test = true)
  and lower(btrim(e.nom)) = lower(btrim(coalesce(p_prenom, '')));
```

Elle renvoie le `username` d'un compte quand le prénom saisi désigne **exactement un** compte actif (ou de test), sinon `NULL`. Aucune autre colonne, aucune liste.

**Production (lecture seule)** : même signature, SECURITY DEFINER, `postgres`, `search_path=public` (pas encore `pg_temp`), même ACL (`anon`, `authenticated`, `service_role`). La fonction existe : l'absence relevée dans `procedure-migration-login-production.md` est donc résorbée.

**Appelants (dépôt)** : un seul appel applicatif, `NEXUS-Login-v1.html` ligne 146 (`origin/production` et rail), `client.rpc("nexus_identifiant_de_connexion", { p_prenom: prenom })`, exécuté **avant** `signInWithPassword`, donc **sous le rôle `anon`**. Aucune politique RLS ni autre fonction ne la cite (catalogue Test). Le commentaire du fichier explique le choix : elle a **remplacé** une vue lisible en anonyme qui rendait l'annuaire complet (migration `20260904175747_login_non_enumerable`).

## Conséquence

Retirer `EXECUTE` à `anon` ferait échouer l'appel (`42501`), le front tomberait dans `lookupError` et afficherait « Connexion au serveur impossible » : **plus personne ne pourrait se connecter**. La fermeture que visaient les étapes 1 et 3 n'est pas applicable ici.

## Risque résiduel (accepté, non corrigé par cette étape)

Un visiteur muni de la clé publiable peut tester des prénoms et obtenir le `username` correspondant quand il est unique. C'est un oracle d'existence prénom → identifiant, strictement moins grave que la vue d'annuaire remplacée (pas de liste, pas de rôle ni de site), mais réel. Le `username` seul ne donne pas accès : le PIN reste exigé par Supabase Auth. Pas de limitation de débit propre à la fonction.

## SQL proposé

**Aucun.** `search_path=public, pg_temp` est déjà posé sur Test (étape 2) ; son report en Production relève de l'étape 5.

## Préconditions / postconditions

Rien à exécuter, donc rien à vérifier après. Pour l'étape 5, garder cette fonction **hors de tout REVOKE** et l'inclure seulement dans l'`ALTER FUNCTION … SET search_path = public, pg_temp` ; épreuve à prévoir alors : appel sous `anon` d'un prénom connu, unique, renvoie son `username`.

## Retour arrière

Sans objet.

## Ce qui reste hors de cette demande

Suppression de l'oracle (déplacer la résolution prénom → identifiant dans une Edge Function avec limitation de débit, ou connexion par identifiant explicite) : changement de front et de back, demande séparée si souhaitée. Étape 5 (report en Production), les 24 autres fonctions `search_path=public`.

## Question d'arbitrage

Constatez-vous que `nexus_identifiant_de_connexion(text)` doit rester exécutable par `anon` (exception documentée : appelée avant authentification par l'écran de connexion), et clôturez-vous l'étape 4 sans modification de droits ? Réponse attendue : APPROVED / APPROVED_WITH_CONDITIONS / REJECTED, avec `closes`.
