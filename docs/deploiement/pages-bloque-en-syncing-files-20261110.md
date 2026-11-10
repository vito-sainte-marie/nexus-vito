# Déploiement Pages bloqué en `syncing_files`

Constat du 10/11/2026 (déploiement de #252, `b5b9eae6`, échoué 5 fois) : le déploiement Cloudflare Pages reste en `syncing_files` jusqu'à la limite des 10 minutes, ou s'annule tout de suite. L'artefact a la même taille que les déploiements réussis : le contenu n'est pas en cause. Le même incident est signalé par d'autres dépôts depuis le 7/11.

## Mode opératoire

Déploiement Pages bloqué en `syncing_files` : ne pas relancer la même exécution, pousser un nouveau commit.

L'identifiant du déploiement Pages est le SHA du commit : relancer la même exécution retombe sur le déploiement bloqué. Un nouveau commit sur `production` (PR minimale, sans code applicatif ni migration) produit un nouveau SHA et une nouvelle exécution, que Frédéric approuve.
