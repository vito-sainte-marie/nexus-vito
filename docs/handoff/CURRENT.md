<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/NEXUS-REGUL-GROUPES-1-20261013/request-1.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-REGUL-GROUPES-1-20261013
seq: 1
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: ChatGPT
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=e1251e2 production=7e37b88
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 147-fichiers
  - id: pr-portage
    classe: VERIFIED
    valeur: PR 109 tete b73c50e base production
  - id: migration-blob
    classe: VERIFIED
    valeur: 20261013140000 eccdbafc53e9e34d365a49aa5c6d3708cc731d03
  - id: banc-sql
    classe: VERIFIED
    valeur: 24/24 scenarios et contre-temoins conformes
  - id: recette-test
    classe: VERIFIED
    valeur: cas Angelique, Paye deux compteurs, refus, export CSV sur NEXUS Test
  - id: mesures-production
    classe: VERIFIED
    valeur: lecture seule 13/10 311 migrations objets de groupe absents
  - id: aucun-go-production
    classe: DECLARED
    valeur: migration, fusion et Pages non accordes
---
# Régularisation différée des écarts de caisse (versements groupés) — verdict sur la migration et le véhicule de portage

**Ceci n'est ni un GO Production ni une demande d'exécution.** Aucun environnement
Production n'a été modifié. La migration est appliquée sur NEXUS Test seulement.

## 1. Pièces soumises

- PR #109, branche `regularisation-differee-groupes-20261013`, tête `b73c50e`, base `production` (non fusionnable en l'état : la branche part du rail).
- Migration `supabase/migrations/20261013140000_versements_groupes_regularisation.sql`, blob `eccdbafc53e9e34d365a49aa5c6d3708cc731d03` : table `versements_regularisation_groupes`, colonnes nullables `groupe_id`, CHECK `ctc_versement_ou_groupe`, triggers d'immuabilité, `_regul_tiroir_detail` remplacée, 6 RPC.
- Dossier `docs/deploiement/promotion-versements-groupes-production-20261013.md` (ordre de pose, retour arrière, reste à décider).
- Fiche `docs/deploiement/qualification-ordre-migration-code.json`, entrée `20261013140000` : `atomique_ou_procedure_speciale`.
- Empreinte d'artefact re-mesurée : 307 migrations, `ca778d6c…2acc86b`.

## 2. Règles métier tenues

Jamais d'affectation automatique (confirmation explicite du manager) ; pas de quart récepteur futur, antérieur à l'écart ou validé ; pas de double enregistrement ; pas d'affectation supérieure au solde ; transfert coffre plafonné au versement ; surplus suivi à part, ni transmis à Paye ni à la comptable ; annulation par contre-écriture. Paye en lecture seule, deux compteurs séparés, aucune retenue automatique.

## 3. Preuves

- Banc Postgres jetable : 24/24 scénarios, contre-témoins conformes.
- 37 épreuves JS vertes ; CI de la PR #109 verte.
- Mesures Production en lecture seule (13/10) : 311 migrations, dernière `20261013152155`, objets de groupe absents.
- Recette NEXUS Test : cas Angélique (écarts 01/10 et 02/10 de −4 €, excédent 10 €, 8 € affectés, 2 € de surplus), vue Paye à deux compteurs, surplus exclu de l'export, export CSV (pied « Aucune déduction ni retenue »).
- Refus prouvés sur Test (transactions annulées) : `PLAFOND_DEPASSE`, `QUART_RECEPTEUR_FUTUR`, `QUART_RECEPTEUR_CLOTURE`, `QUART_RECEPTEUR_ANTERIEUR`, `AFFECTATION_DOUBLON`, `ECART_SOLDE`, `SURPLUS_NON_CONFIRME` ; rejeu de clé d'idempotence → `rejoue:true`.

## 4. Ce qui est demandé à l'arbitre

1. Confirmer l'état `atomique_ou_procedure_speciale` : la garde ordre-migration signale `drop_column`/`drop_table`/`truncate`, faux positifs (le texte apparaît dans des commentaires et des gardes, pas en exécution).
2. Confirmer l'ordre de pose : migration d'abord, puis code (le code ne tourne pas sans les RPC).
3. Arbitrer le véhicule de portage : la PR #109 part du rail, pas de `production` ; portage depuis `origin/production` requis.

## 5. Trois GO distincts, non accordés

(a) application de la migration sur Production ; (b) fusion du portage ; (c) déploiement Pages. Chacun relève du palier Frédéric.

## 6. Limites connues

- Écart d'estampille : `20261013140000` au dépôt, `20261013220411` sur Test (appliquée via le connecteur).
- Le quart partiellement affecté est prouvé par le banc, non rejoué sur Test.
- Données de recette `5eed…` encore présentes sur Test ; nettoyage en attente d'accord.
- Restitution du surplus : hors lot, à décider.
