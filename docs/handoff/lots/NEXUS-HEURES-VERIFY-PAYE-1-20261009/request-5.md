---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-HEURES-VERIFY-PAYE-1-20261009
seq: 5
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
  - id: pr-portage
    classe: VERIFIED
    valeur: PR 104 tete c577e3da580441d5349b40de5330bdb977e3a4b3 base production 13a4e56
  - id: migration-blob
    classe: VERIFIED
    valeur: 20261013132532 fe205ec861e8c81d240d929b0b98343dd0f653cd
  - id: ci-pr-104
    classe: VERIFIED
    valeur: non-regression x2 et artefact verts sur c577e3d
  - id: parite
    classe: DECLARED
    valeur: docs/deploiement/parite-portage-heures-renfort-20261013.md comparaison de lignes, pas de recette navigateur
  - id: production-intacte
    classe: DECLARED
    valeur: aucune ecriture Production, mesures en lecture seule du 13-10-2026
---
# Arbitrage Production — migration, fusion et déploiement du lot heures / renfort Q1

**Suite de request-4 / decision-2 (APPROVED_WITH_CONDITIONS, consommée).** Les quatre conditions sont remplies. Cette demande sollicite un verdict d'arbitrage sur les gestes Production ; **elle n'est ni un GO ni un ordre d'exécution, et rien n'a été écrit en Production.** Les trois GO de Frédéric restent distincts et non accordés.

## 1 · Conditions de la decision-2 : état

| Condition | État | Preuve |
|---|---|---|
| Qualification `atomique_ou_procedure_speciale` limitée au blob, faux positifs documentés | faite | fiche `docs/deploiement/qualification-ordre-migration-code.json`, entrée `20261013132532`, blob `fe205ec861e8c81d240d929b0b98343dd0f653cd` ; garde non modifiée |
| Épreuve de provenance corrigée pour 306 migrations, sans assouplir la garde, nouvelle CI | faite | `test_empreinte_artefact_20260915.js` : 306 / empreinte `c0fb4e90…`, 32/32 en local ; CI de la PR #104 verte sur `c577e3d` (`non-regression` ×2, `Construire et éprouver l'artefact`, Cloudflare) |
| Parité du portage manuel (deux moteurs, trois écrans) | consignée | `docs/deploiement/parite-portage-heures-renfort-20261013.md` : 33 lignes sur 1 076 non retrouvées à l'identique, toutes recomposées pour la version Production ; dix épreuves vertes |
| Q4 et B hors implémentation | respectée | aucune sémantique nouvelle |

**Limite de la parité, à ne pas lire comme une preuve** : la méthode compare des lignes, pas un comportement, et aucune recette navigateur n'a été rejouée sur le portage lui-même.

## 2 · Ce que l'arbitre doit trancher

Deux gestes distincts, chacun avec son propre verdict :

1. **`SUPABASE_PRODUCTION_MUTATION`** — appliquer la migration `20261013132532` en Production (`uzhjpqpctpvxytxpxoqz`). Additive : deux colonnes `jsonb` nullables, deux CHECK élargis en sur-ensembles. Mesures du 13/10/2026 en lecture seule : colonnes absentes, 10 lignes dans `nexus_paye_items`, 0 ligne hors des nouvelles listes, 310 migrations, dernière `20261011220000`. Ordre : migration d'abord, code ensuite. L'estampille posée sera celle du connecteur, postérieure à la dernière ; le fichier porte une estampille antérieure, écart à constater comme pour les lots précédents. Préflight : relire la base juste avant d'écrire, les mesures du 13/10 pouvant avoir bougé.
2. **`PRODUCTION_FUSION_DEPLOIEMENT_PROMOTION`** — fusionner la PR #104 (tête `c577e3d`, base `production` à `13a4e56`) puis déployer Pages. Le déploiement ne vient qu'après la migration. À vérifier après coup : le contenu servi, pas seulement le code HTTP.

Retour arrière R1 (revert de la PR), R2 (rétablir les CHECK, seulement si aucune ligne ne porte les nouvelles valeurs) et R3 (supprimer les colonnes, déconseillé, destructif) : voir §6 du dossier. Le retour arrière est lui-même une écriture Production et demande son propre verdict.

## 3 · Ce qui n'est pas demandé

Aucune décision sur Q4 (case vide au planning) ni sur B (heures exceptionnelles) : elles restent ouvertes. Aucune exécution : un verdict favorable n'autorise l'écriture que par le GO nommé de Frédéric et un ordre lié à son hash.

## 4 · Limites connues

La recette Test ne prouve pas à elle seule l'état de Production (11 migrations hors bande sur Test) ; les mesures du §2 y suppléent. Le registre des migrations de Production divergeant du dépôt, l'estampille réellement posée devra être relue après application.
