# Edge Function `connexion` (Test)

Variables : `AUTH_MASTER_SECRET`, `PEPPER`, `IP_FP_SECRET` (saisies par le gérant, jamais lues ni journalisées), `ORIGINES_AUTORISEES`, `PLANCHER_MS` (2000 par défaut).

`ORIGINES_AUTORISEES` : liste exacte, sans joker, séparée par des virgules.
- Test : `https://nexus-test-ddf.pages.dev,https://claude-connexion-securite.nexus-test-ddf.pages.dev`
- Production (au GO seulement) : `https://app.nexusconseil.net`

Un 503 « indisponible » n'est rendu que si Auth répond lui-même 429. `compter_succes` surveille (journal `egress_proche` à 60 succès en 5 min) sans jamais bloquer.

## Atomicité Auth/base et recette de pannes (étape 2f)
Toute écriture double passe par `ecrireAtomique` : Auth d'abord, puis la base. Si la base échoue, le mot de passe Auth précédent est restauré. Si cette compensation échoue, l'événement `incoherence_auth` est journalisé et `nexus_connexion.comptes_incoherents()` (lecture seule) liste le compte ; la réparation est la réinitialisation par un gérant (`reinitialiser_code`).

Injection de pannes (Test seulement) : table `nexus_connexion.panne_injectee` (user_id, étape `auth`, `base` ou `compensation`), lue seulement si la variable d'environnement `RECETTE_PANNES=1` est posée. Ce code (table, `panne_pour`, appels) est retiré du source avant toute demande de GO Production ; le md5 de Production différera donc de celui de Test.

## Budget d'appels à Auth et migration station par station

Tous les comptes `a_migrer` d'une station sortent par la même IP vers Auth, qui limite par IP (mesure sur Test : seau de jetons, 429 vers 0,8 à 2 appels par seconde, récupération en quelques secondes). `nexus_connexion.budget_auth()` plafonne donc les appels `a_migrer` à `budget_auth_min` par minute (20 par défaut). Au-delà : 503 « indisponible », sans appel à Auth, sans toucher aucun compteur de compte ; le plancher de durée s'applique. L'événement `budget_auth` est journalisé (au plus un par minute) avec le nombre de comptes `a_migrer` restants. Il sera repris dans l'alerte gérant.

La migration se fait **station par station**, et le nombre de comptes `a_migrer` est suivi jusqu'à zéro avant de passer à la station suivante.

## Limite par IP : seuls les échecs réels comptent (étape 2h)

`nexus_connexion.essais_ip.type` vaut `echec`, `succes`, `refus_ip` ou `refus_verrou`. Les fenêtres de 10 min et d'1 h ne comptent que les `echec` (code faux sur un compte existant, prénom inconnu ou ambigu). Un refus ne prolonge donc pas le blocage de l'IP, et une station dont les employés se connectent avec succès ne se bloque pas. Les lignes `refus_*` et `succes` servent à la lecture et à l'alerte. Limite connue : des essais simultanés passent tous `avant_essai` avant que le premier échec soit inscrit. Retour arrière : `outils/recette/connexion_lot1/99e_retour_arriere_etape2h.sql`.

## Coût bcrypt et plafond de CPU (décision Guardian 7151083028)

bcryptjs est en JavaScript pur. Mesure dans la fonction sur Test (`performance.now()` autour de bcrypt, 20 appels par coût, un appel par requête) : coût 12 = 347 ms en médiane (p95 354 ms) ; coût 10 = 86 ms (p95 92 ms). Au-dessus de 300 ms de CPU, le coût passe à 10 (`COST = 10`). Une requête qui dépasse environ 2 s de CPU est coupée par la plateforme (HTTP 546, `WORKER_RESOURCE_LIMIT`, cause visible seulement dans le corps de la réponse, absente de `query_logs`).

Les hachages coût 12 existants restent valides (le coût est lu dans le hachage). Au prochain succès d'un compte `migre` dont le hachage n'est pas au coût courant, la fonction le re-hache au coût 10 : une écriture (`poser_code`), sans toucher Auth ni la version, sans effet sur la réponse si elle échoue.

Client (étape 3) : un 546 ou tout autre 5xx s'affiche « indisponible, réessayez », avec une seule reprise automatique après 1 à 3 s tirées au hasard, sans autre boucle. Pas de sémaphore dans ce lot.

Alerte retenue : au moins 3 réponses 5xx en 1 minute sur `connexion`.
