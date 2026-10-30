---
protocol: nexus-handoff/2
kind: request
lot_id: MENU-ACCUEIL-EMPLOYE-20261030
seq: 2
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
# MENU-ACCUEIL-EMPLOYE-20261030 : request-2 — demande rectificative (réduction du périmètre)

BRANCHE_DU_LOT: menu-accueil-employe-20261030

Cette demande **rectifie** request-1 (e9b6f7cf) sans la réécrire. Elle applique la décision de Frédéric du 30/10, 8 h 19 (relayée par Guardian, #160, 6522699424). Aucun code avant la décision de l'arbitre. Aucune opération en Production.

## Périmètre réduit

Le lot se limite à :
- le **menu ☰** à gauche du logo de l'Accueil employé, avec les fonctions par poste de request-1 (Jaugeage et Index absents du menu des employés, Réception, Inventaire, Missions, Pointage, Coach FDJ caisse, FDJ, Moi) ;
- la **recherche « Que cherchez-vous à faire ? »** retirée pour pompiste, caisse et renfort, conservée pour manager et gérant ;
- un **lien « Inventaire » dans le menu du renfort**, créé tel quel.

**Sortent du lot** (lot dédié « Inventaire renfort », à ouvrir plus tard) : le réglage « Inventaire du renfort » dans Paramètres Station, donc **ni colonne ni migration** ici ; la levée de l'exclusion `roleDuJour !== 'renfort'` dans l'Accueil.

Corrections à request-1 qui en découlent : l'entrée Inventaire du renfort n'est plus conditionnée par un réglage (le lien est toujours présent pour le renfort) ; l'étape 1 « migration du réglage sur Test » tombe ; le lot est de l'interface seule.

## Où mène le lien Inventaire pour un renfort aujourd'hui (lecture seule du code, `origin/production` d799fa58, NEXUS-Inventaire-v1.html)

Établi en lisant le code ; **non rejoué dans un navigateur**.

- **Renfort en service** : la page **s'ouvre, sans refus ni page vide**. Le rôle du jour est résolu (`chargerRoleDuJour`), `zonesPourRole('renfort')` rend `['piste','boutique']` : il choisit la zone, comme un manager. Il peut faire l'inventaire du quart.
- **Ce qu'il ne voit pas** : l'Accueil ne le compte pas dans ses contrôles (`inventaireApplicable = enService && roleDuJour !== 'renfort'`). L'Inventaire n'est donc ni une étape de son ouverture ni dans son compte de contrôles. Ce qu'il fait dans la page reste enregistré, mais n'apparaît pas comme « à faire » sur l'Accueil. C'est le comportement actuel, non modifié.
- **Renfort hors service** (pas de service du jour résolu) : la page affiche l'écran d'arrêt `bloquerFauteDeRoleDuJour`, un refus avec explication, pas une page vide. Même chose si les horaires de quart de la station manquent (`bloquerFauteDHorairesDeQuart`).
- **Mode test Inventaire** : le renfort y suit la mission configurée ; hors sujet en usage normal.

## À valider par Frédéric

Le lien fonctionne donc pour un renfort en service. Deux options pour le lot :
- **A (recommandée)** : garder le lien tel quel. Simple, conforme à votre décision, honnête : le renfort peut faire l'inventaire, l'Accueil ne le lui réclame pas encore (lot « Inventaire renfort »).
- **B** : l'afficher grisé « bientôt disponible » jusqu'au lot dédié. Évite qu'un renfort fasse un inventaire que l'Accueil ne compte pas.

## À arbitrer

L'arbitre valide-t-il ce périmètre réduit (interface seule, sans migration) comme base du lot de développement ? Le choix A ou B du lien Inventaire est à la main de Frédéric ; sans réponse, A.
