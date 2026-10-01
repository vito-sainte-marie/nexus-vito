# Incident Production — connexion NEXUS indisponible après #65

| | |
|---|---|
| Symptôme terrain | « Connexion au serveur impossible » sur `NEXUS-Login-v1.html` |
| Artefact Production audité | `adee9bbcb6fd7e0af7632730ede185e655d04580` (= `origin/production`, merge de #65) |
| Projet Supabase Production | `uzhjpqpctpvxytxpxoqz` |
| Migration manquante | `supabase/migrations/20260904175747_login_non_enumerable.sql` |
| Blob (inchangé depuis sa création) | git `0fa1f02461f70f86a24051874e673d9e7337dca9` — sha256 `186d98915fa210e343c817b0b29c48663a273c640672c18db1837706cabd5c22` |
| Date de l'audit | 01/10/2026 |
| Verdict | **`NO_GO_CORRECTION_PRODUCTION_LOGIN`** — état AVANT de Production non mesuré depuis ce canal |

Ce fichier n'est pas un remplacement de `preflight-20260919103000-production.md` : ce
dernier qualifie une migration *différente*, du même PR #65, toujours non
tranchée. Les deux restent des dossiers séparés — même défaut de rail, deux
objets distincts.

## 1. La chaîne causale, prouvée par l'historique, pas déduite

**`origin/production` est exactement `adee9bb`.** Vérifié :
`git rev-parse origin/production` → `adee9bbcb6fd7e0af7632730ede185e655d04580`,
le même SHA donné dans le réveil. `git merge-base --is-ancestor` dans les deux
sens confirme que `production` ne pointe sur rien d'autre que ce merge.

**`NEXUS-Login-v1.html` en Production appelle bien la fonction manquante**
(ligne 146, vérifié par lecture directe de l'arbre `origin/production`) :

```js
.rpc("nexus_identifiant_de_connexion", { p_prenom: prenom })
```

**La fonction n'existe dans aucune migration de l'arbre `origin/production`.**
`git cat-file -e origin/production:supabase/migrations/20260904175747_login_non_enumerable.sql`
→ *fatal: exists on disk, but not in 'origin/production'*. Recherche élargie
(`git log --all -S nexus_identifiant_de_connexion -- 'supabase/migrations/*'`) :
un seul commit dans tout l'historique crée cette fonction, et il n'est
l'ancêtre d'aucune branche de production.

**D'où vient l'appel sans la migration — le commit exact :**

```
55974aec1df640f31f8ac24b0d707432b376ca3d
fix(login): porter le contrat pre-auth non enumerable (04/09) sur le candidat #65
(Claude, 28/09/2026, co-auteur Claude Opus 5)
```

Ce commit a remplacé l'ancien `NEXUS-Login-v1.html` (requête `ilike` sur
`employees_public`, énumérable) par la version sécurisée du rail
`handoff-continuite-20260920` — **« identique octet pour octet »**, dit son
propre message — mais n'a porté QUE le fichier HTML. Son propre message de
commit **nomme** la migration requise sans jamais la committer :
*« elle passe par la fonction `nexus_identifiant_de_connexion`, dont la
migration 20260904175747_login_non_enumerable garantit une réponse
indistinguable »*. `git show --stat 55974ae` : un seul fichier touché,
`NEXUS-Login-v1.html`.

Ce commit a été fait directement sur la branche candidate de #65
(`reception-regularisation-20260919`, tête mesurée
`5dcdaaa55f5804f88594c91c272439cf77a123b0` — le SHA exact déjà audité dans
`preflight-20260919103000-production.md`), qui a ensuite été fusionnée telle
quelle en Production par le merge `adee9bb`. **Aucun pas intermédiaire n'a
jamais ajouté la migration : ni avant le port, ni après, ni dans le merge.**

**Pourquoi la fonction d'origine, elle, est correcte — ce n'est pas une
régression de contenu.** `supabase/migrations/20260904175747_login_non_enumerable.sql`
a été créée le 04/09/2026 (commit `95cc92a`, branche de sécurisation
`securisation-vues` → rail), avec cette note déjà écrite dans le fichier
**à sa création** :

> ORDRE DE PROMOTION — INCOMPATIBLE AVEC LE CODE ACTUELLEMENT EN PRODUCTION.
> […] appliquer cette migration à la production AVANT d'y promouvoir le
> nouveau `NEXUS-Login-v1.html` rendrait la connexion impossible. Les deux
> vont ensemble, dans cet ordre : code promu, puis migration appliquée.

Le 04/09, l'auteur avait donc déjà anticipé exactement ce risque — dans
l'autre sens. Ce qui s'est produit le 28/09–01/10 n'est pas l'ordre inverse
dont la migration avertit : c'est sa **moitié manquante**. Le code a été
promu (28/09, via le port, puis #65 le 01/10). La migration ne l'a jamais
suivi. Le résultat observable est le même que celui que la note anticipait :
connexion impossible — simplement atteint par l'autre bord.

## 2. Pourquoi aucune gate existante ne l'a vu

- `garde-ordre-migration-code.js` (câblée en préparation, jamais en CI
  bloquante) compare les migrations **nouvelles du candidat par rapport à une
  cible**, et qualifie l'ordre pour celles-là. Ce cas lui échappe
  **structurellement** : la migration manquante n'était dans **aucune** des
  deux listes — ni le candidat de #65, ni `production` avant #65. Rien à
  comparer, donc rien à qualifier. Les deux gardes restent volontairement
  séparées (cf. `README.md`) ; celle-ci n'aurait pas pu voir ce trou même
  pleinement câblée.
- `.github/workflows/deploiement-production.yml` ne publie qu'un artefact
  Pages et **exclut explicitement** `supabase/` de cet artefact (déjà mesuré
  dans `README.md`) : aucune automatisation n'applique ni ne vérifie de
  migration avant de déployer le front.
- Aucun test de ce dépôt (avant ce lot) ne vérifiait qu'un appel RPC du front
  est couvert par une migration de son propre arbre.

## 3. Le trou mécanisé : garde RPC-ORPHELINE

`outils/garde-rpc-orpheline.js` (nouveau, statique, aucun réseau, aucun
secret — preuve par lecture de sa propre source dans
`test_garde_rpc_orpheline_20261001.js`, bloc D). Pour une ref donnée : extrait
chaque `.rpc("nom", …)` des fichiers front réellement publiés sur Pages
(`*.html`/`*.js` à la racine, hors `supabase/`, `outils/`, `docs/`, hors
fichiers `test_*.js`), extrait chaque fonction créée par
`supabase/migrations/*.sql` **du même arbre**, et refuse si un nom appelé
n'est couvert par aucune.

**Rejoué sur le commit réel qui a cassé la Production** (`5dcdaaa5`, tête du
candidat #65) :

```
REFUS — le front appelle une fonction qu'aucune migration de ce même arbre ne définit :
  · nexus_identifiant_de_connexion  appelée par NEXUS-Login-v1.html
```

**Rejoué sur HEAD de ce rail** : `RPC_COUVERTES` — 10 appels RPC distincts,
0 orphelin, 68 fonctions définies, 177 fichiers front scannés. Calibré contre
le dépôt réel avant d'être proposé : un premier passage avec une extraction
naïve (`public\.` non quoté seulement) rendait 4 faux positifs sur des
fonctions du socle Supabase déclarées `"public"."nom"` entre guillemets ;
corrigé, calibration rejouée à zéro faux positif.

`test_garde_rpc_orpheline_20261001.js` — **10/10**, dont : le rejeu sur le
commit réel (bloc A, pas une fixture synthétique), l'auto-cohérence de HEAD
(bloc B), l'extraction sous les deux formes réelles de ce dépôt et une
mutation négative qui fait passer un banc jetable de REFUS à OK en ajoutant
la seule migration manquante (bloc C), l'innocuité de la garde (bloc D).

**Non câblée en CI** : cette session ne peut pas éditer `.github/workflows/*`
(restriction d'outil). Snippet à ajouter à `deploiement-production.yml`,
après l'étape existante « Garde ORDRE-MIGRATION-CODE » si elle y est câblée un
jour, sinon en étape indépendante :

```yaml
      - name: Garde RPC-ORPHELINE (front → migrations)
        run: node outils/garde-rpc-orpheline.js HEAD
```

Geste préparé, distinct, nommé comme tel — même discipline que pour l'autre
garde : une garde qui bloque tout dès son câblage se fait désactiver dans la
semaine. Celle-ci est verte sur HEAD aujourd'hui : le câblage ne fermerait
rien.

## 4. Test sur `nexus-test`

Aucun accès réseau ni identifiant `nexus-test` n'est disponible depuis ce
canal (vérifié : `NEXUS_TEST_DB_URL`, `SUPABASE_TEST_DB_URL_WRITE`,
`NEXUS_TEST_DB_URL_WRITE` tous absents de l'environnement — contrôle booléen
de présence, aucune valeur lue). Élément déjà écrit dans
`docs/recettes/2026-09-04-config-par-environnement.md` à la création de cette
migration : **« Recette validée le — NON VALIDÉE »**. Je ne peux donc ni
confirmer ni infirmer depuis ce canal que `nexus-test` porte la fonction —
seul un geste de Frédéric (ou une session avec accès Test) peut qualifier ce
point. La preuve qui compte pour Production reste indépendante de Test : la
migration est présente, inchangée depuis sa création, et son contenu est
lisible en clair (§6).

## 5. Objets de la migration — purement additifs, aucun DDL destructif

```sql
create or replace function public.nexus_identifiant_de_connexion(p_prenom text) …
revoke all on function public.nexus_identifiant_de_connexion(text) from public;
grant execute on function public.nexus_identifiant_de_connexion(text) to anon;
grant execute on function public.nexus_identifiant_de_connexion(text) to authenticated;
revoke select on public.employees_public from anon;
alter view public.employees_public set (security_invoker = true);
```

Aucun `drop`, `alter table`, `truncate`, `delete`. `create or replace`,
`revoke`, `grant`, `alter view … set` sont les quatre tous rejouables sans
erreur — **idempotence réelle**, pas seulement l'absence d'erreur : rejouer
produit exactement la même définition, puisqu'il n'y a pas de branche
`if not exists` qui pourrait passer en silence sur un homonyme divergent
(contrairement à la migration `20260919103000`, où ce risque est au cœur du
NO-GO existant). La seule table nommée, `employees`, est lue en `select`
seul — aucune écriture de donnée métier.

**Dépendances.** `public.employees` — baseline (`20260101000000`, colonnes
`username`, `nom`, `actif`, `compte_test` toutes présentes, mêmes noms que la
migration les cite). `public.employees_public` — créée bien avant (`cb520b4`,
`1ee2369`), jamais retouchée depuis sauf par cette même migration. Aucune
dépendance vers un objet introduit après le 04/09/2026.

**Ce que la migration change réellement pour le code déjà servi en
Production.** Le code Production (`NEXUS-Login-v1.html` au SHA `adee9bb`)
n'interroge déjà plus `employees_public` directement — il appelle la
fonction. `revoke select … from anon` ne retire donc rien que ce code utilise
encore. Aucun autre écran de ce dépôt ne nomme `employees_public` en lecture
anonyme (vérifié : seule occurrence restante d'`employees_public` hors
migrations est dans `NEXUS-Login-v1.html`, dans un commentaire de l'ancienne
version, pas dans du code actif).

## 6. Lecture AVANT — geste de Frédéric, pas le mien

L'accès en lecture à Production est refusé au niveau du harnais depuis ce
canal (confirmé de nouveau le 01/10/2026 : aucun identifiant, aucune URL dans
l'environnement). Conformément à la discipline déjà établie sur ce dossier
(`preflight-20260919103000-production.md` §16) : lire sous `pg_catalog`,
jamais `information_schema` (filtré par privilège), et nommer l'identité qui
joue la requête.

```sql
select 1 as ordre, 'contexte' as rubrique,
       'identite=' || current_user || ' base=' || current_database()
         || ' le=' || now()::timestamptz(0)::text as detail
union all
select 2, 'fonction',
       p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
         || ' secdef=' || p.prosecdef
         || ' acl=' || coalesce(p.proacl::text, 'DEFAUT(null)')
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'nexus_identifiant_de_connexion'
union all
select 3, 'vue',
       c.relname || ' security_invoker=' || c.relrowsecurity
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relname = 'employees_public'
union all
select 4, 'droit anon sur la vue',
       has_table_privilege('anon', 'public.employees_public', 'select')::text
order by ordre;
```

**Lecture attendue si la migration n'est pas appliquée** (cas le plus
probable, cohérent avec le symptôme terrain) : rubrique 1 renseignée,
**rubrique 2 vide**, rubrique 3 présente avec `security_invoker` non actif
(table régulière, pas de RLS sur une vue — relire la valeur réelle plutôt que
la supposer), rubrique 4 = `true` (anon lit encore la vue).

### Conditions d'arrêt

| constat | décision |
|---|---|
| rubrique 2 non vide, `secdef=true`, acl nommant `anon`/`authenticated` | la fonction existe déjà avec la bonne définition — appliquer la migration est alors un rejeu sans effet ; passer directement à la recette (§8) |
| rubrique 2 non vide avec un `acl` ou un `secdef` différent | **STOP.** Un homonyme divergent existe : comparer avant toute application, ne pas écraser en silence |
| rubrique 1 ne nomme pas d'identité | **STOP.** Lecture non attribuable |
| lecture impossible | **STOP.** État inconnu = refus fermé |

## 7. Application — un seul bloc, le fichier audité, inchangé

```sql
begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';

-- >>> contenu intégral de
--     supabase/migrations/20260904175747_login_non_enumerable.sql
--     blob sha256 186d98915fa210e343c817b0b29c48663a273c640672c18db1837706cabd5c22,
--     sans la moindre retouche

insert into supabase_migrations.schema_migrations (version, name)
values ('20260904175747', 'login_non_enumerable')
on conflict (version) do nothing;

-- Contrôles AVANT COMMIT.
select p.prosecdef, p.proacl::text
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'nexus_identifiant_de_connexion';
-- attendu : prosecdef = true, proacl citant anon et authenticated en EXECUTE

select has_table_privilege('anon', 'public.employees_public', 'select');
-- attendu : false

-- commit;   <- seulement si les deux contrôles correspondent
-- rollback; <- dans tous les autres cas
```

Voie transactionnelle choisie pour la même raison qu'au dossier `20260919103000` :
c'est la seule qui permette `lock_timeout` et un contrôle avant `commit`, et
qui laisse un `rollback` sans effet si quoi que ce soit diverge.

## 8. Recette réelle — après application

Dans l'ordre, par Frédéric ou un humain autorisé, sur l'écran Production
réel (jamais un `curl` isolé qui ne prouve pas l'intégration écran) :

1. Ouvrir `NEXUS-Login-v1.html` en Production, prénom d'un compte actif connu
   → doit atteindre l'écran de saisie du PIN (pas « Connexion au serveur
   impossible »).
2. Même écran, prénom inconnu → **même message** que pour un PIN faux (c'est
   l'exigence que cette migration protège — ne pas réintroduire l'énumérable
   en la validant au mauvais critère).
3. `GET /rest/v1/employees_public?select=*` avec la clé publique seule →
   **doit échouer** (RLS désormais active, plus d'accès anonyme).

Si l'un des trois échoue : ne pas chercher de contournement front — revenir
au §6, la définition réellement en place diverge de celle attendue.

## 9. Retour arrière

**Avant `COMMIT`** : `rollback`, rien n'a eu lieu.

**Après `COMMIT`** : sans risque de perte de données — cette migration ne
touche aucune ligne, seulement des définitions de fonction/vue et des droits.
Retour arrière possible à tout moment, y compris après que des connexions
aient eu lieu avec la nouvelle fonction :

```sql
begin;
set local lock_timeout = '3s';
revoke select on public.employees_public from authenticated; -- nouvelle valeur posée par le code promu, pas celle d'origine
alter view public.employees_public set (security_invoker = false);
grant select on public.employees_public to anon;
drop function if exists public.nexus_identifiant_de_connexion(text);
delete from supabase_migrations.schema_migrations where version = '20260904175747';
-- commit;
```

**Mais un retour arrière ici ne répare rien** : le code Production (`adee9bb`)
n'appelle déjà plus la vue, seulement la fonction. Annuler la migration sans
aussi revenir à l'ancien `NEXUS-Login-v1.html` **laisserait la connexion
cassée** — ce serait rejouer l'incident à l'identique. La seule remise en
service réelle est l'application du §7, pas son annulation.

## 10. Verdict

**`NO_GO_CORRECTION_PRODUCTION_LOGIN`**

Cause unique, et c'est la même discipline que pour le dossier `20260919103000` :
**l'état AVANT de Production n'est pas mesuré**, et cette session n'a et ne
peut avoir aucun accès Production, lecture ou écriture, depuis ce canal
(`issue_comment`, `contents: read` seul — confirmé à nouveau ce jour, aucun
identifiant dans l'environnement). Le contenu de la correction, lui, est
établi avec un niveau de confiance élevé : fichier canonique retrouvé
(jamais recréé de mémoire), inchangé depuis sa création, purement additif,
sans dépendance manquante, sans DDL destructif, et la cause de l'incident est
prouvée par l'historique Git — pas par hypothèse.

### Prochaine action — une seule, et elle répare l'incident en cours

Frédéric (ou tout humain autorisé Production) exécute la lecture du §6. Si
elle confirme l'absence (cas attendu), enchaîne directement sur le bloc
transactionnel du §7 — les deux étapes sont faites pour s'enchaîner en une
seule séance, exactement comme au dossier `20260919103000`. Puis la recette du
§8. Aucune autre décision humaine n'est nécessaire pour ce point précis : le
contenu est figé, audité, et prêt.

Aucune écriture Supabase Production n'a été lancée depuis ce canal. Aucune
lecture Production n'a été lancée. Rien n'a été fusionné vers `main`. Aucun
rollback n'a été exécuté. Aucune garde n'a été affaiblie.
