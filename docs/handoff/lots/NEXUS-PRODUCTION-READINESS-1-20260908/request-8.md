---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-PRODUCTION-READINESS-1-20260908
seq: 8
author: Claude
branch: config-par-environnement
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=10c65d0 production=501c0c7
  - id: source-diagnostic
    classe: VERIFIED
    valeur: blocages-ouverts-1.md paragraphes 7 a 9, commit 73a1c44999a478e571a58335a9df9dad58414d60
  - id: cause-zzzzref-demontree
    classe: VERIFIED
    valeur: horodatage cycle 14:24:46.914Z vs registre modifie 14:24:47.117Z, run push 34488844379 SHA b3ebb6e
  - id: defaut-security-distinct
    classe: VERIFIED
    valeur: reconstruire-base-test.sh ne lit jamais PREPROD-CYCLE.json, cause non isolee sur ea561f6
  - id: trois-voies-presentees
    classe: VERIFIED
    valeur: corps de request-8.md, impact securite et reversibilite par voie
  - id: aucun-correctif-applique
    classe: VERIFIED
    valeur: aucun fichier de code modifie dans ce lot, diff limite a docs/handoff/
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune requete, aucun merge, aucun deploiement, aucune migration
---
# Formalisation du diagnostic — deux défauts distincts, aucun correctif appliqué

Ce retour ne code rien. Il formalise, pour arbitrage, le constat déjà écrit dans
`blocages-ouverts-1.md` §7 à §9 au commit `73a1c44999a478e571a58335a9df9dad58414d60`,
afin qu'il porte une enveloppe canonique et une demande d'arbitrage explicite
plutôt que de rester une note de travail.

## Ce qui est démontré : `zzzzrefdetestinexistante` (défaut 9, lié au défaut 8)

**Cause démontrée, pas une hypothèse.** `zzzzrefdetestinexistante` n'est pas une
référence de projet inconnue : c'est `REF_BIDON`, l'argument que les épreuves
`security` et `credential` passent aux scripts de répétition (`repetition-release-complete.sh`
et apparentés) pour vérifier qu'ils refusent bien la Production.

La chaîne causale, entièrement reconstituée par horodatage :

1. une épreuve lance le script de répétition avec `REF_BIDON` en argument ;
2. le script fait ce qu'il doit faire : il inscrit un cycle PREPROD dans
   `docs/handoff/PREPROD-CYCLE.json` — un fichier **suivi par git**, pas un
   fichier temporaire ;
3. l'épreuve restaure ce fichier dans son bloc `finally`, mais elle n'est pas
   seule : **six épreuves** manipulent ce même fichier (sauvegarde →
   remplacement → exécution → restauration), et le lanceur de tests les
   exécute **en parallèle** (4 processus en CI, 8 en local) ;
4. deux épreuves qui se chevauchent : la seconde sauvegarde la version *déjà
   vidée* par la première, et sa restauration écrase la restauration
   correcte — la dernière restauration gagne, pas nécessairement l'originale ;
5. le cycle bidon survit dans le fichier versionné ;
6. plus tard dans le **même job CI**, l'étape « Semer le scénario Carburants »
   lit ce fichier, trouve un cycle ouvert sur un projet qui n'existe pas, et
   **refuse de semer — correctement**.

Preuve horodatée (run `push` `34488844379`, SHA `b3ebb6e`) : cycle créé à
`14:24:46.914Z`, registre modifié à `14:24:47.117Z` — pendant l'étape de la
suite de tests, environ 200 ms plus tard, largement avant l'étape de semis qui
échoue ensuite. Ceci explique aussi l'**intermittence** observée depuis le
09/09/2026 : le cycle bidon ne survit que lorsque deux épreuves se chevauchent
au bon moment — d'où des runs verts entre deux runs rouges sans qu'aucun code
n'ait changé.

**La garde n'est pas en cause.** `garde-preprod-ephemere` (ou la garde
équivalente côté semis) a refusé de semer pendant ce qu'elle croyait être une
répétition en cours — c'est exactement son travail. Le défaut est que les
épreuves écrivent un état de répétition mensonger dans un fichier du dépôt et
n'arrivent pas toujours à l'effacer avant que d'autres étapes ne le lisent.

## Ce qui reste distinct : le défaut `security` sur `ea561f6` (défaut 7)

**Cause non isolée — volontairement non confondue avec ce qui précède.** Le
SHA `ea561f6` porte deux exécutions de la même suite : `pull_request` →
succès, `push` → échec, séparées par une seule épreuve,
`test_security_jamais_invoque_si_url_20260910.js`. Trois hypothèses ont été
examinées et écartées par lecture de code, dont explicitement l'interférence
par `PREPROD-CYCLE.json` : **écartée**, parce que `reconstruire-base-test.sh`
ne lit jamais ce fichier, et rien ne s'exécute entre le point d'entrée du
script et l'appel `security` qui puisse le lire à sa place.

Les deux défauts partagent une origine probable (une course entre épreuves
qui s'exécutent en parallèle sous le même lanceur de tests) mais une seule
cause est démontrée — celle de `zzzzrefdetestinexistante`. Le défaut 7 reste
classé **cause non isolée**, son instrumentation (message d'échec enrichi du
marqueur, code de sortie, `stdout`/`stderr`) reste en place, et aucune
correction n'est proposée pour lui dans ce retour.

## Trois voies déjà posées — aucune appliquée, aucune neutre

**Aucune n'a été appliquée.** Corriger sur une cause démontrée pour un défaut
et l'étendre au second par ressemblance serait déplacer le défaut, pas le
réparer.

### Voie 1 — chemin de registre surchargeable par l'environnement (`NEXUS_PREPROD_CYCLE`)

Les épreuves travailleraient sur une copie du fichier, dont le chemin serait
lu depuis une variable d'environnement plutôt que codé en dur.

- **Sécurité : impact élevé, défavorable.** Une variable d'environnement
  obtiendrait le pouvoir de rediriger le fichier que lisent **deux gardes de
  sécurité distinctes** (`garde-preprod-ephemere` et `garde-mode-environnement`).
  Quiconque contrôle cette variable dans un contexte d'exécution pourrait leur
  faire lire un fichier vide et les rendre aveugles à un cycle PREPROD
  réellement ouvert. C'est un élargissement de surface de sécurité au sens de
  `CLAUDE.md` — gate humaine, non pré-autorisable.
- **Réversibilité : totale sur le code** (retirer le support de la variable
  annule le changement), **mais le risque n'est pas dans la réversibilité du
  code : il est dans la fenêtre pendant laquelle la variable existe.**

### Voie 2 — exécuter en série les épreuves qui touchent `PREPROD-CYCLE.json`

Retirer les six épreuves concernées du pool parallèle du lanceur de tests
(configuration du lanceur, pas de logique métier), sans toucher à aucune
garde ni à aucun script de release.

- **Sécurité : aucun impact.** Ne change ni le contenu ni la portée d'aucune
  garde de sécurité ; ne touche aucun fichier lu en Production ; ne modifie
  aucun script de release.
- **Réversibilité : totale et peu coûteuse** — un retour arrière consiste à
  remettre les épreuves dans le pool parallèle. Le risque résiduel n'est pas
  un risque de sécurité mais un risque de maintenance : la protection dépend
  d'une liste que six fichiers doivent respecter, et qu'une septième épreuve
  future pourrait oublier d'y rejoindre si elle manipule le même fichier sans
  le savoir.
- **C'est la voie recommandée dans `blocages-ouverts-1.md`** si l'objectif est
  de débloquer la CI sans rien élargir.

### Voie 3 — refuser d'écrire un cycle pour une référence manifestement bidon

Modifier `repetition-release-complete.sh` (et scripts apparentés) pour qu'ils
refusent d'inscrire un cycle PREPROD lorsque la référence de projet reçue est
reconnaissable comme un argument de test (`REF_BIDON`/motif équivalent),
plutôt que d'écrire puis de compter sur une restauration fiable.

- **Sécurité : impact positif** — la garde devient strictement plus stricte
  (elle refuse d'écrire un état trompeur, elle n'accepte jamais de le
  masquer). Aucun élargissement de surface : c'est un durcissement.
- **Réversibilité : plus délicate en pratique, pas en principe.** C'est la
  voie la plus propre sur le fond, mais aussi la plus intrusive : elle touche
  un **script de release** manipulé la veille d'une gate Production. Une
  erreur dans ce script a un rayon d'action plus large qu'une erreur dans la
  configuration du lanceur de tests (voie 2), parce que ce même script est
  celui qui exécute la répétition réelle sur `nexus-test` avant la gate.

## Ce que ce défaut coûte tant qu'il reste ouvert

Un `git status` sale après chaque exécution locale de la suite complète, le
risque de committer par mégarde un `PREPROD-CYCLE.json` vidé, et une CI dont
le rouge sur le candidat ne distingue pas — sans lire ce diagnostic — un vrai
défaut de release d'une intermittence de suite de tests. `aucunBlocageNonResolu`
reste `null` dans `faits-pret-pour-production.json`, et le verdict global reste
`NON_PRET` tant qu'aucune des trois voies n'est arbitrée ou que Frédéric ne
déclare explicitement ce point non bloquant pour cette release.

## Demande d'arbitrage

Aucune des trois voies n'est neutre — la voie 1 touche une garde de sécurité,
la voie 3 touche un script de release à la veille d'une gate ; la voie 2 est
réversible et sans effet sur aucune garde, et reste la recommandation de ce
retour si l'objectif est de débloquer la CI sans rien élargir. L'arbitrage
(quelle voie, ou aucune avant la gate) revient à Frédéric.
