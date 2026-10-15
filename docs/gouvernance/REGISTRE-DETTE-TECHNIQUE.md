# Registre de dette technique NEXUS

Ce registre n'existait pas dans le dépôt au 14/10/2026 (aucun fichier « dette » dans `docs/`) ; il est créé par l'entrée DT-001. Une entrée = une dette constatée, sa priorité, ce qui la réévalue, et qui la suit. Rien ici n'autorise une exécution.

## DT-001 — Divergence `main` / `production`

- **Date :** 2026-10-14. **Priorité : U2** (réévaluée si le contrôle Cloudflare bloque réellement une opération nécessaire).
- **Arbitrage :** « option 3 », sans modification immédiate de `main`. Ne pas fusionner `production` dans `main`. Ne pas porter isolément les sept fichiers du commit `290a217f`. Aucune exécution de réalignement n'est autorisée ; l'étude est dans `docs/plans/2026-10-14-etude-realignement-main-production.md`.
- **Constat :** ancêtre commun `501c0c74` (04/09/2026). `production` porte 308 commits que `main` n'a pas (521 fichiers, +93 389 / −2 638). `main` porte 29 commits que `production` n'a pas (6 fusions, 23 commits) : 21 touchent `.github/workflows/claude.yml` (control-plane, ADR-0003) et 1 touche 91 fichiers (Lexique, `a42bba57`, PR #110). Une fusion à blanc produit 24 conflits, tous sur des pages `NEXUS-*.html`.
- **Symptôme visible :** `outils/build.sh` (porté sur `production` par `290a217f`) n'existe pas sur `main`. Le projet Cloudflare `nexus-test` lance `bash outils/build.sh` : son check échoue sur toute branche issue de `main` (#121, #125, #126 : fusionnées ou fermées avec ce check rouge).
- **Classement du contrôle Cloudflare (vérifié le 14/10) :** non bloquant. Les rulesets actifs n'exigent que `non-regression` (`main`) et `non-regression` + `Construire et éprouver l'artefact` (`production`). Cloudflare Pages n'est requis par aucun. Production est publiée par GitHub Pages (« Déploiement Production »), pas par Cloudflare ; #121 et #125 ont été fusionnées dans `main` avec ce check rouge. Cloudflare ne sert que NEXUS Test (alias du rail), dont le build passe.
- **Condition de réévaluation :** si un check Cloudflare devient requis par un ruleset, si une opération de `main` doit être publiée via Cloudflare, ou si `main` doit de nouveau porter du code applicatif.
- **Suivi :** skill `nexus-lot-reconciler` (`docs/skills/nexus-lot-reconciler/`, déposé par le lot NEXUS-LOT-RECONCILER-1-20261014, decision-1 APPROVED_WITH_CONDITIONS), sans lot doublon. Phase 1 d'observation seulement ; les phases 2 et 3 restent fermées.
- **Effet latent à surveiller :** le Lexique (#110, 91 fichiers) n'est ni sur `production` ni sur le rail.
