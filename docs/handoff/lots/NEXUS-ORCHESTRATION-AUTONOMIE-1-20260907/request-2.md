---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-ORCHESTRATION-AUTONOMIE-1-20260907
seq: 2
author: Claude
branch: config-par-environnement
status: AWAITING_DECISION
token_mode: STANDARD
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=10c65d0 production=501c0c7
  - id: recette-bout-en-bout
    classe: VERIFIED
    valeur: run CI 34143652065 vert — 36 000 L, reliquat 1 000 L sur go, refus motive sp95, aucune saisie humaine
  - id: identifiant-login
    classe: VERIFIED
    valeur: nexus_identifiant_de_connexion resout sur employees.nom, verifie en base
  - id: cron
    classe: NOT_APPLICABLE
    valeur: declencheur toujours absent — exige une modification de main
  - id: suite
    classe: VERIFIED
    valeur: 198/207
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune requete, aucun merge, aucun deploiement
---
# Request-2 — la recette navigateur tourne en CI, sans personne

Complément factuel à `request-1.md` : deux des trois questions posées ont
maintenant une réponse mesurée plutôt qu'estimée.

## 1) La recette est verte de bout en bout

Run CI `34143652065`, push sur `config-par-environnement`, commit `7058968` :

```
Version servie confirmée : 70589682b8219a257bd8ccb046bf1e876222f0af
Recette navigateur NEXUS Test — site nexus-station-test, version servie 7058968
  Commande recommandée : 23 000 L de SP95 + 13 000 L de GO
  optimiseur brut : {"volumesRetenus":{"sp95":23606,"go":12394},"total":36000}
  après arrondi   : {"sp95":23000,"go":13000} = 36000 L
  reliquat        : {"recupereL":1000,"parCarburant":{"go":1000},
                     "motifs":{"sp95":"Capacité disponible à la livraison insuffisante…"}}
Preuve UI satisfaite.
```

Aucune saisie humaine. Le PIN n'a pas quitté le runner et apparaît masqué
(`***`) dans le journal. L'attente de déploiement a fonctionné : la recette a
confirmé que NEXUS Test servait bien le commit testé avant de juger.

## 2) Deux défauts trouvés par ce premier run réel

**a) Une course déguisée en refus d'authentification.** La première version
enchaînait `Promise.all([waitForLoadState('networkidle'), click()])` puis lisait
l'URL. `networkidle` se résolvait avant l'aller-retour d'authentification :
l'échec remontait « connexion refusée » trois secondes après le clic et
**accusait le PIN**. Corrigé en attendant l'événement réel — quitter l'écran de
connexion — et en rapportant le message affiché par la page.

**b) Le rail passait un identifiant que l'écran n'accepte pas.** Avec l'attente
corrigée, l'écran a dit lui-même « Prénom ou code PIN incorrect. ». Vérifié en
base plutôt que supposé :

```
nexus_identifiant_de_connexion('manager-test')  -> NULL
nexus_identifiant_de_connexion('Manager Test')  -> 'manager-test'
```

Le champ est étiqueté « Prénom » mais la fonction résout sur `employees.nom`.
La variable `NEXUS_TEST_MANAGER_USERNAME` du rail contient un identifiant
technique inutilisable à la connexion. Renommée `NEXUS_TEST_MANAGER_NOM` dans
`tests.yml` avec la valeur attendue.

**Conséquence hors périmètre :** `.github/workflows/claude.yml` sur `main` porte
toujours `NEXUS_TEST_MANAGER_USERNAME: manager-test`, ainsi que
`NEXUS_TEST_EMPLOYEE_A_USERNAME` / `_B_`. Ces trois valeurs ne permettent aucune
connexion. Ce n'est pas bloquant — rien ne les consomme aujourd'hui — mais toute
session qui s'y fierait perdrait le même temps. Correction non appliquée :
`main` reste fermée.

## 3) Réponse mesurée à Q71

`request-1.md` recommandait de rendre la recette **non bloquante au premier
run**, faute de l'avoir jamais vue passer. Elle est passée. La recommandation
devient : **bloquante**, telle qu'elle est déjà câblée. Une preuve qui s'excuse
ne prouve rien, et celle-ci n'a plus besoin de s'excuser.

## 4) Q70 reste entière

Le réveil automatique n'a toujours pas de déclencheur : un `schedule` ne vit que
sur la branche par défaut. Rien n'a changé sur ce point.

## 5) Production

`NOT_APPLICABLE` — aucune requête, aucun merge, aucun déploiement.
