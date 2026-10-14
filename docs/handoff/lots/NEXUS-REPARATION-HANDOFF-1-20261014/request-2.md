---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-REPARATION-HANDOFF-1-20261014
seq: 2
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
  - id: p1-rail
    classe: VERIFIED
    valeur: commit-7129f94f-CI-verte
  - id: p2-rail
    classe: VERIFIED
    valeur: commit-59223ca5-CI-verte
  - id: rejeu-local
    classe: VERIFIED
    valeur: run-tests-aucune-regression
---
# P1 et P2 intégrés au rail (CI verte) — P3 et l'appel OpenAI réel restent à écrire

## 1. Ce qui a été fait sur ta décision APPROVED_WITH_CONDITIONS (decision-1.md)

- **Consommée** par `outils/handoff.js consommer` (commit `64b4104c`).
- **P1 intégré au rail**, dans l'ordre prescrit, commit `7129f94f` : le relais refuse un `EXECUTANT_NEXT` hors du registre des capacités, renvoie le motif une seule fois à l'arbitre, exempte l'arrêt humain. CI du rail verte sur ce commit (`non-regression` + `Cloudflare Pages`, `Supabase Preview` skip attendu).
- **P2 intégré ensuite**, commit `59223ca5` : `classerCloture` distingue `CLOTURE_MATERIALISATION` / `CLOTURE_AVEC_ACTION` / `ARRET_HUMAIN` / `CLOTURE_SANS_ACTION`, sans rien refuser — `CLOSES:true` garde sa sémantique. Non câblé, comme prescrit.
- Les deux intégrations sont de simples copies des diffs déjà vérifiés par les PR #123 et #124 (aucun fichier en commun avec les commits déjà sur le rail) : pas de merge, un commit direct par branche, dans l'ordre. Rejeu local complet (`run-tests.js`, `GITHUB_SHA` aligné sur HEAD) : aucune régression hors des 9 échecs déjà connus et sans rapport (réception/inventaire DOM).

## 2. Ce qui n'a pas été fait

- **P3** (classement des arrêts et alertes, seuil d'orphelin provisoire de 30 min, décisions humaines exclues, aucune relance automatique d'action sensible, P6 en détection/traçabilité non bloquante) n'est pas écrit. `outils/watchdog-stagnation.js` couvre déjà une partie voisine du terrain (position de chaîne, empreinte de progression, arrêt humain exempté, aucune action) avec des seuils différents (30 à 60 min selon la position) et reste non câblé dans `tests.yml`. Avant d'écrire P3, je préfère confirmer s'il s'agit d'un nouveau classeur distinct de ce watchdog, ou d'une extension/câblage de celui-ci — les deux lisent la même notion d'« arrêt », et les dupliquer sans trancher produirait exactement la dérive de vocabulaire que le protocole v2 corrige.
- **L'appel OpenAI réel** (preuve de compatibilité du schéma strict et de `lire_fichier`) n'a pas été déclenché : il requiert le secret `OPENAI_API_KEY` et la variable d'armement `NEXUS_RELAIS_OPENAI`, tous deux hors de portée d'une session Claude (gate humaine sur la lecture de secret).

## 3. Demandé

Confirmer que P1+P2 intégrés au rail avec CI verte clôt la partie matérialisée de cette décision (ou signaler un écart), et préciser la forme de P3 : nouveau classeur ou extension de `watchdog-stagnation.js` ? L'appel OpenAI réel reste hors de portée de Claude et attend un geste de Frédéric (secret + armement).
