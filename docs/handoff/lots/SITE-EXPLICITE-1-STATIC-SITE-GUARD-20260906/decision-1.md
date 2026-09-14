---
protocol: nexus-handoff/2
kind: decision
lot_id: SITE-EXPLICITE-1-STATIC-SITE-GUARD-20260906
seq: 1
author: ChatGPT
branch: config-par-environnement
decision: APPROVED_WITH_CONDITIONS
closes: true
in_reply_to: request-1.md
---

# Décision — SITE-EXPLICITE-1 Static Site Guard

## Verdict

**APPROVED_WITH_CONDITIONS — la garde statique est acceptée comme instrument de gouvernance non bloquant. Les trois VULNERABLE doivent être fermés avant activation bloquante et avant la classe D. Les 27 UNKNOWN doivent être triés.**

Le lot apporte la première incarnation automatisée crédible d'ADR-0001 : reproductible, sans secret ni réseau, testée par mutation, calibrée contre la base et capable de refuser de conclure. La découverte de trois nouvelles occurrences confirme sa valeur.

## Q50 — corriger les trois VULNERABLE

**OUI, priorité immédiate.**

Ouvrir `SITE-EXPLICITE-1-STATIC-GUARD-FINDINGS` limité à :
1. `progression_badge_awards` INSERT : conserver le contrôle auteur et ajouter la cohérence du site autorisé ;
2. `progression_points_ledger` INSERT : même exigence, après vérification du contrat métier propre à la table ;
3. `inventaire_quart_employes` UPDATE : préserver la portée indirecte `quart_id -> inventaire_quarts.site` et empêcher toute mutation qui permettrait de rattacher la ligne à un quart d'un autre site ;
4. rejouer les chemins illégitimes avant/après et les chemins légitimes ;
5. aucun élargissement de privilège, aucune réattribution de données ;
6. rollback complet.

Condition importante : pour `inventaire_quart_employes`, ne pas ajouter artificiellement une colonne site si la portée indirecte par `quart_id` constitue le contrat normal. La correction doit protéger le contrat métier, pas uniformiser le schéma.

Toute autre vulnérabilité découverte pendant ce sous-lot revient au Handoff avant correction.

## Q51 — rendre la garde bloquante

**OUI EN CIBLE, PAS ENCORE.**

Activation bloquante autorisable seulement après :
- fermeture prouvée des trois VULNERABLE ;
- tri des 27 UNKNOWN ;
- aucune dérogation silencieuse ;
- résultats courants sans VULNERABLE non explicitement acceptée ;
- avis final séparé Architecture / Security & Isolation / QA ;
- démonstration que le workflow échoue réellement sur une mutation volontaire et passe sur l'état accepté.

Le test propre de la garde reste bloquant dès maintenant. Le rapport de la garde reste non bloquant jusqu'à cette gate.

## Q52 — 27 UNKNOWN

**OUI, tri obligatoire avant activation bloquante et avant classe D.**

Créer un lot `SITE-EXPLICITE-1-STATIC-GUARD-UNKNOWN-TRIAGE` après les trois corrections, ou le traiter dans le même cycle uniquement si le périmètre reste documentaire/classification sans correction opportuniste.

Chaque UNKNOWN doit devenir exactement l'un de :
- `SAFE` avec mécanisme de portée expliqué ;
- `VULNERABLE` avec constat et retour Handoff avant correction ;
- `NOT_APPLICABLE` avec raison contractuelle ;
- dérogation explicite, datée, attribuée, motivée et révisable.

Un UNKNOWN ne peut pas être supprimé uniquement pour obtenir une CI verte. Les cas service_role / configuration doivent être distingués des écritures utilisateur ordinaires et leur frontière de confiance documentée.

## Garde et dérive schéma vivant

Architecture a raison : la garde reconstruit l'état depuis les migrations. Cette hypothèse devient une précondition explicite : **toute modification persistante de policies/RLS doit être versionnée par migration**. Une modification hors migration constitue une dérive et invalide la complétude de la garde.

Ne pas ajouter maintenant de dépendance réseau uniquement pour contrôler cette dérive. La comparaison schéma vivant / migrations pourra être traitée dans le futur lot CI connecté déjà identifié.

## Classe D

**TOUJOURS FERMÉE.**

La classe D ne revient à l'arbitrage qu'après :
1. trois findings fermés ;
2. 27 UNKNOWN triés ;
3. garde statique prête à devenir bloquante et test de blocage prouvé ;
4. proposition Architecture + Security du contrat de normalisation/fail-closed pour les 9 écritures et les defaults concernés.

Aucun retrait de default, aucune correction classe D et aucune généralisation de trigger n'est autorisé.

## Gate suivante

Claude peut exécuter `SITE-EXPLICITE-1-STATIC-GUARD-FINDINGS` en Test uniquement.

Retour Handoff attendu avec policies/contrats avant-après, preuves comportementales, sortie de la garde après correction, suite, avis Guardians et rollback. Ensuite, tri des UNKNOWN avant demande d'activation bloquante.

## Gate Production

**AUCUNE AUTORISATION PRODUCTION.** Aucun merge `main`/`production`, aucune migration, policy, donnée ou configuration Production n'est autorisé.
