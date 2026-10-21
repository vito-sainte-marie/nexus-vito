---
protocol: nexus-handoff/2
kind: request
lot_id: GOV-R4-VIGIE-MAIN-20261020
seq: 1
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: https://github.com/vito-sainte-marie/nexus-vito/issues/28
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=ff19b8a0 production=d3244d86
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 158-fichiers
---
# GOV-R4-VIGIE-MAIN-20261020 : porter la vigie sur main

**Suite de :** GOV-R4-VIGIE-20261020 (clos, decision-2 APPROVED closes:true). Cette demande ouvre le palier que cette décision a nommé et exclu : faire exister `vigie-cloture.yml` sur `main`, seule branche d'où un `schedule` s'exécute.

## Constat
La vigie V1 (rail `d5e2d591`) est inerte : GitHub ne déclenche un `schedule` que depuis la branche par défaut. `origin/main` = `ff19b8a0` ne contient que `claude.yml`, `test-telegram-handoff.yml`, `tests.yml`. Tant que le fichier n'y est pas, la clôture déposée par la CI reste sans lecteur (cf. clôtures R1 decision-4 et R2 decision-3).

## Périmètre proposé (minimal)
- Une PR vers `main` qui ajoute **un seul fichier** : `.github/workflows/vigie-cloture.yml`, identique octet pour octet à celui du rail (`f396f2a7`). Aucun autre fichier, `tests.yml` et `claude.yml` intouchés.
- Le workflow fait un checkout `ref: handoff-continuite-20260920` : le script, O3 et le registre restent lus sur le rail. `main` ne porte que le déclencheur.
- Permissions `contents: read` seul, aucun secret, lecture anonyme de l'API, O3 sans `--appliquer`, alerte = échec du run avec annotation nommant le lot (les 5 conditions de GOV-R4-VIGIE decision-1 restent le cadre).

## Mesures (non composées)
- main `ff19b8a0` ; production `d3244d86` ; rail `d5e2d591`. Les preuves `refs-protegees` et `merge-base-production` sont celles injectées par l'outil.
- `main` est protégée ; rulesets actifs « Production — gate humaine NEXUS » et « main — intégrité de l'historique » (règles : pull_request, required_status_checks, non_fast_forward, deletion). La fusion exige donc une PR et des contrôles verts : ce n'est pas un push.

## Risques nommés
1. **Épreuves du rail lisant `main`** : cinq épreuves lisent `origin/main:.github/workflows/claude.yml` (ex. `test_designation_rail_20260930.js`). La PR ne touche pas `claude.yml` : leur lecture est inchangée. À reconfirmer par la CI de la PR.
2. **Contrôles requis sur `main`** : le workflow ajouté n'a pas son épreuve (`test_vigie_cloture_ci_20261020.js` reste sur le rail). À vérifier sur la PR qu'aucun contrôle requis ne rougit pour cause d'absence ; sinon la PR s'arrête et je le dis.
3. **Effet de bord de la première exécution** : dès la fusion, un run horaire réel. S'il existe une clôture conforme en attente, le run échoue avec annotation (comportement voulu). Il n'écrit rien et ne pousse rien.
4. **Arrêt** : désactiver « Vigie clôture » dans l'onglet Actions, ou retirer le fichier de `main`.
5. **Fusion** : geste humain sur branche protégée. Je ne fusionne pas, je n'active pas l'auto-merge.

## Séquence si GO
1. Je crée une branche courte depuis `origin/main`, y place le seul fichier, ouvre la PR (brouillon) et rapporte la CI.
2. Frédéric fusionne (ou refuse) ; je ne le fais pas.
3. Je constate la première exécution réelle (run `schedule`) et la rapporte à #28 comme preuve, sans nouvelle écriture.

## Demande
Autoriser l'ouverture de la PR décrite (un fichier, vers `main`) et dire si la fusion relève d'un motif humain nommé. Si l'arbitre voit un motif (`SECRET_PERMISSION_SURFACE_SECURITE`, `PRODUCTION_FUSION_DEPLOIEMENT_PROMOTION`), le nommer ; sinon, dire que la fusion reste à Frédéric par la protection de branche seule.
