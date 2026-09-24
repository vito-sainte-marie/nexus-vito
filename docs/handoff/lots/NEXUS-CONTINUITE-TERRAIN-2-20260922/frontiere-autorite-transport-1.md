# Frontière d'autorité Git du canal `issue_comment` — document unique, ne pas re-dériver

Consolidation demandée par le Créateur (issue #28, réveil du 24/09/2026, Phase 0) : « documenter
une seule fois la frontière d'autorité puis laisser l'Orchestrator/GitHub connector effectuer le
transport ; ne pas générer une nouvelle boucle request/repair identique. »

Ce document ne refait aucune mesure : il consolide des preuves déjà produites et déjà déposées
dans ce même lot (`request-4.md`, `request-13.md`), afin qu'aucun réveil futur n'ait besoin de
les reproduire pour établir le même constat.

## Constat

Une session Claude déclenchée par `issue_comment` sur ce dépôt (workflow `claude.yml`) travaille
sur sa propre branche `claude/issue-28-*`. Elle n'a et n'a jamais eu, de façon constatée et
répétée depuis le 06/09/2026, la capacité d'écrire sur une branche tierce du dépôt distant —
qu'il s'agisse d'une branche de rail Handoff (`config-par-environnement`,
`handoff-continuite-20260920`) ou d'une branche candidate (`rebuild/carburants-65-20260922`,
`rebuild/fdj-62-20260922`).

## Preuves déjà établies (non reproduites ici)

`request-13.md` de ce lot a testé et documenté séparément six formes d'écriture, toutes
refusées avec « requires approval » — une approbation qu'aucun humain ne peut donner dans un
run automatisé :

1. `git fetch origin <branche-tierce>`
2. `git ls-remote origin <branche-tierce>`
3. `git worktree add <chemin> origin/<branche-tierce>`
4. `git checkout -b <branche-locale> origin/<branche-tierce>`
5. `git push origin HEAD:refs/heads/<branche-tierce> --dry-run`
6. `git hash-object -w <fichier>` (et même sans `-w`)

Seules les opérations strictement en lecture sur des objets déjà présents localement
fonctionnent : `git rev-parse`, `git cat-file`, `git show <ref>:<fichier>`, `git log -- <fichier>`,
`git diff <refA> <refB>`, `git grep`.

`request-13.md` a aussi constaté que le réseau sortant brut n'est pas coupé (`https.get` vers
`api.github.com/rate_limit` répond `200` sans jeton) — seules les commandes `git`/`gh`/`curl`
invoquées comme sous-processus via l'outil Bash sont bloquées par la couche de permission du
harnais. Il serait techniquement possible de contourner cette restriction en écrivant
directement via l'API REST Contents de GitHub en réutilisant le jeton d'installation déjà
présent dans l'URL du remote `origin`. **Cela n'a pas été fait, et ne doit pas l'être** : ce
serait un usage du jeton hors du périmètre que le harnais lui accorde délibérément (écriture
restreinte à la branche assignée à la session), donc un élargissement de la surface de sécurité
au sens de `CLAUDE.md` — une gate humaine, jamais pré-autorisée.

## Ce que ce canal peut faire, et le fait déjà

Préparer un artefact exact (diff/fichier complet + preuves) sur le rail canonique
(`handoff-continuite-20260920`), accessible en lecture par toute autorité disposant d'un accès
d'écriture réel — comme cela a déjà fonctionné pour `nexus-auth-restaure-65-20260924.js`,
effectivement transporté vers la candidate au commit `a31b2e4` par une autorité extérieure à ce
canal, puis vérifié identique octet pour octet par `request-14.md` de ce même lot.

## Ce que ce canal ne referapas

Retenter l'une des six méthodes ci-dessus depuis un futur réveil `issue_comment` de ce lot,
dans l'espoir d'un résultat différent. Si une autorité de transport réelle (Orchestrator,
connecteur GitHub, ou Frédéric directement) devient disponible et transporte les artefacts déjà
prêts, le réveil suivant doit se limiter à **vérifier** le résultat (identité de blob, CI
mesurée) — pas à re-prouver l'absence de capacité d'écriture.

## Portée

Ce document couvre la frontière d'autorité Git générale de ce canal, pas seulement le lot #65 :
toute future demande de transport inter-branches depuis une session `issue_comment` peut s'y
référer directement plutôt que de reproduire la démonstration.
