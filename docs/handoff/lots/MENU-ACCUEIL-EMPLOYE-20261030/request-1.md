---
protocol: nexus-handoff/2
kind: request
lot_id: MENU-ACCUEIL-EMPLOYE-20261030
seq: 1
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: https://github.com/vito-sainte-marie/nexus-vito/issues/28
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=659af077 production=d799fa58
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 167-fichiers
---
# MENU-ACCUEIL-EMPLOYE-20261030 : request-1 — inventaire des fonctions par poste, avant tout code

BRANCHE_DU_LOT: menu-accueil-employe-20261030

## Demande de Frédéric

Un menu ☰ à gauche du logo de l'Accueil employé, qui donne accès aux fonctions autorisées pour le poste du jour (via `roleADroitModule`), regroupées :
- Carburant : jaugeage, index, réception ;
- Inventaire ;
- Missions ;
- Moi : progression, séries, changer de poste, se déconnecter.

## Ce que cette demande fait et ne fait pas

Cette demande ne porte **aucun code**. Elle dresse la liste des fonctions par poste (piste, caisse, renfort) pour validation de Frédéric. Aucun développement n'est engagé avant sa réponse. Le lot précédent (ACCUEIL-EN-SERVICE-20261030) est clos (decision-2 APPROVED, 6297bff9).

## Ce que le code dit aujourd'hui (lecture seule, `origin/production` d799fa58)

- `roleADroitModule(module, roleDuJour)` ne régit que **deux** modules : `fdj` (caissière, manager, polyvalent : oui ; pompiste, renfort : non) et `reception` (pompiste, manager : oui ; caissière, renfort, polyvalent : non). Tout autre module renvoie `true` : la matrice n'exprime donc ni jaugeage, ni index, ni inventaire, ni missions.
- Réception reste en plus conditionnée par `station_config.reception_carburant_role` (`employe` ou `les_deux`).
- Inventaire : non applicable au renfort (`roleDuJour !== 'renfort'`).
- Jaugeage et index passent par `NEXUS-Releves-Piste-v1.html` (`?ecran=jauge`, `?moment=debut_q1`…), limités aux relevés dont l'employé est habilité ; le jaugeage d'ouverture n'est demandé qu'au quart du matin.
- Pages employé existantes : `NEXUS-Carburant-Reception-v1`, `NEXUS-Inventaire-v1`, `NEXUS-Missions-v1`, `NEXUS-Progression-v1`, `NEXUS-Prise-De-Poste-v1`, `NEXUS-FDJ-v1`, `NEXUS-Pointage-v1`, `NEXUS-Coach-FDJ-v1`.

## Proposition à valider : fonctions par poste

| Fonction | Piste (pompiste) | Caisse (caissière) | Renfort | Manager / gérant |
|---|---|---|---|---|
| Carburant · Réception | oui, si réglage `employe`/`les_deux` | non | non | oui |
| Carburant · Jaugeage, Index | non (fil de l'Accueil) | non | non | oui (pas de fil : le menu est leur porte) |
| Inventaire | oui | oui | oui seulement si Paramètres Station l'attribue (défaut non : absent du menu) | oui |
| Missions | oui | oui | oui | oui |
| Pointage | oui | oui | oui | oui |
| Coach FDJ | non | oui | non | oui |
| FDJ (caisse) | non | oui, forfait Professional | non | oui, forfait Professional |
| Moi · Progression, séries | oui | oui | oui | oui |
| Moi · Changer de poste | oui | oui | oui | oui |
| Moi · Se déconnecter | oui | oui | oui | oui |

Les cases « oui » reprennent ce que le code fait déjà ; elles ne créent aucun droit nouveau. Le groupe FDJ n'était pas dans la liste de Frédéric : je le propose pour la caissière, à confirmer ou retirer.

## Réponses de Frédéric (30/10)

- Pointage : dans le menu (tous les postes de la table). Coach FDJ : caisse uniquement.
- Jaugeage et index : **retirés du menu** (doublons du fil de l'Accueil), sous réserve d'un bouton retour. Constat : `NEXUS-Releves-Piste-v1` a bien « ← Quitter et revenir à l'Accueil » en tête et un « Retour » dans les écrans hors fil ; le fil reste leur seule porte. Le groupe Carburant du menu ne garde que la Réception.
- La tuile Réception et le bouton « Continuer » restent sur l'Accueil.
- La recherche « Que cherchez-vous à faire ? » est **retirée aussi pour la caisse et le renfort** ; seuls le manager et le gérant la gardent.

## Précision de Frédéric (30/10, 8 h 05, via Guardian)

- Le manager et le gérant reçoivent aussi le menu ☰ et **gardent la recherche « Que cherchez-vous à faire ? »**, utile en vue mobile. Le menu ne la remplace pas.
- Le retrait de la recherche reste limité au pompiste en service (déjà en Production). Pour la caisse et le renfort : recherche retirée (réponse de Frédéric, ci-dessus).
- **Réponse de Frédéric : pour le manager, toutes les fonctionnalités existent dans le menu.** La colonne Manager / gérant est donc « oui » partout. Je range sous « toutes » les entrées du tableau, y compris Jaugeage, Index et Coach FDJ ; les écrans de pilotage restent dans Explorer NEXUS, non dupliqués. Si « toutes » doit aussi les inclure, Frédéric le dira.

## Questions pour Frédéric

1. Le tableau ci-dessus est-il juste ? (Colonne manager/gérant : « oui » partout, Jaugeage, Index et Coach FDJ compris.)
2. Renfort et Inventaire : **confirmé par Frédéric**. Le réglage vit dans les paramètres de la station (précédent : `station_config.reception_carburant_role`, NEXUS-Parametres-Station-v1). Défaut **non** : l'entrée Inventaire n'apparaît pas dans le menu du renfort ; réglage sur **oui** : elle apparaît, et le renfort est compté dans les contrôles (exclusion `roleDuJour !== 'renfort'` levée dans ce cas seulement). Il faut une colonne de configuration (migration, Test d'abord) que la demande chiffrera avant tout code.

## À arbitrer

Toutes les réponses de Frédéric sont intégrées. Pour la suite : l'arbitre valide-t-il ce périmètre (table ci-dessus, recherche retirée pour pompiste, caisse et renfort, réglage Inventaire du renfort avec défaut non) comme base d'un lot de développement, étape 1 = migration du réglage sur Test ? Aucun code avant sa décision. Aucune opération en Production.
