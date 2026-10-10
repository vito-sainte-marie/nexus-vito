---
protocol: nexus-handoff/2
kind: request
lot_id: BOUCLE-AUTONOME-ESSAI-1-20261010
seq: 1
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: LEAN
wake_to: ChatGPT
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=7184bfa production=b17ac7a
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 140-fichiers
---
## Objet

Premier essai réel de la boucle autonome, armée par Frédéric le 10/10/2026 à 13:36:12Z (`vars.NEXUS_BOUCLE_AUTONOME = arme`), après la fusion de la PR #90 (`main` 7184bfa). Le GO de cet essai a été donné par Frédéric dans la session Claude du 10/10 : « GO pousse une demande de test sur le rail ».

La demande ne porte aucun changement de code. Elle vérifie une seule chose : une décision déposée par la CI réveille-t-elle Claude, sans humain, par `repository_dispatch` ?

## Ce qui est demandé à l'arbitre

Un verdict qui **autorise un tour de boucle**. Le juge `outils/relancer-claude-ci.js` ne relance Claude que si **tous** les champs ci-dessous valent exactement ce qui est indiqué. Une autre valeur est légitime si l'arbitre la juge nécessaire, mais le tour ne partira pas, et l'essai le constatera.

| Champ | Valeur attendue pour que le tour parte | Raison |
|---|---|---|
| `DECISION` | `APPROVED` | `BLOCKED` arrête tout |
| `CLOSES` | `false` | `true` donne `RIEN_A_FAIRE` |
| `STOP_REQUIRED` | `non` | tout STOP arrête |
| `OWNER_NEXT` | `Claude` | `Frédéric` arrête (palier humain) |
| `EXECUTANT_NEXT` | `github-actions-claude` | identifiant du **canal** au registre `CAPACITES-CANAL.json`, et non le rôle « Claude ». Toute autre valeur donne `CANAL_INCAPABLE` |
| `CAPACITE_REQUISE` | `aucune` | ou une capacité que ce canal détient (`DEPOT_ECRITURE_RAIL`) |
| `CONDITIONS` | `aucune` | sinon la demande suivante doit porter une section de preuve |

## Action proposée pour l'exécutant suivant (le tour de boucle)

Bornée, sans risque, vérifiable :

1. Consommer la décision par `node outils/handoff.js consommer BOUCLE-AUTONOME-ESSAI-1-20261010`.
2. Déposer `request-2.md` sur ce lot, qui constate le tour : identifiant du run `claude.yml` déclenché par `repository_dispatch`, SHA consommé, commit poussé. Elle propose la **clôture** du lot.
3. Pousser **uniquement** sur le rail `handoff-continuite-20260920`.

Aucune modification de code, de workflow, de `main`, de `production` ni de Supabase.

L'essai se termine au tour suivant. Une décision `CLOSES: true` sur request-2 donne `RIEN_A_FAIRE`. Le lot consomme au plus 2 des 3 tours autorisés.

## Garde-fous en place (rappel, decision-1 de BOUCLE-AUTONOME-FAST-TRACK-PREPARATION-1-20261010)

- Plafonds : 3 tours par lot, 10 par jour.
- Charge utile validée à la réception, prompt fixe, aucune permission ajoutée.
- Aucun `MANDAT_BOUCLE`.
- L'interrupteur se coupe en supprimant la variable.

## Guardians

- **Architecture** : aucun changement.
- **Security & Isolation** : le tour ne touche que le rail.
- **Business Rules** : sans objet.
- **QA/Regression** : la preuve attendue est un run `claude.yml` d'événement `repository_dispatch`, puis une `request-2` poussée par ce run.
- **Bible/Philosophie** : on prouve la boucle par un tour réel, pas par une affirmation.
