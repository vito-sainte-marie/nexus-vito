---
protocol: nexus-handoff/2
kind: decision
lot_id: NEXUS-CONTINUITE-TERRAIN-2-20260922
seq: 4
author: NEXUS Orchestrator
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-5.md
---
# Décision — arbitrage technique déterministe de request-5.md

## Verdict

`APPROVED_WITH_CONDITIONS`, `closes: false`, en réponse à `request-5.md`.

## Motif

La re-mesure établit que les 7 blobs autorisés par `decision-3.md` sont identiques entre le rail
(`handoff-continuite-20260920`, `5ec005c`) et la candidate `rebuild/carburants-65-20260922`
(`290a217f`). Le seul écart réel — le mode de `outils/build.sh` (`100755` sur le rail, `100644`
côté candidate) — est sans conséquence fonctionnelle : les trois points d'invocation existants
appellent tous le script via l'interpréteur (`bash outils/build.sh`), jamais en exécutable direct.
Aucun transport artificiel supplémentaire de ces 7 contenus n'est donc requis : un commit qui ne
ferait que rejouer un contenu déjà identique n'aurait aucune valeur probante, l'inverse de ce que
le protocole demande.

Le fail-closed local rejoué (`test_config_environnement.js` 17/17, `test_build_tracabilite_20260905.js`
49/49) est recevable comme preuve du **mécanisme** — il confirme que le build refuse un
environnement `test` pointant Production et refuse un environnement `production` ne pointant pas
Production. Il NE vaut PAS preuve d'un **build réellement ciblé Supabase Test** : ce sont deux
niveaux distincts, et le second reste à obtenir avant toute navigation.

## Poursuite autorisée, sans gate Créateur

Matérialise cette décision via l'outil Handoff canonique, consomme-la, puis poursuis uniquement
les preuves Test/readiness objectivement disponibles pour #65, en t'appuyant sur les faits GitHub
déjà établis :

- le run `35805992451` sur `290a217f` est rouge à l'étape « Cohérence des épingles de cache » ;
- le diagnostic Handoff déjà déposé a établi que `nexus-build.js`/le workflow de la branche
  `rebuild` sont legacy (antérieurs à `config-par-environnement`/Handoff).

**Ne déclare pas la candidate prête** tant que : (a) la CI candidate n'est pas verte, ET (b)
l'identité/l'environnement réellement servi n'est pas prouvé Test-only. Les deux conditions sont
cumulatives, pas alternatives.

Si le correctif mécanique de reconstruction (CI candidate rouge) nécessite un transport externe
que ce canal ne peut pas écrire (écriture Git vers `rebuild/carburants-65-20260922`, déjà refusée
à 8 reprises et documentée dans `request-4.md`/`preuve-cloudflare-humaine-65-portage-1.md`), **ne
sollicite pas Frédéric pour ce transport technique** : dépose le patch/la preuve exacte dans le
registre et reviens par le rail, comme pour les blocages déjà consignés.

## Priorité

Continuité terrain et autonomie manager. Pas de refonte générale, pas de gros merge de l'ancien
rail (`rebuild/carburants-65-20260922`) dans le rail canonique, architecture progressive
uniquement — le principe déjà posé par `decision-2.md`/`decision-3.md` reste inchangé.

## Interdits absolus

Aucun merge/push Production, aucune migration/écriture Supabase Production, aucun déploiement
Production, aucune nouvelle règle métier/UX/RLS/rôle, aucun secret exposé, aucune acceptation d'un
risque résiduel matériel. `NEXUS_BASE_BRANCH=handoff-continuite-20260920` reste le rail de ce lot.

Retour Créateur uniquement si une vraie gate Production ou une décision métier/sécurité devient
nécessaire — pas pour un obstacle technique déterministe déjà classé.
