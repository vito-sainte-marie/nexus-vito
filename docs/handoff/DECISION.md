<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/FDJ-CONTINUITE-QUANTITE-ABSENTE-20261011/decision-3.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: FDJ-CONTINUITE-QUANTITE-ABSENTE-20261011
seq: 3
author: Frédéric Bragance
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-3.md
wake_to: ChatGPT
---
## Provenance

Message de Frédéric dans la session Claude Code, le 12/10/2026 : « go 220000 », reconfirmé après le déploiement de #102 (main/production à `13a4e56`). Attribué à Frédéric, auteur direct du GO. Claude le matérialise et ne l'arbitre pas.

## Accordé (et rien d'autre)

- Migration Production **`20261011220000`** seule, gestes de la section 220000 de `docs/deploiement/procedure-fdj-continuite-quantite-absente-zero-production.md` :
  1. préflight en lecture seule, rejoué juste avant d'écrire (registre 309, version absente, trois aides absentes, six md5 attendus) ;
  2. application par le connecteur `execute_sql`, en une transaction gardée, avec la ligne de registre ;
  3. constat en lecture seule (neuf md5 identiques à Test, ACL, registre 310).
- Arrêt après le constat.

## Exécuté le 12/10/2026

- Préflight conforme, puis application en une transaction gardée (garde passée, aucune exception).
- Constat : registre 310, dernière version `20261011220000` ; neuf md5 = Test (`2f04e3d1…`, `65553ae6…`, `281c7ae3…`, `70d6a4ed…`, `7057bac5…`, `8a71c647…`, `ffaf90e1…`, `f893d77b…`, `cb054262…`) ; trois aides `service_role` seul ; six commandes `authenticated` + `service_role` ; `SECURITY DEFINER`, `search_path=""` ; quarts `a646dfd7` et `64138d8c` toujours en brouillon ; aucune ligne `confirmation_stock_final_zero` / `stock_final_zero_automatique` écrite.

## Non accordé

- Recette Production.
- Régularisation de `539e87bc`.
- Tout retour arrière.
- Aucun GO Production implicite.
