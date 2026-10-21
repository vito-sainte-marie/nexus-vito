# PR #143 — chrono jaugeage en régularisation (FIX-CARBURANT-CHRONO-JAUGEAGE-20261020)

Consignation du 2026-10-21, hors `docs/handoff/`.

- PR : https://github.com/vito-sainte-marie/nexus-vito/pull/143 , ouverte en **brouillon**, base `production` (`d3244d86`), tête `fix-chrono-jaugeage-regularisation-20261020` au commit `5e42da30`.
- Diff : **un seul commit**, trois fichiers : `NEXUS-Carburant-Reception-v1.html`, `test_reception_regularisation_20260919.js`, `test_reception_chrono_jaugeage_regularisation_20261020.js`. Aucune migration.
- Ouverte par Claude Code en session, sur le GO de Frédéric (decision-1 du lot, APPROVED_WITH_CONDITIONS, closes: false), qui lève le palier `PRODUCTION_FUSION_DEPLOIEMENT_PROMOTION` pour l'ouverture seulement. Le verdict BLOCKED de l'arbitre (#28, 01:04Z) n'a pas été matérialisé.
- Non fusionnée ; aucun auto-merge. **La fusion, le déploiement et la promotion sont réservés à Frédéric.**
- Contrôles : suite 286/293 contre 285/292 sur `origin/production`, mêmes 7 échecs préexistants ; recette sur l'aperçu Test (compte manager) : cas réel accepté, ordre inverse refusé, aucune écriture. CI de la PR au moment de la consignation : `Cloudflare Pages` vert, `non-regression` en cours.
- Hors lot : constat caméra iPhone (compte de Dylan).

## Fusion et déploiement (2026-10-21)

- PR #143 **fusionnée par Frédéric** à 10:35Z, commit de fusion `09c9be47` sur `production` (tête `5e42da30`).
- `Tests` vert sur `09c9be47` ; `Déploiement Production (GitHub Pages)` terminé en succès sur `09c9be47`.
- Contenu servi mesuré sur https://app.nexusconseil.net : `nexus-build.js` porte `commit: 09c9be4771cde70a17840a41221c3854fe8368a9` et la page Réception carburant contient le nouveau message « Le jaugeage initial serait postérieur à la livraison… ». L'empreinte du fichier servi diffère de celle du dépôt (balises de version des scripts réécrites par le build) : l'identité est établie par le commit et le message, pas par l'empreinte.
- Non vérifié : la saisie réelle du cas 12:22 / 13:56 en Production (elle exige un compte manager réel ; geste de Frédéric).
