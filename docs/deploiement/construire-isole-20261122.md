# Construire dans une copie, jamais sur place

**Pour rejouer la CI en local, construire dans une copie ; ne jamais commiter un arbre construit.**

`outils/build.sh` réécrit les pages là où elles sont : il épingle chaque script sur un identifiant de build (12 hex) et injecte la configuration, `nexus-page.js` et le bandeau d'environnement. Lancé dans le dépôt de travail, il laisse un arbre construit que `git add -A` commite sans bruit (lot Dates courtes 2, commit 1d72575a : page Relevé construite, test de versions rouge).

## Rejouer la CI en local

```bash
outils/build-isole.sh /tmp/nexus-construit node run-tests.js
```

La copie reçoit les fichiers suivis du dépôt, `build.sh --sur-place` y tourne, la commande éventuelle s'exécute dans la copie. Le dépôt de travail n'est pas touché.

## Garde-fous

- `outils/build.sh` refuse de tourner sur place dans un dépôt git. Il s'exécute seulement avec `CF_PAGES` (Cloudflare), `GITHUB_ACTIONS=true` (CI et déploiement) ou `--sur-place`.
- La CI lance `test_versions_scripts_20261121.js` et `test_sources_non_construites_20261122.js` sur l'arbre source, avant le build. Un arbre construit commité les rougit.
- Après tout build local sur place (déconseillé), `git status` doit être propre avant de commiter.
