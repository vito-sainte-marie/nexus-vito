# Fiche lot 3 : exploitation et alertes

Statut : documentation. Application de NEXUS-REFERENTIEL-CONCEPTION v1.0 (fiche de la section 7, 11 points). Aucun code.

## 1. Objectif

Donner au manager un tableau de suivi des dates à venir, des quantités consolidées, des signalements et des retraits physiques, avec la trace de chaque action.

## 2. Alertes

- Seuil : date limite dans moins de 60 jours (une seule date, sans type).
- Bandes : expiré, 0 à 7 jours, 8 à 30 jours, 31 à 60 jours.
- Ordre : expiré, puis jours croissants, puis quantité décroissante. Aucun score.
- Grisé à 7 jours. Quantité masquée au delà de 14 jours.
- Par ligne : produit et EAN, date limite, jours restants, quantité consolidée, historique des corrections, état de traitement, action du manager.
- Seuils complémentaires : propositions seulement, jamais appliquées sans arbitrage.
- Date passée avec une quantité active supérieure à zéro dans la tournée en cours : le groupe passe de lui-même à l'état d'affichage « signalé, à retirer ». C'est un état d'affichage, pas un mouvement : aucune écriture de retrait, aucune quantité modifiée. Le retrait physique reste un geste humain. Une quantité d'une tournée précédente ne déclenche pas cet état.
- Une date non revue dans la tournée en cours : ni alerte active, ni demande de retrait, aucun mouvement écrit.
- Aucune action automatique : ni promotion, ni destruction, ni démarque.

## 3. Retraits en trois états

| État | Qui peut le poser |
|---|---|
| Signalé | Renfort, manager |
| Retiré physiquement | Renfort, manager |
| Démarque comptabilisée | Manager (et profils supérieurs), jamais le renfort |

Aucune intégration comptable inventée : « démarque comptabilisée » est un état que la personne habilitée pose à la main, avec sa trace. Le retrait physique diminue la quantité active de la tournée comme mouvement à part, ni correction ni démarque (8 moins 3 donnent 5) ; les unités retirées vont dans la liste « à comptabiliser » du manager. Geste « trouvé et retiré » : pour un produit pas encore relevé dans la tournée, il écrit un relevé de 3 et un retrait de 3 (quantité active zéro, 3 dans « à comptabiliser »), renfort autorisé.

## 4. Tableau de suivi du manager

- Avancement de la tournée en tête du tableau : « Tournée du 23/11 : 0 produit relevé », puis le nombre relevé. Un tableau vide n'est jamais présenté comme « aucun risque ». Les chiffres de la tournée précédente sont consultables comme historique, jamais comme quantités actives.
- Liste des groupes à échéance, filtrable par bande.
- Détail d'un groupe : relevés, corrections, signalements, retraits, avec auteur, date et heure.
- Actions : signaler, confirmer le retrait physique, comptabiliser la démarque, ouvrir une nouvelle tournée (confirmation à l'écran, remet toutes les quantités actives à zéro, geste tracé). (L'action « valider » est retirée : aucun objet ni effet défini.)
- Liste « à comptabiliser » : les unités retirées physiquement et pas encore comptabilisées. Le renfort ne peut pas les marquer comptabilisées.
- Liste des produits provisoires (EAN inconnu du catalogue) : le manager peut rattacher une ligne à la main à un produit sous un autre code (geste tracé : auteur, date). Un produit provisoire rejoint seul la fiche du catalogue quand son EAN apparaît dans un import.
- Traçabilité : chaque action écrit une ligne append-only ; rien n'est supprimé.

## 5. Fiche de conception (section 7 du référentiel)

| # | Point | État |
|---|---|---|
| 1 | Tâche principale | Savoir quoi traiter aujourd'hui et le suivre |
| 2 | Qui, où, avec quoi | Manager, gérant, créateur ; mobile et bureau |
| 3 | Niveau (1 à 3) | À confirmer par Guardian |
| 4 | Canevas (A à E) | Liste priorisée avec panneau de détail, à choisir |
| 5 | Action principale | Traiter le groupe (confirmer le retrait physique) |
| 6 | États | Vide, chargement, refus, hors ligne |
| 7 | Textes | Sans tiret, « quantité relevée », jamais « stock » |
| 8 | Cibles 44 px | À mesurer |
| 9 | Jour et Nuit | Maquettes obligatoires |
| 10 | Test de compréhension Guardian | À planifier |
| 11 | Recette Safari iOS | Appareil réel, sinon « non fait » |

Aucune icône dessinée par l'assistant.

## 6. Critères mesurables

- Aucun groupe de 60 jours ou plus n'apparaît.
- Ordre de la liste conforme à la règle, vérifié sur jeu fictif.
- Un renfort ne peut pas poser l'état « démarque comptabilisée » : refus serveur (cas 9). Alertes à 59 et 61 jours : cas 19 ; ordre du tableau : cas 20. Date passée : cas 29 et 34 ; date disparue : cas 30 ; trouvé et retiré : cas 31 ; ouverture manuelle : cas 32 ; avancement en début de tournée : cas 33.
- Aucune action automatique n'est créée sans geste humain.

## 7. Limites

- Pas de lecture de ventes : la fiche n'estime pas de reste écoulé (hors périmètre).
