# Charte des rôles NEXUS, version 2

**Statut : CIBLE, NON ENCORE APPLIQUÉE.**

Tant que les lots de mise en conformité (GOV-01 à GOV-09) ne sont pas prouvés, les textes en vigueur restent applicables : `CLAUDE.md`, `PROTOCOL.md`, `ARBITRAGES-ACQUIS.json` et `ARBITRE-CHATGPT.md`.

Le passage de « cible » à « appliquée » est une décision de Frédéric. Elle se prend sur le banc de gouvernance vert (GOV-09).

## Origine

- 18/10/2026 : demande de Frédéric de clarifier les rôles, pour n'intervenir que sur les fusions et la Production.
- Inventaire de gouvernance du 18/10/2026.
- Contre-arbitrage de ChatGPT du 18/10/2026, cité mot pour mot en annexe : **APPROVED_WITH_CONDITIONS**, architecture de principe uniquement.
- Propositions de conception de ChatGPT du 19/10/2026, accord de principe de Frédéric en conversation, **à confirmer** (`PROPOSITIONS-CONCEPTION-20261019.md`). Elles précisent le rôle de Guardian (contrôle) et ajoutent la vigie (surveillance) aux sept acteurs du contre-arbitrage.

## Principe

Chaque rôle se définit par :
- ce qu'il décide ;
- ce qu'il exécute ;
- ce qu'il ne peut **techniquement** pas faire.

Une responsabilité n'est acquise que si une identité, une permission ou un contrôle indépendant l'impose. Une instruction donnée à l'agent ne suffit pas.

## Les acteurs

| Acteur | Mission | Décide | Exécute | Ne peut pas, techniquement (cible) |
|---|---|---|---|---|
| **Frédéric** | Propriétaire | Fusions vers `main` et `production` ; toute opération Production ; nouvel accès ou secret ; armement de la boucle ; changement de doctrine ; opérations irréversibles hors délégation ; tout motif non encore délégué sur preuve | Les réglages que lui seul peut faire | Sans objet |
| **ChatGPT, arbitre** (relais) | Juge indépendant | Ce qui relève de sa délégation, élargie motif par motif une fois la sécurité démontrée | Rien | Écrire sur le rail ou sur une base |
| **ChatGPT, auditeur** (conversations de Frédéric) | Contre-audit | Rien : il recommande | Rien | Écrire quoi que ce soit |
| **Claude Code** | Développeur et exécutant métier ; point d'entrée des demandes de Frédéric | La manière de réaliser ce que la décision autorise | Code, tests, demandes ; écritures Test après décision canonique | Fusionner ; toucher la Production ; modifier les fichiers de la mécanique de la boucle |
| **Claude Guardian** (session cloud) | Contrôleur hors du chemin critique : sens, preuves, identité de l'exécutant ; prépare la mécanique de la boucle et les gardes | Rien : un constat n'est jamais une décision (`docs/guardian/README.md`) | Constats sur l'issue « Constats Guardian » ; documents et analyses préparés dans son espace de travail ; banc ; preuves sur base jetable | Aucun droit d'écriture sur le contenu du dépôt (fichiers, branches, rail) ; seuls des commentaires sur l'issue dédiée, après R1 ; l'intégration de ses documents relève de Claude Code dans un lot autorisé ; clore un lot, consommer ou déposer une décision, publier une demande, commenter #28 ; écrire sur une base ; modifier le code métier |
| **Claude relancé** (`claude.yml`) | Exécutant automatique | Rien | L'action nommée par la décision, hors base de données | Écrire sur une base ; fusionner |
| **Vigie** (workflow planifié, cible R4) | Surveillance déterministe, sans IA | Rien | Vérifie que chaque transition arrive ; alerte ; émet un signal de vie quotidien, dont Guardian contrôle l'absence | Modifier le rail, une décision ou une base |
| **CI** | Chaîne de transmission | Rien | Réveil, relais, dépôt de la décision telle que rendue, relance, alertes | Fabriquer, modifier ou élargir une décision ; agir sans décision |

**Motifs qui réveillent Frédéric.** Ils ne sont pas réduits par principe. Proposition du 19/10/2026 (condition 3), à confirmer :
- ils sont classés selon leur risque et leur autorité légitime ;
- un motif ne passe à la délégation de l'arbitre que si la sécurité du cas délégué est démontrée, par des preuves et des essais du banc ;
- jusque-là, les motifs actuels de `ARBITRAGES-ACQUIS.json` restent en vigueur (10 motifs dans `routage.frederic`, 6 dans `routage.arbitre`, comptés le 19/10).

## Règles communes

1. Seul le rail fait foi. Un accord ou un GO exprimé en conversation n'existe comme décision qu'une fois déposé sur le rail.
2. Un lot a un domaine (métier, mécanique ou gouvernance) et un acteur, inscrits au registre.
3. La décision précède l'action. Aucune écriture Test sans décision canonique antérieure, relue juste avant d'agir.
4. Toute action se rattache à un lot, une décision, un ordre, une exécution et un commit.
5. Un arrêt de la chaîne est toujours signalé, sauf repos justifié et listé.

## Règles de conception proposées le 19/10/2026 (à confirmer)

Le texte intégral figure dans `PROPOSITIONS-CONCEPTION-20261019.md`. Ces règles ne deviennent des décisions qu'une fois confirmées par Frédéric sur le rail.

1. Une erreur de vocabulaire de l'arbitre n'est jamais corrigée en silence par la CI. Elle provoque un refus, puis éventuellement un nouvel arbitrage explicite. Après un nouvel échec, la boucle s'arrête avec une anomalie traçable.
2. L'automatisation de la clôture ne permet pas à la CI de juger qu'une exécution est correcte sur le plan métier. Elle vérifie les conditions formelles, les empreintes et les preuves attendues. Ce qui demande un jugement revient à l'arbitre ou au contrôleur habilité.
3. Les motifs de réveil de Frédéric ne sont pas réduits artificiellement (voir plus haut).
4. Objectifs incontournables : aucune écriture Test sans décision canonique préalable ; aucune opération Production sans autorisation humaine vérifiable.

## Exécuteur Supabase autonome (voie B)

C'est la cible d'architecture. Ni son activation ni l'élargissement des permissions de la CI ne sont autorisés. Jusqu'à décision explicite de Frédéric, les écritures Test restent confiées à Claude Code, après arbitrage conforme.

## Annexe : contre-arbitrage du 18/10/2026, cité mot pour mot

> CONTRE-ARBITRAGE — CHARTE DES RÔLES NEXUS V2
> Verdict : APPROVED_WITH_CONDITIONS — Architecture de principe uniquement.
> La répartition proposée des sept acteurs est retenue comme cible de gouvernance NEXUS.
> Les responsabilités doivent être garanties par des identités, permissions et contrôles techniques indépendants, et non uniquement par les instructions des agents.
> Conditions obligatoires
> 1. Séparer l'identité GitHub de Frédéric de celles utilisées par les agents, sans capacité de contournement des protections.
> 2. Rendre l'approbation humaine effective sur les fusions vers `main` et `production`.
> 3. Cloisonner les accès Supabase : Claude Code sur Test, gardien en lecture seule, Production réservée aux accès autorisés par Frédéric.
> 4. Contrôler techniquement le domaine de chaque lot et l'identité de son exécutant.
> 5. Unifier les sources d'autorité, les motifs STOP, les capacités des canaux et les contrats de décision.
> 6. Exiger une décision canonique antérieure à toute écriture Test, avec preuves de sécurité vérifiables.
> 7. Distinguer les opérations réversibles des opérations irréversibles et maintenir une escalade humaine hors délégation.
> 8. Garantir la détection et le signalement des arrêts silencieux.
> 9. Empêcher la CI de fabriquer, modifier ou élargir une décision d'arbitrage.
> 10. Prouver toutes ces propriétés par des tests négatifs et des essais sur environnement isolé.
> Exécuteur Supabase autonome
> La voie B est retenue comme cible d'architecture, sans autorisation d'activation ni d'élargissement des permissions CI.
> Jusqu'à décision explicite de Frédéric, les écritures Test restent confiées à un exécutant déjà habilité, après arbitrage conforme.
> Limites du présent verdict
> Ce verdict ne constitue pas :
> * un GO de modification des permissions GitHub ;
> * un GO de création de secret ou d'identité ;
> * un GO d'armement de la boucle ;
> * un GO d'écriture sur Supabase ;
> * un GO de fusion ou de déploiement Production.
> Préparer un plan de mise en conformité avec preuves, dépendances, tests et actions nécessitant l'intervention de Frédéric. Ne pas exécuter les changements sensibles sans autorisation distincte.
