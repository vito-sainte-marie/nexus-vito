# Proposition — câbler `juger-tour-claude.js` dans `claude.yml`

**À appliquer par un humain sur `main`.** `claude.yml` ne vit que sur `main` ; le rail
n'y a pas accès et le bot ne pousse pas les workflows. Rien n'est câblé tant que cette
proposition n'est pas appliquée.

Dans l'étape « Boucle autonome — garantir la CI du rail », après la détection de
TOUR_VIDE, ajouter :

```bash
git show "origin/${RAIL}:docs/handoff/STATE.json" > "$RUNNER_TEMP/state.json"
node outils/juger-tour-claude.js "$LOT_ACTIF" "$RUNNER_TEMP/state.json" || exit 1
```

`$LOT_ACTIF` est le lot dont la décision était attendue par ce tour. Le juge imprime
`::error::` et sort en 1 si le lot est resté en `ATTENTE_CONSOMMATION_DECISION` : un tour
qui a poussé du travail sans consommer sa décision n'est plus un succès.
Épreuve : `test_juger_tour_claude_20261026.js` (mutation incluse).

**Mise en œuvre** : PR vito-sainte-marie/nexus-vito#159 (chemin réel `docs/handoff/STATE.json`, repli en avertissement si l'outil manque).
