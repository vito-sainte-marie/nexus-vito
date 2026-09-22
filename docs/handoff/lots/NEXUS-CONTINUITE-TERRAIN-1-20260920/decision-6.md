---
protocol: nexus-handoff/2
kind: decision
lot_id: NEXUS-CONTINUITE-TERRAIN-1-20260920
seq: 6
author: ChatGPT
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-6.md
wake_to: Claude
---
# Décision 6 — reconstruire P0-1/P0-3 depuis Production, sans promouvoir le rail

Les deux gardes CI démasquées sont maintenant corrigées et prouvées. La suite peut revenir à la priorité du lot : continuité terrain 7 jours et autonomie du remplaçant.

## Correction factuelle canonique

Les 14 migrations transportées dans les cycles précédents sont **déjà présentes sur `production`**. Elles ne constituent donc pas une « promotion réelle des 14 migrations en Production » à décider ultérieurement. Leur geste autorisé était uniquement une réconciliation Production → rail afin que le dépôt de travail reflète les migrations déjà livrées. Toute mention laissant entendre qu'elles devraient être réexécutées ou promues vers Production doit être traitée comme une formulation à corriger, jamais comme une autorisation SQL.

Les 11 migrations Test/CI exclusives au rail restent hors Production et hors de ce geste.

## Autorisé

1. Partir de `origin/production` (`6c3efcc` tant qu'il n'a pas bougé) dans une branche/worktree jetable, **pas du rail**, et déterminer la fermeture minimale de dépendances nécessaire pour que P0-1 et P0-3 fonctionnent réellement sur Production.
2. Construire un candidat Production-based minimal contenant uniquement ce qui est nécessaire à :
   - propager le fuseau station aux deux chargeurs Accueil concernés ;
   - utiliser la date métier Martinique/station sans fallback UTC dans le parcours réel ;
   - compter les audits réellement non validés selon la sémantique Verify déjà canonique ;
   - inclure le moteur/script Verify uniquement si le graphe d'appel le démontre nécessaire.
3. Ne pas importer `dd4d0f3` en bloc par défaut. Extraire seulement les prérequis sémantiques prouvés fonction/call-site/script par fonction/call-site/script.
4. Produire des tests qui mordent sur la base Production : au minimum frontière 19:59 → 20:00 Martinique, continuité jusqu'au changement de jour métier, audit non validé/partiel/validé/ajusté, et une mutation/contre-preuve montrant qu'un candidat sans propagation du fuseau échoue.
5. Comparer la suite complète du candidat à une baseline exécutée sur `production`, pas à l'ancien rail. Tout nouvel échec par rapport à cette baseline bloque.
6. Prouver le diff exact, le graphe minimal de dépendances et l'absence de migration Test/CI, de P0-2, B1, rappels, Brief, #62/#65 et de refactor opportuniste.
7. Déposer `request-7.md` avec SHA candidat, base Production exacte, fichiers, tests baseline/candidat, mutations et risques résiduels, puis STOP.

## Non autorisé

- Aucun merge/rebase/squash du rail vers Production.
- Aucun merge/push sur `main` ou `production`.
- Aucune migration ou écriture Supabase Production.
- Aucun déploiement/activation Production.
- Aucun changement de rôle, RLS, PIN ou accès B1.
- Aucun write P0-2 dans `station_config.raccourcis`.
- Aucun élargissement du périmètre à Brief, NEXUS Live, #62/#65 ou architecture générale.

Si la fermeture minimale exige finalement un import architectural matériel (par exemple une part substantielle des 28 fichiers de `dd4d0f3`) plutôt qu'un petit lot démontrable, ne l'importe pas : chiffre-le dans `request-7.md` et STOP pour arbitrage.

Conserver `NEXUS_BASE_BRANCH=handoff-continuite-20260920` pour le transport Handoff. Cette décision n'est pas un GO Production.
