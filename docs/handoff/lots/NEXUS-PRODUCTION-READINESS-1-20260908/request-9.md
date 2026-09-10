---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-PRODUCTION-READINESS-1-20260908
seq: 9
author: Claude
branch: config-par-environnement
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=10c65d0 production=d5a8b77
  - id: fermeture-defaut-12
    classe: VERIFIED
    valeur: test_handoff_v2 vert sur pull_request 34508020759 et push 34508015447 du candidat e6c7948, lu par gh run view
  - id: non-fermeture-defaut-7
    classe: VERIFIED
    valeur: test_security_jamais_invoque_si_url vert sur les deux runs du candidat, un point de non-reproduction de plus, cause non isolee inchangee
  - id: nouveau-defaut-13-recette-navigateur
    classe: VERIFIED
    valeur: run push 34508015447 echoue a Recette navigateur NEXUS Test, symptome identique au defaut 11, aucun secret lu
  - id: verdict-recalcule
    classe: VERIFIED
    valeur: node outils/evaluer-pret-pour-production.js --sha e6c7948 : ci_et_guardians_conformes BLOQUE, VERDICT NON_PRET
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune requete, aucun merge, aucun deploiement
---
# Consolidation §7/§12, et défaut 13 trouvé en vérifiant — la CI n'est pas verte sur le candidat

## Ce qui était demandé

Réévaluer factuellement §7 et §12 de `blocages-ouverts-1.md` à la lumière du
run CI `34508020759` (candidat `e6c7948`, cité comme « terminé en `success`,
job `non-regression` entièrement vert »), fermer §12 si objectivement fermé,
laisser §7 ouvert sauf preuve reproductible, et publier la demande de gate
finale si tous les critères techniques hors gate humaine sont satisfaits.

## Ce qui a été vérifié, réellement — `gh` a fonctionné dans ce canal cette fois

Contrairement à toutes les sessions précédentes de ce fil, `gh run list`/
`gh run view` invoqués via `child_process.execFileSync` (Node) ont fonctionné
directement dans ce canal — première vérification indépendante, pas une
déclaration reprise telle quelle.

`gh run list --commit e6c7948769c8e1aa6a2690d1c6e5b782f56f7ea9` confirme
**deux** runs sur ce SHA, pas un seul :

| run | événement | verdict |
|---|---|---|
| `34508020759` | `pull_request` | `success` |
| `34508015447` | `push` | **`failure`** |

Le run cité dans le réveil est réel et vert, mais c'est un `pull_request` —
sa chaîne connectée (Test/Playwright) est `skipped` par construction, comme
le réveil le savait déjà et le disait explicitement. Ce que le réveil ne
mentionnait pas : le **second** run du même SHA, un `push`, a réellement
exécuté cette chaîne et **échoue à sa dernière étape**.

## §12 — FERMÉ, avec preuve exacte

Le défaut nommait précisément `test_handoff_v2_20260905.js` (refus d'une
décision déjà consommée sans message identifiable). Cette épreuve vit dans
l'étape « Suite de non-régression et verdict », **verte dans les deux
runs** — `pull_request` et `push` — de même que l'étape séparée « Protocole
Handoff v2 ». Le défaut ne s'est reproduit dans aucun des deux événements
sur le candidat lui-même. Fermé sur cette base : cause toujours non isolée,
mais non reproduite, sur les deux événements qui l'exercent.

## §7 — reste OUVERT, aucune correction par analogie

Même méthode : `test_security_jamais_invoque_si_url_20260910.js`, dans la
même étape, est vert dans les deux runs — un point de non-reproduction de
plus sur un défaut qui a déjà une histoire majoritairement verte (7/7 local,
puis 8/9 sur les exécutions suivantes). Ce n'est pas une preuve d'absence.
Conformément au mandat (« ne corrige rien par analogie »), §7 reste ouvert,
statut inchangé : `cause non isolée`.

## Défaut 13 — NOUVEAU, trouvé en vérifiant, pas en supposant

Le run `push` `34508015447` (candidat `e6c7948` lui-même) va vert jusqu'à
l'étape 49 sur 50 — suite complète, Protocole Handoff v2, les sept
Guardians, la garde PREPROD, le semis Supabase Test, la publication du
journal NEXUS Live — puis échoue sur **« Recette navigateur NEXUS Test »** :

```
Version servie confirmée : e6c7948769c8e1aa6a2690d1c6e5b782f56f7ea9
ÉCHEC de la recette navigateur : Connexion refusée : toujours sur l'écran de
login 30 s après validation. Identifiant inconnu, secret de recette périmé,
ou compte désactivé.
  Écran : […] Prénom ou code PIN incorrect. […]
```

Symptôme identique au défaut 11 (fermé le 10/09 à 15 h 55 sur `4f26a37`,
run `34498775844`), sur le même point d'entrée (`Manager Test`, premier
compte tenté par `outils/recette-navigateur-test.js`). Il réapparaît **une
heure et demie plus tard**, sur le run `push` du candidat lui-même. Aucun
run `push` plus récent sur `config-par-environnement` ne le contredit — un
run plus récent (`34509760412`, 17 h 41) est vert mais sur une branche
Claude distincte, avec la chaîne connectée entière `skipped` : il ne prouve
rien sur la recette.

Aucune valeur de secret lue. Cause non isolée — je m'arrête à la lecture de
verdicts de run, la suite touche un secret de recette (PIN), gate humaine.

## Conséquence calculée, pas racontée

```
node outils/evaluer-pret-pour-production.js --sha e6c7948769c8e1aa6a2690d1c6e5b782f56f7ea9
  CI       : pull_request:success · push:failure
  ✗ BLOQUE   ci_et_guardians_conformes
  VERDICT                : NON_PRET
  autorisation            : NON_AUTORISEE
  run(s) en échec sur le candidat : push 34508015447
```

`ci_et_guardians_conformes` reste **BLOQUE** sur le candidat courant — plus
pour §7/§12 (non reproduits sur ce SHA), mais pour le défaut 13. **Le
package n'est pas complet pour la gate finale : je ne publie donc PAS de
demande de préparation de gate**, conformément à la mission (« publie…
uniquement si tous les critères techniques hors gate humaine sont
objectivement satisfaits »— ils ne le sont pas).

## Ce qu'il faut, et de Frédéric seul

La même action que pour le défaut 11 : vérifier si le code PIN de
`Manager Test` sur Supabase **Test** a de nouveau changé vers 17 h 24 le
10/09, et si oui réaligner `NEXUS_TEST_MANAGER_PIN`. Rien d'autre dans la
chaîne connectée n'est en cause — les 46 étapes qui précèdent sont vertes.
Les mesures Production SELECT-only du 10/09 14 h 02 restent valides
jusqu'au 11/09 14 h 02 ; ni re-mesure ni PREPROD supplémentaire n'est
demandé ici.

## Fichiers modifiés

- `docs/handoff/lots/NEXUS-PRODUCTION-READINESS-1-20260908/blocages-ouverts-1.md` — §12 fermé, §7 point de non-reproduction ajouté, §13 ouvert.
- `docs/handoff/lots/NEXUS-PRODUCTION-READINESS-1-20260908/faits-pret-pour-production.json` — `aucunBlocageNonResolu.preuve` mise à jour en conséquence.

## Invariants respectés

Aucun changement `main`/`production`, aucune écriture ni migration Supabase
Production ou Test, aucun secret/PIN/service_role lu, rotationné ou exposé,
aucun fichier applicatif touché, aucune nouvelle architecture. Migration 21
reste exclue de la release Production, inchangée.
