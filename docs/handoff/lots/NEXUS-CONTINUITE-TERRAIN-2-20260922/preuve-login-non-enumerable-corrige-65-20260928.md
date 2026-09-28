# Preuve — cause racine du login Test candidat #65, et correctif prêt à porter

Réveil du 28/09/2026, base `handoff-continuite-20260920`. Aucune écriture Production,
aucune migration, aucun secret lu. Fichier livré :
`docs/handoff/lots/NEXUS-CONTINUITE-TERRAIN-2-20260922/nexus-login-corrige-65-20260928.html`,
à déposer en remplacement de `NEXUS-Login-v1.html` sur `rebuild/carburants-65-20260922`
(HEAD `20af9f6fbfa435465c05245528ba112880b7be4b` au moment de cette session).

## 0. Refs vérifiées, pas supposées

| Ref | Valeur |
|---|---|
| `origin/main` | `4a49bf4` |
| `origin/production` | `2bc7b39` |
| `origin/handoff-continuite-20260920` (= HEAD de cette session) | `c12d352` |
| `origin/rebuild/carburants-65-20260922` (candidat cité) | `20af9f6` — identique au SHA cité par le réveil |

## 1. La cause racine — pas une ACL accidentelle, un fichier candidat jamais mis à jour

Le réveil pose une hypothèse (« contrat pré-auth/ACL Test incohérent ») et demande de la
revalider avant toute correction. Vérification faite, la cause exacte est plus précise et
plus large que l'hypothèse :

**`rebuild/carburants-65-20260922` est une reconstruction du candidat #65 dont le
merge-base avec `handoff-continuite-20260920` est `501c0c7` — exactement `origin/production`.**
Son `NEXUS-Login-v1.html` est donc antérieur à DEUX correctifs déjà conçus, prouvés et actifs
sur le rail canonique, et le fichier candidat porte encore, vérifié ligne par ligne :

1. **URL et clé Supabase codées en dur** (`https://uzhjpqpctpvxytxpxoqz.supabase.co`) —
   ce projet est très exactement `REF_PRODUCTION` défini dans `outils/generer-config.js:40`.
   Le fichier candidat ne lit jamais `window.NEXUS_CONFIG` : quel que soit l'environnement
   de build (Test ou Production), cet écran de connexion viserait toujours PRODUCTION. C'est
   indépendant, et plus grave, que le point suivant.
2. **Lookup pré-auth par `employees_public.select("username").ilike("nom", prenom)`** — le
   motif exact que `supabase/migrations/20260904175747_login_non_enumerable.sql` a fermé le
   04/09/2026, avec un message de refus distinct (« Prénom non reconnu » / « Code PIN
   incorrect ») qui est lui-même un oracle d'énumération (confirme sans PIN qu'un prénom
   donné existe).

`nexus-auth.js` sur ce même candidat, à l'inverse, lit déjà correctement
`window.NEXUS_CONFIG` (`NEXUS_CFG = window.NEXUS_CONFIG`, ligne 16) : il a reçu la
« restauration minimale » de `decision-9.md`/`decision-10.md`. **`NEXUS-Login-v1.html` n'a
reçu aucune des deux réparations** — ni celle-là, ni le correctif de sécurité du 04/09. Deux
fichiers du même candidat sont donc à deux niveaux de correction différents ; ce n'est pas
un défaut d'ACL Test à recreuser, c'est un fichier non porté.

## 2. L'ACL Test observée n'est pas accidentelle — vérifié par lecture de migration, pas supposé

Contrainte #3 du réveil : ne pas supposer que l'ACL est accidentelle. Elle ne l'est pas.
`supabase/migrations/20260904105148_urgence_revoquer_acces_anonyme_vues_security_definer.sql`
retire les droits d'écriture d'`anon` sur `employees_public` en notant explicitement que le
SELECT restait *« provisoirement, cette vue devant être remplacée par une authentification
non énumérable »*. `supabase/migrations/20260904175747_login_non_enumerable.sql` **est** ce
remplacement : elle documente la faille constatée par appel réel
(`GET /rest/v1/employees_public?select=*` → l'annuaire complet, tous sites confondus, avec
la seule clé publiable), explique pourquoi une simple fonction `SECURITY DEFINER` a été
retenue plutôt qu'un `GRANT` (cadrage `.github/recettes/CADRAGE-nexus-test.md`, branche
`securisation-vues`, qui exclut nommément cette option), et pose le contrat exact :

```sql
create or replace function public.nexus_identifiant_de_connexion(p_prenom text)
returns text
language sql
stable
security definer
set search_path to 'public'
as $$
  select case when count(*) = 1 then min(e.username) end
  from public.employees e
  where (e.actif = true or e.compte_test = true)
    and lower(btrim(e.nom)) = lower(btrim(coalesce(p_prenom, '')));
$$;

revoke all on function public.nexus_identifiant_de_connexion(text) from public;
grant execute on function public.nexus_identifiant_de_connexion(text) to anon;
grant execute on function public.nexus_identifiant_de_connexion(text) to authenticated;

revoke select on public.employees_public from anon;
alter view public.employees_public set (security_invoker = true);
```

Ce mécanisme répond à UNE question (`count(*) = 1` avant tout retour, jamais un homonyme
choisi au hasard), ne renvoie qu'un `username` scalaire (jamais `nom`, `id`, jamais
`select *`), compare en égalité stricte (`lower(btrim(...))`) plutôt qu'en `ilike` — qui
interprète `%`/`_` comme des jokers et aurait permis de balayer l'annuaire même à travers
une fonction. C'est exactement le mécanisme minimal demandé par la contrainte #2 du
réveil — **déjà conçu**, avant cette session, par une décision antérieure de ce même lot
(le fichier date du 04/09/2026 ; ce lot `NEXUS-CONTINUITE-TERRAIN-2-20260922` a ouvert le
22/09). Je n'ai inventé aucun nouveau mécanisme : j'ai vérifié que celui-ci existe déjà,
tourne déjà en service sur `handoff-continuite-20260920`, et n'a simplement jamais été porté
sur le candidat.

**Conséquence directe sur la contrainte #1 du réveil** (ne pas corriger par
`GRANT SELECT ... TO anon` aveugle) : un tel `GRANT` referait exactement la fuite que la
migration du 04/09 a fermée. Il n'a pas été envisagé plus avant que cette vérification.

## 3. Le correctif — port exact, aucune divergence

`git diff` entre le fichier candidat (`20af9f6:NEXUS-Login-v1.html`, 173 lignes) et le
fichier canonique en service (`NEXUS-Login-v1.html`, 197 lignes) montre que **la totalité de
la différence est contenue dans le bloc `<script>`** — tête de fichier, CSS, structure HTML
sont identiques caractère pour caractère (vérifié par `diff` complet, aucun autre hunk).
Le fichier livré dans ce lot est donc une copie exacte du fichier canonique actuellement en
service — vérifiée par égalité de contenu (`fs.readFileSync` des deux fichiers comparés
directement dans le test, §4), pas retapée à la main :

- config partagée (`window.NEXUS_CONFIG`, avec refus explicite « Configuration absente » si
  manquante — jamais une devinette d'environnement) ;
- `client.rpc("nexus_identifiant_de_connexion", { p_prenom: prenom })` au lieu de
  `.from("employees_public").select("username").ilike("nom", prenom)` ;
- message de refus unique (`REFUS = "Prénom ou code PIN incorrect."`) pour prénom inconnu
  ET PIN incorrect.

Aucune autre ligne du fichier n'est touchée.

## 4. Tests déterministes + preuve négative — exécutés réellement

`test_login_pre_auth_non_enumerable_65_20260928.js`, **21/21** :

- 8 vérifications lisent le corps SQL réel de `20260904175747_login_non_enumerable.sql`
  (isolé entre ses délimiteurs `$$`, pas le fichier entier — un commentaire de la migration
  mentionne lui-même « pas de select * » en prose, ce qui aurait fait échouer une recherche
  naïve sur tout le texte) et prouvent le contrat : `SECURITY DEFINER`, garde `count(*) = 1`,
  seul `username` sélectionné, `EXECUTE` révoqué de `PUBLIC` puis regranté nommément à `anon`,
  `SELECT` révoqué sur la vue, `security_invoker = true` ;
- le vérificateur statique (`verifierContratLoginPreAuth`, fonction pure) est appliqué à
  quatre variantes : le fichier canonique (vert), le fichier corrigé livré (vert, et
  identique octet pour octet au canonique), **le candidat original lu depuis son SHA git réel
  `20af9f6...`** (rouge — détecte l'URL Production codée en dur, le lookup `ilike`, les deux
  messages distincts), et deux mutations qui réintroduisent chacune un des deux défauts dans
  le fichier corrigé (rouge sur les deux, avec contre-témoin vert sur le fichier non muté
  ensuite) ;
- une dernière vérification borne l'exposition : aucun appel pré-auth du fichier corrigé ne
  demande `select('*')` ni une deuxième colonne.

```
21 vérification(s) passées.
```

`node run-tests.js` (suite complète, 275 fichiers) : **266/275**, les 9 échecs identiques à
la liste connue du rail (`ECHECS-CONNUS.json`), verdict `Aucune régression : seuls les 9
échecs connus subsistent.` `node outils/guardians-router.js` : 1 finding, la collision
`NexusStock` déjà connue et tracée (dette distincte, non liée à ce correctif).
`node outils/guardian-qa.js` : 0 finding. `node outils/handoff.js verifier` : registre
conforme (32 lots, 15 avertissements tous préexistants, 11 dérogations).

## 5. Ce que cette preuve NE fait PAS — honnête, pas contourné

- **Elle ne réexécute pas `Preuve Test #65` sur le candidat.** Ce canal n'a ni écriture sur
  `rebuild/carburants-65-20260922`, ni identifiants/réseau vers le projet Supabase Test
  `udljdqxerrbbbajxubfn`, ni navigateur — obstacle identique et déjà documenté à chaque
  réveil de ce lot depuis le 22/09/2026 (transport Git non-Production anticipé par
  `decision-9.md` §5). Je n'ai donc **ni ouvert de connexion réseau, ni lu de PIN, ni simulé
  un résultat de recette** : ce qui suit est ce qui reste vrai sans cet accès, pas un
  contournement.
- **Elle ne peut pas confirmer l'état réel de l'ACL sur le projet Test `udljdqxerrbbbajxubfn`
  au moment précis de cette session** — les constats du réveil (`SELECT` absent pour `anon`,
  `security_invoker=false`) sont pris comme entrée, pas revérifiés depuis ce canal. Le fait
  que `security_invoker` soit observé `false` alors que la migration du 04/09 le pose à
  `true` suggère que ce projet Test n'a pas rejoué cette migration précise dans son état
  actuel, ou l'a rejouée puis vu cette valeur retouchée — **je ne tranche pas laquelle** sans
  accès à `supabase_migrations.schema_migrations` de ce projet. Ce point reste à vérifier par
  une session outillée avant de promouvoir quoi que ce soit au-delà du Test.
- **Elle ne prouve pas le "non-divulgation" au niveau base de données** — uniquement au
  niveau du contrat SQL déjà écrit (lu, pas exécuté) et de la forme du code client (ne
  demande jamais plus que ce contrat). Une preuve d'exécution réelle contre `nexus-test`
  (confirmer que `nexus_identifiant_de_connexion('Manager Test')` renvoie bien un seul
  `username` et que `select * from employees_public` échoue en anonyme) reste à faire par une
  session disposant du réseau/secrets Test.

## 6. Verdict de la gate #65 — explicite, pas déclaré à la légère

**NO GO.** Conformément à la contrainte #8 du réveil, `PRET_GATE_CREATEUR` n'est PAS déclaré :
la preuve navigateur authentifiée n'a pas été rejouée depuis ce canal, et ne peut pas l'être
(aucun accès Test). Ce qui change par ce lot : la cause du dernier point bloquant nommé par
le réveil (« Prénom non reconnu ») est identifiée avec certitude, et un correctif prêt à
appliquer est déposé — sans quoi la recette échouerait pour la même raison à chaque nouvelle
tentative.

**Geste minimal exact restant, pour une session disposant de l'écriture sur
`rebuild/carburants-65-20260922` et du réseau/secrets Test :**

```
git fetch origin rebuild/carburants-65-20260922 handoff-continuite-20260920
git checkout -b lot/login-non-enumerable-corrige-65 origin/rebuild/carburants-65-20260922
git checkout origin/handoff-continuite-20260920 -- NEXUS-Login-v1.html
git commit -m "fix(login): porter le contrat pre-auth non enumerable (04/09) + config partagee sur le candidat #65"
git push origin lot/login-non-enumerable-corrige-65:rebuild/carburants-65-20260922

# Puis, avec accès udljdqxerrbbbajxubfn :
#   confirmer que nexus_identifiant_de_connexion existe et se comporte comme §2 ;
#   si absente ou différente, rejouer 20260904175747_login_non_enumerable.sql sur Test
#   (jamais sur Production) ;
#   rejouer Preuve Test #65 (workflow "Preuve Test #65") sur le SHA résultant ;
#   confirmer la connexion Manager/Créateur/Employé Test A puis la recette Carburants.
```

## 7. Guardians

- **Architecture & Cohérence** : un seul fichier candidat visé, réutilisation exacte d'un
  mécanisme déjà conçu et en service — aucune logique réinventée, aucun nouveau chemin
  d'authentification créé.
- **Security & Isolation** : aucun secret lu ni exposé ; aucun `GRANT` proposé ; le correctif
  ferme un chemin vers Production (URL codée en dur) au lieu d'en ouvrir un ; l'ACL Test
  reste celle déjà voulue par la migration du 04/09, non affaiblie.
- **Business Rules** : aucune règle métier nouvelle — le comportement porté est celui déjà
  validé et actif sur le rail canonique depuis le 04/09/2026.
- **QA/Regression** : preuve par exécution réelle (21/21, dont détection sur le SHA candidat
  réel et deux mutations négatives), suite complète sans régression nouvelle (266/275, 9
  échecs connus inchangés).
- **Bible/Philosophie** : la limite réelle (recette navigateur non rejouable depuis ce canal)
  est nommée et classée, pas masquée ; `PRET_GATE_CREATEUR` non déclaré.

## Invariants respectés

Aucun changement `main`/`production`, aucune écriture ni migration Supabase (aucun accès
disponible depuis ce canal, et aucune n'était de toute façon nécessaire — le mécanisme
existe déjà), aucun secret/PIN créé, lu ou exposé, aucun `GRANT` élargissant l'accès anonyme,
aucune promotion Production, aucune activation de gate au-delà de ce qui est réellement
prouvé.
