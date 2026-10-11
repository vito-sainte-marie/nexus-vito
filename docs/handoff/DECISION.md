<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/FDJ-CONTINUITE-QUANTITE-ABSENTE-20261011/decision-1.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: FDJ-CONTINUITE-QUANTITE-ABSENTE-20261011
seq: 1
author: Frédéric Bragance
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-1.md
wake_to: ChatGPT
---
## Provenance

Texte collé par Frédéric dans la session Claude Code le 11/10/2026, sans autre message. Il répond aux « Points soumis à l'arbitre » de `request-1.md`. Sa rédaction est peut-être celle de l'arbitre ChatGPT, mais aucun contrat `NEXT_ACTION_CONTRACT` ne l'accompagne et je n'ai aucun moyen de le vérifier. Il est donc attribué à Frédéric, qui l'a transmis. Claude le matérialise sans rien en retrancher, mais **ne l'arbitre pas**.

## Portée (lecture de Claude, à corriger par l'arbitre si elle est fausse)

- **Accordé** : implémenter et éprouver la nouvelle règle **en développement et sur Test**, sur la branche de #102.
- **Non accordé** : les GO 2 à 6 de `request-1.md` (migration Production, fusion de #102, déploiement GitHub Pages, recette Production, régularisation de `539e87bc`). Le texte se termine par « Aucun GO Production implicite. » Une `request-2` présentera le nouvel état et redemandera chaque GO séparément.
- La règle `inconnu` de `20261011200000`, qui laisse le début NULL et lève l'alerte `continuite_stock_a_verifier`, ne s'applique plus qu'aux fins NULL **historiques** avec stock restant. Une telle fin est une « incohérence réelle qui subsiste » (règle 10). Après cette étape, aucune nouvelle fin NULL ne peut être validée.

## Texte de l'arbitrage (verbatim)

NEXUS FDJ — Nouvel arbitrage métier : confirmation des stocks finaux avant clôture

Cette décision remplace la proposition précédente consistant à générer systématiquement une anomalie manager pour une fin de stock vide.

Objectif : résoudre les omissions de saisie au moment de la validation du quart FDJ, sans intervention manager ultérieure.

Règles :

1. Si stock disponible = 0 et stock final vide, enregistrer automatiquement un stock final explicite de 0.
2. Si stock disponible > 0 et stock final vide, afficher avant validation une confirmation : « Le stock final de [JEU] est-il bien de 0 ticket, ou avez-vous oublié de le renseigner ? »
3. Proposer deux choix :
   * « Confirmer 0 » : enregistrer explicitement 0 et tracer la confirmation.
   * « Corriger la saisie » : revenir au jeu concerné sans clôturer le quart.
4. Si plusieurs jeux sont concernés, afficher une fenêtre unique avec tous les jeux et une décision explicite pour chacun. Aucun choix ne doit être présélectionné.
5. La validation finale doit être impossible tant qu'une quantité finale demeure indéterminée.
6. Appliquer les mêmes règles aux validations employé et manager, ainsi qu'aux régularisations autorisées.
7. Après validation, la continuité Q1 → Q2 doit reprendre les stocks finaux explicites, sans créer de nouvelles fins NULL.
8. Préserver l'historique, les droits, les certifications et les protections A6.
9. Tester les cas stock nul, stock positif, un ou plusieurs champs vides, confirmation 0, retour à la saisie et ouverture du quart suivant.
10. Conserver un signalement manager uniquement pour les incohérences réelles qui subsistent après cette étape.

Implémenter et tester sur branche de travail via le Handoff canonique. Aucun GO Production implicite.
