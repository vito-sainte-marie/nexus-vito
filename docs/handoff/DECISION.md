<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/HANDOFF-V2-EVENEMENTIEL-20260905/decision-2.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: HANDOFF-V2-EVENEMENTIEL-20260905
seq: 2
author: ChatGPT
branch: config-par-environnement
decision: APPROVED
closes: true
in_reply_to: docs/handoff/lots/HANDOFF-V2-EVENEMENTIEL-20260905/request-1.md
---

# Décision — NEXUS Handoff v2

## Arbitrage

L'implémentation Handoff v2 est approuvée et le lot est clos.

Les éléments fournis établissent le socle attendu : registre append-only, enveloppe à vocabulaire fermé, séparation `decision` / `closes`, compatibilité legacy sans reconstruction du passé, `STATE.json`, miroirs v1, validation CI, épreuves mutationnelles, provenance explicite des preuves et couche session dont la limite est documentée.

Aucun comportement métier NEXUS n'est autorisé à changer par cette décision. `main` et `production` restent protégées. Le bloqueur 1 reste ouvert.

## Q14 — fin du lot d'observation

Décision : le résultat de suite recalculé par la CI devient **bloquant** à partir du prochain lot v2.

Règle : lorsqu'une preuve est classée `VERIFIED` et qu'un contrôleur indépendant existe effectivement dans la CI, une divergence entre la valeur déclarée/enregistrée et la valeur recalculée doit faire échouer le handoff. Une preuve `VERIFIED` ne peut pas être seulement décorative.

Pour l'instant :
- refs protégées : bloquant ;
- résultat de suite : devient bloquant ;
- commit déployé : reste `DECLARED` tant qu'aucun contrôleur indépendant ne le constate ;
- état Supabase : reste `DECLARED` tant qu'aucun contrôleur indépendant ne le constate ;
- rejeu navigateur/PIN : reste `HUMAN`.

Ne jamais promouvoir artificiellement une preuve `DECLARED` en `VERIFIED` pour satisfaire la gate.

## Q15 — veille continue

Décision : **non dans ce lot**.

`veiller` reste une primitive de reprise pour une session vivante. Ne pas créer de boucle permanente, démon, polling autonome ou faux mécanisme de réveil. La capacité de réveiller/orchestrer des agents hors session appartient au futur **NEXUS Orchestrator** et sera conçue dans l'organisation d'agents IA.

## Règles pour la suite

1. Conserver v1 comme mode de secours.
2. Le registre v2 est la source canonique ; les miroirs ne doivent pas devenir une seconde source de vérité.
3. Toute preuve réellement recalculable doit progressivement devenir `VERIFIED` et bloquante, après une observation explicite si nécessaire.
4. Le mode LEAN/STANDARD/DEEP règle la profondeur de raisonnement, jamais la qualité des preuves.
5. Ne pas élargir Handoff v2 à l'organisation multi-agents dans ce lot.
6. Ne pas toucher `main` ou `production`.
7. Cette décision n'est pas une autorisation de production.

## Prochaine gate technique

Revenir au **bloqueur 1** et exécuter le rejeu navigateur réel déjà défini sous Employé Test A (ou compte test équivalent vierge), sans masquer un échec par une correction manuelle en base.

L'organisation d'agents IA NEXUS peut être conçue comme lot distinct au-dessus de Handoff v2 ; elle ne doit pas retarder ni affaiblir la fermeture des bloqueurs de recette.
