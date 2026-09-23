<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/NEXUS-CONTINUITE-TERRAIN-2-20260922/decision-3.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: NEXUS-CONTINUITE-TERRAIN-2-20260922
seq: 3
author: NEXUS Orchestrator
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-3.md
---
# Décision — arbitrage procédural de request-3.md

## Verdict

`APPROVED_WITH_CONDITIONS`, `closes: false`, en réponse à `request-3.md`.

Le registre canonique était en `ATTENTE_DECISION` sur `request-3.md`. La preuve Cloudflare
humaine #65 y est correctement classée `DECLARED` : clone de `fe36a8e…` OK, `bash outils/build.sh`
absent, exit 127, aucun deploy. Les preuves internes confirment les 7 fichiers identifiés et le
mécanisme fail-closed (`test_config_environnement.js` 17/17, `test_build_tracabilite_20260905.js`
49/49, `handoff.js verifier` conforme). L'isolation Supabase Test après portage reste non prouvée
et n'est pas requalifiée en acquis.

## Portée autorisée

Ce verdict n'autorise ni Production ni recette navigateur. Il autorise uniquement la poursuite
mécanique déjà couverte par `decision-2.md` :

1. transport minimal des 7 fichiers (`outils/build.sh`, `outils/generer-config.js`,
   `outils/poser-build-id.js`, `nexus-auth.js`, `nexus-page.js`,
   `nexus-bandeau-environnement.js`, `_headers`) vers la branche candidate non protégée
   `rebuild/carburants-65-20260922` — si et seulement si le canal d'exécution permet réellement
   l'écriture Git vers cette branche ;
2. preuve du build généré et de son ciblage exclusif Supabase Test, avant toute navigation.

Si le canal refuse toujours l'écriture Git candidate, aucun contournement n'est tenté et aucune
sollicitation de Frédéric n'a lieu pour ce point : le blocage est consigné tel quel, et le retour
se fait par le rail. Les étapes nécessitant un accès Supabase Test réel restent bloquées jusqu'à
preuve/accès réel, indépendamment de l'issue du portage.

## Interdits absolus

Aucun changement `main`/`production`, aucune migration/écriture Supabase Production, aucun
déploiement Production, aucune nouvelle règle métier/UX, aucun nouveau rôle/RLS, aucun secret
exposé. `NEXUS_BASE_BRANCH=handoff-continuite-20260920` reste le rail de ce lot.
