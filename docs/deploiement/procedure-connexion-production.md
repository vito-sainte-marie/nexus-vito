# Connexion sécurité, lot 1 — procédure Production

Migrations : les douze fichiers `supabase/migrations/2026112609*` à `20261126220000_*` (étapes 1, 2, 2b à 2i, 4, 4b). Fonction : `supabase/functions/connexion/index.ts`. Page : `NEXUS-Login-v1.html`.

**Rien de ceci ne s'exécute sans un GO distinct du gérant pour chaque étape.** Toutes les mesures citées dans les fiches de qualification sont des mesures Test (projet `udljdqxerrbbbajxubfn`). La mesure Production sera faite au GO. Aucune lecture Production n'a été faite pour ce lot.

## 0. Ce que ce lot ne met pas en Production

L'injection de pannes (`nexus_connexion.panne_injectee`, `nexus_connexion.panne_pour`, variable `RECETTE_PANNES`) est un outil de recette Test. Elle est exclue de deux façons, qui se contrôlent séparément.

1. **Côté base : migration 2i** (`20261126200000_connexion_lot1_etape2i_retrait_pannes_injectees.sql`). La 2f crée la table et la fonction ; la 2i les retire. Appliquées dans l'ordre sur une base neuve, elles laissent 16 fonctions et 7 tables (17 fonctions avec l’étape 4, `equipe_pour`). Ni la table ni la fonction n'existent donc jamais durablement en Production.
2. **Côté fonction : retrait du code avant déploiement.** Avant la demande de GO, un commit retire du source `index.ts` la constante `RECETTE_PANNES`, la fonction `panne()` et ses appels. Le md5 du source Production diffère alors de celui de Test, et il est noté dans la demande de GO.

**Preuve sur Test (25/11/2026, projet `udljdqxerrbbbajxubfn`), après application de la 2i :**
- `to_regclass('nexus_connexion.panne_injectee')` = null ; `to_regprocedure('nexus_connexion.panne_pour(uuid,text)')` = null.
- 16 fonctions et 7 tables dans `nexus_connexion` (avant : 17 et 8) ; 0 EXECUTE et 0 SELECT pour `anon` et `authenticated` ; 7 tables sur 7 avec RLS.
- La fonction `connexion` déployée (variable `RECETTE_PANNES` non posée) répond sans la table : mauvais code → 401 neutre `{"ok":false,"erreur":"refus"}` ; bon code → 200 avec session.
- Source sans code de pannes déployé sur Test le 25/11/2026 (version 10, md5 `7a0a9530e017d7758e0872ab1bce3b22`, c'est le source Production) : mauvais code → 401 neutre `{"ok":false,"erreur":"refus"}` ; bon code → 200 avec session. Le source de Production est celui du dépôt à ce md5.

## 1. Ordre réel Production

| # | Étape | Qui | Condition |
|---|---|---|---|
| 1 | Migrations, dans l'ordre des horodatages (étape 1 … 4b) | Guardian | GO distinct |
| 2 | Secrets de la fonction : `AUTH_MASTER_SECRET`, `PEPPER`, `IP_FP_SECRET`, `ORIGINES_AUTORISEES=https://app.nexusconseil.net` | le gérant, jamais lus ni journalisés par l'exécutant | GO distinct ; étape 1 faite |
| 3 | Déploiement de la fonction `connexion` (source sans code de pannes) | Guardian | GO distinct ; étapes 1 et 2 faites |
| 4 | Bascule de `NEXUS-Login-v1.html` vers la fonction | fusion de la PR | GO distinct ; recette navigateur publiée (375 et 1280, Jour et Nuit) ; étape 3 faite |

Le secret `AUTH_MASTER_SECRET` ne se change plus après l'étape 4 sans réinitialiser tous les comptes migrés (le mot de passe Auth en dérive). La date de rotation est une décision du gérant, à prendre avant le GO.

Étape 1 : la migration 2 de l'étape 1 sauvegarde les mots de passe Auth dans `sauvegarde_auth` ; elle ne les modifie pas. Aucun compte n'est migré par les migrations : le passage `a_migrer` → `migre` se fait à la première connexion réussie, station par station (budget 20 appels Auth par minute).

## 2. Retour arrière de chaque étape

| Étape | Retour arrière |
|---|---|
| 4 Page | Revenir au `NEXUS-Login-v1.html` précédent (revert de la fusion). L'ancienne page appelle Auth directement avec `nexus_identifiant_de_connexion`, qui doit donc rester en place. Les comptes déjà migrés ont un mot de passe Auth dérivé : l'ancienne page ne peut plus les connecter. **La page ne se rebascule donc qu'avant la première migration réelle d'un compte**, sinon seule la réinitialisation par un gérant les répare. |
| 3 Fonction | Supprimer la fonction `connexion` (ou la redéployer à la version précédente). Sans elle, la page bascule rend « indisponible ». |
| 2 Secrets | Supprimer les secrets. Ne jamais les journaliser. |
| 1 Migrations | `outils/recette/connexion_lot1/99_retour_arriere.sql`, `99b`, `99c` (pannes, comptes incohérents), `99d` (budget), `99e` (limite IP), `99f` (étapes 4 et 4b : `equipe_pour` retirée, `auteur_autorise` rétablie), dans l'ordre inverse. Pour la 2i : recréer la table et la fonction depuis la 2f est inutile en Production (outil de recette), aucun retour arrière n'est requis. Le schéma est supprimé en dernier. |

## 3. Mesures à refaire en Production (lecture seule, catalogue)

**Avant l'étape 1** (état de départ attendu : le schéma n'existe pas)
```sql
begin read only;
select to_regnamespace('nexus_connexion') as schema_connexion;
select count(*) as pgcrypto from pg_extension where extname = 'pgcrypto';
select count(*) as fonctions_publiques
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('nexus_connexion_email_de', 'nexus_identifiant_de_connexion');
rollback;
```

**Après l'étape 1** (valeurs mesurées sur Test, à comparer)
```sql
begin read only;
select count(*) filter (where c.relkind = 'r') as tables,
       count(*) filter (where c.relkind = 'r' and c.relrowsecurity) as tables_rls
from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'nexus_connexion';
select count(*) as fonctions from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'nexus_connexion';
select to_regclass('nexus_connexion.panne_injectee') as panne_table, to_regprocedure('nexus_connexion.panne_pour(uuid,text)') as panne_fonction;
select count(*) as exec_anon_auth from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'nexus_connexion' and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'));
select count(*) as select_anon_auth from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'nexus_connexion' and c.relkind = 'r' and (has_table_privilege('anon', c.oid, 'select') or has_table_privilege('authenticated', c.oid, 'select'));
rollback;
```
Attendu (mesuré sur Test le 25/11/2026 après 4b) : 7 tables, 7 avec RLS, 17 fonctions (16 avant l’étape 4), `panne_table` et `panne_fonction` null, 0 EXECUTE, 0 SELECT.

**Avant l'étape 4 : comptage des comptes par station** (à lancer seulement sur GO ; le filtre par site est obligatoire)
```sql
begin read only;
select s.site_id, count(*) as comptes
from public.staff s
where s.site_id = '<site_du_GO>'
group by 1;
rollback;
```
Les colonnes exactes de `staff` se vérifient au GO, sur le catalogue, avant de lancer la requête. Les comptes `a_migrer` incertains ne sont pas touchés.

**Après l'étape 4** : par station, nombre de comptes `a_migrer` restants (`select count(*) from nexus_connexion.compte where etat = 'a_migrer'`, rapproché du site), jusqu'à zéro avant la station suivante ; nombre d'événements `budget_auth`, `egress_proche` et `incoherence_auth` au journal ; alerte gérant : au moins 3 réponses 5xx en 1 minute sur `connexion`.

## 4. Décisions du gérant à prendre avant le GO

Durée de conservation du journal, destinataires de l'alerte, date de rotation des secrets, code à 6 chiffres, validité du code temporaire (24 h).

## 5. Source de la fonction (mise à jour étape 4)

Le source `index.ts` ajoute l'action `lister_equipe` (md5 `97dbf34dafd22aefe1f13dc8f8f89325`, déployé sur Test le 25/11/2026, version 13, sans code de pannes ; l’étape 4b journalise le refus de `lister_equipe` et applique la règle gérant/manager validée). Le md5 du source Production est à renoter dans la demande de GO. Mesure Test : `lister_equipe` sans JWT → 403 neutre ; les autres actions répondent comme avant.
