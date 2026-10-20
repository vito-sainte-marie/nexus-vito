---
protocol: nexus-handoff/2
kind: request
lot_id: GOV-WAKE-TO-OBLIGATOIRE-20261020
seq: 2
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=ff19b8a0 production=d3244d86
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 158-fichiers
  - id: code-wake-to
    classe: VERIFIED
    valeur: dc0c2cbc
  - id: banc-w1-w6
    classe: VERIFIED
    valeur: 6-sur-6
---
# GOV-WAKE-TO-OBLIGATOIRE-20261020 : request-2, résultats et demande de clôture

**Domaine :** gouvernance. **Objet :** rendre compte de l'exécution de la decision-1 (APPROVED, CONDITIONS aucune, `014c0d40`) et demander la clôture du lot.

## Preuve des conditions de decision-1

Aucune condition. Les gestes autorisés (implémentation, adaptation des bancs, push sur le rail) ont été exécutés par `claude[bot]` (`github-actions-claude`).

## Exécution (rail `handoff-continuite-20260920`, tête lue : `cd9e7b5f`)

- `dc0c2cbc` : refus dans `nouvelleDemande` (`outils/handoff.js`, 11 lignes) si `--wake-to` est absent et qu'aucun échange du lot ne déclare `wake_to` ; héritage sans valeur écrite ; pas de défaut. Banc `test_wake_to_obligatoire_20261020.js` ; 7 bancs existants adaptés (`--wake-to`).
- `cd9e7b5f` : consommation de decision-1, preuve d'action `dc0c2cbc` ; `STATE.json` : `DECISION_CONSOMMEE`.

## Mesures refaites hors de l'exécutant

- W1 à W6 : 6/6 (refus avant écriture, accepté avec adresse, héritage, adresses invalides, aucun répertoire créé, `verifier` vert sans rétroactivité).
- Guardian QA : 0 finding sur 353 épreuves. `verifier` : vert, 78 lots.
- CI : `cd9e7b5f` verte. **`dc0c2cbc` a été rouge** (Tests ; lignes `chargerControleJour` connues et une assertion « (mutation) un second processus… », typique de deux exécutions concurrentes) ; cause non diagnostiquée, le commit suivant est vert. Dit ici pour que la clôture ne la masque pas.

## Hors périmètre, inchangé

Alerte Telegram sur `RAIL_SANS_ADRESSE` (workflow) ; durcissement de l'avertissement de `verifier` en blocage ; voie B, ETAPE5, Production, Supabase : intouchés.

## Demande à l'arbitre

Clôturer le lot : DECISION APPROVED, CLOSES true, CONDITIONS aucune, STOP_REQUIRED non.
