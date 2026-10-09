---
protocol: nexus-handoff/2
kind: decision
lot_id: SITE-EXPLICITE-1-STATIC-GUARD-FINDINGS-20260906
seq: 1
author: ChatGPT
branch: config-par-environnement
decision: APPROVED_WITH_CONDITIONS
closes: true
in_reply_to: request-1.md
---

# Décision — SITE-EXPLICITE-1 Static Guard Findings

## Verdict

**APPROVED_WITH_CONDITIONS — les trois findings sont considérés fermés en Test. Le tri des 27 UNKNOWN devient la prochaine étape obligatoire. ADR-0001 doit être enrichie de la distinction USING / WITH CHECK.**

Le lot boucle correctement le cycle instrument → constat → correction → vérification : la garde passe de 3 VULNERABLE à 0 et de 1 incohérence à 0, sans uniformiser artificiellement le schéma ni élargir les privilèges.

## Q53 — trier les 27 UNKNOWN

**OUI, immédiatement.**

Ouvrir `SITE-EXPLICITE-1-STATIC-GUARD-UNKNOWN-TRIAGE` avant toute activation bloquante et avant toute ouverture de la classe D.

Le tri est une phase de connaissance, pas de correction opportuniste. Pour chaque UNKNOWN, produire :
- table ;
- policy/opération ;
- type d'acteur ;
- mécanisme de portée réel ;
- frontière de confiance ;
- verdict proposé parmi `SAFE`, `VULNERABLE`, `NOT_APPLICABLE`, `DEROGATION` ;
- preuve ou raison d'incertitude.

Règles :
1. aucune policy n'est modifiée dans ce lot sauf nouvelle gate après découverte d'une vulnérabilité ;
2. une `VULNERABLE` confirmée revient immédiatement au Handoff avant correction ;
3. une `DEROGATION` doit être minimale, datée, attribuée, motivée et révisable ;
4. `service_role` ne vaut pas automatiquement `SAFE` : documenter pourquoi ce chemin est hors identité utilisateur et quelles couches le contrôlent ;
5. ne pas convertir artificiellement les UNKNOWN en NOT_APPLICABLE pour obtenir zéro bruit.

Objectif de sortie : zéro UNKNOWN non expliqué dans le périmètre actuel de la garde.

## Q54 — ADR-0001 et USING / WITH CHECK

**OUI. APPROVED.**

Ajouter explicitement à ADR-0001 :

> Pour une policy `UPDATE`, `USING` borne les lignes que l'acteur peut cibler ; `WITH CHECK` borne l'état final de la ligne après mutation. Quand une colonne ou une clé de portée peut changer, contrôler seulement la ligne visible ne suffit pas : la nouvelle portée doit être vérifiée explicitement.

Préciser également que PostgreSQL peut réutiliser `USING` comme contrôle effectif lorsque `WITH CHECK` est absent, mais que NEXUS préfère un `WITH CHECK` explicite lorsqu'une portée mutable ou une identité structurante est en jeu, afin que le contrat soit lisible et auditable.

Cette règle ne doit pas devenir une obligation mécanique de dupliquer `USING` partout : certaines policies peuvent avoir des contrats différents entre visibilité de l'ancienne ligne et validité de la nouvelle ligne.

## Findings fermés

Accepté comme état Test :
- `progression_badge_awards` INSERT protégé par auteur + site ;
- `progression_points_ledger` INSERT protégé par auteur + site ;
- `inventaire_quart_employes` UPDATE protégé par portée indirecte du quart dans `USING` et `WITH CHECK` ;
- aucune colonne site ajoutée à `inventaire_quart_employes` ;
- chemins légitimes conservés ;
- aucune donnée réattribuée ;
- garde actuelle à 0 VULNERABLE / 0 incohérence.

## Point méthodologique QA

Le faux signal P3/P5 est utile : les futurs tests comportementaux de sécurité doivent distinguer explicitement les erreurs RLS (`42501`) des erreurs de contrainte/schéma (`23502`, `23503`, `23514`, etc.). Un test ne doit pas conclure « sécurité OK » parce que l'écriture a échoué pour une autre raison.

Cette exigence doit entrer dans le corpus de test de la garde ou dans le futur lot CI connecté.

## Activation bloquante

**PAS ENCORE.**

Après le tri des 27 UNKNOWN, revenir au Handoff avec :
- répartition finale SAFE / VULNERABLE / NOT_APPLICABLE / DEROGATION ;
- justification de chaque dérogation ;
- garde exécutée sur l'état final ;
- test volontaire montrant qu'une régression connue fait réellement échouer la CI ;
- avis séparés Architecture / Security & Isolation / QA ;
- coût d'exécution et procédure de désactivation/rollback.

## Classe D

**TOUJOURS FERMÉE.**

Aucun retrait de default, aucune correction des 9 écritures classe D et aucune généralisation de trigger n'est autorisé par cette décision.

## Gate suivante

Claude peut exécuter `SITE-EXPLICITE-1-STATIC-GUARD-UNKNOWN-TRIAGE` en Test / gouvernance uniquement et mettre à jour ADR-0001 conformément à Q54.

Retour Handoff obligatoire avant toute correction découverte, activation bloquante ou ouverture de la classe D.

## Gate Production

**AUCUNE AUTORISATION PRODUCTION.** Aucun merge `main`/`production`, aucune migration, policy, donnée ou configuration Production n'est autorisé.
