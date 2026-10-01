# Câbler la garde RPC dans le déploiement Production

Compagnon de `cablage-garde-rpc-production.patch`. **Append-only** : une
section publiée ici ne se réécrit pas, elle se complète par une section datée.

Ce document ne redit pas ce que fait `outils/garde-rpc-front-definie-sur-la-cible.js` —
son banc `test_garde_rpc_front_definie_sur_la_cible_20261001.js` le prouve, et
le redire ici créerait la documentation concurrente que la maison interdit. Il
répond à une seule question, celle que le 01/10/2026 a rendue coûteuse :
**à quel endroit exact du chemin de déploiement cette garde doit s'asseoir, et
comment on sait qu'elle y est.**

## 01/10/2026 — prouver qu'une garde sait refuser ne prouve pas qu'elle est branchée

Le déploiement #65 a publié `NEXUS-Login-v1.html`, dont la ligne 146 appelle
`public.nexus_identifiant_de_connexion(p_prenom)`. Cette fonction est absente
du catalogue Production. Terrain : « Connexion au serveur impossible ».

Aucune garde n'a parlé. Non parce qu'une garde était fausse : parce qu'**aucune
garde ne vivait à cet endroit-là du chemin**. Les contrôles existants du
déploiement mesurent tous l'artefact — sa composition, sa clôture de
références, son empreinte, ses clés. Pas un seul ne mesure la **base que cet
artefact va interroger**. Production est servie brute par GitHub Pages : une
publication expédie le front, et seulement le front. Les migrations sont un
geste humain séparé. L'écart front/base est donc une forme structurellement
possible, pas un accident.

**Leçon 1 — la mutation à écrire est « débrancher l'aide », pas « casser l'aide ».**
Un banc vert sur la garde seule aurait été vert le 30/09 comme le 01/10. Ce qui
manquait était mesurable statiquement, et ne l'était nulle part.

## Où la garde s'assied, et pourquoi là

Le déploiement vit dans `.github/workflows/deploiement-production.yml`, **qui
n'existe que sur `production`**. Le rail ne le porte pas. Mesure du fichier à
`adee9bbcb6fd7e0af7632730ede185e655d04580` : 502 lignes, **13 étapes `- name:`,
toutes en colonne 6**, deux travaux — `construire` (ligne 145) et `deployer`
(ligne 284, `environment: name: github-pages`).

La garde est insérée dans `construire`, immédiatement **après** « Déterminer le
mode de publication » et immédiatement **avant** « Construire
(NEXUS_ENV=production) ». Ordre mesuré après insertion :
`[2] mode → [3] Garde RPC → [4] Construire`.

Trois raisons, dans cet ordre d'importance :

1. **Elle lit des refs, pas un arbre construit.** Avant le build, rien n'a pu
   perturber ce qu'elle mesure. `build.sh` tourne dans l'étape suivante ; la
   garde ne doit pas dépendre de son résultat.
2. **Un arbre dont l'écran appellerait dans le vide ne devrait pas être
   construit du tout.** Construire puis refuser gaspille, et surtout brouille :
   un rouge tardif ressemble à une panne de build.
3. **Surtout : le refus arrive AVANT l'approbation humaine de l'environnement
   `github-pages`.** Une garde qui rougit après le clic gâche le geste et
   apprend à cliquer quand même.

Elle a besoin de `steps.mode.outputs.sha_construit`, que l'étape amont publie —
c'est pourquoi elle ne peut pas être plus haut. Le banc vérifie ce voisinage en
lisant les **lignes de contexte du correctif**, pas mon intention.

## La cible n'est jamais devinée

Une garde qui se compare à elle-même dégénère : candidat == cible == `adee9bb`
rend un simple WARN et sort 0, parce que l'appel n'est pas *nouveau*. La cible
correcte est **l'état déjà publié**, et il se lit différemment selon
l'événement :

| Événement | Source de la cible | Si vide |
| --- | --- | --- |
| `push` | `github.event.before` | refus, le message nomme la source muette |
| `pull_request` | `github.event.pull_request.base.sha` | refus |
| `workflow_dispatch` | entrée **`ref_cible_rpc`**, nouvelle | refus, le message nomme le champ à remplir |
| tout autre | — | refus : « aucune cible ne peut en être déduite » |

Le SHA nul (quarante zéros, ce que GitHub envoie dans `before` à la création
d'une branche) est refusé **nommément**, pour ne pas envoyer chercher une panne
de clone là où il n'y a qu'une première poussée.

**Leçon 2 — un repli codé en dur ferait porter le verdict sur une autre
question que celle qu'on croit poser.** En répétition manuelle, aucune valeur
n'est déductible : elle est donc **demandée**. C'est la raison d'être de la
nouvelle entrée `ref_cible_rpc` (ligne 134, colonne 6, comme `ref_applicatif`
ligne 123).

## Ce qui est mesuré du correctif, et comment

`docs/deploiement/cablage-garde-rpc-production.patch` — 138 lignes,
sha256 `6284ce3d6d7f394c…`, **121 lignes `+` dont 120 de contenu, 0 suppression**.

| Mesure | Moyen | Résultat |
| --- | --- | --- |
| insertion pure, un seul fichier visé | lecture du diff | 502 → 622 lignes, +120, −0 |
| s'applique réellement | `git apply --check` sur une extraction `git archive origin/production` | propre |
| donne exactement le fichier vérifié | `git apply` puis `cmp -s` | octet pour octet identique |
| corps de l'étape valide | `bash -n` | propre |
| aiguillage et refus | **exécution** du corps sous 7 formes d'événement | 3 passent avec la bonne cible, 4 refusent fermé avec des messages distincts |
| aucune permission accordée, aucun secret | lecture du YAML seul, commentaires exclus | `permissions: {}` intact |

Les deux mesures sur refs réelles, qui sont le cas qui aurait dû bloquer ce
déploiement :

- `--candidat adee9bb --cible 2bc7b39` → **un BLOCK** sur
  `nexus_identifiant_de_connexion`, `RPC_FRONT_REFUS`, **sortie 1**.
- contre-témoin, candidat et cible sur le rail `85208cb` (289 migrations,
  57 fonctions prouvables) → `RPC_FRONT_CONFORME`, **sortie 0**.

Le contre-témoin importe autant que le témoin : il montre que le rouge vient de
la migration manquante, pas du front du candidat.

**Leçon 3 — ce qui n'est PAS prouvé doit être écrit.** Aucun analyseur YAML
n'existe sur cette machine (`pyyaml` absent des deux `python3`, `js-yaml` non
résoluble). Je n'en ai pas fabriqué un : une mesure ne se construit pas, elle
se prend. Donc **« GitHub Actions accepte ce YAML » n'est pas démontré ici** ;
cela se constatera au premier run, pas avant. Ce qui est démontré est
structurel, applicatif et comportemental.

**Leçon 4 — la garde lit des arbres Git, pas la base.** Une migration présente
sur la cible n'a pas forcément été *appliquée* : c'est exactement la divergence
registre/fichiers que ce dépôt mesure ailleurs. Elle attrape le cas #65 — le
front appelle une fonction qu'aucune migration de la cible ne définit — et ne
prétend pas attraper « la migration est là mais n'a pas tourné ».

## Trois fichiers voyagent ensemble, ou le refus arrive pour la mauvaise raison

`production` ne porte **ni `outils/` ni ce correctif**. Appliquer le YAML seul
ferait échouer l'étape sur « module introuvable », qu'on lirait comme une panne
de CI au lieu d'une dépendance oubliée.

| Fichier | Rôle | Sans lui |
| --- | --- | --- |
| `.github/workflows/deploiement-production.yml` (par le correctif) | le siège | la garde n'est pas branchée |
| `outils/garde-rpc-front-definie-sur-la-cible.js` | la garde | « module introuvable », lu comme une panne |
| `docs/deploiement/rpc-hors-bande-constatees.json` | les RPC hors-bande constatées | trois WARN inexpliqués à chaque run |

`test_cablage_garde_rpc_production_20261001.js` (section D) mesure la présence
de ces deux dépendances sur le rail, pour que l'oubli rougisse ici plutôt que
sur `production`.

**Leçon 5 — un correctif posé à côté d'un fichier qu'il ne peut pas tester
pourrit en silence.** Le rail ne porte pas le workflow : il ne peut pas tester
le fichier. Il peut tester **le correctif**, et c'est ce que fait le banc — 20
contrôles, dont trois mutations qui débranchent une clause pour prouver que le
refus venait bien d'elle.

### Note de méthode — une mutation mal visée n'est pas un refus

Premier jet du banc : retirer la seule ligne `if [ -z "${CIBLE}" ]` laisse un
`then … fi` orphelin. Le shell sort en **erreur de syntaxe**, code 1, et on lit
« la clause refusait bien » là où il n'y a qu'un script cassé. Deux
corrections : la mutation retire **le bloc entier**, de l'`if` au `fi` de même
marge ; et chaque script muté passe par `bash -n` **avant** que son code de
sortie soit interprété. Sans cette barrière, deux des trois mutations auraient
été vertes pour une raison fausse.
