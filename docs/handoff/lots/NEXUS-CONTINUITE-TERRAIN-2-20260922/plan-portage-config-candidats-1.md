# Plan de portage — préparation seule, rien n'est exécuté (22/09/2026)

Ce dossier répond aux points 1 et 2 du réveil de poursuite technique du 22/09/2026 après transport
canonique (issue #28, commentaire `5785621978`) : prouver les artefacts/checks GitHub disponibles
pour #62/#65 et le mécanisme `urlTestDeBranche`, puis préparer le plus petit portage de
configuration/build réutilisant ce mécanisme, **sans l'exécuter** — `decision-2.md` de ce lot
conditionne le portage réel à une observation Cloudflare humaine préalable, non levée à ce jour.

## 1. Artefacts/checks GitHub disponibles pour #62/#65 — reconfirmé, inchangé

`gh pr checks 62`, `gh pr view`, `git ls-tree` sur une ref distante : refusent tous une approbation
qu'aucun humain ne peut donner dans ce run automatisé, comme pour tous les réveils précédents de
cette issue depuis le 06/09/2026 — reconfirmé dans cette session, pas seulement recopié d'un rapport
antérieur. Seule la lecture `git show <ref>:<chemin>` fonctionne (déjà établi dans
`classement-gates-etat-git-62-65-1.md`) : ce dossier ne cite donc que ce qui en est dérivable, sans
re-mesurer le statut CI vert/rouge lui-même.

`urlTestDeBranche` (ajoutée par `request-2.md`, déjà 66/66 dans
`test_recette_navigateur_test_20260907.js`) fonctionne sans changement — réutilisée telle quelle
ci-dessous, aucune seconde implémentation d'alias.

## 2. Correction : la chaîne comporte 7 fichiers, pas 4

`etude-isolation-test-candidats-web-1.md` (§2.2) citait 4 fichiers absents sur #62/#65
(`outils/build.sh`, `outils/generer-config.js`, `nexus-page.js`,
`nexus-bandeau-environnement.js`) plus `nexus-auth.js` pré-refonte — 5 au total. Une confrontation
directe (`git show <branche>:<chemin>`, cette session) en révèle deux de plus, jamais nommés
jusqu'ici :

- **`outils/poser-build-id.js` est déjà présent sur #62 ET #65**, à l'identique sur les deux
  (`sha256 32e7c78c…`), mais c'est la version **antérieure au 05/09/2026** : identité de build par
  horodatage de lancement, pas par empreinte de contenu — exactement le défaut que la refonte du
  05/09 a corrigé (constaté en recette le 04/09 : le pied de page annonçait un commit vieux de neuf
  livraisons). Le porter n'est pas optionnel : `outils/build.sh` du rail l'appelle en étape 2/3, et
  l'ancienne version écrirait une identité qui ne dit plus la vérité sur ce qui est réellement servi.
- **`_headers` (règle Cloudflare `Cache-Control: no-store` pour `nexus-config.js`) est absent des
  deux branches.** Sans lui, `outils/generer-config.js` (contrôle §7 de ce fichier) refuse de
  continuer — donc le porter est une précondition du build, pas une amélioration annexe.

La chaîne exacte est donc : `outils/build.sh`, `outils/generer-config.js`,
`outils/poser-build-id.js`, `nexus-page.js`, `nexus-bandeau-environnement.js`, `nexus-auth.js`,
`_headers` — 7 fichiers, mesurés un par un sur les deux candidats (voir §3).

## 3. Outillage ajouté — `outils/planifier-portage-config-candidat.js`

Nouveau, testé (`test_planifier_portage_config_candidat_20260922.js`, 10/10 dont une mutation
négative). Pour une branche candidate nommée explicitement par l'appelant (jamais codée en dur),
il :

1. refuse toute ref protégée (`main`, `production` — réutilise `REFS_PROTEGEES` exporté de
   `outils/handoff.js`, aucune seconde vérité) ou toute ref préfixée (`origin/…`, pour ne jamais
   dériver l'alias Cloudflare d'autre chose que le nom nu de la branche réellement poussée) ;
2. lit l'état des 7 fichiers ci-dessus (`ABSENT` / `DIFFERENT` / `DEJA_IDENTIQUE`) par
   confrontation de contenu (`git show`), jamais par supposition ;
3. calcule l'adresse Test que la branche prendrait une fois portée, via `urlTestDeBranche` — aucune
   seconde implémentation d'alias ;
4. **imprime** la séquence de commandes qu'un humain avec accès Cloudflare ET droit de push
   exécuterait — il ne l'exécute jamais lui-même. Garde d'architecture éprouvée par analyse statique
   du fichier (et par une mutation négative qui prouve que le détecteur lève bien une écriture
   injectée) : ce script ne peut exécuter que `git show`/`git rev-parse`, jamais `checkout`,
   `commit` ni `push`.

Résultat mesuré pour les deux candidats, réellement exécuté (pas simulé) :

```
$ node outils/planifier-portage-config-candidat.js fdj-vague1-cycle-caisse-20260916
  + outils/build.sh (ABSENT)
  + outils/generer-config.js (ABSENT)
  ~ outils/poser-build-id.js (DIFFERENT)
  + nexus-page.js (ABSENT)
  + nexus-bandeau-environnement.js (ABSENT)
  ~ nexus-auth.js (DIFFERENT)
  + _headers (ABSENT)
  7/7 fichier(s) à porter.
  Adresse Test prévue une fois porté : https://fdj-vague1-cycle-caisse-2026.nexus-test-ddf.pages.dev/

$ node outils/planifier-portage-config-candidat.js reception-regularisation-20260919
  (même schéma, 7/7 à porter)
  Adresse Test prévue une fois porté : https://reception-regularisation-202.nexus-test-ddf.pages.dev/
```

Une branche déjà alignée sur le rail (testé contre `handoff-continuite-20260920` lui-même) ressort
correctement `0/7 à porter` — preuve que l'outil ne signale pas un portage là où il n'y en a pas.

## 4. Ce que ce dossier ne fait pas

Aucun `git checkout`/`commit`/`push` vers `fdj-vague1-cycle-caisse-20260916` ou
`reception-regularisation-20260919` — le portage réel reste différé, conformément à `decision-2.md`
§Conditions, tant qu'un accès Cloudflare humain n'a pas observé ce qui y est construit et servi
aujourd'hui. Aucune recette navigateur lancée (§3 du réveil). Aucune étape nécessitant Supabase Test
entamée (§4 du réveil) : aucune variable `NEXUS_TEST_DB_URL*`/`SUPABASE_TEST_DB_URL*`/
`NEXUS_TEST_*_PIN` n'est présente dans ce canal (reconfirmé par test de présence booléen, sans
lecture de valeur). Aucune nouvelle règle métier/UX.

## Invariants respectés

Aucun changement `main`/`production`, aucune opération Supabase, aucune promotion Production, aucun
secret créé/lu/exposé, aucun nouveau rôle/RLS, aucun fichier applicatif métier touché (diff limité à
`docs/handoff/`, `outils/handoff.js` (export additif `REFS_PROTEGEES`),
`outils/planifier-portage-config-candidat.js`,
`test_planifier_portage_config_candidat_20260922.js`).
