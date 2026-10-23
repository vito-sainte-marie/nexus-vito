# Exécution de decision-1 — correctifs de la recette pompiste (PARCOURS-POMPISTE-CORRECTIFS-RECETTE-20261022)

Décision : `decision-1.md` (arbitre ChatGPT, APPROVED_WITH_CONDITIONS, closes:false) sur la request-1. Prise en charge : `d3d9eccf`.
Code : branche `correctifs-recette-pompiste-20261022`, commit `e32c4475`, **PR #152 fusionnée dans `production` le 23/10 sur GO de Frédéric (`7cbbb479`)**, CI verte. Le déploiement attend la validation de Frédéric ; aucune écriture Production.
Cible de la recette : alias Cloudflare `correctifs-recette-pompiste.nexus-test-ddf.pages.dev`, build `e32c447`, génération `29e4f45ff180`, construit le 2026-10-23T00:12:56Z, sur Supabase **Test** `udljdqxerrbbbajxubfn` (Production `uzhjpqpctpvxytxpxoqz` jamais touchée).

## A. Vu au navigateur (375 × 812, Employé Test B, pompiste)
| Cas | Correctif | Constat |
|---|---|---|
| C1, C2, C3 | 1 à 3 (prise de poste, fil, Accueil après l'inventaire d'ouverture) | rejoués le 22/10 après la remise à zéro `aa578cac` ; C3 : les 2 missions obligatoires soldées, message « ouverture faite / clôture en fin de quart » lu à l'écran |
| C4 | 4 (un seul compteur d'étapes) | vu |
| C5 | 5 (jaugeage reconnu par l'Accueil) | 23/10 : après un jaugeage enregistré par l'écran, l'Accueil affiche progression 50 % et ne redemande plus le jaugeage ; la prochaine action est « Le relevé d'index de début de quart n'a pas encore été fait » |
| C6 | 6 (message dès l'ouverture) | 23/10 : écran rouvert sans brouillon local, « Un jaugeage existe déjà pour aujourd'hui » et les quatre volumes enregistrés, dès l'ouverture ; témoin négatif vu avant le jaugeage (aucun message) |
| Remise à zéro SQL | script `aa578cac` | vue : simulation puis exécution, bornée, Test seulement |

À noter, non reproché au correctif : sous ce message, l'écran affiche aussi « Jaugeage non enregistré : saisie en cours » parce que les champs sont rouverts en saisie ; le brouillon local d'un jaugeage déjà enregistré rend « Jaugeage enregistré » à la place. Deux libellés voisins pour un même état : matière du lot langage.

## B. Prouvé seulement par l'épreuve automatique (jamais vu à l'écran)
- **Ajout 3** : repli du nom de photo de jaugeage de #151. Aucune reconnexion ni envoi de photo ; le pane ne pilote pas le champ fichier. Épreuve : `test_jaugeage_nom_fichier_20261022.js`.
- Le jaugeage de C5/C6 a été enregistré **sans photo**.

## C. Écritures sur Test (jamais Production)
- Script `outils/remise-a-zero-recette-pompiste-20261022.sh` (`aa578cac`) : borné à ce site, ce compte, le 22/10, créations entre 22:19 et 22:30 UTC.
- **Lignes recréées le soir du 22/10, hors fenêtre du script** : prise de poste, inventaire d'ouverture, relevé d'index `debut_q2` (index fictifs 1000001 à 4000001), deux validations de missions. Elles restent sur Test.
- **Lignes créées le 23/10 matin** (par l'interface, valeurs fictives) : prise de poste pompiste matin `ed1cc859-0a4f-4214-aa99-11f1b71dfe63` (12:35 UTC), jaugeage `7c521942-8c82-41a9-8eec-a5dcad308327` (SP 12000, GO1 8000, GO2 4000, GNR 9000, sans photo).
- **Correction du jeu de recette** (précision de Frédéric, 23/10) : les écailles sont un produit de Glaçons, pas une catégorie. Script `outils/correction-jeu-recette-ecailles-20261023.sh` : produit `b5cd05a3-…` rangé dans Glaçons et renommé « Écailles » (il s'appelait « Écailles recette »), catégorie « Écailles » `9ca1027e-…` supprimée (aucun autre dépendant : zones, seuils, modes, réassort à 0). Exécutée sur Test le 23/10, relue : 0 catégorie Écailles, produit sous Glaçons. Aucune catégorie « Écailles » ne sera créée en Production.

- **Rejeu du script (23/10, après le GO de Frédéric)** : `correction-jeu-recette-ecailles-20261023.sh udljdqxerrbbbajxubfn --executer` ne trouve plus rien (UPDATE 0, DELETE 0) ; produit « Écailles » toujours sous Glaçons, 0 catégorie Écailles.

## D. Limites
- Rien vu sur iPhone réel. Aucun envoi de photo.
- Le fil compte encore par la liste `CATEGORIES_FIL` du code : lot suivant, après le GO de #152.
- La lenteur de l'Inventaire et le Missions vide du pompiste ne sont pas dans ce lot (diagnostic du Lot 3 rendu séparément).

## E. Prochaine action unique
Validation du déploiement de #152 par Frédéric.
