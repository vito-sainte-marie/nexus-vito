---
protocol: nexus-handoff/2
kind: request
lot_id: CARBURANTS-PERFORMANCE-CORRECTION-COMMANDE-20260906
seq: 1
author: ChatGPT
branch: config-par-environnement
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: audit
    classe: VERIFIED
    valeur: CARBURANTS-PERFORMANCE-AUDIT-COMMANDE-20260906 audit-1.md + decision-1.md
  - id: terrain
    classe: HUMAN
    valeur: Sainte-Marie : samedi vers lundi non commandable ; si recommandation doit être arbitrée, action principale souhaitée = Simuler ma commande
---

# Demande — Correction minimale de la recommandation de commande

## Autorisation issue de l'audit
Corriger uniquement les défauts confirmés, sans refactoriser Carburants Performance.

## Exigences
1. Distinguer dans le moteur `jour de livraison autorisé` et `créneau encore commandable`.
2. Modéliser la commandabilité par configuration multi-site, sans `if (samedi)` en dur.
3. Conserver le comportement historique lorsqu'aucune nouvelle règle de commandabilité n'est configurée, afin de ne pas casser les autres sites.
4. Pour Sainte-Marie/Test, prouver qu'un samedi ne propose plus le lundi comme commande directement préparée.
5. Préserver le calcul 35 000 L si c'est le maximum sûr ; ne jamais forcer 36 000 L.
6. Exposer depuis le moteur un motif structuré lorsqu'un camion ne peut pas être complété jusqu'au maximum configuré.
7. CTA : `Préparer ma commande` uniquement si le créneau est réellement commandable et si aucun arbitrage quantité/calendrier ne demeure ; sinon `Simuler ma commande`.
8. Supprimer/recontextualiser le second CTA de simulation lorsqu'il fait doublon.
9. Ajouter des tests couvrant la matrice de `../CARBURANTS-PERFORMANCE-AUDIT-COMMANDE-20260906/audit-1.md`.
10. Aucune modification des chaînes stock/jaugeage/ventes/réserve/P0/réception/fiabilité sauf preuve de défaut.

## Rail
- `config-par-environnement` uniquement.
- Supabase Test uniquement si un paramètre de fixture est nécessaire.
- Interdit : `main`, `production`, Supabase Production, NEXUS Production.
- Aucun réveil Claude nécessaire tant que la correction reste localisée et prouvable par ChatGPT/CI.
