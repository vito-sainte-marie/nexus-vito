# Edge Function `connexion` (Test)

Variables : `AUTH_MASTER_SECRET`, `PEPPER`, `IP_FP_SECRET` (saisies par le gérant, jamais lues ni journalisées), `ORIGINES_AUTORISEES`, `PLANCHER_MS` (2000 par défaut).

`ORIGINES_AUTORISEES` : liste exacte, sans joker, séparée par des virgules.
- Test : `https://nexus-test-ddf.pages.dev,https://claude-connexion-securite.nexus-test-ddf.pages.dev`
- Production (au GO seulement) : `https://app.nexusconseil.net`

Un 503 « indisponible » n'est rendu que si Auth répond lui-même 429. `compter_succes` surveille (journal `egress_proche` à 60 succès en 5 min) sans jamais bloquer.

## Atomicité Auth/base et recette de pannes (étape 2f)
Toute écriture double passe par `ecrireAtomique` : Auth d'abord, puis la base. Si la base échoue, le mot de passe Auth précédent est restauré. Si cette compensation échoue, l'événement `incoherence_auth` est journalisé et `nexus_connexion.comptes_incoherents()` (lecture seule) liste le compte ; la réparation est la réinitialisation par un gérant (`reinitialiser_code`).

Injection de pannes (Test seulement) : table `nexus_connexion.panne_injectee` (user_id, étape `auth`, `base` ou `compensation`), lue seulement si la variable d'environnement `RECETTE_PANNES=1` est posée. Ce code (table, `panne_pour`, appels) est retiré du source avant toute demande de GO Production ; le md5 de Production différera donc de celui de Test.
