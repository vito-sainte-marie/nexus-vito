<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/NEXUS-HEURES-VERIFY-PAYE-1-20261009/request-6.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-HEURES-VERIFY-PAYE-1-20261009
seq: 6
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
  - id: migration-blob
    classe: VERIFIED
    valeur: 20261013132532 fe205ec861e8c81d240d929b0b98343dd0f653cd
  - id: mesure-production-1516
    classe: DECLARED
    valeur: 310 migrations, colonnes absentes, 10 lignes, 0 hors liste, lecture seule 13-10-2026 15:16Z
---
# Demande d'arbitrage — migration Production seule (suite de request-5)

Ce texte se suffit : il ne suppose pas que le rail soit lisible.

request-5 demandait deux gestes. La réponse de l'arbitre n'a pas été matérialisée : le relais l'a refusée pour forme (`STOP_REQUIRED` portait deux codes séparés par une virgule, non reconnus comme un motif du palier Frédéric). Sur le fond, l'arbitre désignait la migration comme premier geste et exigeait des preuves rafraîchies. Cette demande est donc **limitée à la migration**. La fusion de la PR #104 et Pages feront l'objet d'une demande ultérieure, après la migration.

## Geste demandé : un seul

`SUPABASE_PRODUCTION_MUTATION` — appliquer en Production (`uzhjpqpctpvxytxpxoqz`) la migration additive `20261013132532_nexus_paye_items_types_heures_verify.sql`, blob `fe205ec861e8c81d240d929b0b98343dd0f653cd`.

Contenu : colonne `audits_caisse.employes_renfort jsonb` ; colonne `nexus_paye_items.detail jsonb` ; CHECK `statut` élargi de 3 à 6 valeurs ; CHECK `type_item` élargi de 14 à 16 valeurs. Rejouable (`if not exists`, `drop constraint if exists`), aucune donnée supprimée, nouvelles valeurs = sur-ensembles des anciennes.

## Preuves rafraîchies (lecture seule, `begin read only … rollback`, 13/10/2026 15:16 UTC)

| Mesure Production | Valeur |
|---|---|
| migrations appliquées / dernière | 310 / `20261011220000` |
| `audits_caisse.employes_renfort` | absente (0) |
| `nexus_paye_items.detail` | absente (0) |
| lignes de `nexus_paye_items` | 10 |
| lignes dont le statut sortirait de la nouvelle liste | 0 |
| lignes portant déjà un des deux nouveaux `type_item` | 0 |

Identiques à la mesure de la veille de dépôt de request-4 : Production n'a pas bougé. Cette mesure ne remplace pas le préflight.

## Conditions de decision-2 (rappel)

Qualification liée au blob, provenance 306 / `c0fb4e90…` et CI verte sur `c577e3d`, parité du portage, Q4 et B non tranchées : remplies, voir request-5.

## Ce que la demande pose

- Préflight obligatoire immédiatement avant toute écriture : relire la base (310, colonnes absentes, 0 ligne hors liste) ; un écart arrête tout.
- L'estampille réelle sera celle du connecteur, non celle du fichier ; le constater ensuite.
- Retour arrière : R1 (code) sans objet tant que la PR n'est pas fusionnée ; R2 seulement si aucune ligne ne porte les nouvelles valeurs ; R3 (drop des colonnes) déconseillé, destructif, jamais sans accord distinct.
- Code d'abord n'est pas exigé : l'ancien code sur le nouveau schéma est sans effet.

## Non demandé

La fusion de la PR #104, Pages, Q4, B, toute exécution. Aucun GO n'est présumé : le palier est celui de Frédéric, qui autorise ou refuse nommément la migration.

## Limites

Test a 11 migrations hors bande ; les mesures de Production valent à leur heure. La parité compare des lignes et non un comportement.
