<!-- en-attente wake_to: https://github.com/vito-sainte-marie/nexus-vito/issues/160 -->
# INVENTAIRE-QUARTS-BLOQUES-20261122 : quarts d'inventaire bloqués et réalignement de Test

Dossier distinct ouvert par la décision-6 de INVENTAIRE-CAISSE-RENFORT-20261102 (verdict de l'arbitre relayé par le pilote le 22/11/2026, condition 4).

## Constats (contre-audit Guardian du 22/11/2026, lecture seule)
- VERIFIED : le quart du 13/11/2026 au soir (vito-sainte-marie) est resté en `ouverture_en_cours`. `run_scheduled_inventory_reviews` ne clôt que les quarts `ouvert` ou `cloture_en_cours` et ne lit que les quarts des deux derniers jours : un quart bloqué à l'ouverture n'est jamais clos.
- VERIFIED : environ 80 quarts antérieurs au 03/11/2026 restent en `ouverture_en_cours` ou `ouvert` (août à octobre).
- VERIFIED : sur Test, `run_scheduled_inventory_reviews` a l'empreinte `2b545ac8…`, différente de Production (`277911ea…`, égale à `20261107100000`) et des fichiers du dépôt. Les recettes sur Test ne valent pas pour le code déployé.

## Demande
1. Décider du traitement d'un quart bloqué en `ouverture_en_cours` : règle serveur de clôture ou d'abandon tracé, sans corriger ni déplacer aucune donnée existante.
2. Décider du sort du stock historique : le laisser tel quel et l'exclure des lectures, ou le marquer par un état tracé, jamais en effaçant.
3. Réaligner la fonction de Test sur la version déployée avant toute recette, avec une migration écrite par Claude Code et appliquée sur Test seulement.

## Contrat attendu
- OWNER_NEXT : Claude Code (migration et épreuves), sous revue Guardian sur #160.
- Ne pas réappliquer `20261103190000`.
- STOP : aucune écriture en Production, migration Production, fusion ou déploiement sans GO distinct de Frédéric.
