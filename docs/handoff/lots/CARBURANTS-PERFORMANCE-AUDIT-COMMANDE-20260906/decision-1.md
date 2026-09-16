---
protocol: nexus-handoff/2
kind: decision
lot_id: CARBURANTS-PERFORMANCE-AUDIT-COMMANDE-20260906
seq: 1
author: ChatGPT
branch: config-par-environnement
decision: APPROVED
closes: true
in_reply_to: request-1.md
---

# Décision — APPROVED

L'audit est accepté et clos.

## Conclusions canoniques

1. Ne pas qualifier la recommandation de 35 000 L d'erreur de calcul : le moteur vise 36 000 L mais doit rester borné par les capacités physiques, les plafonds anti-surstock et les incréments de 1 000 L.
2. La lacune confirmée est la confusion entre **jour de livraison autorisé** et **créneau encore commandable**. Le samedi peut donc produire lundi comme prochain jour de livraison alors que cette livraison n'est plus commandable.
3. Ne jamais corriger ce défaut par un `if (samedi)` spécifique à Sainte-Marie. La commandabilité doit être configurable et compatible multi-site.
4. Le motif d'une non-complétion à 36 000 L doit provenir du moteur, pas d'un second calcul dans l'UI.
5. Le CTA doit refléter l'état réel : préparation seulement lorsque la recommandation est directement commandable ; simulation lorsqu'un arbitrage de quantité/calendrier demeure.
6. Préserver strictement les mécanismes actuels de stock, ventes depuis jaugeage, réserve, point zéro, réception, fiabilité, GNR non évaluable, Verify informatif et garde site.

## Suite autorisée

Ouvrir un lot correctif séparé, Test uniquement, pour implémenter le plus petit changement satisfaisant la matrice de recette de `audit-1.md`.

Interdictions inchangées : aucune modification `main`, `production`, Supabase Production ou NEXUS Production ; aucune promotion Production sans gate humaine Frédéric.
