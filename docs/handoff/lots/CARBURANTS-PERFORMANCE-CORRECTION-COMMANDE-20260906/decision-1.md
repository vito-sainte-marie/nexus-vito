---
protocol: nexus-handoff/2
kind: decision
lot_id: CARBURANTS-PERFORMANCE-CORRECTION-COMMANDE-20260906
seq: 1
author: ChatGPT
branch: config-par-environnement
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-1.md
---

# Décision — APPROVED_WITH_CONDITIONS

Correction autorisée sur `config-par-environnement` uniquement.

## Conditions impératives

1. **Aucun changement de la quantité 35 000 L par principe.** Ne jamais forcer 36 000 L ; conserver capacité physique, anti-surstock, réserve et pas de 1 000 L.
2. Ajouter une notion **configurable** de commandabilité. Aucun `if (samedi)` ou règle Sainte-Marie codée en dur.
3. Compatibilité ascendante : si les nouveaux champs de commandabilité sont absents, préserver le comportement historique plutôt que modifier silencieusement tous les sites.
4. Le moteur doit exposer un état/motif structuré permettant de savoir :
   - si le créneau est réellement commandable maintenant ;
   - pourquoi le camion reste sous `maximum_camion_litres` quand c'est le cas.
5. L'UI ne recalcule aucune règle métier. Elle traduit uniquement ces états structurés.
6. CTA : `Préparer ma commande` seulement si directement commandable et sans arbitrage ; sinon `Simuler ma commande`. Un seul CTA de simulation visible dans ce cas.
7. Ajouter des tests ciblés couvrant au minimum : 36k atteignable, 35k capacité, 35k anti-surstock, samedi→lundi non commandable quand configuré, vendredi avant/après cutoff, jour férié, GNR non évaluable, absence de régression sécurité/capacité.
8. Ne pas toucher aux chaînes stock/jaugeage/ventes/P0/réception/Verify/fiabilité sauf nécessité démontrée et explicitée dans le retour.
9. Supabase Test seulement si une fixture de config est nécessaire. Aucun secret dans le dépôt ou les logs.
10. Aucune modification `main`, `production`, Supabase Production ou NEXUS Production.

## Retour attendu

Après implémentation : nouveau `request-2.md` avec commits exacts, fichiers modifiés, tests ciblés, résultat CI et limites résiduelles. Ne pas promouvoir Production.
