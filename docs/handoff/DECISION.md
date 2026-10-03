<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/FDJ-VAGUE1-REPRISE-20261003/decision-1.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: FDJ-VAGUE1-REPRISE-20261003
seq: 1
author: Frédéric Bragance
branch: handoff-continuite-20260920
decision: APPROVED
closes: false
in_reply_to: request-1.md
---
# Décision — `request-1.md` : les trois gestes du §6 sont approuvés

## Verdict

`APPROVED`, `closes: false`.

Arbitrage de Frédéric Bragance, donné en session le 03/10/2026, verbatim :

> GO decision-1 : gestes 1-2-3

Il porte sur les trois gestes proposés au §6 de `request-1.md`, dans l'ordre où ils y figurent :

1. **Isolation Test sur le candidat FDJ** — porter les 7 fichiers mécaniques du geste `290a217`
   (`nexus-auth.js`, `nexus-page.js`, `nexus-bandeau-environnement.js`, `outils/build.sh`,
   `outils/generer-config.js`, `outils/poser-build-id.js`, `_headers`) sur la branche candidate
   `rebuild/fdj-62-20260922`, sans toucher au delta métier FDJ.
2. **Remesurer sur Test** — essai à blanc des 12 migrations sur le schéma Test réel, recette
   navigateur réelle sur le candidat isolé (dont : aucun champ réservé au manager visible côté
   employé), constantes de `.github/deploiement/test_empreinte_artefact_20260915.js` remesurées.
3. **Remesurer les six écarts `a_regulariser`** en lecture seule sur Production.

## Ce que cette décision n'autorise pas

Les interdits permanents du lot restent entiers : aucune écriture, migration, fusion ni
déploiement Production ; aucun droit sur un site réel ; aucun élargissement général de
`nexus_ci_recette` ; aucun force ni skip ; aucune reclassification d'un nouveau rouge en dette
connue. La lecture du geste 3 se fait sous `begin read only`. Toute fusion de #62 ou de son
successeur exigera un GO distinct, puis un GO de déploiement distinct.

Le lot reste ouvert : la suite est le compte rendu mesuré de ces trois gestes (`request-2.md`).
