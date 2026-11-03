<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/INVENTAIRE-CAISSE-RENFORT-20261102/request-9.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: request
lot_id: INVENTAIRE-CAISSE-RENFORT-20261102
seq: 9
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=659af077 production=5751a9b0
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 174-fichiers
---
# Clôture individuelle du fil caisse et du pompiste : règle de passage du quart partagé

## Branche du lot
BRANCHE_DU_LOT: handoff-continuite-20260920

## Décision métier de Frédéric (03/11, 12:49, citée telle quelle via Guardian, commentaire 6610055143)
> « La clôture est individuelle : la caissière peut clôturer de son côté et le pompiste également, mais la caissière ou le pompiste clôture soit le quart 1, soit le quart 2, en fonction de leurs prises de poste. »

Lecture à confirmer : (1) chaque employé clôture son propre comptage sans fermer celui de l'autre ; l'ordre n'a plus d'importance, l'ancienne option « le pompiste en dernier » est écartée ; (2) le quart clôturé est celui de la prise de poste de l'employé (`shifts.quart`, matin = quart 1, soir = quart 2).

## Constat (code, worktree PR #175)
- `validerCloture()` (NEXUS-Inventaire-v1.html l. 4070-4071) écrit `a_valide_cloture=true` sur la ligne de l'employé puis passe tout `inventaire_quarts` à `cloture` avec `cloture_le`, sans condition sur les autres.
- « Fait » se juge sur `inventaire_quarts.cloture_le`, partagé : `inventaireFait` (NEXUS-App l. 2710-2715) et `faitsInventaire().clotureFaite` (nexus-fil-caisse.js l. 89).
- Étape 3 du fil masquée (`FERMETURE_OUVERTE = false`, 97d19c20, PR #175, qui ne contient que l'entrée et l'étape 2).

## Règle proposée
1. **Fait par employé** : « clôture faite » = `inventaire_quart_employes.a_valide_cloture` de la ligne de l'employé, sur le quart de son service (`quart = quartDuJour`). Vaut pour `faitsInventaire` (caissière) et `inventaireFait` (pompiste). La clôture d'un employé ne retire plus le lien de l'autre.
2. **Passage du quart partagé** (le plus sûr) : après avoir écrit sa propre ligne, l'employé relit les lignes `inventaire_quart_employes` du quart ; le quart passe à `cloture` + `cloture_le` seulement si toutes les lignes présentes ont `a_valide_cloture = true`. Sinon le quart reste `ouvert`. La relecture suit l'écriture, donc de deux clôtures simultanées la seconde voit les deux et ferme le quart ; aucune ne peut le fermer sur un état périmé.
3. **Clôture manager** (`rouvrirClotureQuart`, Manager l. 1121-1125) : inchangée, elle remet déjà le quart à `ouvert` et `a_valide_cloture=false` pour toutes les lignes ; compatible.
4. **`cloture_incomplete`** : calculée dans `validerCloture` sur `requis = produitsRequis(produitsZone)` de l'employé qui clôture (l. 4002-4023) ; reste donc par périmètre de chacun, sans changement. Elle n'est plus masquée par la clôture de l'autre.
5. **Moteur d'écarts et mesures** : `cloture_le` est lu par le moteur (durée de session, `nexus-inventaire-moteur.js` l. 666), le snapshot (`nexus-inventaire-snapshot-donnees.js`), le contrôle manager (affichage) et la progression (`nexus-progression.js` l. 1648, qui exige déjà `a_valide_cloture` ET `cloture_le`). Avec la règle 2, `cloture_le` est posé à la dernière clôture : la durée de session du quart s'allonge jusqu'au dernier clôturant au lieu du premier. Effet à valider par Frédéric, pas un défaut de code.
6. **Aucune migration** : les colonnes `a_valide_cloture` et `cloture_le` existent ; les écritures employé sur sa ligne et sur `inventaire_quarts` existent déjà. La lecture des lignes du quart par un employé est permise par `select_inventaire_quart_employes` (site du quart) dans la migration 20260802144312 ; **à vérifier sur Test avant tout code** car des durcissements RLS ont pu la modifier depuis (si elle est refermée, ce serait une policy, donc une porte pour Frédéric).

## Conditions avant tout code
Arbitrage sur cette request. Ensuite : épreuves sur les deux ordres (caissière puis pompiste, pompiste puis caissière), mutations, recette Test avec deux comptes (Employé Test B pour la partie manuelle, GOV-012). Rien n'est câblé en attendant. C'est un changement du parcours pompiste en Production.

## Preuve des conditions de decision-4
- Fil affiché seulement si `piloteCaisseCourant === true` et `roleDuJour === 'caissiere'` ; épreuves pilote / non-pilote / autre rôle / inter-sites.
- Aucune catégorie ni produit nouveau ; comptage à l'aveugle (étape 3 sans `dernierStock`).
- Aucune migration, policy, grant ni règle d'alerte dans cette demande. Défaut A (RLS update_inventaire_alertes) non contourné.
- Changement de quart arrêté au libellé. Lectures seules de `inventaire_quart_employes`.
