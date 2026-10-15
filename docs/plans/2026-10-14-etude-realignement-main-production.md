# Étude de réalignement `main` / `production` — analyse seule

**Statut : étude. Aucune exécution n'est autorisée** (arbitrage du 14/10/2026, DT-001 du registre `docs/gouvernance/REGISTRE-DETTE-TECHNIQUE.md`). Données mesurées le 14/10/2026 sur `origin/main` = `dea3ae73`, `origin/production` = `50c634a8`.

## 1. Ce que chaque branche est vraiment

| | `production` | `main` |
|---|---|---|
| Rôle réel | ligne déployée (GitHub Pages) et base des PR de code | branche par défaut GitHub : porte le control-plane (`claude.yml`, ADR-0003) |
| Depuis l'ancêtre `501c0c74` (04/09) | +308 commits, 521 fichiers, +93 389 / −2 638 | +29 commits (6 fusions), 93 fichiers |
| `claude.yml` | absent | présent (21 des 23 commits non-fusion) |
| `outils/build.sh` | présent (`290a217f`) | absent |

## 2. Ce que contient `main` seul

- **Control-plane (22 commits environ)** : `claude.yml` uniquement (routage du rail, refus audible, boucle autonome `repository_dispatch`, alerte Telegram, smoke Telegram isolé). `production` et le rail n'ont **aucun** `claude.yml` : GitHub exige que les événements `issue_comment` / `repository_dispatch` lisent le workflow de la branche par défaut (ADR-0003, `tests.yml` lit `claude.yml` à `origin/main`).
- **Lexique (#110, `a42bba57`)** : 1 commit, 91 fichiers (+364 / −368), moteurs et pages `nexus-*.js`. **Absent de `production` et du rail** : c'est du contenu applicatif qui n'est donc pas déployé.

## 3. Conflits et dépendances

- Fusion à blanc `main` ← `production` : **24 conflits**, tous des pages `NEXUS-*.html` (Analyse-Ecarts, App, Apprentissage, Boîte-Réception, Brief, Coach-FDJ, Cockpit, Comptes-Clients, Debug, Évaluation-Employé, FDJ, FDJ-Analyse, FDJ-Manager, Inventaire, Inventaire-Manager, Missions, Mon-Évolution, Paramètres-Station, Paye, Planning, Pointage, Prise-De-Poste, Progression, Verify). Origine : le Lexique réécrit des libellés dans ces pages que `production` a profondément modifiées.
- `claude.yml` ne conflicte pas aujourd'hui, mais **toute opération qui rend `main` identique à `production`** (reset, fusion en mode « theirs ») le supprimerait et couperait le réveil de la boucle (voir `boucle-autonome`, alerte `CANAL_NON_DECLENCHABLE`).
- `outils/build.sh` dépend des six autres fichiers de `290a217f` (`_headers`, `nexus-auth.js` −819 lignes, `nexus-bandeau-environnement.js`, `nexus-page.js`, `outils/generer-config.js`, `outils/poser-build-id.js`) : le porter seul sur `main` change l'authentification d'une branche qui ne déploie rien.

## 4. Options analysées (non exécutées)

| Option | Principe | Gain | Risque principal |
|---|---|---|---|
| A. Fusion `production` → `main` | une PR, 24 conflits résolus à la main | `main` reprend la ligne déployée | arbitrer 91 fichiers de Lexique ligne à ligne ; régression de libellés sur des pages métier ; `claude.yml` à préserver explicitement |
| B. Reset `main` sur `production` | écrase `main` | historique propre | détruit le control-plane et le Lexique ; contraire à la règle d'immuabilité de `main` ; **à écarter** |
| C. Changer la branche par défaut vers `production` | `claude.yml` doit alors y vivre | supprime la raison d'être de `main` | déplace le control-plane (ADR-0003 à amender), touche aux protections et aux triggers ; décision humaine lourde |
| D. Statu quo + porter le Lexique par `production` | PR Lexique vers `production` seule | règle la seule dette applicative réelle | 91 fichiers à rejouer sur une base qui a bougé ; le rail doit suivre |
| E. Porter la chaîne de build sur `main` | 7 fichiers de `290a217f` | Cloudflare vert sur `main` | change `nexus-auth.js` sans bénéfice de déploiement ; **écarté par l'arbitrage** |

## 5. Risques de régression à tester avant toute exécution

1. Libellés : comparer le rendu des 24 pages avant/après (le Lexique remplace 364 lignes).
2. Control-plane : après toute opération touchant `main`, rejouer la recette réveil A/B du 14/10 (relance Claude seule ; arrêt propre avec alerte Telegram).
3. Épreuves du rail qui lisent `claude.yml` à `origin/main` (cinq épreuves) : doivent rester vertes.
4. Rulesets : `main` exige PR + `non-regression` ; `production` exige PR + `non-regression` + « Construire et éprouver l'artefact ».
5. Épreuve d'empreinte et manifestes : tout lot de fichiers rougit des épreuves attendues, voir la mémoire du dépôt.

## 6. Ordre de travail suggéré, à valider

1. Décider du sort du Lexique (D) : il est le seul contenu applicatif réellement en retard.
2. Décider si `main` reste le control-plane seul (statu quo documenté) ou si l'ADR-0003 est amendé (C).
3. Ne lancer A qu'après 1 et 2, sur un clone jetable d'abord, avec les cinq vérifications du §5.

## 7. Points ouverts

- **`nexus-lot-reconciler`** : fourni par Frédéric le 15/10 et déposé sous `docs/skills/nexus-lot-reconciler/` (lot NEXUS-LOT-RECONCILER-1-20261014, decision-1). DT-001 y est rattaché, sans lot doublon.
- Le registre de dette technique n'existait pas : `REGISTRE-DETTE-TECHNIQUE.md` a été créé. S'il existe ailleurs, y reporter DT-001.
