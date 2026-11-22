# Fiche lot 3 : suivi manager dans Produits (v4)

Statut : documentation. Rien sur Test ni en Production.

## 1. Objectif

Donner au manager et au gérant le suivi des tournées, des relevés consolidés, des alertes, des retraits et de la certification.

## 2. Alertes

- Date limite à moins de 60 jours. Bandes : expiré, 0 à 7, 8 à 30, 31 à 60.
- Ordre : expiré, jours croissants, quantité décroissante.
- Par ligne : produit, date limite, quantité relevée, âge du relevé, tournée.
- Âge : 7 jours et moins courante ; 8 à 14 jours « à vérifier » ; plus de 14 jours « À recontrôler ».
- Date dépassée : relevé de plus de 7 jours « DLC dépassée, présence à vérifier », sans demande de retrait ; relevé de 7 jours ou moins « à retirer ».
- Aucune quantité de plus de 7 jours ne déclenche de demande de retrait. Aucune action automatique.

## 3. Retraits en trois états

- Signalé, retiré physiquement, démarque comptabilisée.
- 8 relevés moins 3 retirés : 5 ; la liste « à comptabiliser » porte les 3.
- « Trouvé et retiré » : quantité 0 dans la tournée, 3 à comptabiliser (cas 43).
- La démarque comptabilisée n'est pas ouverte au renfort.

## 4. Tableau de suivi

- Tournées à certifier.
- Relevés consolidés et historique, avec la mention « relevé aussi dans la tournée X ».
- Détail d'une ligne, avec « reçue après clôture » le cas échéant.
- « Demander une correction » et « Certifier le contrôle », avec « réalisateur et certificateur identiques » si le manager certifie sa propre tournée.
- Quantités « non certifiées » jusqu'à la certification.
- Liste des produits provisoires avec « même produit que… ».
- Tout est append-only.

## 5. Fiche de conception

Référentiel : NEXUS-REFERENTIEL-CONCEPTION v1.0, section 7.

1. Utilisateur : manager, gérant ou créateur, au bureau ou au téléphone.
2. Besoin : savoir quelles tournées attendent une certification et quelles quantités sont courantes.
3. Trois informations en premier : tournées à certifier, produits à échéance 0 à 7 jours, retraits à comptabiliser.
4. Actions : Certifier le contrôle (page de la tournée), Demander une correction, Comptabiliser la démarque.
5. Canevas : A identité, B synthèse (trois cartes), D navigation, E détails. C Conseiller écarté à ce lot (réservé à la Prévention des pertes).
6. Composants : `nexus-theme.js`, jetons `--t-*`, `nexus-badge-etat.js` pour les états, `nexus-icones.js`, tuile « icône à venir ».
7. Réservé aux détails : lignes consolidées, historique, mention « relevé aussi dans la tournée X ».
8. Premier écran à 375×812 et 1280×800 : les trois cartes, puis la liste des tournées à certifier.
9. États : chargement, aucune tournée à certifier, erreur, quantités « non certifiées ».
10. Exceptions : aucune. Aucun rouge hors `--nbe-critique`.
11. Maquette : `outils/maquettes/dates-courtes/`, Jour et Nuit, 375 et 1280, après revue de cette fiche.

## 6. Critères

Cas de recette : 9, 19, 20, 26 à 30, 38, 40, 43.

## 7. Limites

- Aucune lecture de ventes.
- Rien n'a été joué sur Test.
