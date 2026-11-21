# Plan de recette : Dates courtes

Données fictives, stations pseudonymes (R1, R2), employés pseudonymes (M1 manager, R1 renfort). Seule exception : l'EAN de recette 3168930171683. Aucune recette n'est jouée sur Test sans accord ; rien en Production.

La date saisie est une seule « Date limite », sans type : aucune recette ne distingue DLC et DDM.

| # | Cas | Critère mesurable | Lot |
|---|---|---|---|
| 1 | Même EAN et même date limite à deux endroits, même tournée (4 au frigo, 3 en gondole) | Un seul groupe, quantité 7, les deux relevés visibles | 1 |
| 2 | Même EAN, deux dates limites | Deux groupes distincts, aucune fusion | 1 |
| 3 | Correction de moins 2 sur un groupe de 10 | Total 8, relevés et correction visibles dans l'historique | 1 |
| 4 | Renvoi réseau de la même opération | Une seule ligne créée, même résultat renvoyé | 1 |
| 5 | Deux employés relèvent le même groupe en même temps | Total égal à la somme, aucun écart, aucun relevé perdu | 1 |
| 6 | EAN inconnu du catalogue, `3168930171683` saisi avec nom libre facultatif | Entrée marquée « provisoire », aucune référence créée | 1 et 2 |
| 6b | Même EAN `3168930171683` présent ensuite dans un import de test | Un seul groupe, historique intact, plus de marque « provisoire » | 1 |
| 6c | Manager rattache à la main une ligne provisoire à un produit sous un autre code | Rattachement accepté, tracé (auteur, date) ; renfort refusé | 1 |
| 7 | Caissière sans habilitation | Refus par le serveur sur relevé, ajout et correction | 1 |
| 8 | Pompiste | Refus par le serveur sur toute action | 1 |
| 9 | Retrait physique de 3 sur un groupe de 8 relevés, puis renfort tente la démarque comptabilisée | Quantité active 5, historique « 3 retirés par R1 à 10:05 » ; les 3 dans la liste « à comptabiliser » du manager, démarque non comptabilisée ; renfort refusé par le serveur sur la comptabilisation | 3 |
| 10 | Changement de station | Aucun relevé de l'autre station visible ni modifiable | 1 |
| 11 | Scan réel iPhone Safari, EAN de recette 3168930171683, y compris à 90 degrés | Lu et identifié, ou marqué « non fait » | 2 |
| 12 | Accès caissière : manager, gérant ou créateur l'active | Accepté ; la caissière accède ensuite à cette station seulement | 1 |
| 13 | Accès caissière : renfort ou caissière tente de l'activer | Refusé par le serveur | 1 |
| 14 | Activation sur la station R1 | Aucun effet sur R2 | 1 |
| 15 | Produit sans EAN trouvé par nom, relevé deux fois (deux dates limites) | Un groupe par date, les deux relevés visibles, clé sur le libellé normalisé | 1 et 2 |
| 16 | Même produit sans EAN avec une date en tête du libellé, casse ou espaces différents, après un nouvel import | Toujours le même groupe (libellé normalisé) | 1 |
| 16b | Renommage d'un produit sans EAN (type « Pain Chocolat - 68P » vers « Pain Chocolat - 96P ») | Deux groupes tant que rien n'est fait ; le manager pose « même produit que… » : un groupe, historique intact, geste tracé ; renfort refusé | 1 |
| 17 | Correction qui ferait passer sous zéro | Refus serveur visible, quantité inchangée | 1 |
| 18 | Coupure réseau pendant la saisie puis reprise | État En attente puis Enregistré, aucun doublon | 2 |
| 19 | Alerte : date limite à 59 puis 61 jours | 59 apparaît, 61 non | 3 |
| 20 | Ordre du tableau d'alertes | Expiré, puis jours croissants, puis quantité décroissante | 3 |
| 21 | Tournée, semaine 1 : relevés 6 puis 4 | Quantité 10 | 1 |
| 22 | Tournée, semaine 2 : premier relevé 4 du même groupe | Quantité active 4 et non 14 ; les relevés de la semaine 1 restent dans l'historique | 1 |
| 23 | Tournée, semaine 2 : second relevé 3 | Quantité 7 | 1 |
| 24 | Groupe relevé à 10 en semaine 1, non revu en semaine 2 | Quantité active 0 ; historique « tournée du … : 10 » ; aucune alerte, aucune demande de retrait, aucun mouvement | 1 et 3 |
| 25 | Ouverture manuelle d'une nouvelle tournée par un manager, un gérant ou un créateur | Acceptée et tracée ; renfort et caissière refusés par le serveur | 1 |
| 26 | Changement de tournée à lundi 00:00, heure de Martinique | Un relevé à dimanche 23:59 reste dans l'ancienne tournée, à lundi 00:00 dans la nouvelle | 1 |
| 27 | Semaine 1 = 8 ; lundi 9:00 de la semaine 2, un retrait de 3 sur la tournée de la semaine 1 (geste daté de la semaine 1) ; 10:00, premier relevé de la semaine 2 : 5 | Correction ou retrait d'une tournée précédente sans effet : quantité active 5 ; le retrait reste dans l'historique et dans « à comptabiliser » | 1 et 3 |
| 28 | Geste hors ligne : retrait fait dimanche 23:50 sans réseau, reçu lundi 8:00 | Compté dans la tournée de son heure de geste (celle du dimanche) : sans effet sur la quantité active de la nouvelle tournée ; l'heure de réception est conservée pour la trace | 1 et 2 |
| 29 | Groupe dont la date limite est passée, quantité active supérieure à zéro dans la tournée en cours | Affiché « signalé, à retirer » sans geste ; aucune ligne de retrait créée, quantité inchangée | 3 |
| 30 | Date disparue : semaine 1, 15/12 relevé à 10 ; semaine 2, seul le 22/12 est relevé, à 6 | Actifs : 22/12 = 6, 15/12 = 0 ; aucune alerte ni demande de retrait sur le 15/12 ; historique de la semaine 1 intact | 1 et 3 |
| 31 | Retrait le lundi avant tout relevé de la tournée : geste « trouvé et retiré » de 3 | Quantité active 0 ; 3 dans « à comptabiliser » ; aucun refus de plancher ; renfort autorisé | 1 et 3 |
| 32 | Ouverture manuelle d'une tournée | Refusée au renfort et à la caissière ; acceptée avec confirmation à l'écran et tracée pour manager, gérant et créateur ; toutes les quantités actives à 0 | 1 et 3 |
| 33 | Tableau du manager en début de tournée | Affiche « Tournée du 23/11 : 0 produit relevé », et non une liste vide sans explication ; chiffres de la tournée précédente présentés comme historique | 3 |
| 34 | Date passée dont la quantité vient seulement de la tournée précédente | Aucun état « à retirer » : il ne vaut que pour une quantité active de la tournée en cours | 3 |

Autres preuves attendues au lot 2 et 3 : maquettes Jour et Nuit, captures à largeur iPhone, test de compréhension de Guardian, recette Safari iOS sur appareil réel.

Limite : aucun de ces cas n'a été joué. Le plan décrit ce qu'il faudra démontrer.
