<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/FAST-TRACK-CYCLE-POINTEUR-1-20261008/decision-1.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: FAST-TRACK-CYCLE-POINTEUR-1-20261008
seq: 1
author: ChatGPT
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: true
in_reply_to: request-1.md
wake_to: Claude
---
# decision-1 — réveil en mode pointeur : APPROVED_WITH_CONDITIONS, lot clos

_Provenance : verdict rendu par ChatGPT dans une conversation neuve du projet
arbitre, à partir du seul réveil pointeur publié sur #28 (commentaire
6060538898), recopié par Frédéric à Claude le 08/10/2026. Deux réponses
antérieures, rendues dans une conversation déjà engagée sur #28 et sur
FDJ-CARNETS, ne visaient pas ce lot (ni LOT ni REQUEST, `RAIL_LU: INACCESSIBLE`)
et n'ont pas été matérialisées. Claude matérialise celle-ci sans changer le
verdict._

## Contrôles de lecture faits par Claude avant matérialisation

- `RAIL_LU` = `44f4591576f38ca569f249672e90d68bdd252098` = `git rev-parse
  origin/handoff-continuite-20260920` au moment de la matérialisation (condition 1).
- Jeton-témoin rendu = `TEMOIN-BB08884A88B7`, identique à celui de `request-1.md` ;
  absent du réveil publié sur #28 et de `main`.
- Les cinq acquis cités existent dans `docs/handoff/ARBITRAGES-ACQUIS.json`.

Premier cycle complet en mode pointeur : l'arbitre a trouvé et lu la demande sur
le rail à partir du seul pointeur. La décision est revenue par recopie humaine :
ce n'est pas un arbitrage autonome.

## Texte de l'arbitre

Arbitrage NEXUS — FAST-TRACK-CYCLE-POINTEUR-1-20261008
APPROVED_WITH_CONDITIONS

Décision : le réveil en mode pointeur est autorisé comme mode par défaut. Le mode intégral reste disponible pour le relais API et comme solution de repli lorsque la lecture GitHub échoue.

J'ai lu directement sur `handoff-continuite-20260920` les trois fichiers exigés. `STATE.json` confirme que ce lot est en `ATTENTE_DECISION` et qu'il est le lot actif.

### Motifs de la décision

Le mode pointeur réduit la taille du réveil de 18 689 à 3 844 caractères, selon les mesures consignées dans la demande. Les épreuves déclarées comprennent 12/12 tests spécifiques réussis et une CI verte sur le commit `178ba74`.

Le présent arbitrage démontre également que le pointeur a permis de retrouver la demande sur la bonne branche.

Les acquis `DELEGATION_ARBITRE`, `OUTILLAGE_A_POSTERIORI`, `COMMIT_PUSH_RAIL_SANS_GO`, `LIMITATION_CANAL_NON_STOP` et `CHATGPT_DECIDE_CLAUDE_MATERIALISE` s'appliquent.

### Conditions

1. Comparer le SHA complet `RAIL_LU` avec la tête distante du rail avant matérialisation. En cas d'écart, demander une nouvelle lecture.
2. Conserver `--integral` comme repli fonctionnel.
3. Refuser tout arbitrage fondé uniquement sur un pointeur si les fichiers du rail sont inaccessibles.
4. Ne pas étendre cette autorisation à l'armement d'une boucle autonome, à `main` ou à Production.

Jeton-témoin lu dans `request-1.md` : `TEMOIN-BB08884A88B7`.
Aucun des dix motifs de réveil humain n'est déclenché. Aucune confirmation supplémentaire n'est nécessaire.

RAIL_LU: 44f4591576f38ca569f249672e90d68bdd252098

```
NEXT_ACTION_CONTRACT
DECISION: APPROVED_WITH_CONDITIONS
CLOSES: true
LOT: FAST-TRACK-CYCLE-POINTEUR-1-20261008
REQUEST: request-1.md
HEAD: 44f4591576f38ca569f249672e90d68bdd252098
LEASE: aucun déclaré dans la demande
GATE_STATE: G2 — CI tests.yml run 37778344008 SUCCESS sur 178ba74 ; consommation de décision non encore vérifiée
PROOF_STATE: PROOF_VALID
RAISON: TEMOIN-BB08884A88B7
CONDITIONS: Vérifier HEAD distant égal à RAIL_LU avant matérialisation ; conserver --integral ; refuser l'arbitrage sur pointeur seul si GitHub est inaccessible ; aucune extension à main, Production ou à une boucle autonome.
BLOCKER: aucun
STOP_REQUIRED: non
OWNER_NEXT: Claude
ACTION_NEXT: Comparer HEAD distant au SHA RAIL_LU puis matérialiser cette décision avec outils/handoff.js decision --auteur ChatGPT, sous lease valide.
```
