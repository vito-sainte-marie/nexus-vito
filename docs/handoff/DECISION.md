<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/FAST-TRACK-POMPISTE-RELEVES-PISTE-20261016/decision-5.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: FAST-TRACK-POMPISTE-RELEVES-PISTE-20261016
seq: 5
author: Frédéric Bragance
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-7.md
---
# Décision sur request-7.md — arbitrage humain de Frédéric (GO Test exclusivement)

Cette décision matérialise l'arbitrage humain rendu par Frédéric Bragance dans la conversation du 17/10/2026, en réponse à l'arrêt de l'arbitre sur request-7.md (« Décision réservée à un humain — l'arbitre ne franchit aucun palier »). Principe favorable donné d'abord, puis GO explicite : « Je te donne mon GO pour appliquer la politique sur Test. »

1. **Politique `documents_a_traiter_jaugeage_pompiste` : RATIFIÉE sur Test exclusivement.** INSERT pour `authenticated`, site propre, dossier unique `jaugeage_veeder_root`, pompiste du jour (`est_pompiste_du_jour`), nom préfixé de `auth.uid()`, extensions image seulement.
2. Aucune autre politique modifiée, aucun élargissement de permission, aucune fusion, aucune intervention en Production. La reprise en Production exigerait un arbitrage de sécurité et un GO distincts.
3. GO pour reprendre la recette complète sur Test (upload, OCR, correction manuelle, validation, enregistrement, consultation), puis Safari iOS sur appareil réel.

## Vérification de l'objet déployé (Claude, 17/10/2026)

Mesure directe sur Supabase Test : les quatre politiques `documents_a_traiter_*` sont présentes, seule `documents_a_traiter_jaugeage_pompiste` est nouvelle (INSERT, `authenticated`). Migration `20261017120000`, classée « EXCLUE — Test/CI » dans l'addendum du manifeste.

Aucune différence constatée entre l'objet déployé et celui visé par l'arbitrage.
