<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/SECURITE-DEFINER-ETAPE3-20261018/decision-1.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: SECURITE-DEFINER-ETAPE3-20261018
seq: 1
author: Frédéric Bragance
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-2.md
---
# Décision sur request-2.md — arbitrage humain de Frédéric (levée du STOP SECRET_PERMISSION_SURFACE_SECURITE, Supabase Test uniquement)

Cette décision matérialise l'arbitrage humain rendu par Frédéric Bragance dans la conversation du 18/10/2026, en réponse à l'arrêt de l'arbitre sur request-2.md (run 39136326636, issue #28, commentaire 6251126333) : `DECISION: BLOCKED`, `STOP_REQUIRED: SECRET_PERMISSION_SURFACE_SECURITE`, `OWNER_NEXT: Frédéric`. request-1.md n'a jamais reçu de décision (elle ne déclarait pas `wake_to`) ; cette décision répond à la demande active, request-2.md.

Frédéric retient l'option 1 : autoriser ces huit révocations sur Supabase Test uniquement. Raisons : la demande cible des permissions excessives, conserve les droits de `service_role`, ne modifie ni les fonctions ni les triggers, prévoit un retour arrière et impose des contrôles fonctionnels.

## Deux décisions strictement séparées

1. **Autorisation de principe (la présente décision)** : préparer les huit `REVOKE EXECUTE … FROM public, anon, authenticated` du SQL de request-2.md, sur le seul projet Supabase Test `udljdqxerrbbbajxubfn`. Cette décision n'autorise PAS l'exécution.
2. **GO d'exécution (distinct, à venir)** : donné par Frédéric seulement après relecture des ACL, confirmation du périmètre exact, présence de cette décision sur le rail, et préparation des tests ainsi que du retour arrière.

## Périmètre autorisé

Exclusivement les huit instructions du SQL de request-2.md (`carburant_resoudre_prix_achat_snapshot`, `fdj_sync_releve_apres_cash_control`, `fdj_tracer_correction_stock_initial`, `flag_modification_apres_validation`, `flag_mouvement_non_justifie`, `nexus_forcer_site_unique`, `nexus_inventaire_detecter_conditionnement`, `nexus_site_supprimable`). Aucun droit supplémentaire, aucun GRANT, aucun ALTER, rien en Production, `service_role` inchangé.

## Conditions avant l'exécution

- Rail relu : cette décision présente, aucune décision contraire.
- ACL et signatures relues sur Test, relevé préalable enregistré ; le SQL exécuté est exactement celui de request-2.md.
- Épreuves fonctionnelles et retour arrière préparés avant d'exécuter.
- Si une condition échoue ou exige un autre changement de permissions, interrompre et revenir à l'arbitrage.

`closes: false` : l'exécution, sa vérification et la consignation restent à faire.
