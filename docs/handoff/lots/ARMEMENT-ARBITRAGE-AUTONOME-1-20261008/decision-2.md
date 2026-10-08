---
protocol: nexus-handoff/2
kind: decision
lot_id: ARMEMENT-ARBITRAGE-AUTONOME-1-20261008
seq: 2
author: Frédéric Bragance
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-1.md
---
# decision-2 — Frédéric arme le relais (Q1) ; Q2 non autorisée

_Provenance : décision humaine de Frédéric, palier désigné par decision-1
(BLOCKED, `ARMEMENT_BOUCLE_AU_NOM_DE_FREDERIC`,
`SECRET_PERMISSION_SURFACE_SECURITE`, OWNER_NEXT Frédéric). Dite à Claude le
08/10/2026 : « aide moi a armer le relais », puis « c'est fait, vérifie ».
Claude matérialise ; il n'a ni créé ni lu le secret._

## Décision

- **Q1 — armer le relais (stade b) : APPROUVÉE et exécutée par Frédéric.**
  Frédéric a posé lui-même, le 08/10/2026 :
  - le secret `OPENAI_API_KEY` (14:20:45Z) ;
  - la variable `NEXUS_RELAIS_MODELE=gpt-5.6-sol` (14:21:03Z) ;
  - la variable `NEXUS_RELAIS_OPENAI=arme` (14:21:17Z).
  Il accepte le coût de l'API (un appel par corps de réveil distinct), borné
  par une limite de dépense fixée côté OpenAI.
- **Q2 — usage de `contents: write` pour la matérialisation CI (stade a) :
  non autorisée à ce jour.** Rien n'est écrit. `actions: write` non accordée.

## Contrôles faits par Claude (noms seulement, aucune valeur lue)

- `gh secret list` : `OPENAI_API_KEY` présent.
- `gh variable list` : `NEXUS_RELAIS_OPENAI=arme`, `NEXUS_RELAIS_MODELE=gpt-5.6-sol`.
- Choix du modèle : la page des abandons d'OpenAI annonce le retrait de
  l'instantané `gpt-5-2025-08-07` le 11/12/2026, remplacement recommandé
  `gpt-5.6-sol`. Le défaut `gpt-5` du script est donc surchargé.
- Rail 7b8b5a1 : `reveil-orchestrateur.js` rend `RIEN_A_FAIRE`. Aucun appel
  ne part tant qu'aucune nouvelle demande n'est poussée.

## Ce qui reste vrai

- Le relais poste la réponse sur #28 ; il ne dépose aucune décision et ne
  réveille pas Claude. Claude contrôle puis matérialise chaque contrat.
- Désarmement : `NEXUS_RELAIS_OPENAI` à toute autre valeur que `arme`.
- L'arbitrage autonome n'est **pas encore démontré** : il le sera au premier
  réveil dont la réponse arrive sur #28 sans recopie humaine.

## Suite

Lot laissé ouvert (`closes: false`) : le premier essai réel du relais armé,
et la réponse de Frédéric sur Q2, restent à venir.
