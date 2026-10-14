---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-INCIDENTS-CI-1-20261014
seq: 2
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: ChatGPT
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=7468f603 production=3f5589e4
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 150-fichiers
  - id: aucun-go-production
    classe: DECLARED
    valeur: ni-fusion-ni-claude.yml-ni-Production-ni-OpenAI-reel
  - id: item-2-3-livres
    classe: VERIFIED
    valeur: commit-5faa4cce-pousse-sur-rail
  - id: item-1-bloque
    classe: DECLARED
    valeur: push-refuse-workflows-permission-manquante-github-app
---
# Items 2 et 3 livrés sur le rail ; item 1 (câblage CI) bloqué par une permission GitHub d'installation, arbitrage demandé

## Preuve des conditions de decision-1

decision-1 (APPROVED_WITH_CONDITIONS) autorisait le périmètre des trois
reliquats et exigeait, avant clôture du lot : lease, concurrence dédiée,
idempotence, absence de récursion/relance, aucune permission nouvelle ni
élargie, arrêts de sécurité préservés en `NON_ENREGISTRE`.

1. **Item 2 — compteur append-only des répétitions** : LIVRÉ et poussé sur
   le rail (commit `5faa4cce`). `outils/compteur-repetitions.js` ajoute une
   ligne à `docs/learning/REPETITIONS.jsonl` quand un `code` déjà présent au
   journal des incidents revient sous un nouvel `id` ; le total se COMPTE
   sur le journal, il n'est jamais stocké. Câblé dans
   `outils/enregistrer-incident.js`, sur la branche `ENREGISTRE` seulement —
   un rejeu (`DEJA_ENREGISTRE`) ou un arrêt humain (`NON_ENREGISTRE`) ne
   touche jamais ce journal. `test_compteur_repetitions_20261014.js` : 11
   épreuves (première occurrence, récurrence, rejeu idempotent à zéro octet,
   journal inachevé refusé, intégration réelle avec `enregistrer-incident.js`,
   absence d'effet de bord — pas de shell, pas de réseau).

2. **Item 3 — skill `nexus-incidents`** : LIVRÉ et poussé sur le rail (même
   commit). `docs/skills/nexus-incidents/SKILL.md` documente ce qui est
   automatique (classement par `classerArret`, enregistrement, compteur,
   lease, concurrence) et ce qui reste un geste réfléchi (diagnostic,
   correction, promotion GOV-002 dans `EXPERIENCE.jsonl` + `RULES.json`), sur
   le précédent réel `INC-1b3e3a7d6d30` / `GOV-008`. N'invente aucun statut
   `FERME` que l'outillage ne porte pas, ne requalifie jamais un arrêt déjà
   classé.

3. **Item 1 — câblage CI rail-only** : ÉCRIT, PROUVÉ EN SIMULATION, **NON
   LIVRÉ SUR LE RAIL**. Voir §2 — ce n'est pas une preuve manquante, c'est un
   canal qui ne peut pas écrire ce fichier précis.

## 1. Ce qui a été construit pour l'item 1 (preuve avant blocage)

Un job `enregistrement-incident` (`needs: non-regression`), déclenché
seulement quand l'étape `boucle_autonome` du job `non-regression` classe un
verdict comme devant notifier un humain (`incident_a_enregistrer == '1'`),
publié par trois lignes `echo` ajoutées à la branche `notifier` existante de
cette étape (`lot`, `rail`, `sha` — `motif` servait déjà de `code`).

- **Lease** : la tête du rail est lue par le `checkout` de ce job (pas celle
  lue par `non-regression`, qui peut avoir vieilli dans la file de
  concurrency) ; le commit est construit sur cette tête, le push final est
  SANS FORCE.
- **Concurrence dédiée** : groupe
  `nexus-incidents-enregistrement-${{ github.ref }}`, `cancel-in-progress:
  false` — propre à ce job ; `non-regression` n'en a aucun et n'est pas
  affecté.
- **Idempotence** : `enregistrer-incident.js` ne commit QUE sur son propre
  verdict `ENREGISTRE` ; `DEJA_ENREGISTRE` et `NON_ENREGISTRE` ne touchent
  aucun fichier.
- **Absence de récursion/relance** : aucun `GH_TOKEN`, aucun `gh`, aucun
  `repository_dispatch`/`workflow_dispatch` dans ce job ; un push refusé
  (rail avancé) échoue une seule fois (`FAILED`/`PUSH_REFUSE`), sans nouvelle
  tentative dans le même run.
- **Aucune permission nouvelle ni élargie** : aucun `permissions:` de job
  (héritage du bloc du workflow, inchangé) — condition vérifiée par
  construction : le bloc `permissions:` du haut n'a pas été touché, et
  `test_permissions_workflow_20260908.js` reste vert sans modification.
- **Arrêts de sécurité préservés** : correction associée dans
  `outils/watchdog-stagnation.js` — `FAMILLES.DECISION_HUMAINE` gagne
  `STOP_HUMAIN`, `VERDICT_REPETE`, `PLAFOND_LOT_ATTEINT`,
  `PLAFOND_JOUR_ATTEINT` (les quatre codes de `garde-boucle-autonome.js` que
  `relancer-claude-ci.js` place dans `A_NOTIFIER`, donc les seuls que ce job
  pouvait recevoir en plus de `BLOQUE`/`CONDITIONS_NON_PROUVEES`, déjà
  classés). Sans cette correction, un plafond de sécurité délibéré se serait
  enregistré comme un incident système.

Toute la chaîne a été rejouée en simulation sur un dépôt git jetable (bare +
clones, hors de ce dépôt) : premier enregistrement, rejeu idempotent
(`DEJA_ENREGISTRE`, 0 octet changé), arrêt humain préservé (`STOP_HUMAIN` →
`NON_ENREGISTRE`), lease violée par une course simulée (push refusé, `FAILED`,
aucun force), reprise propre au run suivant (le même incident s'enregistre
sans corruption), répétition de code committée avec son incident dans le
même commit atomique. 11 épreuves dans
`test_cablage_incidents_ci_20261014.js` (job, concurrency, lease, permissions
absentes, mutation sur `FAMILLES`).

## 2. Le blocage — CHANNEL_LIMITATION, pas une absence de preuve

Le `git push` de la branche portant les trois items a été REFUSÉ par GitHub :

> refusing to allow a GitHub App to create or update workflow
> `.github/workflows/tests.yml` without `workflows` permission

Ce n'est pas le bloc `permissions:` interne au workflow — celui-là reste
inchangé, condition déjà remplie. C'est une permission d'**installation**
de l'app GitHub `claude[bot]`, posée par GitHub lui-même, hors du dépôt. Je
ne peux pas me l'accorder : CLAUDE.md classe « nouveau jeton, nouvelle
capacité d'écriture, nouvel accès » dans les gates jamais pré-autorisées, et
une permission d'app GitHub en est une par construction.

J'ai donc retiré du commit poussé les trois fichiers qui en dépendent
(`.github/workflows/tests.yml`, `outils/watchdog-stagnation.js`,
`test_cablage_incidents_ci_20261014.js` — supprimé, puisqu'il n'a plus de
job à tester sans les deux premiers), en documentant pourquoi dans le
message du commit `8a7e971b`. Rien n'est perdu : le travail complet de
l'item 1 (câblage, correction, 11 épreuves) reste sur la branche locale
`mon-travail-20261014` (tête `aeff14c1`), reproductible à l'identique.

## 3. Ce qui est demandé

1. Valider items 2 et 3 comme livrés (commit `5faa4cce`, déjà sur le rail).
2. Trancher l'item 1 : soit un canal qui détient `workflows` sur ce dépôt
   (ChatGPT, si un tel canal existe et est autorisé) pousse le contenu de
   `mon-travail-20261014` (`aeff14c1`) vers le rail sous lease ; soit Frédéric
   l'accorde au jeton `claude[bot]` (élargissement de la surface du jeton,
   geste humain, CLAUDE.md) ; soit le lot se clôt sans l'item 1, qui repart
   dans un lot successeur avec un exécutant capable d'emblée.
3. Dire si le lot se clôt sur ce verdict ou attend l'item 1.

## 4. Limites

Aucun GO Production, aucune fusion, aucun `claude.yml` sur `main`, aucun
appel OpenAI réel, aucune permission supplémentaire prise seul. Je ne
m'arbitre pas moi-même.

## 5. Verdict demandé

Router l'item 1 (canal capable ou geste de Frédéric), et dire si items 2+3
suffisent à clore ce lot ou si l'item 1 reste une condition de clôture.
