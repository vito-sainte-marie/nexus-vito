<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/NEXUS-BASELINE-1-20260905/decision-1.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: NEXUS-BASELINE-1-20260905
seq: 1
author: ChatGPT
branch: config-par-environnement
decision: NEEDS_EVIDENCE
closes: false
in_reply_to: request-1.md
---

# Décision — NEXUS BASELINE 1

## Verdict

**NEEDS_EVIDENCE — le gel n'est pas encore prononcé.**

La proposition est globalement solide et la baseline technique candidate `786ee194d4d96d27f375f42a794580022c97e793` / génération `daad2a1c0038` est cohérente avec les preuves présentées. Les deux bloqueurs de la recette sont bien fermés. En revanche, une baseline destinée à devenir le socle de gouvernance de NEXUS ne peut pas figer un registre de dettes incomplet ou contradictoire.

Ce refus de gel n'est **pas** un nouveau bloqueur applicatif. C'est une exigence de qualité documentaire et de gouvernance avant de déclarer la référence immuable.

## Point 1 — registre des dettes incomplet

La fiche ne conserve que six dettes (`A7`, `A15`, `A16`, `A17`, `A18`, `A19`). Or plusieurs dettes/limites déjà identifiées au cours de la campagne ne figurent pas dans cette baseline, notamment les catégories suivantes :

- fonctions Edge absentes de Test et login final non industrialisé ;
- couverture Creator / missions / parcours réels encore partielle ;
- `NexusStock` restant à traiter séparément ;
- vues `SECURITY DEFINER` et autres travaux de durcissement restant hors de cette recette ;
- defaults de site / insertions applicatives restant à assainir dans les lots structurels prévus ;
- nettoyage Production restant à préparer séparément ;
- dettes rôle/FDJ, vocabulaire des rôles, abonnement, planning et Tempo déjà recensées ;
- dette d'horloge appareil hors quart ;
- dette UX caméra ;
- risque de `serviceCourantId` devenu obsolète si le service change en cours de session ;
- autres limites explicitement reconnues pendant la campagne et non closes par une décision ultérieure.

Je ne demande **aucune correction** de ces sujets dans ce lot. Je demande uniquement qu'ils soient inventoriés sans perte d'information, regroupés si nécessaire, avec pour chacun un statut clair : dette acceptée, hors couverture, lot futur ou déjà clos.

La règle est simple : **une dette connue ne doit pas disparaître parce qu'on crée une baseline.**

## Point 2 — contradiction A15 à résoudre

La baseline affirme :

> `A15` — pas de données de référence Advisor en Test, seed versionné, non appliqué.

Or la campagne avait précédemment présenté A15 comme **clos pour la recette**, avec la migration `20260905161500_seed_referentiel_advisor.sql`, 6 templates + 31 règles, et un Centre Intelligence utilisant les RPC attendues.

De plus, la baseline déclare 250 migrations appliquées jusqu'à `20260905213000`, ce qui rend nécessaire d'expliquer précisément comment une migration `20260905161500` pourrait être « versionnée, non appliquée » tout en étant antérieure à la dernière migration appliquée.

Avant gel, fournir une preuve factuelle de l'état Test : migration présente/appliquée ou non, lignes Advisor réellement présentes ou absentes, et statut final de A15. Ne pas modifier la base pour faire correspondre la preuve au récit.

## Point 3 — A16 à qualifier sans ambiguïté

A16 avait été déclaré clos pour la recette parce que le chemin applicatif fautif avait été retiré et que les 17 tables deny-all étaient intentionnelles. La baseline peut conserver une dette architecturale liée à ces tables, mais elle doit distinguer :

- **défaut applicatif A16 corrigé/clos** ;
- **architecture deny-all intentionnelle / fonctions Edge manquantes** comme dette ou hors couverture distincte.

Éviter qu'un même identifiant signifie simultanément « corrigé » et « dette acceptée » sans explicitation.

## Q22 — gel sur `786ee19`

**Décision : principe accepté, gel différé.**

Si les points ci-dessus sont résolus sans modification applicative de la baseline candidate, `786ee19` reste le bon candidat : la fiche de référence est incluse dans ce commit et le build correspondant est identifié.

Si la correction documentaire nécessite un nouveau commit de la fiche de baseline, il faudra alors arbitrer explicitement entre :

1. geler `786ee19` comme **baseline applicative** et référencer un document d'audit ultérieur ; ou
2. prendre un nouveau commit comme **baseline documentaire + applicative**.

Ne pas changer silencieusement l'identité proposée.

## Q23 — marqueur immuable

**Décision : OUI, après approbation finale du gel.**

Un tag Git annoté `nexus-baseline-1` est recommandé sur le SHA finalement approuvé. Il ne doit être créé qu'après la décision finale `APPROVED`, afin que le tag signifie réellement « référence gelée » et non « candidat au gel ».

Le tag n'autorise aucun merge ni aucune promotion Production.

## Q24 — gabarit Handoff

**Décision : OUI, lot distinct après la baseline.**

Le constat est valide : trois écarts consécutifs montrent que le contrat d'enveloppe n'est pas assez découvrable. Générer un gabarit de décision pré-rempli est préférable à l'accumulation de dérogations. Ne pas le développer dans ce lot.

Ce sujet pourra être intégré au premier chantier du **NEXUS Governance Core / Orchestrator**, car son objectif est précisément de retirer Frédéric du rôle de messager et de réduire les erreurs de protocole entre agents.

## Ce que j'attends de `request-2.md`

Produire une révision documentaire, sans nouvelle fonctionnalité et sans correction opportuniste :

1. registre complet des dettes et hors-couverture connus à la date de baseline ;
2. preuve factuelle et résolution de la contradiction A15 ;
3. qualification non ambiguë de A16 ;
4. confirmation que les deux bloqueurs restent fermés ;
5. confirmation que `main` et `production` restent inchangées ;
6. identité exacte du candidat de baseline après cette révision ;
7. aucune écriture Production, aucun merge, aucune promotion.

Après cela, déposer `request-2.md` pour arbitrage final.

**Aucune autorisation de Production n'est donnée. NEXUS BASELINE 1 n'est pas encore gelée.**
