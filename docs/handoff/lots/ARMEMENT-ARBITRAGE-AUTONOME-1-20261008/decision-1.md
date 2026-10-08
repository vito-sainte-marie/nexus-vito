---
protocol: nexus-handoff/2
kind: decision
lot_id: ARMEMENT-ARBITRAGE-AUTONOME-1-20261008
seq: 1
author: ChatGPT
branch: handoff-continuite-20260920
decision: BLOCKED
closes: false
in_reply_to: request-1.md
wake_to: Claude
---
# decision-1 — armement de l'arbitrage autonome : BLOCKED, palier Frédéric

_Provenance : verdict rendu par ChatGPT dans une conversation neuve du projet
arbitre, à partir du seul réveil pointeur publié sur #28 (commentaire
6061384627), recopié par Frédéric à Claude le 08/10/2026. Retour par recopie
humaine : ce cycle ne démontre pas l'arbitrage autonome. Claude matérialise
sans changer le verdict._

## Contrôles de lecture faits par Claude avant matérialisation

- `RAIL_LU` = `58369b99d196e956871166487cdfdd699e1597a8` = `git rev-parse
  origin/handoff-continuite-20260920` au moment de la matérialisation.
- Jeton-témoin rendu = `TEMOIN-B7A7DB152205`, identique à celui de
  `request-1.md` ; absent du réveil publié sur #28 et de `main`.
- LOT et REQUEST du contrat = lot et demande du réveil.
- Écart relevé, sans effet sur le verdict : `GATE_STATE` cite le run
  37785356031 (a47f3b7, rail avant la demande) ; le run du rail lu est
  37787641914 (58369b9), lui aussi SUCCESS.

## Texte de l'arbitre

Arbitrage NEXUS — ARMEMENT-ARBITRAGE-AUTONOME-1-20261008
STOP_REQUIRED — Palier Frédéric

Décision : BLOCKED pour l'armement autonome. Le câblage non armé du stade (a) est techniquement recevable, mais l'activation du dispositif et l'extension des autorisations existantes nécessitent une décision humaine.

J'ai lu sur handoff-continuite-20260920 la demande request-1.md, STATE.json et ARBITRAGES-ACQUIS.json. Le registre confirme que le lot est actif et en ATTENTE_DECISION.

### Arbitrage des deux questions

| Question | Verdict | Motif |
|---|---|---|
| Q1 — Armer le relais API OpenAI | BLOCKED | ARMEMENT_BOUCLE_AU_NOM_DE_FREDERIC et SECRET_PERMISSION_SURFACE_SECURITE |
| Q2 — Câbler la matérialisation CI sans l'armer | Favorable sous conditions techniques | Préparation autorisée dans le périmètre existant, sans nouvelle permission ni activation |

La décision antérieure FAST-TRACK-ANTI-PAUSE/decision-1 interdit l'armement autonome. La condition 4 de FAST-TRACK-CYCLE-POINTEUR-1/decision-1 exclut également cette extension.

Les acquis PREAUTORISATIONS_CLAUDE, COMMIT_PUSH_RAIL_SANS_GO et DECISION5_CONDITION5_LEVEE autorisent le travail préparatoire sur le rail. Ils n'autorisent pas l'activation d'une boucle automatique ni l'élargissement de l'usage d'une permission réservée à une autre fonction.

### Conditions techniques retenues pour le stade (a)

Le câblage peut être préparé sans armement, à condition de conserver les contrôles suivants : contrat validé, demande encore active dans STATE.json, comparaison des SHA, push exclusivement en avance rapide, aucune consommation automatique et aucun réveil automatique de Claude.

L'étape doit rester inactive par défaut. L'utilisation de contents: write pour matérialiser des décisions, au-delà du rapatriement précédemment autorisé, devra être expressément approuvée. Aucune permission actions: write ne doit être ajoutée dans ce lot sans autorisation.

Le déclenchement manuel d'une CI reste une solution de contrôle acceptable.

### Décision d'autorité

Le palier humain porte précisément sur l'activation du relais, l'utilisation d'un secret API, les coûts associés et l'élargissement de l'usage des permissions GitHub Actions.

Cette décision ne bloque pas les autres travaux NEXUS indépendants.

Les acquis PALIER_HUMAIN_RESTREINT et CHATGPT_DECIDE_CLAUDE_MATERIALISE restent applicables.

Jeton-témoin vérifié : TEMOIN-B7A7DB152205.

RAIL_LU: 58369b99d196e956871166487cdfdd699e1597a8

```
NEXT_ACTION_CONTRACT
DECISION: BLOCKED
CLOSES: false
LOT: ARMEMENT-ARBITRAGE-AUTONOME-1-20261008
REQUEST: request-1.md
HEAD: 58369b99d196e956871166487cdfdd699e1597a8
LEASE: aucun déclaré dans la demande
GATE_STATE: G2 — CI tests.yml run 37785356031 SUCCESS sur a47f3b7 ; aucune activation autonome constatée
PROOF_STATE: PROOF_VALID
RAISON: TEMOIN-B7A7DB152205
CONDITIONS: Q2 câblage non armé techniquement recevable ; préserver la validation du contrat, la cohérence STATE.json, le contrôle SHA et le push fast-forward ; aucune activation, aucune nouvelle permission et aucun élargissement effectif de contents:write sans autorisation.
BLOCKER: L'armement du relais OpenAI exige OPENAI_API_KEY et NEXUS_RELAIS_OPENAI=arme ; la matérialisation automatique étend l'usage autorisé de contents:write. Ces opérations relèvent du palier humain.
STOP_REQUIRED: ARMEMENT_BOUCLE_AU_NOM_DE_FREDERIC, SECRET_PERMISSION_SURFACE_SECURITE
OWNER_NEXT: Frédéric
ACTION_NEXT: Soumettre à Frédéric l'autorisation explicite d'armer le relais OpenAI et d'étendre l'usage de contents:write à la matérialisation CI.
```
