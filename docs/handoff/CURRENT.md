<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/NEXUS-HEURES-VERIFY-PAYE-1-20261009/request-4.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-HEURES-VERIFY-PAYE-1-20261009
seq: 4
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
    valeur: PR 104 tete 45c707850be166f65d07618c20d70d9c4bbbdb11 base production 13a4e56
  - id: migration-blob
    classe: VERIFIED
    valeur: 20261013132532 fe205ec861e8c81d240d929b0b98343dd0f653cd
  - id: production-intacte
    classe: DECLARED
    valeur: aucune ecriture Production, mesures en lecture seule le 13-10-2026
  - id: ci-pr-104
    classe: VERIFIED
    valeur: non-regression rouge (provenance migrations 305 vers 306), artefact vert
---
# Promotion Production — heures supplémentaires, renfort Q1, réconciliation Verify / Paye : demande de verdict

**Ceci n'est ni un GO Production ni une demande d'exécution.** Rien n'a été écrit en Production : ni migration, ni donnée, ni code, ni Pages. Frédéric a demandé la transmission du dossier au Handoff le 13/10/2026 ; l'arbitrage reste à ChatGPT ou à Frédéric, je ne m'arbitre pas moi-même.

## 1 · Ce qui est soumis

| Pièce | Référence |
|---|---|
| Dossier de promotion | `docs/deploiement/promotion-heures-renfort-production-20261013.md` (PR #103 vers le rail, tête `a2710e9`) |
| Véhicule de portage | PR #104 vers `production`, branche `portage-heures-renfort-20261013`, tête `45c7078`, partie de `origin/production` (`13a4e56`) |
| Migration | `supabase/migrations/20261013132532_nexus_paye_items_types_heures_verify.sql`, blob `fe205ec861e8c81d240d929b0b98343dd0f653cd` |
| Fiche de qualification | `docs/deploiement/qualification-ordre-migration-code.json`, entrée `migrations["20261013132532"]`, commit `45c7078` |

La migration est additive (deux colonnes `jsonb` nullables, deux CHECK élargis en sur-ensembles). Appliquée sur Test seulement. Mesures Production du 13/10/2026, en lecture seule : colonnes absentes, 10 lignes dans `nexus_paye_items`, 0 ligne qui sortirait des nouvelles listes, 310 migrations appliquées, dernière `20261011220000`.

## 2 · Règles métier portées (rappel des instructions de Frédéric)

Renfort Q1 = 9 h–17 h moins 1 h de pause = 7 h normales ; jeudi→samedi : 7 h + 1 h sup ; dimanche→mercredi : 7 h. Q2 ignoré. La caisse / piste confirmée dans Verify prime, sans cumul. Effectif au 01/10/2026 pour Paye ; historique avant octobre préservé. Aucun taux ni majoration inventé, aucune retenue automatique.

## 3 · Ce qui est demandé à l'arbitre

1. **Choix d'état de la fiche.** L'état additif est refusé par la garde (`CIBLE_DEJA_DEPENDANTE`) à cause de deux faux positifs : le mot `detail` et un nom de contrainte cité en commentaire dans la cible. J'ai retenu `atomique_ou_procedure_speciale`, avec la procédure et la justification dans la fiche, sans modifier la garde. À confirmer ou à corriger.
2. **Addendum pour les épreuves de manifeste de migrations.** La CI `non-regression` est rouge (31/32 sur la PR #104) pour une seule cause connue : le contrôle de provenance compte 306 migrations au lieu de 305. Je ne l'ai pas corrigée ni reclassée en dette. `Construire et éprouver l'artefact` passe ; les 7 rouges préexistants de Production pure sont inchangés.
3. **Véhicule de portage.** Revue de la branche de portage et de son écart avec la branche de la PR #103 (réécrite à la main sur les deux moteurs et trois écrans, parce que 12 commits sur 13 conflictent sur `production`).
4. **Questions laissées ouvertes, sans recommandation fermée de ma part.**
   - Q4 : case vide au planning, ni absence ni déduction aujourd'hui.
   - B : heures exceptionnelles, colonne de provenance ou ligne distincte.

## 4 · Trois GO distincts, aucun accordé

(a) application de la migration en Production ; (b) fusion de la PR #104 ; (c) déploiement Pages. Ordre prévu : migration, puis code. Retour arrière R1–R3 décrit au §6 du dossier ; R3 (suppression des colonnes) déconseillé.

## 5 · Limite connue

Test porte 11 migrations hors bande : la recette Test ne prouve pas à elle seule l'état de Production, d'où les mesures du 13/10.
