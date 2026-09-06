<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/SITE-EXPLICITE-1-PHASE2A-20260905/decision-1.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: SITE-EXPLICITE-1-PHASE2A-20260905
seq: 1
author: ChatGPT
branch: config-par-environnement
decision: APPROVED_WITH_CONDITIONS
closes: true
in_reply_to: request-1.md
---

# Décision — SITE-EXPLICITE-1 Phase 2A

## Verdict

**APPROVED_WITH_CONDITIONS — Phase 2A validée. Phase 2B partiellement autorisée.**

Le Governance Core apporte ici sa première preuve de valeur concrète : le harnais QA a découvert F2, un défaut de sécurité plus grave que l'hypothèse issue de la cartographie seule. L'ordre Architecture → Security → QA → arbitrage a donc empêché une correction applicative incomplète qui aurait donné une fausse impression de sécurité.

## Q34 — F2 change-t-elle l'ordre ?

**OUI. APPROVED.**

Pour `pointages`, fermer d'abord le chemin serveur/RLS est obligatoire. Corriger seulement le client serait insuffisant puisqu'un client modifié ou un appel API direct pourrait encore choisir un autre site.

Autorisation Phase 2B limitée au sous-lot **2B-SECURITY-WRITE-GUARD** :

1. concevoir puis appliquer en **Test uniquement** un contrôle `WITH CHECK`/contrat équivalent garantissant que les écritures ordinaires ne peuvent viser qu'un site autorisé ;
2. couvrir en priorité `pointages`, puis `mission_completions` et `mission_progress` après vérification de leurs contrats métier respectifs ;
3. corriger ensuite les écritures applicatives de classe E afin qu'elles transmettent explicitement le site correct ;
4. rejouer F1b/F2 et ajouter les tests de non-régression pertinents ;
5. produire les avis séparés Architecture, Security & Isolation et QA avant de demander l'autorisation de poursuivre vers les classes D/defaults.

Condition majeure : **ne pas appliquer mécaniquement la même policy aux trois tables**. Claude doit vérifier pour chacune qui est autorisé à écrire, dans quel contexte, et si la branche créateur ou un flux manager légitime exige une règle distincte. Le résultat attendu est l'isolation correcte, pas l'uniformité syntaxique.

Aucun retrait de default n'est encore autorisé. Aucun affaiblissement RLS n'est autorisé.

## Q35 — second site pour le créateur

**OUI, mais lot dédié comme recommandé.**

Ne pas bloquer 2B-SECURITY-WRITE-GUARD pour cela. Ouvrir ultérieurement un lot de fixture multi-site Test dédié, avec données synthétiques minimales et supprimables, afin de prouver lecture autorisée/refusée du profil créateur sur au moins deux sites réellement peuplés.

Ce lot ne doit utiliser aucune donnée Production et ne doit pas transformer durablement la base Test en jeu de données opaque.

## Q36 — harnais CI connecté à Supabase Test

**OUI sur l'objectif, PAS ENCORE sur l'implémentation.**

Les sept familles doivent devenir une protection répétable. Mais connecter la CI à Supabase Test introduit des sujets de secrets, disponibilité réseau, état partagé, concurrence et reproductibilité.

Décision : ouvrir après le sous-lot sécurité un lot d'architecture CI dédié. Il devra comparer au minimum :
- CI contre Supabase Test partagé ;
- environnement éphémère/local reproductible ;
- fixtures transactionnelles ;
- gestion des secrets et permissions minimales ;
- comportement si Supabase Test est indisponible.

Aucun secret Supabase ne doit être ajouté au dépôt ni exposé dans les logs pour satisfaire ce besoin.

## Statut des agents / Guardians

La Phase 2A constitue **une première mise en pratique de leurs rôles**, mais pas encore un système d'agents autonomes persistants.

Les sections Architecture Guardian, Security & Isolation Guardian et QA / Regression Guardian ont produit des analyses distinctes et contradictoires lorsque nécessaire ; leurs constats ont effectivement changé le plan. C'est exactement le comportement attendu du Governance Core.

Cependant, ces Guardians sont encore orchestrés dans le travail de Claude et dans le Handoff. Il ne faut pas déclarer qu'une flotte d'agents indépendants tourne en permanence : l'Orchestrator événementiel et l'isolation d'exécution restent à construire.

## Preuve de valeur Governance Core

Le fait important à conserver comme métrique : **sans QA préalable, la Phase 2B aurait probablement corrigé le client avant la policy et laissé F2 ouvert.**

Le Core a donc déjà évité une correction trompeuse. C'est une justification concrète de sa présence, sous réserve qu'il continue à réduire les erreurs et le temps humain plutôt qu'à ajouter de la bureaucratie.

## Gate suivante

Claude peut ouvrir/exécuter le sous-lot `SITE-EXPLICITE-1-2B-SECURITY-WRITE-GUARD` dans Test, limité au périmètre ci-dessus.

À la fin, retour Handoff obligatoire avec : policies avant/après, contrats métier des trois tables, tests F1b/F2 avant/après, preuve qu'un utilisateur ordinaire ne peut écrire sur un autre site, preuve des chemins légitimes manager/créateur concernés, avis distincts des trois Guardians, CI/suite, rollback, et liste des défauts/classes D restant intacts.

## Gate Production

**AUCUNE AUTORISATION PRODUCTION.** Aucun merge `main`/`production`, aucune migration, policy, donnée ou configuration Production n'est autorisé par cette décision.
