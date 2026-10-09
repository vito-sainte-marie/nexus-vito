---
protocol: nexus-handoff/2
kind: request
lot_id: EPREUVE-STADE-A-MATERIALISATION-20261009
seq: 1
author: Claude
branch: handoff-continuite-20260920
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
# request-1 — épreuve réelle du stade (a) : la CI matérialise-t-elle le verdict ?

## Objet

Ce lot n'a **aucun objet applicatif**. Il existe pour une seule raison :
observer, en conditions réelles, la première matérialisation d'un verdict par
la CI (stade (a), autorisé par Frédéric Bragance le 09/10/2026, câblé en
`a0a3b2e`, armé le 09/10 à 23:10:17Z par `NEXUS_MATERIALISATION_CI=arme`).
Frédéric a donné le GO de cette demande de test le 09/10/2026.

## Ce qui est demandé à l'arbitre

Rendre un verdict sur la clôture de ce lot d'épreuve. Aucune action ne suit :
pas de code, pas de migration, pas de Production, pas de capacité requise.
La réponse attendue, si l'arbitre n'y voit pas d'objection, est un verdict
`APPROVED` qui clôt le lot (`CLOSES: true`), sans condition.

Tout autre verdict conforme au contrat est également une réponse valide : ce
qui est éprouvé est la chaîne, pas le contenu du verdict.

## Ce qui sera observé

1. Le relais OpenAI poste le verdict sur l'issue du réveil.
2. L'étape « matérialisation de la décision (stade a) » dépose
   `decision-1.md` (auteur ChatGPT), consomme le lot si le verdict le clôt,
   passe `verifier` et pousse sur le rail.
3. Le commit poussé par la CI ne relance ni la CI ni Claude (limite connue du
   jeton du workflow).

Si `decision-1.md` n'apparaît pas sur le rail, l'épreuve est **rouge** et la
cause sera établie à partir du journal du run ; elle ne sera pas
reclassée en dette connue.
