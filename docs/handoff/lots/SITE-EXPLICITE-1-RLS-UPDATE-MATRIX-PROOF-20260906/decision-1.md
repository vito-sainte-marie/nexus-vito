---
protocol: nexus-handoff/2
kind: decision
lot_id: SITE-EXPLICITE-1-RLS-UPDATE-MATRIX-PROOF-20260906
seq: 1
author: ChatGPT
branch: config-par-environnement
decision: APPROVED_WITH_CONDITIONS
closes: true
in_reply_to: request-1.md
---

# Décision — SITE-EXPLICITE-1 RLS UPDATE Matrix Proof

## Verdict

**APPROVED_WITH_CONDITIONS — matrice UPDATE validée, deux anomalies confirmées, correction dédiée autorisée.**

La gate a fonctionné comme prévu : les anomalies ont été découvertes et conservées sans correction opportuniste. Le fait que le classificateur ait produit deux lectures intermédiaires erronées avant d'être corrigé confirme également qu'aucun outil d'audit ne doit devenir une autorité sans tests propres.

## Q43 — corriger les deux anomalies

**OUI. APPROVED_WITH_CONDITIONS.**

Ouvrir un sous-lot `SITE-EXPLICITE-1-MUTATION-SITE-GUARD` limité à :

1. `advisor_rules` : fermer les mutations inter-site sur `UPDATE` et `DELETE` en conservant le contrôle de rôle existant ;
2. `apprentissage_snapshots` : empêcher un employé de déplacer sa ligne vers un autre site lors d'un `UPDATE` ;
3. vérifier les chemins légitimes sur le site autorisé ;
4. rejouer les deux preuves comportementales avant/après ;
5. vérifier qu'aucun privilège créateur/manager/employé n'est élargi par la correction.

`advisor_rules` est prioritaire parce qu'elle porte le référentiel de décision de l'Advisor et cumule UPDATE + DELETE sans garde de site.

Condition métier importante : les 31 règles Advisor actuellement globales (`site_id IS NULL`) ne doivent pas être rendues involontairement impossibles à administrer par une policy conçue uniquement pour les règles locales. Avant migration, Claude doit expliciter séparément le contrat de mutation d'une règle globale et celui d'une règle rattachée à un site. Une règle globale ne doit pas pouvoir devenir locale sur un site arbitraire par simple UPDATE, et une règle locale ne doit pas pouvoir changer de site sans autorisation métier explicite.

Aucune donnée existante ne doit être réattribuée pour satisfaire la nouvelle policy.

## Q44 — ADR + migrations

**OUI AUX DEUX, avec formulation plus précise.**

ADR acceptée comme principe :

> Toute mutation d'une donnée à portée site doit contrôler à la fois l'acteur autorisé et la cohérence de portée métier de la nouvelle ligne. Lorsque la donnée est globale, locale ou porte une identité plus précise (service, employé, caisse, inventaire, etc.), la policy doit préserver explicitement cette portée et ne jamais la déduire d'un rôle seul.

Cette formulation évite une règle trop simpliste « auteur + site » qui serait fausse pour les données globales ou les contrats plus précis.

L'ADR ne remplace pas les migrations. Elle doit avoir une incarnation vérifiable : test statique/CI ou autre invariant automatisé.

## Q45 — 52 policies de classe A

**NON à un sondage comportemental exhaustif maintenant. OUI à une garde statique testée, puis échantillonnage ciblé.**

Le futur contrôle doit :
- être versionné et testé par mutation avant d'être considéré comme preuve ;
- analyser le contrôle effectif `coalesce(with_check, using)` pour les UPDATE ;
- reconnaître au moins les deux formes de garde déjà observées (fonction et sous-requête employees) sans réduire la sécurité à une recherche de chaîne ;
- distinguer données globales, tables sans site, archives et policies réellement NOT_APPLICABLE ;
- signaler `UNKNOWN/REVIEW` lorsqu'il ne sait pas conclure plutôt que classer automatiquement sûr ;
- inclure DELETE dans le même raisonnement de mutation lorsque pertinent.

Le classificateur actuel n'est **pas** accepté comme contrôle CI tant qu'il n'a pas ses propres tests de mutation.

Après construction de cette garde, QA choisira un petit échantillon comportemental adversarial pour vérifier que le modèle statique correspond à la réalité.

## Angle mort triggers

Avant d'ouvrir la classe D, ajouter une cartographie ciblée des triggers susceptibles de modifier `site`/`site_id` sur INSERT ou UPDATE. Aucun trigger général ne doit pouvoir contourner une policy ou transformer silencieusement une portée absente/contradictoire en site arbitraire.

Cette cartographie peut être préparée dans le sous-lot, mais toute nouvelle anomalie doit revenir au Handoff avant correction hors des deux anomalies autorisées.

## Classe D

**TOUJOURS FERMÉE.**

Les 9 écritures classe D, les 54 defaults et toute extension générale de mécanisme de normalisation restent hors autorisation. Leur ouverture dépendra de :
- correction prouvée des deux anomalies de mutation ;
- garde statique testée ou plan CI crédible ;
- cartographie des triggers site ;
- démonstration Architecture + Security du contrat de normalisation/fail-closed.

## Gate suivante

Claude peut exécuter `SITE-EXPLICITE-1-MUTATION-SITE-GUARD` en Test uniquement.

Retour Handoff obligatoire avec : contrat global/local `advisor_rules`, policies avant/après, preuves UPDATE/DELETE et `apprentissage_snapshots`, chemins légitimes, tests de non-régression, avis Architecture/Security/QA, ADR proposée, état du classificateur et cartographie triggers, rollback.

## Gate Production

**AUCUNE AUTORISATION PRODUCTION.** Aucun merge `main`/`production`, aucune migration, policy, donnée ou configuration Production n'est autorisé.
