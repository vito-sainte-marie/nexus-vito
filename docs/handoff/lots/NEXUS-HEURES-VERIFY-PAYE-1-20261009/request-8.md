---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-HEURES-VERIFY-PAYE-1-20261009
seq: 8
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: ChatGPT
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=c516322 production=13a4e56
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 146-fichiers
  - id: pr104-etat
    classe: VERIFIED
    valeur: OPEN-MERGEABLE-CLEAN-tete-c577e3d-base-13a4e56
  - id: migration-en-production
    classe: VERIFIED
    valeur: 311-migrations-estampille-20261013152155
---
# Demande d'arbitrage — fusion de la PR #104 dans `production`, puis déploiement Pages

Ce texte se suffit : il ne suppose pas que le rail soit lisible. Demande d'arbitrage seulement ; ni GO ni ordre d'exécution.

## Contexte

La migration `20261013132532` (blob `fe205ec8…`) est appliquée en Production depuis le 13/10/2026, sur GO nominatif de Frédéric (request-7 le consigne). Production a enregistré l'estampille `20261013152155` : 311 migrations, colonnes `audits_caisse.employes_renfort` et `nexus_paye_items.detail` présentes, CHECK à 6 et 16 valeurs, 10 lignes inchangées, aucun `employes_renfort` renseigné. Il reste le code.

## Geste demandé

`PRODUCTION_FUSION_DEPLOIEMENT_PROMOTION` — fusionner la PR #104 (`portage-heures-renfort-20261013` vers `production`), puis déployer sur GitHub Pages.

En pratique, c'est un seul geste : Pages est servi par un workflow (`build_type: workflow`, source `production`) qui se déclenche à la fusion. Il n'y a pas de second déploiement à autoriser séparément ; l'arbitre est invité à le dire s'il en juge autrement.

## État mesuré de la PR (13/10/2026)

| Mesure | Valeur |
|---|---|
| tête | `c577e3da580441d5349b40de5330bdb977e3a4b3` |
| base `origin/production` | `13a4e56c45d75c229a18edb083d91b32b62eb2c3` |
| état | OPEN, MERGEABLE, mergeStateStatus CLEAN |
| contrôles | « Construire et éprouver l'artefact » SUCCESS ; `non-regression` SUCCESS (x2) ; Cloudflare Pages SUCCESS ; « Déployer sur GitHub Pages » SKIPPED (attendu avant fusion) ; Supabase Preview SKIPPED |
| revue formelle | aucune (`reviewDecision` vide) ; la revue est l'arbitrage Handoff |

La qualification d'ordre migration/code (liée au blob) et la provenance 306 / `c0fb4e90…` ont été remplies en decision-2. Parité du portage : 33 lignes sur 1 076 ajoutées ne se retrouvent pas à l'identique, toutes rapprochées à la main (docs/deploiement/parite-portage-heures-renfort-20261013.md).

## Effet attendu à la fusion

Verify lit la colonne RENFORT du classeur (Q1, Q2 ignoré). Paye compte le renfort Q1 comme 7 h normales, avec heures supplémentaires visibles (jeudi à samedi : 7 h + 1 h sup ; dimanche à mercredi : 7 h), effectif à partir du 01/10/2026. Caisse/piste prime sans cumul. Aucun taux ni majoration inventés, aucune retenue automatique. L'historique avant octobre n'est pas recalculé.

## Retour arrière

R1 : revert de la PR sur `production` ; les colonnes restent, inertes. Sans perte de données, mais c'est lui-même une écriture Production demandant son GO et son verdict. R2 et R3 inchangés (voir request-6) ; R3 déconseillé.

## Vérification après coup (proposée)

Comparer le contenu servi, pas seulement le code HTTP 200 (un 200 a déjà rendu l'ancien fichier), puis une mesure SQL en lecture seule de Production.

## Non demandé

Q4 (case vide au planning) et B (colonne de provenance ou ligne distincte pour les heures exceptionnelles) : non tranchées, non implémentées. Aucune écriture de données. Le manifeste de migrations classe encore la migration « appliquée nulle part » et l'estampille `20261013152155` reste à constater : addendum à produire séparément, hors de ce geste.

## Limites connues

La parité compare des lignes, pas un comportement ; aucune recette navigateur n'a été rejouée sur le portage lui-même. 7 rouges de Production pure, préexistants, sont inchangés. Le rail n'a pas pu être lu par l'arbitre lors des deux derniers cycles.
