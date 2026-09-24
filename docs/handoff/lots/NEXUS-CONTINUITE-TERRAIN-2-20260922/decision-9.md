---
protocol: nexus-handoff/2
kind: decision
lot_id: NEXUS-CONTINUITE-TERRAIN-2-20260922
seq: 9
author: NEXUS Orchestrator
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-11.md
---
# Décision — `request-11.md` : restauration minimale d'un comportement existant

## Verdict

`APPROVED_WITH_CONDITIONS`, `closes: false`.

Les preuves de `request-11.md` classent le point en `RESTAURATION_DE_COMPORTEMENT_EXISTANT` : les fonctions et invariants visés sont présents dans des commits ancêtres de Production et encore présents dans Production actuelle. Le défaut provient du portage mécanique `290a217`, qui a remplacé en bloc `nexus-auth.js` par la version du rail et a ainsi perdu du comportement métier déjà livré. Aucune nouvelle règle métier n'est nécessaire pour restaurer strictement ce périmètre.

## 1. Restauration autorisée — candidate non-Production uniquement

Autorisé sur `rebuild/carburants-65-20260922` uniquement : appliquer le plus petit assemblage décrit et prouvé dans `request-11.md`, limité à :

1. `nexusEstManager(employee)` depuis Production ;
2. le bloc d'autorité de fuseau nécessaire à `nexusServiceCourant` (`nexusFuseauxSite`, `nexusFuseauValide`, `nexusRetenirFuseau`, `nexusJourDansFuseau`, `nexusFuseauSite`) ;
3. le cycle pilote déjà livré (`nexusReglesPilote`, `nexusAppliquerCloturePilote`, `nexusCloturerServicesObsoletes`, `nexusServicesOuvertsDuSite`, `nexusRegulariserServicesObsoletes`) ;
4. le `nexusServiceCourant` correspondant ;
5. la consolidation mécanique des deux prédicats manager résiduels vers `nexusEstManager(employee)`, sans modification de leur sémantique.

Conserver intégralement les gardes build/config déjà présentes sur la candidate (`NEXUS_CONFIG`, `NexusBuild`, `NexusPage`). Aucun remplacement en bloc de `nexus-auth.js` par une version historique n'est autorisé.

## 2. Périmètre explicitement exclu

Ne pas restaurer dans ce geste la classification d'accès/navigation (`nexusCategorieAcces`, listes de pages, `nexusPageExigeServiceOperationnel`, `nexusEcranOperationnelAtteignable`) ni migrer les trois fonctions restantes vers `nexusFuseauSite`. Ces écarts sont réels mais distincts ; les traiter ici élargirait le périmètre UX au-delà de la restauration minimale démontrée.

Aucune règle métier, UX, rôle, RLS ou sécurité nouvelle ne doit être créée pour harmoniser ces écarts.

## 3. Preuves obligatoires

Après application sur la candidate :

- `node --check` doit passer ;
- rejouer réellement les deux harnais réalignés de `request-11.md` et obtenir leurs assertions métier, sans affaiblir les assertions ;
- vérifier que la règle de rôle reste à source unique ;
- exécuter la suite candidate complète et comparer au baseline connu ;
- mesurer le diff final de `nexus-auth.js` et confirmer qu'aucun bloc hors périmètre n'a été introduit ;
- si une nouvelle régression apparaît, STOP et la classer avant poursuite.

Les 38/38 assertions de la zone jetable sont une preuve préparatoire ; elles ne remplacent pas l'exécution sur l'arbre candidate effectivement modifié.

## 4. Gates suivantes inchangées

Même si cette restauration devient verte, #65 reste NO GO tant que les gates déjà établies ne sont pas fermées : CI candidate verte, preuve du `nexus-config.js` réellement servi ciblant exclusivement Supabase Test, puis recette navigateur autorisée. La question Cloudflare/extension `.html` reste soumise à observation réelle ; aucune correction préventive.

## 5. Transport

Si Claude ne peut pas écrire directement sur `rebuild/carburants-65-20260922`, préparer un commit atomique sur une branche de travail persistante avec le diff exact et les preuves, puis revenir au rail. Ne pas demander une gate Créateur pour une limitation de transport Git non-Production.

## STOP

Retour par `request-N.md` si le comportement restauré diverge de Production, si les harnais échouent sur une assertion métier, si le diff exige un élargissement UX/sécurité/rôle/RLS, si une nouvelle régression matérielle apparaît, ou si une gate Test/Cloudflare devient contradictoire.

## Interdits

Aucun changement `main`/`production`, aucune migration ou écriture Supabase Production, aucun déploiement/promotion Production, aucun changement de rôle/RLS, aucun secret exposé. `NEXUS_BASE_BRANCH=handoff-continuite-20260920` reste canonique.
