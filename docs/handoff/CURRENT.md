<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/NEXUS-PRODUCTION-READINESS-1-20260908/request-8.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
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
# Formalisation du diagnostic : deux défauts distincts, aucun correctif appliqué

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
   `docs/handoff/PREPROD-CYCLE.json`, un fichier suivi par git, pas un fichier temporaire ;
3. l'épreuve restaure ce fichier dans son bloc `finally`, mais elle n'est pas
   seule : six épreuves manipulent ce même fichier (sauvegarde, remplacement,
   exécution, restauration), et le lanceur de tests les exécute en parallèle
   (4 processus en CI, 8 en local) ;
4. deux épreuves qui se chevauchent : la seconde sauvegarde la version déjà
   vidée par la première, et sa restauration écrase la restauration correcte ;
5. le cycle bidon survit dans le fichier versionné ;
6. plus tard dans le même job CI, l'étape « Semer le scénario Carburants » lit
   ce fichier, trouve un cycle ouvert sur un projet qui n'existe pas, et refuse
   de semer, correctement.

Preuve horodatée (run `push` `34488844379`, SHA `b3ebb6e`) : cycle créé à
`14:24:46.914Z`, registre modifié à `14:24:47.117Z`, pendant l'étape de la suite
de tests, largement avant l'étape de semis qui échoue ensuite. Ceci explique
également l'intermittence observée depuis le 09/09/2026.

**La garde n'est pas en cause.** Le défaut est que les épreuves écrivent un état
de répétition mensonger dans un fichier du dépôt et n'arrivent pas toujours à
l'effacer avant que d'autres étapes ne le lisent.

## Ce qui reste distinct : le défaut `security` sur `ea561f6` (défaut 7)

**Cause non isolée.** Le SHA `ea561f6` porte deux exécutions de la même suite :
`pull_request` en succès, `push` en échec, séparées par une seule épreuve,
`test_security_jamais_invoque_si_url_20260910.js`. L'interférence par
`PREPROD-CYCLE.json` a été écartée parce que `reconstruire-base-test.sh` ne lit
jamais ce fichier et rien ne s'exécute entre son point d'entrée et l'appel
`security` qui puisse le lire à sa place.

Les deux défauts partagent une origine probable, une course entre épreuves
parallèles, mais une seule cause est démontrée : celle de
`zzzzrefdetestinexistante`. Le défaut 7 reste classé cause non isolée.

## Trois voies déjà posées, aucune appliquée

### Voie 1 : chemin de registre surchargeable par l'environnement

Les épreuves travailleraient sur une copie du fichier, dont le chemin serait lu
depuis une variable d'environnement.

- Sécurité : impact élevé, défavorable. Une variable d'environnement pourrait
  rediriger le fichier lu par deux gardes de sécurité.
- Réversibilité : totale sur le code, mais le risque existe pendant la fenêtre
  où la variable est active.

### Voie 2 : exécuter en série les épreuves qui touchent `PREPROD-CYCLE.json`

Retirer les six épreuves concernées du pool parallèle du lanceur de tests,
sans toucher à aucune garde ni à aucun script de release.

- Sécurité : aucun impact. Aucune garde, aucun fichier Production et aucun
  script de release n'est modifié.
- Réversibilité : totale et peu coûteuse. Le risque résiduel est uniquement un
  risque de maintenance si une future épreuve manipulant le même fichier n'est
  pas classée dans le groupe sérialisé.
- C'est la voie recommandée dans `blocages-ouverts-1.md` si l'objectif est de
  débloquer la CI sans élargir la surface de sécurité.

### Voie 3 : refuser d'écrire un cycle pour une référence manifestement bidon

Modifier les scripts de répétition pour qu'ils refusent d'inscrire un cycle
PREPROD lorsqu'une référence est reconnue comme argument de test.

- Sécurité : impact positif en principe, car la garde devient plus stricte.
- Réversibilité : possible, mais cette voie touche un script de release utilisé
  pour la répétition réelle avant gate Production et a donc un rayon d'action
  supérieur à la voie 2.

## Coût tant que le défaut reste ouvert

Un `git status` peut rester sale après une suite complète, un
`PREPROD-CYCLE.json` altéré peut être commité par mégarde, et une CI rouge peut
être confondue avec un vrai défaut de release. `aucunBlocageNonResolu` reste
`null` dans `faits-pret-pour-production.json` et le verdict global reste
`NON_PRET` tant que le point n'est pas fermé ou explicitement classé non
bloquant.

## Demande d'arbitrage

La voie 1 touche une garde de sécurité. La voie 3 touche un script de release.
La voie 2 est réversible, sans effet sur les gardes et reste la recommandation
du diagnostic pour débloquer la CI sans élargir la surface de sécurité.
