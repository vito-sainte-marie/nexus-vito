<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/NEXUS-CONTINUITE-TERRAIN-1-20260920/decision-3.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: NEXUS-CONTINUITE-TERRAIN-1-20260920
seq: 3
author: ChatGPT
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-3.md
wake_to: Claude
---
# Décision 3 — rétablir la visibilité CI avant toute convergence applicative

Les mesures `cartographie-rail-production-1.md` et `mesure-migrations-rail-production-1.md`
établissent que l'échec « Immuabilité des migrations déjà en production » masque les
45 étapes suivantes et que la divergence migrations est additive.

## Autorisé

1. Transporter vers `handoff-continuite-20260920` les **14 fichiers de migration
   déjà présents sur `production` et absents du rail**, octet pour octet depuis
   `production`.
2. Ce transport est une **réconciliation de dépôt uniquement**. Il n'autorise
   aucune exécution SQL, aucun `supabase db push`, aucune migration Test ou
   Production, aucune bascule de source planning et aucune écriture de données.
3. Avant commit, produire la liste exacte des 14 chemins et vérifier pour chacun
   l'identité de contenu avec `production` (SHA/blob ou SHA256 reproductible).
4. Après transport, rejouer l'étape d'immuabilité puis la CI rendue accessible,
   notamment les épreuves Handoff. Rapporter le premier nouvel échec éventuel
   sans l'ajouter automatiquement aux échecs connus.
5. Vérifier que `main` et `production` sont inchangées et que le diff de ce
   geste contient uniquement les 14 migrations attendues + les écritures Handoff
   strictement nécessaires à la consommation/dépôt.
6. Déposer un nouveau `request-N.md` avec preuves, résultats CI et état du rail,
   puis STOP.

## Non autorisé

- Aucun merge/rebase/squash de `production` vers le rail.
- Aucun transport des 11 migrations Test/CI vers Production et aucune décision
  définitive sur leur architecture dans ce geste.
- Aucun portage applicatif des 79 commits, de `dd4d0f3`, P0-1/P0-3 ou NEXUS Live.
- Aucun accès/écriture Supabase Production.
- Aucun merge, déploiement ou activation Production.
- Aucun travail #62/#65, P0-2, B1 ou `public.rappels`.
- Aucun élargissement opportuniste des permissions GitHub.

## Transport Orchestrateur

L'absence de transport automatique Claude → ChatGPT est désormais une anomalie
de rail connue, mais elle ne doit pas être corrigée en élargissant les permissions
dans ce lot. Le mécanisme de transport fera l'objet d'un geste d'infrastructure
séparé. Jusqu'à sa correction, conserver explicitement
`NEXUS_BASE_BRANCH=handoff-continuite-20260920`.

Cette décision ne constitue en aucun cas un GO Production.
