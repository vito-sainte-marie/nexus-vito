# Répétition PREPROD-équivalente sur ressource Test existante

`decision-3.md` demande de chercher d'abord une répétition équivalente avec
les ressources Test existantes, sans donnée personnelle, avant d'envisager
la construction d'un PREPROD anonymisé à partir d'un dump Production
(`plan-preprod-anonymise-1.md`, resté `INCONNU / NON CONSTRUIT`).

## Réponse : oui, `nexus-test` suffit pour cet objectif précis

`nexus-test` (`udljdqxerrbbbajxubfn`) est un projet Supabase **déjà
existant**, pré-autorisé pour Claude par `CLAUDE.md` (« Alimenter,
réinitialiser ou corriger la base de recette Test »), et qui **ne contient
par construction aucune donnée personnelle réelle** : ses seuls comptes sont
`manager-test`, `createur-test`, `employe-test-a`, `employe-test-b`, tous
`compte_test=true` (établi lors du lot NEXUS-GUARDIANS-1, réveil du
07/09/2026). Contrairement à un PREPROD construit depuis un dump Production,
il n'y a ici **aucune fuite possible à anonymiser** — pas de mapping HMAC, pas
d'épreuve de détection de contenu identifiable, pas de revue humaine
préalable requise pour ce motif précis. C'est plus fort qu'anonymisé : il n'y
a jamais eu de donnée à protéger.

Cela ferme la case « aucune donnée personnelle » du critère
`preprod_anonymise_ou_equivalent` sans construire quoi que ce soit de
nouveau — mais ne remplace pas, et ne prétend pas remplacer, une preuve de
comportement à l'échelle et à la structure des données Production réelles
(volume, distribution, anomalies historiques). C'est une répétition
**migrations + recette**, pas une répétition **de risque métier à l'échelle**.

## Procédure — outillage déjà existant, rien de nouveau à construire

L'outil canonique de ce dépôt pour ce besoin exact existe déjà et n'a pas
besoin d'être réécrit :

```
outils/reconstruire-base-test.sh udljdqxerrbbbajxubfn
```

Ce script (documenté comme « l'épreuve de vérité du dépôt de migrations »)
remet `nexus-test` à zéro puis rejoue **la totalité** des migrations
versionnées, dans l'ordre chronologique, jusqu'à la première erreur nommée.
Il ne filtre pas Production/Test : il applique donc nativement les 16
migrations du manifeste Production **et** les 4 migrations Test/CI (#16,
#18, #19, #20) qui n'ont de sens que sur ce projet — exactement l'état que
`nexus-test` doit avoir. Rejouer ce script constitue donc, à lui seul, la
preuve que les 16 migrations retenues pour Production s'appliquent proprement
en séquence, sur un projet qui contient les artefacts Test/CI qu'elles
côtoient réellement.

Après reconstruction, la recette existante valide le comportement :

```
node outils/recette-navigateur-test.js
node test_carburant_commande_p0_traversee_reliquat_20260907.js
node run-tests.js
```

## Ce que ce canal ne peut pas faire — honnêtement, comme pour toute mesure Production de ce lot

`outils/reconstruire-base-test.sh` lit son mot de passe dans le trousseau
macOS local (jamais une variable CI, par conception — voir son en-tête). Ce
canal GitHub Issue n'a ni ce trousseau, ni identifiant réseau vers
`nexus-test`, ni accès Supabase d'aucune sorte (constat inchangé depuis le
06/09/2026, confirmé à nouveau ici : aucune tentative de connexion n'a été
faite). Cette répétition n'a donc **pas été exécutée** dans ce lot — elle est
prête à l'être par l'Orchestrator ou par Frédéric.

## Limite honnête à signaler avant exécution

`outils/reconstruire-base-test.sh` reconstruit le **schéma** depuis zéro,
mais n'insère aucune ligne `auth.users` : les quatre comptes de recette
(`manager-test`, `createur-test`, `employe-test-a`, `employe-test-b`) sont
gérés par Supabase Auth, pas par une simple ligne SQL, et ne survivent pas à
une reconstruction complète du schéma `public` sans une étape de
réapprovisionnement distincte (hors du périmètre lu dans ce script). Toute
exécution de cette reconstruction doit donc être suivie d'une vérification
explicite que ces quatre comptes existent toujours et sont rattachés au bon
`site_id` avant de lancer la recette — sans quoi la recette échouera pour une
raison sans rapport avec les migrations elles-mêmes. Ce point n'a pas été
vérifié ici (aucun accès), il est signalé pour ne pas être découvert en cours
d'exécution.

## Coût

Aucune ressource facturable nouvelle : `nexus-test` existe déjà, l'outil
existe déjà. Aucune gate de coût n'est donc déclenchée par cette proposition.
Si une preuve de comportement à l'échelle Production réelle s'avérait
nécessaire au-delà de cette répétition, ce serait alors une ressource
distincte (PREPROD depuis dump), avec son propre besoin et coût à faire
approuver séparément — non demandé ici, non construit.
