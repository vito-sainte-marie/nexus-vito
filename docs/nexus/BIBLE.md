# NEXUS — Bible produit

## Vision

NEXUS est conçu comme le système d'exploitation intelligent des dirigeants de commerces : un outil qui transforme données, signaux terrain et procédures en décisions, priorités et actions compréhensibles.

Le pilote initial est Vito Sainte-Marie Usine, mais l'architecture doit rester compatible avec un déploiement multi-entreprises et multisites.

## Philosophie

- Le manager doit sentir qu'un directeur d'exploitation expérimenté travaille à ses côtés.
- L'employé doit recevoir un accompagnement utile, positif, concret et non punitif.
- L'interface doit rester simple pour un novice, même lorsque la logique métier sous-jacente est complexe.
- La donnée n'a de valeur que si elle conduit à une compréhension ou à une action pertinente.
- Les preuves réelles du terrain priment sur les hypothèses.
- Une anomalie ne doit jamais être masquée par un affichage rassurant.
- NEXUS automatise tout ce qui peut être détecté, vérifié, transmis ou exécuté de manière fiable ; l'attention humaine est réservée aux exceptions, arbitrages et décisions où le jugement humain crée réellement de la valeur.

## Architecture de vérité et productivité

NEXUS ne recherche pas la simplification technique pour elle-même. L'architecture doit rechercher en priorité la productivité opérationnelle, la cohérence, la fiabilité, l'explicabilité et la capacité d'évolution sans recréer de travail humain inutile.

Principes :

- Chaque moteur métier travaille dans son domaine de responsabilité et produit une vérité métier explicite, traçable et testable.
- Le CIN ne recalcule pas silencieusement les vérités des moteurs. Il les reçoit, les qualifie, les rapproche, les hiérarchise et les transforme en vision transverse exploitable.
- Une règle métier ne doit avoir qu'un propriétaire logique. Les interfaces et agrégateurs consomment cette vérité plutôt que de reconstruire une logique parallèle.
- Les dépendances entre modules doivent passer par des contrats explicites et stables, pas par des hypothèses implicites ou des duplications de calcul.
- L'optimisation doit chercher à supprimer attente, surveillance, double saisie, ressaisie, vérification répétitive et arbitrage humain sans valeur ajoutée.
- La complexité interne est acceptable lorsqu'elle permet une expérience plus simple, fiable et productive pour l'utilisateur ; elle doit rester maîtrisée, observable et testable.

## Permanence des décisions

Une décision NEXUS déjà arbitrée et enregistrée dans une source canonique n'est pas rediscutée à chaque nouveau lot, agent ou conversation.

- Les décisions durables doivent être matérialisées dans la Bible, les ADR, la gouvernance ou le Handoff selon leur nature.
- Un agent doit d'abord rechercher la décision canonique existante avant de proposer une nouvelle architecture.
- Une décision existante est présumée applicable tant qu'aucune preuve nouvelle, contradiction terrain, contrainte légale/sécurité ou changement stratégique ne justifie sa réouverture.
- Si une réouverture est réellement nécessaire, elle doit être explicite : décision concernée, raison, preuves nouvelles, impacts et nouvel arbitrage attendu.
- L'absence de mémoire d'un agent n'est jamais un motif valable pour revenir sur une décision prise.

## Agents NEXUS

### NEXUS Directeur d'Exploitation

S'adresse prioritairement au manager. Il transforme les données en jugement, priorités et recommandations opérationnelles de niveau directeur d'exploitation expérimenté.

### NEXUS Coach Terrain

S'adresse prioritairement aux employés. Il transforme objectifs, écarts, rappels, progrès et consignes en accompagnement positif, respectueux, motivant et concret, adapté au rôle exercé.

Ces deux agents sont distincts dans leur destinataire, leur ton et leur responsabilité.

### NEXUS Guardian Architecture & Cohérence

Examine les évolutions de structure, moteurs, contrats, flux et responsabilités avant validation. Son objectif n'est pas de simplifier pour simplifier : il protège la productivité globale, la cohérence du système et la permanence des décisions déjà prises.

Il vérifie notamment :
- qu'une vérité métier a un propriétaire logique unique ;
- que les moteurs restent autonomes dans leur domaine et transmettent leurs vérités au CIN via des contrats explicites ;
- que le CIN agrège et arbitre sans dupliquer les moteurs ;
- qu'aucune évolution ne recrée une saisie, surveillance ou vérification humaine inutile ;
- qu'une décision canonique existante n'est pas réouverte sans motif démontré ;
- qu'une optimisation locale n'endommage pas la cohérence ou la productivité globale.

Il peut opposer un veto architectural et demander une correction avant intégration.

## Gouvernance des agents — autonomie utile

La gouvernance NEXUS applique la même philosophie que le produit : automatiser ce qui peut l'être de façon fiable et réserver l'humain aux exceptions utiles.

- Claude est le développeur principal : dans un lot Test autorisé, il diagnostique, code, teste, corrige et reteste sans ouvrir une nouvelle boucle d'arbitrage pour chaque bug local.
- NEXUS Orchestrator dirige le programme, reconstruit l'état canonique, arbitre tout ce que les sources permettent de trancher et ne remplace pas Claude dans le codage applicatif.
- Les Guardians fonctionnent en backend : ils ne sont pas interrogés manuellement ; ils restent silencieux sans anomalie et interviennent uniquement lorsqu'un contrôle détecte un risque, une contradiction ou une non-conformité.
- Frédéric n'est sollicité que pour une vraie décision de fondateur ou pour la gate Production.
- La vitesse est recherchée à l'intérieur de Test ; la barrière Test → Production reste volontairement forte.

La gouvernance détaillée est définie dans `docs/gouvernance/2026-09-06-governance-autonome-v2.md` et ADR-0002.

## Apprentissage opérationnel

NEXUS Orchestrator doit capitaliser l'expérience terrain et de développement afin que les problèmes déjà rencontrés coûtent moins cher et moins de temps lors des occurrences suivantes.

L'apprentissage n'est jamais une mémoire implicite d'un modèle. Il est matérialisé dans les sources canoniques :
- doctrine et principes : Bible / gouvernance ;
- décisions structurantes : ADR ;
- règles actives compactes : `docs/learning/RULES.json` ;
- incidents et apprentissages : `docs/learning/EXPERIENCE.jsonl` ;
- contexte temporaire : Handoff.

Un problème résolu deux fois doit déclencher une tentative de transformation en règle, contrôle automatique, test ou runbook avant qu'une troisième analyse humaine identique soit nécessaire.

## Invariant données clients

**Le créateur administre NEXUS mais l'entreprise cliente contrôle l'usage et le partage de ses données.**

Conséquences :
- isolation stricte par entreprise/site ;
- aucun site par défaut implicite pour une opération sensible ;
- moindre privilège ;
- contexte métier explicite ;
- `service_role` uniquement derrière un composant serveur/Connector de confiance ;
- aucune exposition de secret côté navigateur ou workflow public ;
- fail closed lorsque le contexte est insuffisant.

## Environnements

Le développement et les preuves se font sur `config-par-environnement` et Supabase Test.

Aucune promotion vers `main`, `production` ou Supabase Production sans validation humaine explicite de Frédéric.

## Principes UX

- Hiérarchie claire avant densité d'information.
- Une action fréquente doit être rapide.
- Un écran employé ne doit pas exposer une complexité réservée au manager.
- Les explications secondaires utilisent si besoin des informations contextuelles `(i)` plutôt que de polluer l'écran principal.
- Une donnée métier doit être exprimée dans le langage du terrain : jour/quart, couverture, présence réelle, livraison effectuée, etc.
- Les états test/réel, prévu/réalisé, ouvert/clos doivent être visuellement non ambigus.

## Principes de sécurité

- Utilisateur → rôle → site → service → autorisation → donnée.
- Les helpers de sécurité sont éprouvés comportementalement, pas seulement lus statiquement.
- Une aide défaillante ou non éprouvée ne peut pas permettre de classer une policy comme sûre.
- Les opérations rétrospectives ou exceptionnelles utilisent des chemins explicites et auditables plutôt que d'élargir silencieusement les droits normaux.

## Continuité

La mémoire canonique de NEXUS est dans le dépôt.

La procédure de reprise est définie dans `docs/nexus/CONTINUITY.md` et `docs/handoff/REPRISE.md`.

Cette Bible contient les principes durables. Les décisions techniques détaillées restent dans `docs/adr/`, `docs/gouvernance/` et le Handoff.

## Règle d'évolution

Toute évolution doit préserver cinq dimensions :

1. **valeur métier réelle** ;
2. **productivité et simplicité d'usage** ;
3. **cohérence architecturale et permanence des décisions** ;
4. **isolation et sécurité** ;
5. **continuité et traçabilité**.

Une amélioration qui gagne sur un axe en cassant gravement un autre n'est pas une évolution conforme à NEXUS.