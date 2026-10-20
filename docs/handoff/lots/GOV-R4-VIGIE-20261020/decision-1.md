---
protocol: nexus-handoff/2
kind: decision
lot_id: GOV-R4-VIGIE-20261020
seq: 1
author: Frédéric Bragance
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-1.md
provenance:
  niveau: 1
  mode: declared
  reference: conversation Claude Code du 2026-10-20, texte colle par Frederic
---
# Décision sur GOV-R4-VIGIE-20261020, request-1

**APPROVED_WITH_CONDITIONS, closes: false.** Palier : `ARMEMENT_BOUCLE_AU_NOM_DE_FREDERIC`, réservé à Frédéric. Elle répond au `BLOCKED` de l'arbitre sur request-1 (RAIL_LU `2e8d6f9ed32c14983b0a1bd84f5be6246270c38a`, commentaire #28 `issuecomment-6303878089`).

## Décision

J'autorise l'armement de V1 aux conditions suivantes :

## Conditions

1. Permissions `contents: read` seulement : aucun secret, aucune écriture sur les issues ni sur le dépôt, O3 sans `--appliquer`.
2. Canal d'alerte : le run planifié se termine en échec avec une annotation nommant le lot quand une clôture attend sa consommation. Pas de Telegram, pas de commentaire sur #28. Un autre canal demandera une décision distincte.
3. Fréquence horaire. Pas de nouvelle alerte tant que l'état ne change pas, sauf le rappel naturel du run suivant en échec.
4. Épreuves rouges avant le code : silence sans clôture ; alerte avec une clôture conforme ; alerte de refus si la clôture n'est pas conforme ; aucune écriture.
5. Arrêt : je peux désactiver le workflow à tout moment depuis l'onglet Actions ; V2 et V3 restent hors périmètre.

## Provenance (niveau 1, décision exprimée)

Texte de la décision écrit par Frédéric et collé tel quel dans la conversation avec Claude Code, le 20/10/2026. Claude Code n'a ajouté que cet en-tête et cette note. Dépôt sous le compte GitHub `vito-sainte-marie`, partagé avec des agents : il ne prouve pas l'identité de l'auteur ; le niveau 3 n'est pas atteignable avec l'outil actuel.
