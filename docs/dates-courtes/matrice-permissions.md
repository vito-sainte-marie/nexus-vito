# Matrice des droits : Dates courtes (v4)

Les droits sont portés par le serveur (politiques de sécurité par ligne et fonctions), jamais par l'écran seul. Isolation stricte par `site_id` : aucun profil ne voit une autre station.

Légende : O = autorisé, N = refusé par le serveur, A = autorisé seulement si l'accès caissier est activé pour la station, P = ses propres tournées seulement.

Rôles du serveur (`employees.role`) : `renfort`, `manager`, `gerant`, `caissier`, `pompiste`, `vacataire`. Créateur : drapeau `est_createur`, valable seulement sur une station où `acces_createur_autorise` est vrai.

| Action | Renfort | Manager | Gérant, créateur | Caissier | Pompiste | Vacataire |
|---|---|---|---|---|---|---|
| Créer sa tournée (nom facultatif) | O | O | O | A | N | N |
| Relever, ajouter, corriger | O | O | O | A | N | N |
| Terminer sa tournée | O | O | O | A | N | N |
| Répondre à une demande de correction | O (P) | O | O | A (P) | N | N |
| Voir ses tournées | O (P) | O | O | A (P) | N | N |
| Voir toutes les tournées de la station | N | O | O | N | N | N |
| Annuler une ligne (motif obligatoire) | O (P) | O | O | N | N | N |
| Voir le tableau d'alertes | O | O | O | N | N | N |
| Signaler | O | O | O | N | N | N |
| Confirmer le retrait physique, « trouvé et retiré » | O | O | O | N | N | N |
| Comptabiliser la démarque | N | O | O | N | N | N |
| Demander une correction | N | O | O | N | N | N |
| Certifier une tournée | N | O | O | N | N | N |
| Exporter | N | O | O | N | N | N |
| Activer ou fermer l'accès caissier | N | O | O | N | N | N |
| Rattacher un produit provisoire, « même produit que… » | N | O | O | N | N | N |

Règles :

- Tournées individuelles : chaque employé autorisé crée et mène la sienne. Plusieurs tournées ouvertes en même temps dans une station. Il n'y a ni ouverture réservée au manager ni tournée automatique.
- Certification : manager, gérant et créateur seulement. Le manager peut certifier sa propre tournée, avec la mention « réalisateur et certificateur identiques ». Le renfort et le caissier ne certifient jamais.
- Accès caissier : fermé par défaut. Seuls manager, gérant et créateur l'activent, pour la station concernée seulement.
- Pompiste : aucun accès.
- Vacataire : en attente d'arbitrage du pilote. Aucun accès par défaut, comme le pompiste. Cas de recette « vacataire refusé ».
- Le renfort ne comptabilise jamais une démarque. Le geste « trouvé et retiré » combine relever et confirmer un retrait physique, sans droit comptable.
- Aucune suppression pour aucun profil. Mise à jour limitée aux colonnes d'annulation et d'état de tournée, par fonction serveur.
- Aucun accès `anon`.

Limites : la cellule « caissier, ses tournées en lecture » reste une hypothèse de travail. Le rôle `vacataire` n'est pas arbitré.
