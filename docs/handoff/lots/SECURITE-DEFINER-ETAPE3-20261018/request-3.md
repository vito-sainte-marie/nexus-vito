---
protocol: nexus-handoff/2
kind: request
lot_id: SECURITE-DEFINER-ETAPE3-20261018
seq: 3
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: https://github.com/vito-sainte-marie/nexus-vito/issues/28
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=ff19b8a0 production=8e8b7ba2
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 157-fichiers
---
# SÉCURITÉ SECURITY DEFINER — Étape 3 : preuves d'exécution des 8 REVOKE (TEST exclusivement)

Suite de decision-1 (`a4fa9ba4`, humaine, APPROVED_WITH_CONDITIONS) et du GO d'exécution distinct donné par Frédéric le 18/10/2026. Cette demande **consigne** l'exécution et ses preuves ; elle n'ouvre aucune nouvelle opération. Ni Production, ni GRANT, ni autre modification de schéma, ni étapes 4 et 5.

## Preuve des conditions de decision-1
- Rail relu : tête `a4fa9ba4`, decision-1 présente, aucune décision contraire.
- ACL et signatures relues sur Test avant exécution : les 8 fonctions SECURITY DEFINER, propriétaire postgres, `search_path=public, pg_temp`, ACL `{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}`. Garde SQL de précondition dans la transaction (8 fonctions conformes, sinon abandon).
- SQL exécuté = les 8 instructions de request-2, `revoke execute on function public.<nom>() from public, anon, authenticated;`, en une seule transaction.

## Exécution (18/10/2026, ~15:34 UTC, Supabase Test `udljdqxerrbbbajxubfn`)
Les 8 : carburant_resoudre_prix_achat_snapshot, fdj_sync_releve_apres_cash_control, fdj_tracer_correction_stock_initial, flag_modification_apres_validation, flag_mouvement_non_justifie, nexus_forcer_site_unique, nexus_inventaire_detecter_conditionnement, nexus_site_supprimable.

## Les six épreuves
1. Droits : les 8 ont ACL `{postgres=X/postgres,service_role=X/postgres}` ; EXECUTE public/anon/authenticated faux, service_role vrai ; SECURITY DEFINER, propriétaire postgres et `search_path=public, pg_temp` inchangés.
2. Triggers : 9 triggers liés, tous `tgenabled=O`.
3. Fonctionnel sous `authenticated` (pompiste de nexus-station-test, blocs annulés) : insertion `shifts` OK (trigger nexus_forcer_site_unique) ; insertion `inventaire_mouvements` OK (trigger flag_mouvement_non_justifie). Rien conservé.
4. Appel direct des 8 sous anon et sous authenticated : 16 refus `42501`.
5. Job `nexus-inventaire-reviews` : passage `succeeded` à 15:45:00 UTC, postérieur à l'opération (15:30 avant, 15:45 après).
6. Comptes : triggers SECDEF ouverts à anon 8→0 ; fermés aux deux rôles 13→21. `nexus_garde_regularisation_reception` inchangée : fermée à anon, ouverte à authenticated (appel direct sous authenticated : `0A000`, « appelable seulement comme trigger », comportement attendu et préexistant ; le `42501` cité en postcondition vaut pour anon).

## Anomalie
Aucune. Pas de retour arrière appliqué (retour arrière prévu : `grant execute on function public.<nom>() to public, anon, authenticated;`).

## Hors de cette demande
Étape 4 (`nexus_identifiant_de_connexion`), étape 5 (report en Production avec migration de dépôt), les 24 autres fonctions `search_path=public`. Écart Test–Production assumé jusqu'à l'étape 5.

## Question d'arbitrage
Constatez-vous que les conditions de decision-1 sont remplies et clôturez-vous l'étape 3 ? Réponse attendue : APPROVED / APPROVED_WITH_CONDITIONS / REJECTED, avec `closes`.
