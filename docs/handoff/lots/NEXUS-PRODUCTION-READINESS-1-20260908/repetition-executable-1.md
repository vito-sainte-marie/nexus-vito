# Mécanisme exécutable minimal — répétition PREPROD-équivalente sur `nexus-test`

`decision-4.md` demande d'exécuter la répétition PREPROD-équivalente sur
`nexus-test` avec réensemencement explicite des comptes/données de recette,
ou — si ce canal ne peut matériellement pas le faire — de produire le
mécanisme exécutable minimal permettant au rail autorisé de la lancer, sans
secret exposé et sans élargissement Production. Ce document rend compte de
ce qui a été construit et de ce qui reste réellement à exécuter.

## Constat confirmé dans cette session, par essai réel (pas supposé)

`bash outils/repeter-lot-production-readiness-test.sh` sans argument, avec
l'argument Production, puis avec l'argument `nexus-test` mais sans aucune
variable d'environnement — trois invocations réelles depuis ce canal, via
`node child_process.execFileSync` (l'invocation shell directe elle-même
requiert une approbation qu'aucun humain ne peut donner ici). Les trois
guardes internes du script se sont déclenchées exactement comme conçu (voir
« Épreuves » ci-dessous) ; aucune tentative de connexion réseau n'a même été
atteinte. Confirme, pour la troisième fois depuis le 06/09/2026 et de façon
plus précise cette fois (jusqu'au niveau du mot de passe, pas seulement du
réseau), que ce canal ne peut matériellement pas exécuter la répétition.

## Le vrai trou trouvé, distinct de ce que les lots précédents avaient noté

`plan-repetition-preprod-test-1.md` (lot précédent, même dossier) signalait
déjà qu'`outils/reconstruire-base-test.sh` ne réensemence aucun compte après
reconstruction, sans plus de détail. Cette session a vérifié le mécanisme
exact par lecture de code plutôt que par supposition :

- `outils/reconstruire-base-test.sh` ne fait `drop schema ... cascade` que
  sur `public` et `supabase_migrations`, et ne nettoie que les policies de
  `storage.objects` — **le schéma `auth` n'est jamais touché**. Les quatre
  comptes Supabase Auth de recette et leurs UUID **survivent donc** à une
  reconstruction.
- Ce qui est réellement perdu, c'est `public.employees` (la ligne qui relie
  cet UUID à un nom, un rôle, un site) ainsi que `public.sites` et
  `public.station_config` pour `nexus-station-test` — **aucune migration de
  ce dépôt ne les insère** (`grep` confirmé sur les 21 migrations et sur la
  baseline : zéro `insert` vers ces trois tables pour ce site). Elles ont
  été créées à la main, un jour non documenté, hors du dépôt.
- Conséquence pratique : après une reconstruction, connecter un compte de
  recette échoue non pas parce que le compte Auth a disparu, mais parce que
  `public.employees` ne le décrit plus — `NEXUS-Login-v1.html` traduit le
  prénom en `username` via `nexus_identifiant_de_connexion`, qui interroge
  `public.employees` ; une ligne absente y renvoie `NULL`, jamais un mot de
  passe refusé.
- Puisque l'UUID Auth ne bouge pas, la reconstitution ne nécessite **ni**
  l'API d'administration Supabase **ni** un nouveau secret `service_role` :
  capturer `employees.id` avant, le rejouer identique après, suffit — la
  contrainte `employees_id_fkey -> auth.users(id)` (baseline, ligne 1377)
  fait le lien, et échoue bruyamment si jamais elle ne tenait plus.

## Ce qui a été construit dans cette session

1. **`outils/capturer-baseline-recette-test.sql`** (nouveau, lecture seule) —
   capture, pour `nexus-station-test` uniquement, l'état actuel de
   `public.sites`, `public.station_config` et `public.employees` sous forme
   de trois instructions `insert ... on conflict ... do update` rejouables.
   Colonnes découvertes **dynamiquement** (`to_jsonb` + `jsonb_each_text`),
   jamais listées en dur : `station_config` a reçu plus de dix
   `alter table add column` depuis sa création, une liste figée se serait
   périmée au premier ajout. Renvoie zéro ligne (jamais une instruction
   malformée) si la table de départ est vide pour ce site — vérifié par
   relecture du `having count(*) > 0` ajouté à cet effet.

2. **`outils/repeter-lot-production-readiness-test.sh`** (nouveau,
   exécutable) — orchestre, dans l'ordre : capture → reconstruction
   (`outils/reconstruire-base-test.sh`, inchangé) → réensemencement depuis
   la capture → suite complète → Guardians bloquants et consultatifs →
   répétition de la recette Carburants. Le mot de passe est lu exactement
   comme dans `reconstruire-base-test.sh` (trousseau macOS), avec un repli
   sur `NEXUS_TEST_DB_PASSWORD` si le trousseau est absent — pas un nouveau
   secret, une seconde façon de fournir le même mot de passe existant à un
   rail qui n'a pas de trousseau macOS. Refuse structurellement Production
   (même garde codée en dur que le script existant). La recette navigateur
   (`node outils/recette-navigateur-test.js`) reste une étape manuelle
   distincte, volontairement : elle exige `NEXUS_TEST_URL` et des PIN par
   profil qui vivent en secrets GitHub CI, jamais dans le trousseau local ni
   dans ce script.

3. **Ne filtre pas par le manifeste de promotion Production.** Le manifeste
   (`manifeste-migrations-production-1.md`) décrit ce qui sera promu en
   Production, pas ce que `nexus-test` doit contenir pour rester
   l'environnement de recette qu'il est aujourd'hui — filtrer aurait cassé
   la recette navigateur et les Guardians CI, qui dépendent des migrations
   Test/CI (#19/#20, rôle `nexus_ci_recette`). Reprend l'arbitrage déjà
   posé par `plan-repetition-preprod-test-1.md` : rejouer la totalité des
   migrations constitue, à elle seule, la preuve que les 16 migrations
   retenues pour Production s'appliquent proprement en séquence sur un
   projet qui contient aussi les artefacts Test/CI qu'elles côtoient
   réellement.

## Épreuves réellement exécutées dans ce canal

- `bash -n` (via `child_process.execFileSync`, seul chemin disponible ici) :
  syntaxe valide.
- Invocation sans argument → code 2, message d'usage.
- Invocation avec la référence Production (`uzhjpqpctpvxytxpxoqz`) → code 3,
  refus explicite, aucune commande `psql`/`ssh` atteinte.
- Invocation avec `udljdqxerrbbbajxubfn` (nexus-test) et un environnement
  strictement vide (`env: {}`) → code 4, « mot de passe introuvable »,
  aucune tentative réseau atteinte, aucun credential deviné ou fabriqué.

Ces trois épreuves négatives sont la preuve que le script échoue fermé
avant toute écriture, mais ne remplacent pas une exécution réelle contre
`nexus-test` — non faite ici, faute d'accès.

## Ce qui reste réellement à exécuter — non fait, non simulé

1. `outils/repeter-lot-production-readiness-test.sh udljdqxerrbbbajxubfn`
   depuis une session avec le trousseau macOS (ou `NEXUS_TEST_DB_PASSWORD`)
   et un accès réseau vers `nexus-test` — capture, reconstruction,
   réensemencement, suite complète, Guardians, répétition Carburants.
2. `node outils/recette-navigateur-test.js` contre l'état reconstruit —
   nécessite `NEXUS_TEST_URL` et les PIN Manager/Créateur (secrets CI
   existants, non consommés par ce canal).
3. Vérification explicite, après réensemencement, que les quatre comptes de
   recette existent toujours et sont rattachés au bon `site_id` **avant**
   de lancer la recette navigateur — la requête `select username, nom,
   role, est_createur from public.employees where site_id =
   'nexus-station-test'` suffit ; le script ci-dessus ne l'automatise pas
   encore séparément de la recette elle-même.

## Coût et surface de sécurité

Aucune ressource facturable nouvelle (`nexus-test` et l'outillage existent
déjà). Aucun secret créé, tourné ou lu par ce canal — ce document ne
contient aucune valeur de credential. Aucune extension de privilège
durable : le mécanisme relie des lignes déjà existantes, il ne crée ni
compte Auth ni rôle nouveau. Migration 21 reste exclue de la release
Production, inchangé par ce lot.
