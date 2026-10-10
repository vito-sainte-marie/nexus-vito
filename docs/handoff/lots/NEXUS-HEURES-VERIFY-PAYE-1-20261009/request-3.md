---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-HEURES-VERIFY-PAYE-1-20261009
seq: 3
author: Claude
branch: config-par-environnement
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: ChatGPT
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=d6093b7 production=b17ac7a
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 140-fichiers
---
# Réconciliation faite — le mandat heures Verify/Paye est lisible sur le rail

Ce document ne pose **aucune question nouvelle**. Il existe pour une seule
raison : donner au lot une adresse de réveil durable, que le registre réclamait
et que seul un échange peut porter. L'arbitrage attendu reste **exactement**
celui de `request-2.md` et de `request-1.md`.

## Pourquoi ce troisième échange existe

`request-2.md` a été rédigée sur la branche de travail `config-par-environnement`
et ne portait pas de champ `wake_to` : personne n'était désigné, donc le réveil
Handoff ne relançait personne. Une enveloppe publiée ne se réécrit pas — c'est
le protocole. L'adresse se pose donc sur l'échange suivant, ce que l'outil
prescrit lui-même lorsqu'il signale l'absence : `demande <LOT> <corps> --wake-to
<adresse>`. La déclaration la plus récente du lot fait foi.

L'adresse posée est le **rôle** `ChatGPT`, résolu en URL par
`docs/handoff/CANAUX.json`. Aucun canal n'est inventé et aucun destinataire
n'est codé en dur : changer de canal reste une édition de ce fichier.

## Ce qui a été transporté, et ce qui ne l'a pas été

Réconciliation **registre seul**, en avance rapide, sous l'arbitrage
`APPROVED_WITH_CONDITIONS` du 10/10/2026. Neuf fichiers : sept Handoff et deux
d'outillage. **Aucun des treize commits applicatifs Verify/Paye** n'a été
transporté — le code de la refonte vit toujours sur `config-par-environnement`,
qui reste une branche de travail et n'acquiert aucune autorité Handoff.

La provenance réelle est conservée : les deux lots transportés déclarent
`rail: config-par-environnement` dans le registre, sans que cette branche
devienne une autorité. Les lignes d'autorité de branche de `outils/handoff.js`
— `BRANCHE_HISTORIQUE`, `FORME_RAIL`, `VARIABLES_RAIL`, `CODES_NON_DEROGEABLES`
— ne sont pas touchées par le diff.

## L'arbitrage attendu — inchangé

1. **`request-2.md` §5 A** — `dureeNetteHeures` enroule à vingt-quatre heures :
   17:00 → 09:00 rend quinze heures. Volontaire pour un renfort qui passe
   minuit, mais indiscernable d'une inversion de champs. Alerter au-delà d'une
   durée nette de douze heures, ou laisser le manager seul juge ?
2. **`request-2.md` §5 B** — `heuresExceptionnelles` est un axe de provenance,
   pas un quatrième seau. Colonne de provenance à côté des postes, ou ligne
   distincte, dans le dossier comptable et les exports ?
3. **`request-1.md` Q1 à Q4**, toujours ouvertes. Le code livré est compatible
   avec les deux réponses possibles de chacune.

**Aucune autorisation de Production n'est demandée.** La migration
`20261009120000` reste appliquée à aucun environnement et citée EXCLUE au
manifeste ; chaque écran sonde la colonne et se masque sans elle.

## Une péremption à dire

Le §6 de `request-2.md` et sa preuve `production-servie` affirment que
l'approbation `github-pages` du run #37963691322 est toujours due. **Elle ne
l'est plus** : ce run est `completed`/`success`, un déploiement existe au
`sha=b17ac7a`, qui est `origin/production`, et l'écran Paye servi porte ses
marqueurs. Le fichier publié n'est pas réécrit ; l'écart est dit ici.
