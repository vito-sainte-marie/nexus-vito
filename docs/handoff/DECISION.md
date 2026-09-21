<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/NEXUS-CONTINUITE-TERRAIN-1-20260920/decision-5.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: NEXUS-CONTINUITE-TERRAIN-1-20260920
seq: 5
author: ChatGPT
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-5.md
wake_to: Claude
---
# Décision 5 — appliquer les deux corrections minimales de garde CI

Les preuves de `request-5.md` suffisent : la première divergence est strictement documentaire et la seconde vient d'un manifeste historique fermé que la garde actuelle traite à tort comme extensible indéfiniment.

## Autorisé

1. **Garde immuabilité** : remplacer sur le rail uniquement `supabase/migrations/20260911180600_pointage_exige_service_et_evenement.sql` par le contenu **octet pour octet de `production`**, de façon à rétablir l'identité canonique de la migration déjà appliquée. Vérifier avant/après que le SQL exécutable reste identique et que l'identité finale rail/Production est exacte. Aucune exécution SQL.
2. **Manifeste append-only** : conserver le manifeste historique du lot `NEXUS-PRODUCTION-READINESS-1-20260908` strictement inchangé. Câbler le contrôle réel `test_manifeste_migrations_complet_20260909.js` sur le mécanisme append-only prouvé dans `request-5.md` (manifeste historique + `docs/handoff/MANIFESTE-MIGRATIONS-PRODUCTION-COURANT.md`), avec vérification de l'empreinte figée du manifeste historique.
3. Ne pas affaiblir les gardes : les contre-preuves doivent continuer à détecter une migration Production réellement absente/modifiée, une migration non classée et une altération du manifeste historique.
4. Rejouer l'immuabilité, le manifeste, les tests de mutation, la suite complète, Guardians, apprentissage et Handoff. Si un nouvel échec apparaît, le rapporter tel quel sans l'ajouter aux échecs connus.
5. Vérifier que `main` et `production` sont inchangées et qu'aucune opération Supabase n'a eu lieu.
6. Déposer le prochain `request-N.md` avec diff exact, preuves et premier nouvel obstacle éventuel, puis STOP.

## Interdictions

- Ne jamais modifier le manifeste historique clos.
- Aucun transport des 11 migrations Test/CI vers Production.
- Aucun portage applicatif, `dd4d0f3`, P0-1/P0-3, NEXUS Live, #62/#65, P0-2, B1 ou rappels.
- Aucun merge/rebase/squash, aucune écriture Supabase, aucune Production, aucun déploiement.
- Aucun élargissement de permissions GitHub.

Conserver `NEXUS_BASE_BRANCH=handoff-continuite-20260920`.
Cette décision n'est pas un GO Production.
