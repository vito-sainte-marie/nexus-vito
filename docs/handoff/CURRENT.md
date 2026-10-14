<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/NEXUS-REPARATION-HANDOFF-1-20261014/request-1.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-REPARATION-HANDOFF-1-20261014
seq: 1
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: ChatGPT
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=7468f603 production=3f5589e4
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 150-fichiers
  - id: pr-p1
    classe: VERIFIED
    valeur: PR 123 CI verte (3 executions), 19/19 epreuves, rejeu 21/2/13
  - id: pr-p2
    classe: VERIFIED
    valeur: PR 124 non cablee, rejeu 16 decisions CLOSES true : 9/6/1, aucune refusee
  - id: aucun-go-production
    classe: DECLARED
    valeur: ni fusion ni claude.yml ni Production
---
# Réparation de la boucle Handoff — contrat fermé, cohérence, classement (P1 à P3)

## 1. Objet
Suite à ton arbitrage du 14/10 (GO pour détailler et tester P1, P2 et P3 sur branche isolée, sans fusion), je dépose le contrat exact proposé, les règles de compatibilité et les tests. Origine : l'audit du 14/10 sur 100 runs du rail montre 8 arrêts sur 10 en `CANAL_INCAPABLE`, parce que `EXECUTANT_NEXT` est écrit en texte libre (« Claude ») au lieu des identifiants du registre `docs/handoff/CAPACITES-CANAL.json`.

## 2. Livré (branches isolées, non fusionnées, CI verte)
- **P1 — PR #123** (`p1-executants-fermes`, base du rail) : le relais refuse un `EXECUTANT_NEXT` hors registre (`EXECUTANT_INCONNU`, `CAPACITE_INCONNUE`, `CANAL_INCAPABLE`), renvoie le motif à l'arbitre une seule fois (jamais trois), et ne renvoie jamais une faute de structure. Un arrêt humain (`BLOCKED`, `OWNER_NEXT` Frédéric ou `STOP_REQUIRED` posé) est exempté : « Frédéric » reste admis. Rejeu du rail : 21 décisions avec exécutant, 2 arrêts humains, 13 en vocabulaire libre ancien ; seul ce vocabulaire est refusé. Mutations M1 à M4.
- **P2 — PR #124** (`p2-coherence-cloture`, empilée sur #123, non câblée) : `classerCloture` distingue `CLOTURE_MATERIALISATION`, `CLOTURE_AVEC_ACTION`, `ARRET_HUMAIN`, `CLOTURE_SANS_ACTION`. Elle ne refuse rien : la sémantique de `CLOSES:true` est inchangée (correction 1). Rejeu des 16 décisions `CLOSES:true` du rail : 9 / 6 / 1, aucune refusée. Mutation M5.

## 3. Points à trancher
1. La classification repose sur un motif de texte (matérialiser, consommer, clore). Acceptable comme signalement INFO, sans refus ?
2. Alias `*_READ_ONLY` : le validateur l'accepte, mais `relancer-claude-ci` arrêtera toujours une lecture Production pour `github-actions-claude`. À traiter dans un lot distinct ?
3. P3 (classement des arrêts et alertes) n'est pas encore écrit : orphelines à 30 min provisoires, hors décisions humaines, sans relance automatique d'une action sensible ; P6 en détection et traçabilité, sans blocage. Je l'écris sur ta confirmation de la forme.
4. La compatibilité du modèle OpenAI avec le schéma strict et `lire_fichier` n'est pas démontrée : un appel réel est à autoriser.

## 4. Limites
Aucun GO Production, aucune fusion, aucune modification de `claude.yml` sur main, aucun workflow planifié. Je ne m'arbitre pas moi-même.

## 5. Verdict demandé
Valider la forme de P1 et P2 (fusion dans le rail à ta charge ou celle de Frédéric), et dire si j'écris P3.
