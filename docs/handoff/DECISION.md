<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/NEXUS-ORCHESTRATION-GUARDIANS-1-20260907/decision-1.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: NEXUS-ORCHESTRATION-GUARDIANS-1-20260907
seq: 1
author: NEXUS Orchestrator
branch: config-par-environnement
decision: APPROVED_WITH_CONDITIONS
closes: true
in_reply_to: request-2.md
---
# Décision — Guardians calibrés, activation partielle, dettes produit ouvertes

## Verdict

`APPROVED_WITH_CONDITIONS`, `closes: true`, en réponse à `request-2.md`.

Le lot a atteint son objectif d'intégration/câblage/calibration des Guardians
backend. Les points restants sont soit des dettes produit distinctes (Q74),
soit des extensions de gouvernance séparées (Q75/Q76) : ils ne doivent pas
maintenir ce lot artificiellement ouvert.

## Q73 — activation bloquante

**NON pour l'instant** pour `guardians-router` (Architecture), Business Rules
et Bible. Ils restent en mode rapport (non bloquants en CI) tant que leurs
dettes préexistantes ne sont pas tranchées : la collision `NexusStock` pour
Architecture, les 2 findings restants pour Business Rules, les 17 findings
restants pour Bible.

`verifier-apprentissage` et le Guardian QA/Regression restent bloquants : ils
sont à zéro finding canonique après calibration mesurée (14 → 1, le seul
finding restant étant dans notre propre code, déjà corrigé).

Le passage au blocage des autres gardes se fera après extinction de leur
dette respective, avec une preuve verte mesurée sur le HEAD canonique — sans
nouvel arbitrage produit si la doctrine, le scope et l'environnement de la
garde ne changent pas.

## Q74 — défauts produit trouvés

**OUI, ouvrir des lots distincts et déterministes**, par gravité humaine puis
risque métier :

1. `NEXUS-Evaluation-Employe-v1.html` — ne jamais afficher `0.0 / 5` / `0 %`
   lorsqu'aucune évaluation n'existe ; afficher un état neutre explicite.
2. `NEXUS-Debug-v1.html` — une absence de mesure ne doit jamais devenir
   `+0 €` vert / conformité parfaite.
3. `nexus-coach-fdj-moteur.js` — aucune absence de donnée ne doit devenir un
   reproche `0 %`.
4. Moteur carburant parallèle dans `NEXUS-Parametres-Rappels-v1.html` —
   rétablir une source de vérité unique issue du moteur canonique
   (`MAXIMUM_CAMION_LITRES`), jamais une réimplémentation locale.

La collision `NexusStock` (déjà matérialisée comme `ARCH-002` au Backlog par
`NEXUS-ORCHESTRATION-GUARDIANS-1-20260907/decision-1.md`) reste également un
lot séparé, préalable au blocage du routeur Architecture.

Aucun de ces défauts n'est corrigé dans ce lot.

## Q75 — relecteur Philosophie

**OUI, uniquement en consultatif.** Jamais bloquant tant qu'il dépend d'un
jugement de modèle ; hors CI bloquante. Il peut produire des findings et des
recommandations traçables, mais aucune conclusion automatique de conformité
sur les principes non mécanisables.

## Q76 — arbitrage a posteriori outillage/QA

**APPROUVÉ avec frontière stricte.** Claude peut exécuter puis faire arbitrer
a posteriori un lot uniquement si les quatre conditions suivantes sont
simultanément vraies :

1. aucun choix métier/produit ;
2. aucun secret, rotation/lecture de secret, ni dépendance/harnais tiers
   élargissant la surface de sécurité ;
3. aucune action Production/Supabase Production/NEXUS Production ;
4. aucune modification de `main`.

Dès qu'une seule condition tombe, retour immédiat au régime normal
(arbitrage préalable). Cette pré-autorisation couvre l'outillage, les
gardes, les tests, les mutations, la calibration et le câblage CI sur
`config-par-environnement` — elle n'autorise jamais une correction
applicative hors lot ni un élargissement silencieux de périmètre.

## Conditions permanentes

- les Guardians doivent être calibrés sur le dépôt réel avant blocage ;
- toute mutation doit prouver qu'elle a réellement modifié la cible avant de
  conclure ;
- toute assertion doit pouvoir échouer ;
- la mémoire servie par `briefing-agent.js` doit rester dérivée de
  `RULES.json`, sans seconde vérité paraphrasée ;
- aucun finding préexistant ne doit être maquillé pour rendre une garde
  verte : il reste une dette tracée jusqu'à correction ;
- aucun changement `main`/`production`, aucune opération Supabase
  Production/NEXUS Production, aucun secret/PIN/service_role dans dépôt ou
  logs.

## Après consommation

Ne pas corriger les défauts produit dans ce lot. Matérialiser uniquement les
futurs lots/backlog nécessaires (Q74), puis retourner l'état canonique final
et les prochains lots prêts à ouvrir.
