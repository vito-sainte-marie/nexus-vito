---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-INCIDENTS-CI-1-20261014
seq: 1
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
  - id: parent-consomme
    classe: VERIFIED
    valeur: decision-4-7e2caaaf-consommee-CI-success-9437eda3-run-38606012180
  - id: aucun-go-production
    classe: DECLARED
    valeur: ni-fusion-ni-claude.yml-ni-Production-ni-OpenAI-reel
---
# Lot successeur de NEXUS-REPARATION-HANDOFF-1-20261014 — enregistrement automatique des incidents (condition 4)

Cette demande ouvre le lot successeur prescrit par decision-4 (APPROVED_WITH_CONDITIONS, `CLOSES: true`, lot parent consommé). Elle ne livre rien : elle cadre le périmètre et le périmètre de preuve, et demande validation avant toute écriture de workflow.

## Preuve des conditions de decision-4
- **Transférer dans un lot successeur distinct** le câblage CI rail-only, le compteur append-only des répétitions et le skill `nexus-incidents` — FAITE par cette demande : lot `NEXUS-INCIDENTS-CI-1-20261014`, rail `handoff-continuite-20260920`.
- **Prouver lease, concurrence dédiée, idempotence, absence de récursion ou de relance, absence de permission nouvelle ou élargie** — À LIVRER dans ce lot, pas encore prouvée ; voir §2.

Parent : decision-4 matérialisée par `7e2caaaf`, consommée ; CI du rail `success` sur `9437eda3` (run 38606012180).

## 1. Périmètre (trois reliquats)
1. **Câblage CI** de `outils/enregistrer-incident.js` dans `tests.yml` : sur un arrêt classé par `classerArret`, ajouter une ligne à `docs/learning/INCIDENTS.jsonl` et la pousser sur le rail seulement.
2. **Compteur append-only des répétitions** : une récurrence du même `code` incrémente un compteur dans un journal en ajout seul, sans réécrire l'historique.
3. **Skill `nexus-incidents`** : procédure d'enregistrement et de clôture (EXPERIENCE + règle promue).

## 2. Périmètre de preuve (ce que le lot devra démontrer)
- **Lease** : le commit automatique n'a lieu que sous la lease du rail.
- **Concurrence dédiée** : un groupe `concurrency` propre à l'enregistrement, sans annulation du run en cours.
- **Idempotence** : un rejeu rend `DEJA_ENREGISTRE`, octets inchangés.
- **Absence de récursion et de relance** : le push se fait avec le jeton du workflow, qui ne redéclenche ni la CI ni Claude ; mutation à l'appui.
- **Aucune permission nouvelle ou élargie** : diff du bloc `permissions` de `tests.yml` vide ; sinon STOP, `SECRET_PERMISSION_SURFACE_SECURITE`.
- Les arrêts de sécurité restent préservés (`NON_ENREGISTRE`).

## 3. Autorisations invoquées
`COMMIT_PUSH_RAIL_SANS_GO`, `OUTILLAGE_A_POSTERIORI`, `PREAUTORISATIONS_CLAUDE`, comme énoncé par decision-4.

## 4. Limites
Aucun appel OpenAI réel hors relais CI, aucun `claude.yml` sur main, aucun workflow planifié, aucune action sur Production, aucune fusion main/production.

## 5. Verdict demandé
Valider ce périmètre et ce périmètre de preuve, pour que l'implémentation commence sur le rail.
