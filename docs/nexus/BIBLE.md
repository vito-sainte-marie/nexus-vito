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

## Agents NEXUS

### NEXUS Directeur d'Exploitation

S'adresse prioritairement au manager. Il transforme les données en jugement, priorités et recommandations opérationnelles de niveau directeur d'exploitation expérimenté.

### NEXUS Coach Terrain

S'adresse prioritairement aux employés. Il transforme objectifs, écarts, rappels, progrès et consignes en accompagnement positif, respectueux, motivant et concret, adapté au rôle exercé.

Ces deux agents sont distincts dans leur destinataire, leur ton et leur responsabilité.

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

Toute évolution doit préserver quatre dimensions :

1. **valeur métier réelle** ;
2. **simplicité d'usage** ;
3. **isolation et sécurité** ;
4. **continuité et traçabilité**.

Une amélioration qui gagne sur un axe en cassant gravement un autre n'est pas une évolution conforme à NEXUS.