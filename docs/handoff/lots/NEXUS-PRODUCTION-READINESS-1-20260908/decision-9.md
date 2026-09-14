---
protocol: nexus-handoff/2
kind: decision
lot_id: NEXUS-PRODUCTION-READINESS-1-20260908
seq: 9
author: NEXUS Orchestrator
decision: APPROVED
closes: false
in_reply_to: request-10.md
branch: config-par-environnement
---
# Poursuite déterministe : défaut Auth fermé, isoler la fixture de reproduction

Aucun arbitrage Frédéric supplémentaire n'est requis.

Depuis `request-10.md`, un fait nouveau ferme le défaut Auth : le run connecté `34523206197`, tentative 2, est `success` de bout en bout sur le candidat `b7cbe95635c24c8c61683bf5b51cc83aa36b05fb`, après le réalignement Test déjà effectué. La recette navigateur a donc franchi la connexion `Manager Test`. Une vérification SELECT-only sur Supabase `nexus-test` confirme en outre que `Manager Test` n'est ni supprimé ni banni et qu'une connexion réussie a été enregistrée le 10/09/2026 à 20:02 UTC. Aucune valeur de PIN ou secret n'a été lue ni exposée.

Le blocage restant est désormais déterministe et relève exclusivement de l'outillage Test : `test_fixtures_hors_depot_20260910.js` reproduit sa course en créant puis supprimant `__fixture_race_repro_20260910__.js` dans la racine réelle du dépôt pendant que `test_build_tracabilite_20260905.js` parcourt cette même racine. Le commit canonique `2f57ad9d1ff1872d992381ce89fcbf649133a699` documente cette cause et propose le correctif minimal : déplacer la reproduction dans un répertoire temporaire isolé, sans modifier le mécanisme testé.

## Décision

Claude est autorisé à appliquer uniquement cette correction minimale Test/outillage :

1. faire créer et supprimer la fixture de reproduction dans un répertoire temporaire dédié ;
2. faire exercer `listerPuisCopier` sur ce même répertoire pour conserver la preuve de la course sans toucher la racine partagée ;
3. ne modifier aucune logique métier, aucun script de release, aucune garde Production et aucun comportement applicatif ;
4. exécuter la mutation négative ou l'épreuve équivalente démontrant que la reproduction reste réelle dans son bac à sable ;
5. rejouer la suite globale, les Guardians et la recette connectée à partir de l'étape utile seulement ;
6. si tout est vert et que les autres critères Readiness restent satisfaits, publier le prochain `request-N.md` demandant uniquement les re-mesures Production SELECT-only déjà autorisées et la préparation de la gate finale spécifique.

Ne pas ajouter de nouvelle architecture et ne pas perfectionner PREPROD. Le but est maintenant de terminer la preuve de release.

## Gate Production inchangée

Aucune écriture ou migration Supabase Production. Aucun push/merge vers `main` ou `production`. Aucun déploiement ou rollback Production. Aucune copie non anonymisée de Production. Aucun secret ou `service_role` exposé. Migration 21 reste exclue de cette release. `Prêt pour Production` ne vaut jamais autorisation Production ; l'autorisation finale reste explicitement celle de Frédéric sur une release et un impact mesurés.
