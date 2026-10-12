---
protocol: nexus-handoff/2
kind: decision
lot_id: FDJ-CONTINUITE-QUANTITE-ABSENTE-20261011
seq: 2
author: Frédéric Bragance
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-2.md
wake_to: ChatGPT
---
## Provenance

Message de Frédéric dans la session Claude Code, le 12/10/2026 : « go 1 » puis « option 1 », en réponse à ma proposition d'un accord limité à la seule migration Production `20261011200000`. Attribué à Frédéric, auteur direct du GO. Claude le matérialise et ne l'arbitre pas.

## Accordé (et rien d'autre)

- Migration Production **`20261011200000`** seule, gestes 1 à 3 de `docs/deploiement/procedure-fdj-continuite-quantite-absente-zero-production.md` :
  1. préflight en lecture seule, rejoué juste avant d'écrire (registre 308, version absente, deux fonctions absentes, cinq md5 et ACL attendus) ;
  2. application par le connecteur `execute_sql`, en une transaction gardée, avec la ligne de registre ;
  3. constat en lecture seule (sept md5, ACL, registre 309).
- Si une valeur du préflight diffère : arrêt, rien n'est écrit.
- Arrêt après le constat.

## Non accordé

- Fusion de #102 et déploiement GitHub Pages.
- Migration `20261011220000`.
- Recette Production.
- Régularisation de `539e87bc`.
- Tout retour arrière. Aucun GO Production implicite.
