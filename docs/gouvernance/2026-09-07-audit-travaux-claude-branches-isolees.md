# Audit de cohérence — travaux Claude sur branches isolées

Date : 2026-09-07
Auteur : NEXUS Orchestrator
Branche canonique auditée : `config-par-environnement`
HEAD au démarrage de l'audit : `693570bfccd46c83ea50a88246eb1eaef9b5e8f5`
Portée : audit et plan de réconciliation uniquement. Aucun changement `main`, `production`, Supabase Production ou NEXUS Production.

## Objet

Frédéric demande de retrouver la cohérence entre le rail canonique NEXUS et les travaux antérieurs de Claude restés sur des branches `claude/issue-*` ou historiques.

Le problème est confirmé : plusieurs branches Claude sont divergentes de `config-par-environnement`. Elles ont été créées depuis une racine `main` ancienne ou actuelle et contiennent des travaux parfois utiles, parfois déjà remplacés, parfois seulement documentaires. Elles ne doivent surtout pas être fusionnées en bloc.

Principe de réconciliation : **intégrer l'intention canonique et les deltas encore utiles sur le HEAD courant, jamais fusionner une branche stale entière.**

## Inventaire factuel

### 1. `claude/issue-28-20260906-0604` — HEAD `93852f8`

Objet : `SITE-EXPLICITE-1-POMPISTE-DU-JOUR-TIMEZONE-GUARD-20260906`.

Contenu notable : migration fuseau + `en_cours`, évolution du registre d'aides de la garde de portée, tests.

Statut : **historique / probablement supersédé**. Le registre canonique marque le lot correspondant `DECISION_CONSOMMEE` par une autre voie et `config-par-environnement` contient déjà la migration `20260906120000_pompiste_du_jour_fuseau_station.sql`, la garde et ses tests. Ne pas cherry-pick sans diff sémantique ciblé.

### 2. `claude/issue-28-20260906-1314` — HEAD `4ffeb518`

Objet : première implémentation du créneau commandable, motif structuré de non-complétion camion et CTA structuré.

Statut : **supersédé par les décisions et implémentations Carburants ultérieures**. Ne pas intégrer en bloc.

### 3. `claude/issue-28-20260906-1315` — HEAD `0b49a868`

Objet : variante concurrente de la même correction Carburants.

Statut : **supersédé**. Les variantes 1314/1315/1323 ne doivent pas être cumulées : elles représentent des itérations concurrentes d'un même sujet.

### 4. `claude/issue-28-20260906-1323` — HEAD `72cec144`

Objet : précision canonique commandes lundi-vendredi avant 11h, samedi non commandable, CTA Préparer/Simuler.

Statut : **partiellement repris ensuite dans le rail canonique**, mais Claude a lui-même signalé dans l'audit Live que `72cec14` n'était pas fusionné comme commit. Vérifier uniquement les deltas fonctionnels encore absents du HEAD courant ; ne pas cherry-pick le commit entier.

### 5. `claude/issue-28-20260906-1405` — HEAD `7a5d329`

Objet : audit du rail event-driven, Guardian Philosophie NEXUS, corrections `outils/handoff.js` (lecture distante, idempotence, anti-boucle).

Statut : **non intégré comme branche**. Une partie de la doctrine a depuis été absorbée dans Gouvernance Autonome v2/Bible/REPRISE ; il reste à comparer les corrections exécutables de `outils/handoff.js` et le document Guardian Philosophie avec les versions canoniques actuelles. Intégration sélective seulement si elles ajoutent encore une garantie non présente.

### 6. `claude/issue-28-20260906-1412` — HEAD `157316e`

Objet : audit Guardian Architecture & Cohérence, sans code applicatif.

Findings utiles non matérialisés canoniquement comme conclusions fermées :
- collision d'identité globale `NexusStock` entre `nexus-stock.js` et `nexus-stock-moteur.js` ;
- duplication divergente de `classifierEcart` dans `NEXUS-Mon-Evolution-v1.html` par rapport à `nexus-verify-moteur.js` ;
- logique de pattern-learning CIN sans propriétaire logique nommé ;
- moteurs absents du Data Dictionary.

Statut : **audit à capitaliser**. Ne pas corriger automatiquement les sujets ambigus. Le bug `classifierEcart` est déterministe et peut devenir un futur lot ciblé ; la collision NexusStock exige de déterminer l'intention du fichier mort avant suppression/renommage.

### 7. `claude/issue-28-20260906-2014` — HEAD `821310ce`

Objet : décision-4 Carburants, complément camion configurable, prudence rotation inconnue, plus plusieurs alignements issus du HEAD canonique de l'époque.

Statut : **partiellement supersédé / partiellement pertinent**. Le lot actif `CARBURANTS-PERFORMANCE-OPTIMISATION-CAMION-20260906` possède maintenant sa propre correction canonique et `decision-1.md` exige encore la traversée P0 + recette UI. Ne jamais fusionner `821310ce` en bloc. Comparer seulement les éléments expressément requis par le lot actif, notamment `seuil_autonomie_max_jours_completion`, rotation inconnue et traversée P0, contre le HEAD canonique courant.

### 8. `claude/issue-28-20260907-0028` — HEAD `4ecccc85`

Objet : implémentation Gouvernance Autonome v2 : `guardians-router.js`, `verifier-apprentissage.js`, recette navigateur Test, tests associés.

Statut : **travail utile non intégré**. Les documents canoniques Gouvernance/ADR/Rules existent déjà sur `config-par-environnement`; ne pas recopier leurs versions stale. Candidats de rapatriement : uniquement les nouveaux outils/tests encore absents ou supérieurs à l'équivalent canonique. Le câblage CI doit être évalué sur le HEAD courant, sans modifier `main` et sans rendre une capacité Test optionnelle bloquante.

### 9. `claude/issue-28-20260907-0044` — HEAD `990a0f1`

Objet : MVP `NEXUS LIVE DÉVELOPPEMENT`.

Livré sur branche isolée : page Live, contrat événement, projection, gate Créateur, migration `nexus_live_events`, 27 assertions, recette négative réelle Manager/Employé avec NEXUS Test.

Statut : **candidat prioritaire à réintégration Test**, mais incomplet : migration Test non appliquée, aucun producteur d'événements, pas d'entrée navigation Créateur, pas de test positif Créateur. La réintégration doit repartir du HEAD canonique courant et préserver la séparation Créateur/clients et l'absence de données clientes brutes.

### 10. `cloture-des-services` — HEAD `908a7808`

Objet : ancien WIP du 04/09 sur la clôture des services, page Services, moteur/données, migration et tests.

Statut : **historique à ne pas fusionner**. Le commit indique explicitement qu'une migration avait déjà été appliquée à Production avant la séparation Test/Production, tandis que le code n'était pas déployé. Depuis, le rail canonique a développé des migrations plus récentes de clôture/reprise/unicité des shifts. Toute reprise doit comparer le besoin métier actuel aux contrats canoniques récents ; cherry-pick interdit.

### 11. `historique-migrations`

Statut : **entièrement ancêtre de `config-par-environnement`**, aucun delta à récupérer.

## Diagnostic racine

Le défaut de cohérence n'est pas un manque de travail de Claude. C'est un défaut de **réintégration** : le workflow Issue crée des branches Claude à partir de `main`, tandis que la vérité de développement est `config-par-environnement`. Claude peut lire la branche canonique, mais ses commits restent souvent sur une lignée divergente. Le résultat est une accumulation de branches contenant des variantes concurrentes et des travaux utiles non rapatriés.

Cette situation viole l'esprit de `ENV-001` si un travail est considéré livré simplement parce qu'il existe sur une branche Claude. Dorénavant : **un travail Claude n'est intégré que lorsque son delta utile a été réappliqué/rebasé sur le HEAD canonique, testé là, et matérialisé dans Handoff.**

## Ordre de réconciliation recommandé

1. **Ne pas interrompre ni mélanger le lot Carburants actif.** Consommer d'abord sa décision déjà envoyée et terminer P0 + UI Test dans son périmètre.
2. **Rapatrier Gouvernance backend** depuis `4ecccc85` de façon sélective : nouveaux outils/tests seulement, après comparaison avec HEAD canonique.
3. **Rapatrier NEXUS Live** depuis `990a0f1` sur HEAD canonique, puis appliquer migration uniquement à Supabase Test, connecter un producteur minimal d'événements et faire les recettes d'accès requises.
4. **Capitaliser l'audit Architecture** de `157316e` dans Backlog/lot dédié ; corriger ensuite les bugs déterministes sans mélanger avec Live/Carburants.
5. **Event-driven `7a5d329`** : reprendre uniquement les garanties encore absentes ; ne pas dupliquer la Gouvernance v2 déjà canonique.
6. **Branches Carburants 1314/1315/1323/2014** : conserver comme preuves historiques ; intégrer uniquement un delta manquant explicitement démontré par tests du HEAD courant.
7. **Clôture services** : requalifier comme historique et auditer contre les migrations/services actuels avant tout nouveau lot.

## Règles de sécurité pour Claude

- partir du HEAD courant `config-par-environnement`, jamais de la branche ancienne comme base ;
- ne jamais merger/cherry-pick aveuglément une branche stale ;
- comparer fichier par fichier et intention par intention ;
- ne jamais réintroduire `.github/workflows/claude.yml` provenant des branches Claude ; le control-plane `main` est séparé ;
- aucun `main`, `production`, Supabase Production ou NEXUS Production ;
- aucune réécriture rétroactive des anciens request/decision ;
- si le HEAD canonique contient déjà une solution équivalente ou meilleure, classer l'ancien delta `SUPERSEDE` et ne rien modifier ;
- après chaque rapatriement, tests ciblés + régression + Guardians backend ;
- un seul nouveau `request-N.md` par unité de travail réellement réconciliée.

## Définition de cohérence retrouvée

La cohérence est retrouvée lorsque :
- chaque branche historique est classée `INTEGREE`, `SUPERSEDEE`, `A_REPRENDRE` ou `HISTORIQUE_SANS_ACTION` ;
- aucun travail utile n'existe uniquement sur une branche Claude sans être référencé par une source canonique ;
- `config-par-environnement` contient les seules versions actives ;
- les tests prouvent les versions actives sur Test ;
- le rail empêche qu'une future branche Claude soit déclarée livrée avant réintégration canonique.
