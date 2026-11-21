# Matrice des droits : Dates courtes

Les droits sont portés par le serveur (politiques de sécurité par ligne et fonctions), jamais par l'écran seul. Isolation stricte par `site_id` : aucun profil ne voit une autre station.

Légende : O = autorisé, N = refusé par le serveur, A = autorisé seulement si l'accès caissière est activé pour la station.

| Action | Renfort | Manager | Gérant, créateur | Caissière | Pompiste |
|---|---|---|---|---|---|
| Relever (scan, recherche, saisie) | O | O | O | A | N |
| Ajouter des unités | O | O | O | A | N |
| Corriger le relevé | O | O | O | A | N |
| Annuler une ligne (motif obligatoire) | O | O | O | N | N |
| Voir les groupes et l'historique | O | O | O | A (lecture de ses relevés) | N |
| Voir le tableau d'alertes | O | O | O | N | N |
| Signaler | O | O | O | N | N |
| Confirmer le retrait physique | O | O | O | N | N |
| Comptabiliser la démarque | N | O | O | N | N |
| Activer ou fermer l'accès caissière | N | O | O | N | N |
| Ouvrir une nouvelle tournée | N | O | O | N | N |
| Rattacher un produit provisoire ou poser « même produit que… » | N | O | O | N | N |

Règles :

- Accès caissière : fermé par défaut. Seuls manager, gérant et créateur peuvent l'activer. Une tentative par un renfort ou une caissière est refusée par le serveur. L'activation vaut pour la station concernée seulement.
- Pompiste : aucun accès opérationnel.
- Le renfort ne comptabilise jamais une démarque. Il peut confirmer le retrait physique, qui diminue la quantité consolidée.
- Tournée : une par semaine par défaut ; seuls manager, gérant et créateur en ouvrent une à la main. Le renfort ne choisit jamais la tournée.
- Aucune suppression pour aucun profil. Mise à jour limitée aux colonnes d'annulation.
- Aucun accès `anon`.

Limites : la cellule « caissière, lecture de ses relevés » est une hypothèse de travail (le texte d'arbitrage dit « accès activable », sans préciser la portée). Les noms de rôles du serveur (`manager`, `gerant`, `createur`) sont à vérifier contre la base avant tout code.
