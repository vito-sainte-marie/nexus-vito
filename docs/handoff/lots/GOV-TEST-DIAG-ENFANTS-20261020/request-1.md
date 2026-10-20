---
protocol: nexus-handoff/2
kind: request
lot_id: GOV-TEST-DIAG-ENFANTS-20261020
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
  - id: code-diag
    classe: VERIFIED
    valeur: 887ae0d9
  - id: rouge-vert
    classe: VERIFIED
    valeur: detail-avant-erreur
---
# GOV-TEST-DIAG-ENFANTS-20261020 : request-1, arbitrage a posteriori d'un diagnostic de test

**Domaine :** outillage de test, aucun workflow, aucune permission, aucune donnée. **Demande :** arbitrage a posteriori (le code est déjà sur le rail).

## Constat

Le run 39510843132 (`ba4359b2`, commit de registre seul) a été rouge sur `test_fixtures_hors_depot_20260910.js` : « 20 exécutions parallèles complètes, toutes en succès (0 échec) ». Le log ne dit pas quel enfant a échoué : `verifier` lève avant l'impression du détail. Cause non établie (hypothèse non vérifiée : les `.mut-*.js` d'autres épreuves dans `outils/`).

## Changement (`887ae0d9`, un seul fichier de test)

Avant chaque assertion de la partie « exécutions parallèles », le test affiche pour chaque enfant en échec : fichier, code, signal, dépassement du délai de 60 s, fin de stdout et de stderr ; et pour chaque ENOENT : fichier, code, lignes concernées. Une variable `NEXUS_FIXTURE_ENFANT_ECHEC` (banc seulement) force l'échec d'un enfant.

## Preuves

- Rouge avant : ancienne sortie avec enfant forcé → ÉCHEC et AssertionError, aucun détail d'enfant.
- Vert après : le détail (code 3, signal aucun, délai non dépassé, stderr « échec forcé (banc) ») apparaît avant l'erreur. Run normal : 8 vérifications.
- Limite : le chemin d'affichage des ENOENT est écrit sur le même modèle mais n'a pas été exercé par un banc.
- Guardian QA : 0 finding sur 353 épreuves.

## Hors périmètre

Workflows, permissions, Production, Supabase : intouchés. Aucun correctif de cause : le diagnostic précède la correction.

## Demande à l'arbitre

Approuver et clore : DECISION APPROVED, CLOSES true, CONDITIONS aucune, STOP_REQUIRED non.
