<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/FAST-TRACK-POMPISTE-RELEVES-PISTE-20261016/decision-4.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: FAST-TRACK-POMPISTE-RELEVES-PISTE-20261016
seq: 4
author: Frédéric Bragance
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-6.md
---
# Décision sur request-6.md — arbitrage humain de Frédéric (GO Test exclusivement)

Cette décision matérialise l'arbitrage humain rendu par Frédéric Bragance le 16/10/2026 en réponse à l'arrêt `SECRET_PERMISSION_SURFACE_SECURITE` de l'arbitre sur request-6.md. Elle remplace la réponse BLOCKED non matérialisée.

1. **Section 6 : RATIFIÉE.** Retrait des privilèges de `anon` et de `TRUNCATE` pour `authenticated` sur les quatre nouvelles tables du lot, sous réserve de vérifier les privilèges effectifs et de préserver les accès légitimes et les politiques RLS.
2. **EXECUTE PUBLIC : MAINTENU** sur les deux fonctions trigger (`carburant_index_valeurs_heriter_site`, `carburant_index_corrections_heriter_site`) : `RETURNS trigger`, sans `SECURITY DEFINER`. Aucune migration de révocation supplémentaire.
3. GO pour reprendre le lot sur Test, poursuivre l'implémentation et exécuter la recette avec preuves.
4. Aucune fusion ni intervention en Production. Toute différence entre objets déployés et objets visés par cet arbitrage est à signaler immédiatement.

## Vérification des privilèges effectifs sur Test (Claude, 16/10/2026)

Mesure directe sur Supabase Test après application de la migration 20261016230000 :

- `anon` : aucun droit select/insert/update/delete/truncate sur les quatre tables ;
- `authenticated` : `TRUNCATE` refusé, `SELECT` conservé ; RLS activée sur les quatre tables ;
- les deux fonctions trigger : `RETURNS trigger`, `prosecdef = false`, `EXECUTE` accordé à `PUBLIC`, conformément à l'arbitrage.

Aucune différence constatée entre les objets déployés et ceux visés par l'arbitrage.
