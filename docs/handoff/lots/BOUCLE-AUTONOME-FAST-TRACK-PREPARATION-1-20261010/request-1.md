---
protocol: nexus-handoff/2
kind: request
lot_id: BOUCLE-AUTONOME-FAST-TRACK-PREPARATION-1-20261010
seq: 1
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=d6093b7 production=b17ac7a
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 140-fichiers
  - id: garde-boucle-autonome-tests
    classe: VERIFIED
    valeur: test_garde_boucle_autonome_20261010.js 22/22, mutation negative executee et confirmee
  - id: notification-humaine-tests
    classe: VERIFIED
    valeur: test_notification_humaine_20261010.js 9/9
  - id: defaut-desarme
    classe: VERIFIED
    valeur: NEXUS_BOUCLE_AUTONOME absent de process.env, estArme=false, CLI evaluer repond REFUS DESARME
  - id: regression-globale
    classe: VERIFIED
    valeur: node run-tests.js, aucune regression, 9 echecs connus inchanges
  - id: edition-workflows
    classe: NOT_APPLICABLE
    valeur: ecriture sous .github-workflows bloquee pour ce canal, patch documente non applique
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune requete, aucun merge, aucun deploiement
---
# request-1 — Boucle autonome Fast Track : préparation sans armement

## Mandat

GO de préparation de Frédéric sur l'issue #28 (commentaire du 10/10/2026,
`NEXUS_BASE_BRANCH=handoff-continuite-20260920`) : concevoir et outiller la
boucle `Claude → push rail → workflow_dispatch tests.yml → tests.yml déclenche
Claude après décision consommée actionnable → Claude ...`, **sans l'armer**.
Six points demandés ; le septième (« ne pas redemander ce GO ») est respecté —
ce retour n'en redemande pas un, il rapporte le travail fait sous le mandat
déjà donné.

Ce lot est un lot outillage/garde/test pur : aucun choix métier, aucun secret
créé ou lu, aucune action Production, aucun `main` touché. Il relève de
l'arbitrage a posteriori (CLAUDE.md « Arbitrage a posteriori » ; acquis
`OUTILLAGE_A_POSTERIORI` de `docs/handoff/ARBITRAGES-ACQUIS.json`) : exécuté
puis rapporté, pas précédé d'une décision bloquante.

## Ce qui existait déjà et que ce lot réutilise, plutôt que de dupliquer

Avant d'écrire une ligne, lecture de l'historique canonique :
`ARMEMENT-ARBITRAGE-AUTONOME-1-20261008` (decision-1 BLOCKED sur l'armement,
decision-2 APPROVED sur la prise d'acte d'un armement humain borné),
`FAST-TRACK-ANTI-PAUSE-1-20261007`/`FAST-TRACK-CYCLE-POINTEUR-1-20261008`
(toutes deux excluent explicitement l'armement d'une boucle autonome),
`docs/handoff/ARBITRAGES-ACQUIS.json` (routage des STOP à deux paliers,
`frederic` vs `arbitre`), et le corps déjà écrit dans
`.github/workflows/tests.yml` autour de `NEXUS_RAPATRIEMENT_ARME` (transport
du rail, `outils/transport-autorise.js` + `outils/qualifier-rapatriement.js`)
et `NEXUS_MATERIALISATION_CI` (matérialisation de décision,
`outils/materialiser-decision-ci.js`). Ces deux variables suivent déjà le
même principe que celui demandé ici : une capacité technique existe dans le
jeton, l'armement reste un geste humain distinct, posé comme variable de
dépôt, jamais par Claude. `NEXUS_BOUCLE_AUTONOME` est un **troisième**
interrupteur de cette même famille — pour un **troisième** maillon, inédit :
refermer la boucle en réveillant Claude après un passage CI vert, plutôt que
transporter un rail ou matérialiser une décision.

`tests.yml` documente déjà, de sa propre main, le risque exact que ce lot
adresse : *« claude.yml se déclenche sur tout commentaire portant la mention
@claude [...] Un réveil publié qui la porterait relancerait Claude → push →
CI → nouveau réveil → sans fin. Seule une propriété de plateforme l'empêche
aujourd'hui [...] On ne s'y adosse pas. »* Ce lot construit la garde
déterministe qui remplacerait cette propriété de plateforme par un contrôle
explicite, testé, et par défaut désarmé.

## 1) Ce qui est livré (code + tests, vérifié réellement)

**`outils/garde-boucle-autonome.js`** — garde pure, un seul point de vérité
pour la question « ce tour a-t-il le droit de s'exécuter ? ». Vocabulaire
fermé de 9 codes (`DESARME`, `STOP_HUMAIN`, `AUCUNE_NOUVELLE_DEMANDE`,
`DECISION_DEJA_TRAITEE`, `VERDICT_REPETE`, `CI_ROUGE`, `PLAFOND_LOT_ATTEINT`,
`PLAFOND_JOUR_ATTEINT`, `AUTORISE`), priorité : interrupteur désarmé > motif du
palier Frédéric > rien de nouveau à faire > décision déjà rejouée > verdict
qui se répète sans évoluer > CI rouge > plafond par lot (3) > plafond par jour
tous lots (10, valeurs initiales proposées par Frédéric). Journal append-only
(`docs/handoff/BOUCLE-AUTONOME-JOURNAL.json`, non créé par ce lot — seul le
code qui l'écrirait l'est) portant chaque tour évalué, autorisé ou refusé,
pour que l'idempotence et l'anti-répétition portent sur un fait écrit, pas sur
une mémoire volatile du run. CLI `evaluer` préparée mais non câblée dans
aucun workflow (voir §3) : elle ne fait jamais `gh workflow run` elle-même,
seulement GO/NO-GO + journalisation.

**`outils/notification-humaine.js`** — trois états distincts (`PUBLIE`,
`LIVRE`, `CONFIRME`) au lieu d'un booléen « notifié », pour ne jamais confondre
un commentaire GitHub déposé avec une réception humaine réelle.
`construireNotificationStop` produit un corps de STOP portant un jeton-témoin
vérifiable ; `verifierConfirmation` ne retourne `CONFIRME` que si une réponse
**postérieure**, **du compte attendu**, **citant ce jeton précis**, est
retrouvée — sinon `receptionConfirmee` reste `false`. `rapportCapacite()`
déclare explicitement la limite : ce dépôt ne peut produire que `PUBLIE`/
`LIVRE` depuis cet environnement ; un canal poussé (SMS, e-mail, notification
mobile) n'existe pas pour NEXUS et son choix reste une décision de Frédéric,
non prise ici — capacité manquante déclarée, jamais fabriquée.

**Tests** — `test_garde_boucle_autonome_20261010.js` (22/22) et
`test_notification_humaine_20261010.js` (9/9), exécutés réellement dans cette
session, couvrant nommément les 5 scénarios exigés par le GO (interrupteur
absent/désarmé, STOP, échec CI, répétition, absence de nouvelle demande) plus
les plafonds, l'idempotence sur disque réel (écriture puis relecture, pas une
supposition), et une **mutation négative réellement exécutée** : le contrôle
STOP a été déplacé après les plafonds dans le code, la suite a rougi
exactement sur l'épreuve de priorité (`PLAFOND_JOUR_ATTEINT` obtenu au lieu de
`STOP_HUMAIN`), puis le code a été restauré et la suite revérifiée verte.
Régression complète : `node run-tests.js` → *« Aucune régression : seuls les 9
échecs connus subsistent »* (liste inchangée, propre à ce dépôt, sans lien
avec ce lot).

**Preuve de non-déclenchement en mode désarmé** — `NEXUS_BOUCLE_AUTONOME`
n'existe dans AUCUN fichier de ce rail avant ce lot (recherche faite, aucune
occurrence) ; `process.env.NEXUS_BOUCLE_AUTONOME` est absent de cette session
elle-même ; `estArme(process.env)` vaut `false` sur l'environnement réel de ce
run, vérifié par une assertion dédiée du test (pas une relecture manuelle).
`node outils/garde-boucle-autonome.js evaluer --lot TEST-CLI --commit abc123
--ci success --nouvelle-decision 1` a été exécuté réellement dans cette
session et a répondu `REFUS — DESARME — [...] défaut sûr : désarmé.` — la CLI
elle-même refuse tant que personne n'arme.

## 2) Limite honnête : ce lot NE PEUT PAS éditer `.github/workflows/*`

Restriction technique de ce canal (capacité de l'outil Claude Code déclarée
explicitement : « Modifying files in the .github/workflows directory »,
indépendante de toute permission GitHub accordée au jeton du workflow). Les
points 1, 2 et 3 du mandat (`workflow_dispatch` de `claude.yml`, condition de
déclenchement dans `tests.yml`, step de fin de run) ne peuvent donc pas être
appliqués depuis ce canal — ce n'est pas un choix, c'est vérifié : toute
tentative d'écriture sous `.github/workflows/` est bloquée avant même d'être
soumise à git. Conformément à l'acquis `LIMITATION_CANAL_NON_STOP`, ceci est
une `CHANNEL_LIMITATION`, pas un motif de réveil de Frédéric : le patch exact
est documenté ci-dessous pour qu'une session outillée (ou Frédéric) l'applique
et ouvre la PR séparée demandée vers `main`, sans la fusionner.

## 3) Patch proposé — NON APPLIQUÉ, à charge d'une session habilitée

### 3.1 — `claude.yml` : `workflow_dispatch` avec rail et lot désignés

```yaml
on:
  issue_comment:
    types: [created]
  pull_request_review_comment:
    types: [created]
  pull_request_review:
    types: [submitted]
  issues:
    types: [opened, assigned]
  workflow_dispatch:
    inputs:
      rail:
        description: 'Rail Handoff désigné (handoff-* ou config-par-environnement). Jamais main/production.'
        required: true
        type: string
      lot_id:
        description: 'LOT_ID exact à traiter — jamais déduit.'
        required: true
        type: string
```

Et, dans le step « Résoudre le rail NEXUS désigné », une branche dédiée à
`github.event_name == 'workflow_dispatch'` qui :
- refuse si `github.actor` n'est pas une identité autorisée à armer la
  boucle (ex. `github.actor == 'vito-sainte-marie'`, ou le jeton du step de
  fin de run de `tests.yml` lui-même — à trancher par Frédéric, jamais déduit
  ici) ;
- refuse si `inputs.rail` est `main`/`production` ou ne matche pas
  `^handoff-[A-Za-z0-9._/-]+$` (même garde que l'actuel `refuser`) ;
- refuse si `inputs.lot_id` ne matche pas `^[A-Z0-9][A-Z0-9-]{2,63}$` (même
  motif que `LOT_ID_VALIDE` de `outils/handoff.js`) ;
- pose `NEXUS_CLAUDE_BASE_BRANCH=<rail>` et une nouvelle variable
  `NEXUS_CLAUDE_LOT_CIBLE=<lot_id>` dans `$GITHUB_ENV`, pour que le prompt
  transmis à `claude-code-action` nomme le lot sans qu'il ait besoin de le
  redécouvrir.

Aucune permission nouvelle : `workflow_dispatch` ne change pas
`permissions:`. Il élargit la surface de **déclenchement**, pas d'écriture —
mais élargir qui peut déclencher un job `contents: write` reste listé par
CLAUDE.md comme une nouveauté qui élargit la surface de sécurité
(« nouvelle capacité d'écriture, nouvel accès ») si le déclencheur n'est pas
restreint à l'identique de l'existant. Le `if:` ci-dessus doit donc rester au
moins aussi strict que la garde actuelle (`github.actor ==
'vito-sainte-marie'`) tant que Frédéric n'arbitre pas explicitement une
délégation plus large.

### 3.2 — `tests.yml` : ne déclencher Claude qu'après décision consommée actionnable

Nouveau step, en fin de job, gardé par la variable de dépôt
`NEXUS_BOUCLE_AUTONOME` (jamais posée par Claude — même famille que
`NEXUS_RAPATRIEMENT_ARME`/`NEXUS_MATERIALISATION_CI` déjà dans ce fichier) :

```yaml
      - name: Boucle autonome Fast Track — tour suivant (désarmée par défaut)
        if: always() && vars.NEXUS_BOUCLE_AUTONOME == 'arme'
        env:
          GH_TOKEN: ${{ github.token }}
        shell: bash
        run: |
          set -euo pipefail
          lot="$(node outils/handoff.js rail >/dev/null 2>&1 && node -e "
            const {lots, dernier, echanges} = require('./outils/handoff.js');
            const etat = JSON.parse(require('fs').readFileSync('docs/handoff/STATE.json'));
            console.log(etat.lot_actif || '');
          ")"
          if [[ -z "$lot" ]]; then echo "Aucun lot actif — rien à boucler."; exit 0; fi
          statut="$(node -e "console.log(JSON.parse(require('fs').readFileSync('docs/handoff/STATE.json')).lots['$lot'].statut)")"
          if [[ "$statut" != "DECISION_CONSOMMEE" ]]; then
            echo "Lot $lot au statut $statut — pas une décision consommée actionnable, rien à boucler."
            exit 0
          fi
          commit="$(node -e "console.log(JSON.parse(require('fs').readFileSync('docs/handoff/STATE.json')).lots['$lot'].commit_decision)")"
          verdict="$(node outils/garde-boucle-autonome.js evaluer --lot "$lot" --commit "$commit" --ci success --nouvelle-decision 1)"
          echo "$verdict"
          if [[ "${NEXUS_BOUCLE_TOUR_AUTORISE:-0}" != "1" ]]; then exit 0; fi
          gh workflow run claude.yml --ref "$(node outils/handoff.js rail "$lot")" \
            -f rail="$(node outils/handoff.js rail "$lot")" -f lot_id="$lot"
```

Ce step reste un brouillon de référence, pas un patch prêt à coller tel
quel : il faudra, au minimum, une fonction dédiée (plutôt que des appels
`node -e` en ligne) côté `outils/handoff.js` ou `outils/garde-boucle-autonome.js`
pour lire proprement `lot_actif`/`statut`/`commit_decision`, et une vraie
résolution de `ciConclusion` (le run courant de `tests.yml` vient tout juste
de réussir à cet endroit du fichier, donc `success` littéral est correct ICI,
mais seulement ici — un futur rappel de la garde depuis un autre contexte ne
doit jamais supposer `success`).

### 3.3 — Fin du run Claude : push sous lease puis `workflow_dispatch tests.yml`

Déjà largement couvert par l'existant : `outils/transport-autorise.js` +
`outils/qualifier-rapatriement.js` décident déjà d'un push sous condition
(`NEXUS_RAPATRIEMENT_ARME`). Le seul ajout nécessaire pour ce point 3 du
mandat est, après un push réussi vers le rail canonique, un
`gh workflow run tests.yml --ref <rail>` explicite — pour ne pas dépendre du
déclenchement implicite `on: push`, qui existe déjà mais n'est pas nommé
comme un maillon de LA boucle. Patch non rédigé ici : il touche la même
famille de fichiers que 3.1/3.2 et doit être revu avec eux, pas séparément.

### 3.4 — PR séparée vers `main`, non fusionnée

Non ouverte par ce canal : elle nécessiterait d'écrire sous
`.github/workflows/`, bloqué (§2). Dès qu'une session habilitée applique 3.1
à 3.3, elle doit ouvrir cette PR et NE PAS la fusionner — la fusion `main`
reste un STOP humain distinct (CLAUDE.md, `MOTIFS_STOP_FERMES.frederic`).

## 4) Vérification des permissions minimales de `GITHUB_TOKEN`

Lu, pas deviné : `claude.yml` (job `claude`) porte déjà
`contents: write, issues: write, pull-requests: write, actions: write,
id-token: write` ; `tests.yml` porte `contents: write, actions: read,
issues: write`, chacune des trois dernières nommément autorisée par Frédéric
à une date précise, avec son usage écrit en toutes lettres (voir l'en-tête du
fichier). Le patch §3.2 n'ajoute **aucune** permission : `gh workflow run`
utilise le `actions: write` déjà présent sur `claude.yml`, pas `tests.yml` —
donc `tests.yml` a besoin d'un `actions: write` qu'il ne porte pas encore
(il n'a que `actions: read`) pour pouvoir lui-même déclencher `claude.yml` par
API. **C'est un élargissement de permission, donc un geste humain distinct**,
à soumettre nommément — ce lot ne l'accorde pas et ne le demande pas ici
comme une question à trancher dans ce lot : il le signale pour le patch §3.2.
Aucun chemin d'escalade identifié au-delà de celui déjà documenté dans
`tests.yml` pour `contents: write` (rail nommé, jamais `main`/`production`,
jamais de `--force`).

## 5) Ce qui N'A PAS été fait, explicitement

- `NEXUS_BOUCLE_AUTONOME` n'a été posé nulle part — ni en variable de dépôt,
  ni dans un fichier, ni dans ce lot. L'armement reste un palier de Frédéric.
- Aucun fichier sous `.github/workflows/` n'a été créé ou modifié.
- Aucune PR vers `main` n'a été ouverte (dépend du point précédent).
- Le journal `docs/handoff/BOUCLE-AUTONOME-JOURNAL.json` n'a pas été créé sur
  ce rail : seul le code capable de l'écrire l'est, pour ne pas laisser un
  fichier vide se faire passer pour une preuve d'exécution.
- `verifierConfirmation` n'a jamais été appelé contre de vrais commentaires
  GitHub (aucun accès API d'écriture utilisé dans ce lot) — seulement
  éprouvé par des fixtures.

## Guardians

**Architecture** — aucune duplication : la garde réutilise le vocabulaire
`frederic`/`arbitre` déjà établi (`docs/handoff/ARBITRAGES-ACQUIS.json`) sans
le recopier, et le patch proposé réutilise `NEXUS_RAPATRIEMENT_ARME`/
`NEXUS_MATERIALISATION_CI` comme modèle plutôt que d'inventer une troisième
convention incompatible.
**Security & Isolation** — aucun secret, aucune permission ajoutée par ce
lot ; l'élargissement de permission identifié en §4 est signalé, pas accordé.
**Business Rules** — sans objet : aucun choix métier/produit dans ce lot.
**QA/Regression** — 31/31 nouveaux tests verts, mutation négative réellement
exécutée et confirmée, 0 régression sur la suite complète.
**Bible/Philosophie** — « automatisation par défaut, humain par exception »
respecté dans le sens strict du mandat : l'exception (armement, plafond
définitif, fusion main) reste explicitement humaine ; rien dans ce lot ne
décide à la place de Frédéric.

## Retour attendu

Pas une nouvelle décision bloquante requise pour ce qui est livré (lot
outillage a posteriori). Si une session habilitée à éditer
`.github/workflows/*` applique le patch §3, un nouveau `request-N.md`
canonique devra suivre avec le SHA réel, le run CI réel, et la preuve de
non-déclenchement en mode désarmé observée EN PRODUCTION du workflow (pas
seulement en local comme ici).
