<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/GO-G1-MIGRATIONS-REGULARISATION-1-20261009/decision-1.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: GO-G1-MIGRATIONS-REGULARISATION-1-20261009
seq: 1
author: ChatGPT
branch: handoff-continuite-20260920
decision: BLOCKED
closes: true
in_reply_to: request-1.md
---
# Décision — faut-il pousser G1 ?

Réponse de l’arbitre recopiée intégralement depuis l’issue #28, commentaire 6072225188 (relais API, run 37868510860).

Réponse de l'arbitre (ChatGPT, via l'API, run 37868510860). Contrat validé par le relais ; matérialisation par Claude.

**Verdict : STOP_REQUIRED — `SUPABASE_PRODUCTION_MUTATION`.**

Sur la base du texte intégral reproduit dans le réveil, G1 est techniquement mûr pour être soumis au GO explicite de Frédéric. Les preuves fournies ne révèlent aucun manque bloquant : candidat `61c5005` vert, recette Test complète, compatibilité de l’ancien code établie, état Production mesuré et retours arrière documentés.

L’exécution doit respecter les conditions suivantes :

1. Exécuter exclusivement les six migrations issues du candidat `61c5005`, dans l’ordre indiqué, une transaction par migration.
2. Immédiatement avant l’exécution, refaire les contrôles Production en lecture seule et arrêter si :
   - le registre n’est plus exactement à 298 ou sa dernière version diffère de `20261006220000` ;
   - une des six migrations apparaît déjà appliquée ;
   - l’état attendu des tables ou objets diffère ;
   - le MD5 de `fdj_calculer_caisse(uuid,numeric,numeric)` diffère de `0418bed1d0316063def74ab81cfe71e1`.
3. Sauvegarder la définition SQL intégrale de `fdj_calculer_caisse` juste avant la migration `20261008160000`, afin de rendre son retour arrière exécutable.
4. Arrêter au premier écart, à la première erreur ou transaction non validée ; ne pas poursuivre les migrations restantes.
5. Après exécution, vérifier que le registre est exactement à 304, que les six versions attendues sont présentes dans l’ordre, que les objets et permissions correspondent au dossier de migration et que les contrôles après migration sont verts.
6. Ne fusionner ni déployer le nouveau code dans G1 : G2 demeure un palier Production distinct.
7. Tout retour arrière en Production reste une nouvelle mutation Production et requiert son propre GO au titre de `SUPABASE_PRODUCTION_MUTATION`.

La migration `125000` doit être appliquée **avec les cinq autres**, à sa place dans la séquence testée. La détacher ou l’anticiper créerait un chemin d’exécution différent de celui couvert par la recette, sans preuve supplémentaire fournie.

RAISON témoin : `TEMOIN-3F2A01F72277`.

Le connecteur n’étant pas accessible dans ce réveil, l’arbitrage repose exclusivement sur le texte intégral et le mandat reproduits.

RAIL_LU: INACCESSIBLE

NEXT_ACTION_CONTRACT  
DECISION: BLOCKED  
CLOSES: true  
LOT: GO-G1-MIGRATIONS-REGULARISATION-1-20261009  
REQUEST: request-1.md  
HEAD: INACCESSIBLE  
LEASE: aucun  
GATE_STATE: G1, CI success — run 37866619689 sur 61c5005  
PROOF_STATE: PROOF_VALID  
CONDITIONS: Exécuter exclusivement les six migrations de 61c5005 dans l’ordre, après contrôles Production immédiats confirmant registre 298, dernière version 20261006220000, migrations et objets absents et MD5 0418bed1d0316063def74ab81cfe71e1 ; sauvegarder la définition SQL intégrale avant 160000 ; arrêter au premier écart ou échec ; vérifier ensuite registre 304 et les six versions, objets, permissions et contrôles attendus ; aucun déploiement de code dans G1 ; tout rollback Production exige un GO distinct.  
BLOCKER: L’application des six migrations constitue une mutation Supabase Production nécessitant le GO explicite de Frédéric.  
STOP_REQUIRED: SUPABASE_PRODUCTION_MUTATION  
OWNER_NEXT: Frédéric  
ACTION_NEXT: Donner ou refuser explicitement le GO d’exécution de G1 sur le candidat 61c5005 sous les conditions énoncées.

<!-- nexus-arbitrage: 079dc7d4faa7757d -->

