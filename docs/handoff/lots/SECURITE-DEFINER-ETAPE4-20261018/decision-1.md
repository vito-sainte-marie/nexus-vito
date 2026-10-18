---
protocol: nexus-handoff/2
kind: decision
lot_id: SECURITE-DEFINER-ETAPE4-20261018
seq: 1
author: Frédéric Bragance
branch: handoff-continuite-20260920
decision: APPROVED
closes: true
in_reply_to: request-1.md
---
# Décision humaine — Étape 4 : `nexus_identifiant_de_connexion(text)` reste exécutable par `anon`

Arbitrage de Frédéric Bragance (option 1, 18/10/2026), en réponse à request-1.md, après le STOP `SECRET_PERMISSION_SURFACE_SECURITE` de l'arbitre (run 39147172179, commentaire #6252588646 sur l'issue 28).

## Décision
J'accepte le maintien de `EXECUTE` pour `anon` sur `public.nexus_identifiant_de_connexion(text)`, **exception documentée** : l'écran de connexion (`NEXUS-Login-v1.html`, ligne 146) l'appelle avant authentification. Je prends acte du risque résiduel nommé dans request-1 : oracle d'existence prénom → identifiant, sans limitation de débit, le PIN restant exigé par Supabase Auth.

## Portée
- Aucune modification de droits, aucun SQL, rien en Production. Étape 4 close sans écriture.
- Pour l'étape 5 : la fonction reste hors de tout REVOKE ; seul son `search_path = public, pg_temp` est reporté, avec l'épreuve d'appel sous `anon` d'un prénom connu et unique.
- Supprimer l'oracle (Edge Function avec limitation de débit, ou connexion par identifiant explicite) reste une demande séparée, non engagée par cette décision.
- Ne vaut ni GO d'exécution, ni autorisation pour l'étape 5, une fusion ou un déploiement Production.
