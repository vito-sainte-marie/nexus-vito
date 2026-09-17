# `supabase/recette-vague1/` — la recette **exécutée** du cycle de caisse FDJ

Ce dossier n'est pas un dossier de migrations. Rien de ce qu'il contient ne
part avec `supabase db push`, et rien ne doit être inscrit dans
`supabase_migrations.schema_migrations`.

## Ce qu'il contient

| Fichier | Rôle |
|---|---|
| `20260917_preuves_cycle_caisse.sql` | les preuves **10 à 16** du mandat : le cycle de vie d'une caisse, de l'ouverture du quart à la validation |
| `20260917_preuves_cycle_caisse.sortie.txt` | sa sortie réelle du 17/09/2026 sur `nexus-test`, conservée telle quelle |
| `20260917_preuves_livrets_et_historique.sql` | les preuves **§10.5 et §10.6** : livrets et mouvements, puis l'effet des migrations sur des données **préexistantes** |
| `20260917_preuves_livrets_et_historique.sortie.txt` | sa sortie réelle du 17/09/2026, code de sortie 0 |

Les deux se jouent **en transaction annulée** et ne se chargent pas de la même
manière :

* `…_cycle_caisse.sql` **ne s'exécute pas seul** : il suppose les neuf
  migrations de la Phase A déjà chargées dans la même transaction, et se joue
  avec la commande d'assemblage ci-dessous ;
* `…_livrets_et_historique.sql` est **auto-portant** : il ouvre lui-même la
  transaction et charge les neuf migrations par `\ir`, *au milieu* du fichier.
  Ce n'est pas une commodité, c'est le sujet même de la preuve : il fabrique
  d'abord un historique (9 quarts, 8 caisses couvrant les huit statuts réels,
  5 mouvements), **puis** applique les migrations par-dessus, puis mesure ce
  qu'elles lui ont fait. On ne peut pas prouver qu'une migration respecte
  l'existant si l'existant naît après elle. Il se lance directement :

```
PGPASSWORD="$(security find-generic-password -a nexus -s nexus-test-db -w)" \
PGCONNECT_TIMEOUT=20 \
/opt/homebrew/opt/libpq/bin/psql \
  "postgresql://postgres@db.udljdqxerrbbbajxubfn.supabase.co:5432/postgres?sslmode=require" \
  -v ON_ERROR_STOP=1 -q \
  -f supabase/recette-vague1/20260917_preuves_livrets_et_historique.sql
```

Son `\ir ../migrations/…` se résout relativement au **répertoire du fichier**,
pas au répertoire courant : il fonctionne donc d'où qu'on le lance.

## Pourquoi il existe

Parce que la suite de tests du dépôt ne peut pas faire ce travail, et qu'il
fallait que ce soit écrit quelque part plutôt que redécouvert.

`.github/workflows/tests.yml` le dit de lui-même : *« Aucun secret n'est
référencé […] Les tests sont purement locaux — aucun n'ouvre de connexion
réseau ni ne parle à Supabase (vérifié). »* C'est une bonne propriété et il ne
s'agit pas de la casser : un workflow qui ne peut rien atteindre hors de la
machine de build ne peut rien abîmer. Mais elle a un prix — **aucun test de la
suite ne peut exécuter une commande serveur**. Les trois tests FDJ existants
lisent donc du texte, et l'un d'eux l'assume en toutes lettres : *« ce contrôle
lit du texte, il n'exécute pas la fonction. Il constate une intention, pas un
refus. »*

Le 17/09/2026, cette limite s'est payée. La suite était verte — 202/209, les
sept échecs connus — et le cycle de caisse était inutilisable :

* la contrainte de versions du journal refusait l'insert de la **toute
  première confirmation** : `23514` à chaque fois ;
* `fdj_ecrire_saisies_caisse` écrasait les montants du brouillon **avant** le
  contrôle de complétude de la confirmation, qui refuse par un `return` sans
  annuler la transaction : un refus qui détruisait la saisie qu'il reprochait
  d'être incomplète.

Ni l'un ni l'autre n'était visible en lisant le SQL. Les deux sont tombés à la
première exécution réelle.

Deux réponses complémentaires en sont sorties, et il faut les deux :

* **ici**, la recette exécutée — elle voit tout, mais elle demande une base et
  une main humaine ;
* **`test_fdj_vague1_invariants_ecriture.js`**, à la racine — il ne voit que
  ces deux défauts-là, mais il tourne à chaque CI, sans réseau. Il n'interprète
  pas le SQL de loin : il traduit la contrainte CHECK réellement écrite en un
  prédicat et lui soumet les couples de versions réellement insérés par les
  sept commandes. Et il rejoue chaque vérification sur le texte **muté** —
  la contrainte d'avant correction, la fonction d'avant correction — en
  échouant si la version fautive passait. Une garde verte ne prouve rien tant
  qu'on n'a pas vu ce qui la fait rougir.

## Comment rejouer la recette du cycle de caisse

(Pour l'autre fichier, voir la commande auto-portante plus haut.)

Le glob compte : les neuf migrations de la Vague 1 sont estampillées
`2026091622HHMM`, de `220000` à `220800`. Un glob plus étroit en charge une
partie et le reste échoue sur des objets manquants, ce qui ressemble à un bug
du code alors que c'est la commande qui est incomplète.

Sur `nexus-test` uniquement — **jamais sur Production**. Le script se termine
par `rollback;` : il ne laisse rien derrière lui, ni les tables, ni les
fonctions, ni les lignes du jeu d'essai (les quatre dernières vérifications de
la sortie le constatent explicitement).

```
{ printf '%s\n' '\set ON_ERROR_STOP on' 'begin;'
  for m in supabase/migrations/2026091622*.sql; do cat "$m"; done
  cat supabase/recette-vague1/20260917_preuves_cycle_caisse.sql
} > /tmp/preuves.sql

PGPASSWORD="$(security find-generic-password -a nexus -s nexus-test-db -w)" \
PGCONNECT_TIMEOUT=20 \
/opt/homebrew/opt/libpq/bin/psql \
  "postgresql://postgres@db.udljdqxerrbbbajxubfn.supabase.co:5432/postgres?sslmode=require" \
  -v ON_ERROR_STOP=1 -q -f /tmp/preuves.sql
```

Trois détails qui coûtent chacun une demi-heure quand on les oublie :

* **`PGCONNECT_TIMEOUT=20`** — la résolution tente d'abord l'IPv6 et expire.
  Sans ce délai, la connexion échoue avec un « Operation timed out » qui
  ressemble à une panne de la base.
* **L'URL directe, jamais le pooler.** Le pooler ne tient pas une transaction
  de cette longueur et ne rend pas les `notice`.
* **Les `\set` de psql ne sont pas interpolés dans un bloc `do $$ … $$`.** Le
  script passe donc les identifiants par une table temporaire `ctx(cle, val)`.

## Ce que la recette prouve, et ce qu'elle ne prouve pas

`…_cycle_caisse.sql` couvre les preuves **10 à 16** du mandat : l'ouverture
naturelle du quart et son idempotence, le fait qu'une consultation ne crée
rien, l'apparition de l'écart provisoire **après** la confirmation, la
traçabilité d'une correction avant validation, le refus d'une correction après
validation, le monopole du manager sur la validation, et la distinction entre
l'auteur de saisie et l'employé opérationnel.

`…_livrets_et_historique.sql` couvre **§10.5** (les trois notions distinctes
sur un mouvement, la clé d'idempotence qui mord, la date d'effet contrainte, et
l'argument structurel : aucune des 29 fonctions ajoutées par la vague ne
mentionne `fdj_stock_movements` ni `fdj_booklets`) et **§10.6** (aucune colonne
ajoutée n'est remplie, aucune valeur existante ne bouge — 22 empreintes
identiques —, les huit statuts historiques survivent, et les contraintes
`NOT VALID` laissent vivre les lignes incohérentes tout en refusant les
nouvelles).

Deux de ses preuves servent surtout à ne pas se rassurer à tort :

* **P22.3b** exécute `alter table … validate constraint` et vérifie qu'il
  **échoue**. Tant qu'on ne l'a pas fait, on suppose que le `NOT VALID` était
  nécessaire ; après, on le sait.
* **P22.6** ne nomme pas l'index d'idempotence en dur : elle demande à la base
  lequel porte réellement l'unicité, le retire, fabrique un doublon, puis tente
  de le recréer avec sa propre définition. C'est cette précaution qui a révélé
  que `fdj_stock_movements_idempotency_key_uniq` **existait déjà** sur Test
  comme sur Production, et que la migration 220400 — qui utilisait
  `create unique index if not exists` sous un autre nom — en aurait créé un
  second, identique. `if not exists` compare le nom, jamais la définition.

Elle ne prouve **pas** les politiques RLS de la Phase C : celles-ci ne sont pas
chargées ici, et leurs propres mutations vivent dans
`supabase/phase-c/20260916230000_mutations_de_validation.sql`. Les deux jeux
sont indépendants et se jouent séparément.

Attention enfin aux trois formes de refus, qu'il ne faut pas confondre en
lisant la sortie : un trigger lève `42501` (une exception), une politique RLS
masque la ligne (**0 ligne, aucune erreur**), et une commande serveur rend
`{"ok": false, "motif": "…"}` sans rien lever du tout. Écrire « on attend une
exception » pour les deux derniers cas donne un test vert qui ne prouve rien.

## La sortie conservée

Les deux `*.sortie.txt` sont les sorties réelles du 17/09/2026, code de sortie
0, gardées pour comparaison. Ce n'est pas une référence figée :
si une exécution ultérieure en diffère, c'est la nouvelle exécution qui dit la
vérité — ce fichier dit seulement ce qui était vrai ce jour-là, avec ce code.
