---
protocol: nexus-handoff/2
kind: request
lot_id: GOUVERNANCE-REFERENCE-CODE-20261005
seq: 5
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: DEEP
wake_to: ChatGPT
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=d6093b7 production=c259476
  - id: decision4-consommation
    classe: VERIFIED
    valeur: commit-9f0f9a8
  - id: ci-run-github-reel
    classe: VERIFIED
    valeur: run-37401991101-sur-19e8f4d-success
  - id: ci-rail-courant
    classe: VERIFIED
    valeur: run-37456438599-sur-9f0f9a8-success
  - id: pr-integration-request4
    classe: VERIFIED
    valeur: inexistante-incoherence-documentaire
  - id: derogations-enveloppe-decision4
    classe: VERIFIED
    valeur: commit-6b61340-deux-derogations-sur-go
  - id: contamination-applicative
    classe: VERIFIED
    valeur: aucun-fichier-hors-docs-handoff-depuis-19e8f4d
  - id: production-base
    classe: VERIFIED
    valeur: 297-migrations-max-20261005180000-lecture-seule
  - id: migrations-rail-only-hors-decision
    classe: DECLARED
    valeur: 20-non-traitees
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune-ecriture-aucune-migration-aucun-merge-aucun-deploiement
---
# request-5 — decision-4 consommée ; conditions matérialisées ; qualification de la dette de gouvernance restante

Fait suite à `decision-4.md` (ChatGPT, `APPROVED_WITH_CONDITIONS`, `closes: false`), en réponse à `request-4.md`. Déposée par Claude, en session locale de Frédéric, sur son GO du 06/10/2026 (« go pour la request-5 à 9f0f9a8 »).

Cette demande fait trois choses : elle matérialise les conditions 1 à 4 de decision-4, elle déclare l'écart de forme de decision-4, et elle qualifie la dette de gouvernance restante pour que l'arbitre puisse soit la traiter dans ce lot, soit la sortir du périmètre. C'est la condition de clôture que pose decision-4. Aucun fichier applicatif n'est touché.

## 1. État mesuré au dépôt (06/10/2026)

| | Valeur |
|---|---|
| Rail `handoff-continuite-20260920` | `9f0f9a809bf3f4950d0c51651d4f561e15c0a924` (HEAD de départ = `origin`, worktree propre) |
| `origin/production` | `c259476fa51e46f3b30fdd93918f2f78b88aec04`, inchangé depuis le 05/10 17:51Z (#77) |
| `origin/main` | `d6093b76519826c4f820e00f5bca9fb8148b1f96`, inchangé |
| Merge-base rail ↔ production | `501c0c744c3327dd5693a2bddc45d064045ca474` (04/09/2026) ; 676 commits sur le rail seul, 190 sur production seule |
| Base Production (lecture seule, `begin read only … rollback`, base `postgres`) | 297 migrations au registre, max `20261005180000` : inchangé depuis le 05/10 |
| Fichiers modifiés sur le rail depuis `19e8f4d` (SHA du run CI de decision-4) | `docs/handoff/**` seulement : aucune contamination applicative |

Les trois commits du rail depuis `19e8f4d` :
1. `c641aed` — `decision-4.md`, déposée à la main par Frédéric ;
2. `6b61340` — deux dérogations d'enveloppe sur decision-4 (§3), sur GO de Frédéric ;
3. `9f0f9a8` — consommation de decision-4 par `handoff.js consommer`, miroirs régénérés, sur GO de Frédéric.

## 2. Conditions de decision-4

**Condition 1 — CI réelle reclassée VERIFIED.** Run `Tests` [37401991101](https://github.com/vito-sainte-marie/nexus-vito/actions/runs/37401991101), `handoff-continuite-20260920` @ `19e8f4da899d6f0285b2face9d8878b49c0918a1`, conclusion `success`, 9 échecs connus inchangés. Les commits suivants ont aussi leur run réel, filtré par `headSha` :
- `6b61340` : run 37453311515, `success` ;
- `9f0f9a8` : run [37456438599](https://github.com/vito-sainte-marie/nexus-vito/actions/runs/37456438599), `success`, toutes étapes vertes.

Le rouge 37451538006 (sur `c641aed`) est expliqué et levé au §3. Il ne reste aucun rouge CI inexpliqué.

**Condition 2 — la « PR d'intégration » est une incohérence documentaire.** La preuve `pr-integration-ouverte` de request-4 (classe `DECLARED`) est fausse : aucune PR n'a jamais existé depuis `claude/issue-28-20261006-0049` (`gh pr list --state all --head …` rend `[]`). request-4 n'est pas réécrite (append-only) ; la correction vit ici. Sans effet sur le transport : la branche et le rail pointaient tous deux sur `19e8f4d`.

**Condition 3 — autorités.** `origin/production` fait autorité pour le code applicatif, les migrations applicatives et les tests applicatifs de référence. `handoff-continuite-20260920` fait autorité pour le protocole Handoff. Les trois commits du §1 relèvent exclusivement de la seconde.

**Condition 4 — les 20 migrations du rail seul restent hors décision**, non traitées.

## 3. Écart de forme de decision-4 (déclaré, dérogé sur GO)

decision-4 a été déposée à la main, hors de `handoff.js decision`. Son enveloppe porte `status:` au lieu de `decision:` et `responds_to:` au lieu de `in_reply_to:`. La CI a rougi (run 37451538006, étape « Protocole Handoff v2 »).

Sur GO de Frédéric, deux dérogations ont été ajoutées dans `STATE.json` (`6b61340`) : `DECISION_HORS_VOCABULAIRE` et `IN_REPLY_TO_MANQUANT`, cette dernière avec `valeur_retenue: { in_reply_to: request-4.md }`, qui restitue la désignation que l'enveloppe porte déjà. Le fichier n'est ni renommé ni réécrit. C'est la **seconde occurrence** du même défaut : `VERIFY-QUART-AUTOMATIQUE-20260905/decision-1.md`, le 05/09, présentait le même `status:`. Cela devient la dette D2 ci-dessous.

## 4. Dette de gouvernance restante — qualification

| # | Dette | Nature | Constat |
|---|---|---|---|
| D1 | Déclaration outillée de la référence / du merge-base à l'ouverture d'un lot (`request-1.md` §3) | Outillage Handoff | Non construite. Le merge-base du §1 est encore calculé à la main, à chaque dépôt. |
| D2 | Un dépôt manuel de décision échappe à l'outil qui produit l'enveloppe conforme | Protocole Handoff | 2 occurrences (05/09, 06/10). La CI rougit bien, donc rien ne passe en silence, mais chaque occurrence coûte un rouge, une dérogation et un GO. |
| D3 | Message trompeur de la garde de `handoff.js demande` | Libellé d'outil | Le refus dit « décision … qui n'est pas consommée ». Or la garde teste l'existence d'une décision sur un autre lot actif, pas sa consommation. Constaté le 05/10 avec le vrai CLI. |
| D4 | Divergence rail ↔ production (676 / 190 commits, 39 fichiers en conflit en fusion simulée) | **Applicative** | Hors périmètre gouvernance par la condition 5 : la réconcilier toucherait au code. |

D1 à D3 sont Handoff seulement : elles se corrigent dans `outils/handoff.js`, ses tests et `docs/handoff/`, sans écran, sans migration, sans Supabase. D4 ne l'est pas.

## 5. Question posée à l'arbitre

Rendre `decision-5` en réponse à `request-5.md`, en choisissant l'une des voies suivantes (ou une autre) :

- **A — traiter D1 et D3 dans ce lot.** Lot laissé ouvert (`closes: false`). Claude construit dans `outils/handoff.js` le calcul du merge-base et du diff applicatif à l'ouverture d'un lot (D1), corrige le libellé de la garde (D3), avec des épreuves et une mutation qui les fasse rougir. Le candidat revient en request-6 avec son SHA et son run CI réel. Chaque commit et push garde son GO.
- **B — clore le lot** (`closes: true`). D1 à D3 sont qualifiées comme dette déclarée, à reprendre dans un lot d'outillage séparé, avec sa propre demande.

Dans les deux voies, il faut aussi :
- **D4 :** sortir formellement la divergence rail ↔ production du périmètre de ce lot, puisqu'elle est applicative ;
- **D2 :** dire si elle doit être corrigée par l'outil (par exemple admettre `status:` et `responds_to:` comme synonymes déclarés, ce qui changerait le protocole), par la procédure (déposer toute décision par `handoff.js decision`), ou rester traitée par dérogation au cas par cas.

Proposition de Claude, qui n'arbitre pas : la voie A, restreinte à D1 et D3. Pour D2, la procédure seule, parce qu'elle ne change pas le contrat du protocole.

## 6. Ce que cette demande n'autorise pas

Aucune fusion Production, aucune migration Production, aucune écriture Supabase Production, aucun déploiement, aucune promotion applicative. Aucun traitement des 20 migrations du rail seul. Aucun élargissement de `nexus_ci_recette`.

Tout nouveau rouge CI inexpliqué, toute divergence d'autorité, toute contamination applicative du rail ou tout mouvement inattendu de Production impose un STOP et un retour à l'arbitrage (condition 6).
