# Frontière NEXUS Connector / `service_role`

Date : 2026-09-06 · Statut : **frontière inscrite, aucune implémentation autorisée**
Fondement : `DOCTRINE-PROPRIETE-CREATEUR-DONNEES-CLIENTS.md`

Ce document ne développe pas le Connector. Il inscrit sa frontière **avant**
qu'il existe, pour que le chantier en cours ne crée pas aujourd'hui une
exception que le Connector exploiterait demain.

## Le principe qui gouverne

> **Le créateur contrôle NEXUS. Le client contrôle l'usage de ses données.**
> Les droits techniques existent pour faire fonctionner NEXUS, jamais pour
> transformer les données d'un client en actif librement réutilisable.

Appliqué au Connector : ses droits sont des **droits d'exécution**, pas des
droits de propriété ni de réutilisation.

## Ce que `service_role` est, et n'est pas

Le tri des `UNKNOWN` du 06/09/2026 a classé
`fdj_site_settings_write_service_role` en `NOT_APPLICABLE` : elle est en
`using (true)`, mais réservée à `service_role`, qui n'est pas une identité
utilisateur.

**Ce n'est pas une absolution.** C'est un **déplacement** du contrôle vers la
couche qui détient la clé. Aujourd'hui la frontière tient par un fait
contingent : `nexus-test` n'héberge **aucune** fonction Edge, donc personne
n'emprunte ce chemin. Le jour où le Connector existera, ce fait disparaît.

> `service_role` ne doit jamais devenir un passe-partout métier.

## Contrat obligatoire avant toute activation

1. **Exécution serveur uniquement.** Jamais de clé `service_role` dans le
   navigateur, un client, un dépôt ou un journal.
2. **Site cible explicite** dans chaque job, import ou synchronisation.
   Absence ou contradiction de site : **fail closed**, jamais de repli.
3. **Traçabilité** de l'identité machine, de la provenance, de la finalité et
   des écritures réalisées.
4. **Permissions minimales par fonction** plutôt qu'un `service_role`
   générique, partout où l'architecture le permet.
5. **Séparation** entre import brut, validation métier et écriture finale.
6. **Idempotence**, journal d'import, erreurs, rejeu et rollback.
7. **Aucune déduction silencieuse** d'un site — et surtout pas de
   Sainte-Marie. C'est le défaut que tout le chantier `SITE-EXPLICITE-1` a
   servi à éliminer ; le Connector ne doit pas le réintroduire par une porte
   technique.
8. **Tests multi-site positifs et négatifs**, avant activation.
9. **Secrets hors dépôt et hors journaux**, rotation possible.
10. Une policy `TO service_role` n'est `NOT_APPLICABLE` pour la garde
    utilisateur **que si** sa frontière machine est inventoriée et auditée.

## Ce que le Connector ne peut jamais faire

Reprises de la doctrine, appliquées à une identité machine :

- mélanger, exposer ou réutiliser les données d'un client au bénéfice d'un
  autre ;
- constituer des comparatifs identifiables entre entreprises clientes ;
- enrichir ou entraîner un modèle avec des données identifiables d'un client
  sans cadre explicite ;
- conserver un accès au-delà de la finalité qui l'a justifié.

Une identité machine n'a pas moins d'obligations qu'une identité humaine.
Elle en a davantage, parce qu'elle agit sans témoin.

## Conséquence immédiate pour la garde ADR-0001

La garde classe `TO service_role` en `NOT_APPLICABLE` **pour l'identité
utilisateur**. Ce classement devra être revu le jour où une identité machine
existera réellement : il deviendra alors une **frontière à auditer**, pas une
case à ignorer.

**Aucune implémentation n'est autorisée par ce document.**
