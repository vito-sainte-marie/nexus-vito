---
protocol: nexus-handoff/2
kind: request
lot_id: GOV-WAKE-TO-OBLIGATOIRE-20261020
seq: 1
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: https://github.com/vito-sainte-marie/nexus-vito/issues/28
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
---
# GOV-WAKE-TO-OBLIGATOIRE-20261020 : `handoff.js demande` refuse une demande qui ne déclare pas `wake_to`

**Domaine :** gouvernance. **Origine :** GO de Frédéric du 20/10/2026 (« ouvre le lot pour refuser la demande sans wake_to »), extrait de GOV-R3 (request-2, périmètre « refuser `demande` sans `wake_to` »).
**Nature de cette request-1 :** cadrage et épreuves de falsification seulement. Aucun code, workflow, permission, secret, identité, connecteur ni armement n'est modifié par elle. L'alerte Telegram sur `RAIL_SANS_ADRESSE` est un workflow : **exclue**, lot distinct.

## Constat (mesuré)

- GOV-R3 request-1 (`3fa64c9d`) a été déposée sans `wake_to` : le réveil de l'arbitre n'a pas été composé (`RAIL_SANS_ADRESSE`, run 39474481132), la demande est restée muette jusqu'au redépôt (request-2). Deuxième fois en deux jours.
- Aujourd'hui `handoff.js verifier` n'émet qu'un **avertissement** (`signalerLotsSansAdresseDeReveil`, `outils/handoff.js` ~l.470), et seulement après coup. Le commentaire du code le dit : la règle « Claude la pose en ouvrant le lot » a été violée sur deux lots consécutifs en 2026-09 puis de nouveau ici. Une règle que rien ne bloque n'est pas une règle.
- `nouvelleDemande` (l.975) accepte `--wake-to` en option ; sans elle, la demande est écrite sans adresse (l.1027, `if (options.wakeTo !== undefined)`).

## Objet

Dans `nouvelleDemande`, **avant toute écriture** : refus (`REFUS — … --wake-to`, exit 1) si la demande n'a pas d'adresse de réveil, c'est-à-dire si `--wake-to` est absent **et** qu'aucun échange antérieur du lot ne déclare déjà `wake_to` (`adresseDeReveil(lot).adresse` vide). Un lot qui a déjà posé son adresse n'a pas à la répéter à chaque request : elle est héritée, sans écrire de valeur implicite dans l'enveloppe.

Pas de valeur par défaut (issue #28 en dur) : une adresse injectée en silence est une adresse que personne n'a choisie, et elle masquerait le prochain oubli. Le refus force le choix, l'adresse reste libre (PROTOCOL.md).

## Épreuves de falsification (à écrire rouges avant tout code)

- W1 `demande` sur un lot neuf sans `--wake-to` : refus, aucun fichier écrit, STATE.json inchangé.
- W2 avec `--wake-to <adresse valide>` : acceptée, `wake_to` dans l'enveloppe (comportement actuel conservé).
- W3 lot dont un échange antérieur déclare `wake_to`, nouvelle `demande` sans option : acceptée (héritage), et aucune valeur écrite par défaut.
- W4 `--wake-to` vide ou ressemblant à une option : refus inchangé (`adresseDeReveilValide`).
- W5 le refus précède toute écriture : aucun répertoire de lot créé.
- W6 non-régression : `verifier` reste vert sur le registre réel (les 77 lots existants ne sont pas rétroactivement refusés ; l'avertissement existant demeure pour l'historique).

## Coût annoncé

Neuf fichiers de test appellent `handoff.js demande` ; la plupart sans `--wake-to` (seuls `test_handoff_v2`, `test_boucle_tour_vide`, `test_execution_recue` l'utilisent). Ils devront passer `--wake-to` ou poser l'adresse dans le banc. Aucune de ces modifications n'affaiblit une épreuve ; Guardian QA doit rester à 0 finding.

## Hors périmètre (dit, pas masqué)

- Alerte Telegram sur `RAIL_SANS_ADRESSE` : workflow, hors de ce lot.
- Rétroactivité sur les lots existants ; durcissement de l'avertissement en blocage de `verifier`.
- Voie B, `tests.yml`, ETAPE5, Production, Supabase : intouchés.

## Demande à l'arbitre

Approuver le périmètre (refus dans `nouvelleDemande`, héritage de l'adresse du lot, pas de défaut) et les épreuves W1–W6, puis GO pour : écrire W1–W6 rouges, implémenter jusqu'au vert, adapter les bancs existants, pousser sur le rail.
