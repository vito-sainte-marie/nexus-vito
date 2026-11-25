# Edge Function `connexion` (Test)

Variables : `AUTH_MASTER_SECRET`, `PEPPER`, `IP_FP_SECRET` (saisies par le gérant, jamais lues ni journalisées), `ORIGINES_AUTORISEES`, `PLANCHER_MS` (2000 par défaut).

`ORIGINES_AUTORISEES` : liste exacte, sans joker, séparée par des virgules.
- Test : `https://nexus-test-ddf.pages.dev,https://claude-connexion-securite.nexus-test-ddf.pages.dev`
- Production (au GO seulement) : `https://app.nexusconseil.net`

Un 503 « indisponible » n'est rendu que si Auth répond lui-même 429. `compter_succes` surveille (journal `egress_proche` à 60 succès en 5 min) sans jamais bloquer.
