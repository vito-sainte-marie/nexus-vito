# Doctrine NEXUS — propriété du créateur et données des entreprises clientes

Date : 2026-09-06
Autorité humaine : Frédéric Bragance
Statut : DÉCISION FONDATRICE

## Principe

**NEXUS est la propriété de son créateur. Le créateur conserve tous les droits nécessaires pour administrer, faire évoluer, sécuriser, maintenir et exploiter la plateforme NEXUS. En revanche, les données propres à chaque entreprise cliente ne deviennent jamais la propriété du créateur du seul fait qu'elles sont traitées par NEXUS.**

La séparation suivante est obligatoire :

- **propriété et gouvernance du produit NEXUS** : créateur NEXUS ;
- **données métier d'une entreprise cliente** : entreprise cliente ;
- **droits techniques nécessaires au fonctionnement de NEXUS** : peuvent appartenir au créateur ou aux services techniques NEXUS, mais uniquement pour exécuter une finalité légitime de plateforme ;
- **utilisation secondaire ou partage des données d'un client** : interdits sans autorisation explicite et base juridique appropriée.

## Droits du créateur sur NEXUS

Le créateur peut notamment :

- créer un nouveau site ou une nouvelle entreprise cliente ;
- administrer la structure de la plateforme ;
- faire évoluer le logiciel, les schémas, les règles globales et les mécanismes techniques ;
- corriger, sécuriser, migrer, sauvegarder, restaurer et superviser NEXUS ;
- activer ou désactiver des capacités produit ;
- gérer les rôles et capacités transverses nécessaires à l'exploitation de la plateforme.

Le fait qu'un site refuse l'accès fonctionnel du créateur à ses données métier ne retire pas au créateur la propriété ni l'autorité sur la plateforme NEXUS elle-même.

## Limite absolue : données d'une entreprise cliente

Le créateur **ne peut pas utiliser ni partager les données d'un client pour une finalité étrangère au service rendu à ce client**, sauf autorisation explicite et base juridique appropriée.

Sont notamment interdits par défaut :

- consultation par curiosité ;
- utilisation commerciale des données d'un client au bénéfice d'un autre client ;
- partage entre entreprises clientes ;
- vente ou communication à un tiers ;
- constitution de benchmarks identifiables inter-clients ;
- entraînement ou enrichissement d'un modèle IA avec les données identifiables d'un client sans cadre explicite ;
- réutilisation d'informations opérationnelles, RH, financières, stocks, ventes, paie ou autres données métier hors de la finalité autorisée.

## Accès technique exceptionnel

Un accès technique aux données peut être nécessaire pour support, incident, sécurité, migration, sauvegarde, restauration ou contrôle d'intégrité. Dans ce cas il doit respecter :

1. finalité explicite et légitime ;
2. accès minimal nécessaire ;
3. traçabilité de l'acteur, du motif, du site et de l'opération ;
4. durée limitée ;
5. absence de réutilisation secondaire ;
6. séparation stricte entre entreprises clientes ;
7. respect des obligations contractuelles et juridiques applicables.

## Conséquence pour le rôle `createur`

Le rôle `createur` n'est pas un rôle métier équivalent à `manager` ou `gerant`. C'est une capacité de gouvernance de la plateforme.

Par conséquent :

- `createur_insert_sites` est **autorisé par Frédéric Bragance** comme capacité constitutive de NEXUS ;
- le créateur peut créer un nouveau site sans site préexistant ;
- une policy de site ne doit pas empêcher le créateur d'administrer la plateforme elle-même ;
- en revanche, les accès aux **données métier d'un client** doivent rester séparés, finalisés, tracés et ne pas devenir une permission transverse implicite ;
- `service_role`, NEXUS Connector, Edge Functions et tout futur agent technique doivent respecter exactement la même séparation.

## Conséquence pour NEXUS Connector

NEXUS Connector peut disposer de droits techniques puissants pour importer, synchroniser ou transformer les données d'un client, mais ces droits sont des **droits d'exécution**, pas des droits de propriété ou de réutilisation.

Chaque job Connector doit porter explicitement :

- l'entreprise / le site cible ;
- la source et la provenance ;
- la finalité ;
- l'identité technique exécutante ;
- les écritures réalisées ;
- les erreurs, rejouages et éventuels rollbacks.

Aucune donnée d'un client ne peut être automatiquement mélangée, exposée ou réutilisée au bénéfice d'un autre client.

## Règle d'arbitrage

**Le créateur contrôle NEXUS. Le client contrôle l'usage de ses données. Les droits techniques du créateur existent pour faire fonctionner NEXUS, jamais pour transformer les données d'un client en actif librement réutilisable par le créateur.**
