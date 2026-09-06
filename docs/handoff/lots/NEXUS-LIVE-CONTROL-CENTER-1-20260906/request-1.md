# NEXUS Handoff — request-1

protocol: nexus-handoff/2
lot_id: NEXUS-LIVE-CONTROL-CENTER-1-20260906
type: architecture-and-product-spec
branch: config-par-environnement
environment: TEST_ONLY
requested_by: Frederic Bragance

## Objet

Concevoir le Centre de contrôle des agents NEXUS permettant d'observer la progression du travail automatisé en temps réel sans rendre Frédéric responsable de la surveillance ni de l'avancement nominal du système.

Principe cardinal : **autonomie sans opacité**.

Le système doit travailler de manière autonome ; l'observabilité doit permettre de comprendre instantanément l'état du travail lorsqu'un humain choisit de regarder, sans exiger de clics ou d'actions pour faire avancer les agents.

## Philosophie obligatoire

- automatisation par défaut, humain par exception ;
- l'humain intervient par valeur, jamais par défaut ;
- une interface de supervision informe, elle ne devient pas un moteur manuel du workflow ;
- ne jamais rediscuter une décision canonique existante sans preuve nouvelle ;
- chaque moteur/agent conserve son domaine de responsabilité ;
- le Centre de contrôle agrège les vérités d'exécution, il ne recrée pas les calculs ou décisions des agents ;
- simplicité d'usage visible, complexité interne maîtrisée ;
- les états doivent être explicites, auditables et compréhensibles en quelques secondes.

## Cible UX

En moins de 10 secondes, Frédéric doit pouvoir répondre à :
1. Qui travaille actuellement ?
2. Sur quel lot ?
3. Quelle étape est en cours ?
4. Qu'est-ce qui est déjà terminé ?
5. Quels tests / CI / Guardians sont passés ou bloquent ?
6. Y a-t-il un vrai gate humain ?
7. Quelle est la prochaine étape automatique ?
8. Le système est-il en train d'avancer normalement, d'attendre un événement, ou d'être bloqué ?

## États minimums à représenter

- IDLE / EN_ATTENTE_EVENT
- EN_ANALYSE
- EN_EXECUTION
- EN_TEST
- EN_REVUE_GUARDIAN
- ATTENTE_CI
- ATTENTE_DECISION_HUMAINE
- BLOQUE_FAIL_CLOSED
- TERMINE

## Agents / rôles visibles

Au minimum :
- NEXUS Orchestrator
- Claude / ingénieur d'exécution
- Guardian Architecture & Cohérence
- Guardian Security & Isolation
- Guardian Business Rules
- Guardian QA / Regression
- Guardian Bible / Philosophie

La vue doit pouvoir accueillir de futurs agents sans refonte de structure.

## Informations par activité

Chaque activité affichée doit être issue d'une vérité d'exécution explicite :
- agent / rôle
- lot_id
- étape
- statut
- horodatage début / dernière mise à jour
- source de vérité / commit / run associé
- résultat de l'étape précédente
- prochaine étape prévue
- blocage éventuel
- human_gate_required: true/false
- raison du gate si true
- niveau de confiance / preuve disponible si pertinent

## Principe d'observabilité

Le Centre de contrôle ne doit pas dépendre du parsing fragile de logs humains. Concevoir un contrat d'événements / statuts structurés, versionné et exploitable par l'Orchestrator et les agents.

Le modèle doit permettre le live sans coupler l'UI à Claude, GitHub Actions ou un fournisseur particulier.

## Architecture attendue

Étudier une structure du type :

Agent / workflow / Guardian
→ événement d'état structuré
→ journal d'exécution canonique
→ Orchestrator
→ vue Live NEXUS

Le journal doit être append-only ou historisé, idempotent et corrélable par lot_id / event_id / run_id.

Le Centre de contrôle lit la vérité d'exécution ; il ne pilote pas l'exécution nominale.

## Mode intervention humaine

La présence d'un gate humain doit être rare, explicite et justifiée. L'interface peut présenter l'arbitrage demandé, mais ne doit jamais créer artificiellement des approbations manuelles pour des étapes que la Bible, les Guardians ou la CI peuvent décider de manière fiable.

Question obligatoire : **Pourquoi un humain doit-il intervenir ici ?**

## MVP demandé

Spécifier un MVP capable d'afficher :
- le lot actif ;
- l'agent actuellement actif ;
- une timeline courte des dernières étapes ;
- progression / état des Guardians ;
- état des tests et CI ;
- blocage ou gate humain ;
- prochaine étape automatique ;
- dernier événement reçu ;
- indicateur « système autonome / intervention requise ».

Le MVP doit d'abord exploiter les sources déjà présentes dans GitHub / Handoff / Actions avant d'ajouter une nouvelle infrastructure.

## Acceptance criteria

1. Architecture indépendante du fournisseur d'agent.
2. Aucun besoin de surveillance humaine nominale.
3. Lecture de progression en moins de 10 secondes.
4. États structurés et non déduits uniquement de texte libre.
5. Historique corrélable au lot et aux preuves.
6. Compatible avec event-driven Orchestrator et watchdog horaire.
7. Aucun nouveau droit Production.
8. Aucun secret exposé.
9. Pas de duplication des décisions ou calculs des moteurs/agents.
10. UX cohérente avec NEXUS : sobre, claire, directionnelle, explicite.

## Contraintes

- ne pas mélanger ce lot avec NEXUS-ORCHESTRATOR-EVENT-DRIVEN-1-20260906 ;
- ce lot peut avancer en conception pendant que Claude finalise le rail event-driven ;
- pas d'implémentation qui dépend d'un état non encore prouvé du rail event-driven ;
- pas de main, production, Supabase Production ou NEXUS Production ;
- pas de service_role côté navigateur/repo/logs.

## Retour attendu

Audit d'architecture + spécification produit/UX + schéma d'événements/statuts + proposition MVP + points d'intégration avec le rail event-driven une fois celui-ci validé.

Ne demander une décision à Frédéric que s'il existe un vrai choix stratégique non tranché par la Bible ou les décisions canoniques existantes.
