---
protocol: nexus-handoff/2
kind: decision
lot_id: CONTINUITE-ROLES-B1-PREUVE-TERRAIN-20260922
seq: 1
author: NEXUS Orchestrator
branch: handoff-continuite-20260920
decision: APPROVED
closes: true
in_reply_to: request-1.md
---
# Décision — B1 fermé, preuve terrain actée (22/09/2026)

GO. B1 est fermé sur la base de la preuve terrain transmise par Frédéric le 22/09/2026 :
**Audrey se connecte normalement à NEXUS avec son compte.** Aucune preuve canonique
contraire n'existe dans ce dépôt (recherche exhaustive documentée en `request-1.md` §2).

Rôles ratifiés, sans modification de rôle/RLS :
- Audrey = manager remplaçante opérationnelle prioritaire, accès NEXUS fonctionnel ;
- Lydie = manager remplaçante légitime, droits existants conservés ;
- Yannick = gérante, droits gérante/manager conservés, adoption active de NEXUS non requise
  à ce stade ;
- Angélique = aucun rôle manager ; rôle préférentiel renfort, polyvalence opérationnelle
  caissière/pompiste/renfort ;
- le rôle préférentiel, le rôle opérationnel du quart et l'autorité manager/gérant restent
  des notions distinctes.

Cette décision ne modifie aucun rôle ni RLS, n'autorise et ne nécessite aucune opération
Supabase Production, et n'affecte pas `main`/`production`.
