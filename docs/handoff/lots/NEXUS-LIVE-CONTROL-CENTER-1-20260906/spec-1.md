# NEXUS LIVE DÉVELOPPEMENT — Spécification MVP

Lot : `NEXUS-LIVE-CONTROL-CENTER-1-20260906`
Statut : conception Test uniquement

## 1. Positionnement

**NEXUS LIVE DÉVELOPPEMENT** est le poste d'observation interne du Créateur NEXUS.

Il répond au principe : **autonomie sans opacité**.

Il n'est ni un module métier client, ni un tableau de bord manager, ni un panneau d'administration multisite. Il observe le système de développement et d'orchestration NEXUS.

Principe de rôles :
- Manager : administre l'exploitation de sa structure selon ses droits métier.
- Créateur NEXUS : dispose en plus de capacités système internes NEXUS.
- Un rôle client ne peut jamais devenir Créateur par héritage, configuration multisite ou délégation.

## 2. Capacité d'accès

Capacité canonique proposée : `nexus_creator_live_development`.

Cette capacité :
- est indépendante de `manager`, `admin_site`, `owner_company` et des rôles multisites ;
- n'apparaît pas dans l'éditeur de permissions client ;
- n'est pas assignable par un manager ;
- n'est pas délégable depuis une structure cliente ;
- est vérifiée côté serveur avant toute lecture de données Live ;
- fail closed si la preuve manque ou est ambiguë.

Le masquage du menu côté UI est uniquement une mesure UX. Il ne constitue jamais la sécurité d'accès.

## 3. Emplacement dans NEXUS

Le menu NEXUS peut afficher une entrée :

`NEXUS LIVE DÉVELOPPEMENT`

uniquement lorsque la session courante possède explicitement `nexus_creator_live_development`.

Pour toutes les autres sessions, l'entrée n'est pas rendue.

Un accès direct à la route par un utilisateur non autorisé retourne un refus d'accès sans révéler de données de développement.

Cette entrée est volontairement hors des réglages multisites et hors de la matrice des droits managers.

## 4. Vue principale MVP

### Bandeau supérieur

- `NEXUS LIVE DÉVELOPPEMENT`
- état global : `Système autonome`, `Intervention requise`, `Bloqué en sécurité`, `Au repos`
- dernière activité significative
- environnement observé : Test / autre environnement explicitement autorisé

### Bloc « Maintenant »

Une carte dominante répond à :
- agent actif ;
- lot actif ;
- étape actuelle ;
- durée depuis le début de l'étape ;
- dernière mise à jour ;
- prochaine étape automatique.

Exemple de langage UI :

> Claude développe le correctif Carburants. Tests à suivre automatiquement.

Le résumé humain ne remplace jamais les champs structurés qui constituent la vérité d'exécution.

### Timeline Live

Timeline courte, du plus récent au plus ancien :
- Orchestrator a reçu l'événement ;
- décision canonique vérifiée ;
- Claude a commencé ;
- modification terminée ;
- tests lancés ;
- Guardian QA en revue ;
- CI validée.

Chaque ligne peut exposer l'heure, l'agent, le statut et une preuve technique secondaire (commit/run) sans polluer la lecture principale.

### Bloc Guardians

Pour chaque Guardian applicable :
- `À venir`
- `En revue`
- `Validé`
- `Veto / correction requise`
- `Non applicable`

Guardians minimum : Architecture & Cohérence, Security & Isolation, Business Rules, QA / Regression, Bible / Philosophie.

### Bloc Tests & CI

- tests ciblés ;
- non-régression ;
- CI ;
- dernière preuve ;
- état explicite : attente / en cours / vert / rouge.

### Bloc Intervention

Absent dans le flux nominal.

S'il existe un vrai gate humain :
- question précise ;
- pourquoi l'humain doit intervenir ;
- éléments déjà vérifiés automatiquement ;
- conséquences des options ;
- aucune demande de validation artificielle.

## 5. Contrat d'événement d'exécution

Version initiale proposée : `nexus-execution-event/1`.

Champs minimum :

```json
{
  "protocol": "nexus-execution-event/1",
  "event_id": "uuid-or-stable-id",
  "occurred_at": "ISO-8601",
  "lot_id": "LOT-ID",
  "run_id": "provider-independent-correlation-id",
  "actor": {
    "id": "agent-id",
    "role": "execution|orchestrator|guardian|ci"
  },
  "phase": "ANALYSE|EXECUTION|TEST|GUARDIAN_REVIEW|CI|GATE|DONE",
  "status": "STARTED|PROGRESS|PASSED|FAILED|BLOCKED|WAITING",
  "summary": "résumé court sans donnée sensible",
  "evidence": {
    "type": "commit|run|test|decision|handoff",
    "ref": "opaque-reference"
  },
  "next_step": "étape structurée ou null",
  "human_gate": {
    "required": false,
    "reason_code": null,
    "question": null
  },
  "source": {
    "provider": "github|claude|nexus|other",
    "external_id": "optional"
  }
}
```

### Règles

- `event_id` est idempotent : le même événement ne crée pas deux étapes Live.
- le fournisseur n'est pas l'identité métier de l'agent ; Claude peut être remplacé sans casser l'UI ;
- le journal est historisé/append-only ;
- un événement réveille ou renseigne, il n'autorise jamais une opération à lui seul ;
- STATE/Handoff/décision canonique restent les sources d'autorisation ;
- les événements ne contiennent ni secrets, ni tokens, ni données clientes brutes.

## 6. Modèle de projection Live

L'UI ne doit pas relire et interpréter tous les logs à chaque affichage. Une projection structurée peut être maintenue à partir du journal :

```json
{
  "system_status": "AUTONOMOUS|HUMAN_REQUIRED|FAIL_CLOSED|IDLE",
  "active_lots": [],
  "active_actor": null,
  "current_phase": null,
  "guardians": {},
  "tests": {},
  "ci": {},
  "next_automatic_step": null,
  "last_event_id": null,
  "updated_at": null
}
```

Le MVP peut commencer avec GitHub/Handoff/Actions comme sources, mais la cible est cette projection structurée afin d'éviter le parsing fragile de texte libre.

## 7. Sécurité

Deux frontières sont distinctes :

1. **Peut-on accéder à NEXUS LIVE DÉVELOPPEMENT ?** → capacité Créateur obligatoire.
2. **Quelles données le Live peut-il exposer ?** → uniquement métadonnées d'exécution minimisées et autorisées.

Le Créateur ne reçoit pas automatiquement les données opérationnelles d'un client parce qu'il observe le moteur NEXUS.

Tests négatifs obligatoires :
- employé → refus ;
- manager station → refus ;
- manager multisite → refus ;
- administrateur client → refus ;
- propriétaire entreprise cliente → refus ;
- utilisateur connaissant l'URL → refus ;
- session sans capacité explicite → refus ;
- capacité absente/illisible → fail closed.

Test positif : session Créateur explicitement autorisée → accès aux seules métadonnées Live autorisées.

## 8. Non-objectifs MVP

Le MVP ne doit pas :
- devenir un terminal GitHub ;
- exposer des logs bruts par défaut ;
- permettre d'éditer STATE à la main ;
- permettre de contourner les Guardians ;
- permettre de promouvoir en Production sans gate explicite ;
- permettre de modifier les droits clients ;
- mélanger monitoring de développement et données métier clients.

## 9. Intégration avec l'Orchestrator event-driven

Une fois le rail event-driven validé :

`événement externe → normalisation nexus-execution-event/1 → validation/idempotence → journal → projection Live → UI`

En parallèle :

`événement externe → Orchestrator → relecture STATE/Handoff/décision → action autorisée ou fail closed`

Les deux flux partagent l'événement mais pas la responsabilité : **Live observe ; Orchestrator décide du prochain mouvement autorisé.**

Le watchdog horaire peut également publier un événement de réconciliation, par exemple `WAITING`, `STALE`, `RECOVERED`, sans créer de nouvelle autorisation.

## 10. Ordre d'implémentation proposé

1. figer le contrat `nexus-execution-event/1` après confrontation avec le rail event-driven réellement livré ;
2. implémenter la capacité système Créateur et ses tests négatifs ;
3. produire le journal/projection Live en Test ;
4. connecter Handoff et GitHub Actions ;
5. créer la page NEXUS LIVE DÉVELOPPEMENT et son affichage conditionnel ;
6. connecter les Guardians ;
7. tester le scénario complet avec un lot Test réel ;
8. seulement après preuve, envisager une promotion séparée avec gate explicite de Frédéric.

## 11. Critère de réussite

Frédéric ouvre NEXUS LIVE DÉVELOPPEMENT et comprend en moins de dix secondes : **ce que NEXUS est en train de faire, pourquoi, qui travaille, ce qui a été prouvé, ce qui vient ensuite et s'il doit réellement intervenir.**

Il peut ensuite fermer la page sans interrompre ni ralentir le travail autonome.
