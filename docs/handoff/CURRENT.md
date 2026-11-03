<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/INVENTAIRE-CAISSE-RENFORT-20261102/request-10.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: request
lot_id: INVENTAIRE-CAISSE-RENFORT-20261102
seq: 10
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
# Clôture du quart partagé : tous les employés en poste, repli à la fin prévue + délai (remplace request-9)

## Branche du lot
BRANCHE_DU_LOT: handoff-continuite-20260920

## Décisions de Frédéric citées telles quelles (via Guardian)
- 03/11 12:49 (commentaire 6610055143) :
> « La clôture est individuelle : la caissière peut clôturer de son côté et le pompiste également, mais la caissière ou le pompiste clôture soit le quart 1, soit le quart 2, en fonction de leurs prises de poste. »
- 03/11 13:46 (commentaire 6611296591) :
> « Le quart est terminé : réponse 1 ; si pas clôturé par l'employé, option 3 avec 30 mn après l'heure de fin prévue dans les réglages. »
- 03/11 13:44 (commentaire 6611256508), déjà appliquée dans PR #175 (commit 2adf35a3), hors arbitrage : l'Accueil « caisse » est donné à toutes les caissières en service ; le fil reste réservé aux pilotes. Changement visible pour toutes les caissières en Production après fusion.

Cette request supersède request-9 (même sujet, désormais complétée par la décision du 13:46).

## Règle proposée (aucun code écrit)
1. **Fait individuel** : « clôture faite » d'un employé = `inventaire_quart_employes.a_valide_cloture` de sa ligne, sur le quart de sa prise de poste (matin = quart 1, soir = quart 2). Vaut pour la caissière (`faitsInventaire`) et le pompiste (`inventaireFait`). La clôture de l'un ne retire plus le lien de l'autre.
2. **Quart terminé, réponse 1** : le quart partagé passe à `cloture` quand TOUS les employés qui ont pris leur poste sur ce quart ont validé leur clôture. `cloture_le` = heure de la dernière clôture individuelle.
3. **Repli, option 3** : si un employé n'a pas clôturé, le quart est considéré terminé 30 minutes après l'heure de fin prévue dans `station_config.horaires` (`quart1` / `quart2`, `fin_normal`). Le délai n'est pas une constante : on réutilise `parametres_inventaire.closureDelayMinutes` (30 par défaut). Les produits de l'employé défaillant restent non comptés et donnent lieu à l'alerte existante (`cloture_incomplete` / `cloture_en_retard`).

## Points demandés par Guardian
### 1. Qui fait passer le quart à `cloture` à l'échéance
Constat (migration 20260905131500, `run_scheduled_inventory_reviews`, l. 180-195) : la fonction planifiée lit déjà `closureDelayMinutes` et la fin normale du quart, mais elle ne fait que **créer l'alerte `cloture_en_retard`** ; elle ne passe jamais le quart à `cloture`. Deux voies :
- **A (sans porte, recommandée pour la suite immédiate)** : l'état « terminé » est **calculé à la lecture** côté client (fil, Accueil, progression) : tous les employés en poste ont `a_valide_cloture`, ou l'heure locale du site dépasse `date + fin_normal + closureDelayMinutes`. Aucune écriture nouvelle. Limite : `inventaire_quarts.cloture_le` n'est pas posé au repli ; le moteur d'écarts, le snapshot et le contrôle manager qui lisent cette colonne ne voient le quart terminé qu'une fois la dernière clôture écrite.
- **B (PORTE POUR FRÉDÉRIC)** : étendre `run_scheduled_inventory_reviews` (ou une fonction/cron neuf) pour écrire `statut='cloture'` et `cloture_le` à l'échéance. C'est une migration SQL et une écriture sur le quart hors de l'employé. Je ne l'écris pas ; elle ne démarre qu'après GO explicite.
Arbitrage demandé : A seule pour l'instant, ou A puis B ?

### 2. Population attendue
Les employés ayant pris leur poste sur ce quart (`shifts` du site, date, quart), pas seulement les lignes déjà présentes dans `inventaire_quart_employes`.
- **Constat RLS (Test, lu le 03/11)** : `select_shifts` ne laisse à un employé que **ses propres** shifts (managers/gérants : ceux du site). Un employé ne peut donc pas lister les collègues en poste. `select_inventaire_quart_employes` (propre ligne, ou quart du site) et `select_inventaire_quarts` (site) restent lisibles : la voie « lignes présentes » fonctionne sans changement.
- Conséquence : la population complète depuis `shifts` exige soit une fonction SECURITY DEFINER qui renvoie les effectifs du quart, soit une policy de lecture : **c'est une porte (sécurité/RLS) pour Frédéric**, non écrite. Sans elle, la règle 2 ne s'applique qu'aux employés qui ont ouvert une ligne ; un employé en poste sans ligne n'est pas attendu, et le repli (règle 3) couvre le cas.
- **Changement de poste en cours de quart** (service clos par une nouvelle prise de poste) : proposition, un employé qui a changé de poste n'est attendu que sur le service **en cours** de la clôture ; son ancien service n'exige plus de clôture. À confirmer.
Arbitrage demandé : accepter la lecture limitée aux lignes présentes en attendant, ou ouvrir la porte de lecture des effectifs ?

### 3. Fait individuel
`a_valide_cloture` de la ligne de l'employé, pour la caissière comme pour le pompiste (cf. règle 1). `cloture_incomplete` reste calculée sur le périmètre de l'employé qui clôture.

### 4. Vérification RLS sur Test avant tout code
Faite le 03/11 (lecture seule, Test) : `select_inventaire_quart_employes` : `employee_id = auth.uid()` OU quart du site de l'employé ; `select_inventaire_quarts` : site de l'employé ; `select_shifts` : voir point 2. Les lignes du quart sont lisibles par un employé du site : aucune policy à modifier pour la voie « lignes présentes ».

## Constat complémentaire (Guardian 6610696949)
`referenceEcartAveugle` est vide au comptage du soir : `chargerDerniersStocks` (#169) ne lit que les comptages de type `cloture`. Tant que l'étape 3 est masquée, le fil caisse ne peut produire aucun écart sur les cigarettes ni le CBD ; le contrôle fiable du lot dépend donc de la clôture individuelle.

## Conditions avant tout code
Arbitrage sur cette request. Ensuite : épreuves sur les deux ordres de clôture (caissière puis pompiste, pompiste puis caissière) et sur le repli (échéance dépassée, non dépassée, closureDelayMinutes modifié, employé défaillant), mutations, recette Test avec deux comptes (Employé Test B pour la partie manuelle, GOV-012). Rien n'est câblé en attendant. Changement du parcours pompiste en Production.

## Portes à franchir par Frédéric (non écrites)
- Voie B du point 1 (écriture à l'échéance, SQL).
- Lecture des effectifs d'un quart par un employé (point 2, SECURITY DEFINER ou policy).

## Preuve des conditions de decision-4
- Fil affiché seulement si `piloteCaisseCourant === true` et `roleDuJour === 'caissiere'` ; l'affichage Accueil caisse des non-pilotes n'a pas de fil ; épreuves pilote / non-pilote / autre rôle / inter-sites.
- Aucune catégorie ni produit nouveau ; comptage à l'aveugle.
- Aucune migration, policy, grant ni règle d'alerte dans cette demande. Défaut A (RLS update_inventaire_alertes) non contourné.
- Changement de quart arrêté au libellé. Lectures seules de `inventaire_quart_employes`.
