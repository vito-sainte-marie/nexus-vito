### Fiche de conception : Rapport A4 d'audit de gestion

Statut : conception seule, brouillon, aucune validation. Aucun code, aucune migration, rien en Production. Aucune donnée réelle citée. Référentiel : NEXUS-REFERENTIEL-CONCEPTION v1.0. Fiche distincte de celle du Brief v4 (bouton d'accès : Brief §11.9).

## 1. Utilisateur cible
Le gérant, qui veut un document imprimable ou transmissible (comptable, associé, banque) de l'état de sa station.

## 2. Besoin principal
Lire, sur quelques pages A4, l'état de la station avec, pour chaque chiffre, sa période, son unité, sa référence, sa preuve et sa limite.

## 3. Trois informations à comprendre en premier
1. Performance globale et risques confirmés (mêmes deux lectures que le Brief, Brief §17.2).
2. Les chiffres clés par secteur, avec période et couverture.
3. Les actions et le potentiel, par nature, avec leur source.

## 4. Principe : aucun calcul concurrent
Le PDF consomme les mêmes résultats officiels que le Brief (table d'autorité, Brief §18). Le générateur ne recalcule rien : il met en page. Si un résultat manque, la page dit « non mesuré » et la raison, jamais une valeur de remplacement.

## 5. Contenu par page (proposition)
- Page 1 : station, date d'édition, performance globale, risques confirmés, couverture (secteurs mesurés).
- Page 2 : Carburant et Boutique, fenêtres de 7 jours nommées (dates contre dates), graphique sur 40 jours.
- Page 3 : Marge (taux, cible, date de la période), FDJ, Opérations.
- Page 4 : signaux de risque avec leur état (actif, à vérifier, résolu, sans mesure récente) et la preuve de chaque transition.
- Page 5 : objectifs et potentiel, une nature par ligne.
- Dernière page : références (sources, fonctions officielles, dates de mesure) et limites (ce qui n'est pas mesuré, périmètres).

## 6. Pour chaque chiffre
Période, unité, périmètre, date de mesure, source officielle, limite connue. Un chiffre sans ces six éléments n'est pas imprimé.

## 7. Exigences d'impression
- Feuille de style claire propre au rapport, indépendante du thème Jour ou Nuit.
- Pagination A4 : pas de carte coupée entre deux pages, en-tête et pied de page avec numéro, station et date.
- Téléchargement direct du fichier et impression depuis le navigateur ; même rendu.
- Graphiques lisibles en noir et blanc : pas de sens porté par la seule couleur.

## 8. États
- Données absentes ou périmées : la section existe, avec « non mesuré » et la date de la dernière mesure.
- Station sans objectif : « objectif à définir », jamais une valeur proposée présentée comme validée.

## 9. Épreuves prévues
- Le PDF et le Brief affichent les mêmes valeurs pour le même jeu de données fictif.
- Le générateur n'appelle aucun calcul propre : épreuve de non-concurrence (aucune formule dupliquée).
- Chaque chiffre porte ses six éléments.
- Pagination A4 : aucun bloc coupé, numéros de page justes.
- Rendu identique en Jour et en Nuit.

## 10. Questions pour le gérant
1. Destinataires du rapport et niveau de détail (une page de synthèse seule ou le rapport complet) ?
2. Le rapport inclut-il les noms d'employés (écarts de caisse) ou seulement des quarts ?
3. Fréquence d'édition et conservation d'une copie datée ?
4. Mentions légales ou d'en-tête à imposer ?

## 11. Lot
Lot propre, après la revue de la fiche et le GO du gérant ; il dépend du lot A du Brief (résultats officiels stables).
