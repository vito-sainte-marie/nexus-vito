<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/NEXUS-INCIDENTS-CI-1-20261014/request-3.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-INCIDENTS-CI-1-20261014
seq: 3
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
  - id: ci-rail
    classe: VERIFIED
    valeur: run-38618584398-success-f0b666ca
  - id: geste-humain-local
    classe: DECLARED
    valeur: push-par-session-locale-a-la-demande-de-Frederic
  - id: aucune-permission-modifiee
    classe: VERIFIED
    valeur: bloc-permissions-tests.yml-inchange
  - id: aeff14c1-perdu
    classe: DECLARED
    valeur: branche-runner-ephemere-item-1-reconstruit
---
# Request-3 — NEXUS-INCIDENTS-CI-1 : item 1 livré, CI du rail verte

## 1. Ce qui est livré
Décision-2 (APPROVED_WITH_CONDITIONS, CLOSES false) est consommée. L'item 1 a été reproduit sur la tête du rail puis poussé SANS force :

- `508264d8` — nouveau verdict notifié `CANAL_NON_DECLENCHABLE` (EXECUTANT_NEXT reconnu au registre mais aucun déclencheur ne le réveille). Famille DECISION_HUMAINE, alerte Telegram.
- `bf2fe443` — job `enregistrement-incident` dans `tests.yml` (outputs de `non-regression`, branche notifier de `boucle_autonome`, `set +e` contre le piège `$?` sous `bash -e`), correction du watchdog, test `test_cablage_incidents_ci_20261014.js` (13 épreuves, corps du job exécuté en vrai sur un dépôt jetable).
- `f0b666ca` — attendus de deux assertions rendus indépendants de l'observé (Guardian QA `attendu_calcule_par_le_meme_appel`).

## 2. Nature du geste (à consigner honnêtement)
Ce n'est PAS un déclenchement automatique de `session-claude-habilitee`. Le push a été fait par une session Claude locale, à la demande explicite de Frédéric dans cette session (geste humain déclenché), avec son jeton `gh` (scopes repo+workflow). Le canal `session-claude-habilitee` reste non déclenchable : c'est précisément ce que `CANAL_NON_DECLENCHABLE` rend désormais visible. Le commit `aeff14c1` est perdu (branche de runner éphémère `mon-travail-20261014`, jamais poussée) ; l'item 1 a été reconstruit depuis request-2 §1.

## Preuve des conditions de decision-2
Condition « CI du rail verte avant clôture » : run 38618584398 success sur f0b666ca. Condition « aucune permission modifiée » : bloc `permissions:` inchangé. Reproduction sur la tête du rail, push sans force : bf2fe443 puis f0b666ca.

## 3. Preuves
- CI du rail : run 38618584398 sur `f0b666ca`, conclusion success (le run 38617882351 sur `bf2fe443` était rouge sur Guardian QA seul, corrigé).
- Lease : le job re-checkout la tête du rail ; épreuve de rail avancé (aucun écrasement).
- Concurrency : groupe `nexus-incidents-enregistrement-<ref>`, cancel-in-progress false.
- Idempotence : rejeu → `DEJA_ENREGISTRE`, zéro octet, aucun push.
- Pas de récursion : push par GITHUB_TOKEN ne redéclenche pas les workflows.
- Aucune permission modifiée : bloc `permissions:` de tests.yml inchangé ; aucune extension des permissions de l'App GitHub.
- Arrêts de sécurité conservés : DECISION_HUMAINE → `NON_ENREGISTRE`.
- Suite : seuls les 9 échecs connus subsistent.
- Non fait : aucune fusion main/Production, aucun claude.yml sur main, aucun appel OpenAI réel, aucun workflow planifié.

## 4. Demande
Condition de décision-2 remplie (CI rail verte avant clôture). Arbitrer la clôture du lot ; je ne m'arbitre pas moi-même. Point ouvert à décider côté arbitre : comment `session-claude-habilitee` doit être réellement déclenchable, ou le retirer des EXECUTANT_NEXT valides.
