# Plan de recette : Dates courtes

Données fictives, stations pseudonymes (R1, R2), employés pseudonymes (M1 manager, R1 renfort). Seule exception : l'EAN de recette 3168930171683. Aucune recette n'est jouée sur Test sans accord ; rien en Production.

| # | Cas | Critère mesurable | Lot |
|---|---|---|---|
| 1 | Même EAN et même DLC à deux endroits | Un seul groupe, quantité égale à la somme des deux relevés, les deux visibles | 1 |
| 2 | Même EAN, deux DLC | Deux groupes distincts, aucune fusion | 1 |
| 3 | Correction de moins 2 sur un groupe de 10 | Total 8, relevés et correction visibles dans l'historique | 1 |
| 4 | Renvoi réseau de la même opération | Une seule ligne créée, même résultat renvoyé | 1 |
| 5 | Deux employés relèvent le même groupe en même temps | Total égal à la somme, aucun écart, aucun relevé perdu | 1 |
| 6 | EAN inconnu du catalogue | Entrée marquée provisoire, aucune référence créée | 1 et 2 |
| 7 | Caissière sans habilitation | Refus par le serveur sur relevé, ajout et correction | 1 |
| 8 | Pompiste | Refus par le serveur sur toute action | 1 |
| 9 | Renfort confirme un retrait physique, puis tente la démarque comptabilisée | Retrait physique accepté ; démarque refusée par le serveur | 3 |
| 10 | Changement de station | Aucun relevé de l'autre station visible ni modifiable | 1 |
| 11 | Scan réel iPhone Safari, EAN de recette 3168930171683, y compris à 90 degrés | Lu et identifié, ou marqué « non fait » | 2 |
| 12 | Accès caissière : manager, gérant ou créateur l'active | Accepté ; la caissière accède ensuite à cette station seulement | 1 |
| 13 | Accès caissière : renfort ou caissière tente de l'activer | Refusé par le serveur | 1 |
| 14 | Activation sur la station R1 | Aucun effet sur R2 | 1 |
| 15 | Produit sans EAN trouvé par nom, relevé deux fois (deux DLC) | Un groupe par DLC, les deux relevés visibles, clé sur la référence catalogue | 1 et 2 |
| 16 | Même produit sans EAN après un nouvel import de période | Toujours le même groupe (stabilité de la référence) | 1 |
| 17 | Correction qui ferait passer sous zéro | Refus serveur visible, quantité inchangée | 1 |
| 18 | Coupure réseau pendant la saisie puis reprise | État En attente puis Enregistré, aucun doublon | 2 |
| 19 | Alerte : DLC à 59 puis 61 jours | 59 apparaît, 61 non | 3 |
| 20 | Ordre du tableau d'alertes | Expiré, puis jours croissants, puis quantité décroissante | 3 |

Autres preuves attendues au lot 2 et 3 : maquettes Jour et Nuit, captures à largeur iPhone, test de compréhension de Guardian, recette Safari iOS sur appareil réel.

Limite : aucun de ces cas n'a été joué. Le plan décrit ce qu'il faudra démontrer.
