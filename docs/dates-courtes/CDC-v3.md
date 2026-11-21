# Cahier des charges v3 : Dates courtes

Statut : brouillon de documentation. Aucun code, aucune migration, rien sur Test ni en Production.
Cette version v3 est autonome : elle se lit sans la v2. Elle reprend l'arbitrage du 21/11 et l'emporte sur la v2 partout où elles divergent.

## 1. Objet

Permettre à une station de relever les produits à date limite en circulant librement dans le magasin, et de savoir à tout moment, produit par produit et date par date, combien d'unités ont été relevées et quand. Le module n'est pas un inventaire de stock. Il alimente un suivi par le manager : alertes à moins de 60 jours, signalements, retraits physiques.

Vocabulaire imposé : « quantité relevée », jamais « stock ». Toute quantité affichée porte sa date de relevé ou son âge.

## 2. Principes arbitrés (21/11)

1. Pas un inventaire de stock. Circulation libre : on scanne ou on cherche, on saisit la date limite et la quantité, on enregistre, on continue.
2. Pas de zones. Aucun réglage de zone, aucun passage par zone, aucune ouverture ni clôture de zone, aucune confirmation d'absence en fin de zone, aucun remplacement zone par zone. Une session de travail peut subsister pour la traçabilité, sans clôture automatique ni découpage géographique.
3. Identification d'un produit :
   - scan caméra sur iPhone Safari ;
   - recherche par nom ou par EAN ;
   - saisie manuelle de l'EAN si la lecture échoue ;
   - photo facultative ;
   - EAN inconnu : entrée provisoire portant l'EAN lu et un nom libre facultatif, clairement marquée « provisoire », aucune création de référence. Elle rejoint la fiche du catalogue d'elle-même quand l'EAN apparaît dans un import. Le manager voit la liste des produits encore provisoires et peut rattacher une ligne à la main (geste tracé) ;
   - produit sans EAN : identifié par son nom via la recherche rapide (suggestions dès les premières lettres, un geste). La clé est le libellé normalisé (date en tête retirée, casse et espaces unifiés), jamais le texte tapé. Un geste manager tracé « même produit que… » traite un renommage (voir fiche lot 1, section 5).
4. Une seule date est saisie, la « Date limite », sans type : DLC et DDM sont traitées de la même façon (même clé, mêmes seuils, même règle).
5. Clé de consolidation : station + EAN normalisé + date limite exacte (sans EAN : libellé normalisé). 6 + 4 = 10, puis correction de moins 2 = 8, relevés et correction restent visibles. Deux dates limites donnent deux groupes. Jamais de fusion sur le seul nom commercial.
6. Tournée. Les relevés d'un même groupe dans la même tournée s'additionnent (4 au frigo + 3 en gondole = 7), avec corrections positives et négatives. Chaque nouvelle tournée est un contrôle indépendant : toutes les quantités actives repartent de zéro ; celles de la tournée précédente restent consultables comme historique et ne s'additionnent jamais. Quantité active = relevés, plus corrections, moins retraits physiques, de la tournée en cours seulement, plancher à zéro. Un geste appartient à la tournée de son heure de geste (appareil, y compris hors ligne) et ne compte que dans celle-ci. Une date non revue n'a ni alerte active ni demande de retrait ; son absence n'est ni une vente, ni une destruction, ni une démarque, et aucun mouvement n'est écrit. L'employé ne choisit rien. Une tournée n'est jamais fermée : par défaut une par semaine calendaire (lundi 00:00, heure de la Martinique), et un manager, un gérant ou un créateur peut en ouvrir une à la main, avec confirmation à l'écran et trace du geste, car elle remet tout à zéro. « Corriger le relevé » reste pour les erreurs de saisie.
7. Corrections positives et négatives, chacune enregistrant produit et date limite, quantité, auteur, date et heure, motif s'il est donné, relevé ou groupe visé. La quantité consolidée n'est jamais négative. Deux actions distinctes : « Ajouter des unités » et « Corriger le relevé ». Une correction n'est ni une vente ni une démarque.
8. Droits portés par le serveur, isolation stricte par `site_id` : le renfort a le contrôle complet ; le manager pareil ; la caissière n'a pas d'accès par défaut ; le pompiste n'a aucun accès opérationnel. Complément : l'accès de la caissière peut être activé dans les réglages de la station, par trois profils seulement : manager, gérant, créateur. Fermé par défaut.
9. Retraits en trois états : signalé, retiré physiquement, démarque comptabilisée. Le renfort peut confirmer le retrait physique, jamais le comptabiliser. Le retrait physique diminue la quantité active de la tournée comme mouvement à part (ni correction ni démarque) : 8 relevés moins 3 retirés donnent 5, et les 3 vont dans la liste « à comptabiliser » du manager. Un geste « trouvé et retiré » écrit un relevé et un retrait de même quantité pour un produit pas encore relevé dans la tournée : quantité active zéro, rien refusé par le plancher. Aucune intégration comptable inventée.
10. Alertes à date limite de moins de 60 jours. Affichés : produit et EAN, date limite, jours restants, quantité consolidée, historique des corrections, état de traitement, action du manager. Les seuils complémentaires ne sont que des propositions. Rien d'automatique (promotion, destruction, démarque). Un groupe dont la date est passée avec une quantité active supérieure à zéro dans la tournée en cours passe de lui-même à l'état d'affichage « signalé, à retirer » : ce n'est pas un mouvement et aucune quantité ne change. Au début d'une tournée, le tableau du manager affiche l'avancement (« Tournée du 23/11 : 0 produit relevé », puis le nombre relevé), pour qu'un tableau vide ne se lise pas comme « aucun risque » ; les chiffres de la tournée précédente y figurent comme historique.
11. États de synchronisation : Enregistré, En attente, Refusé. Une opération renvoyée compte une fois. Tests de corrections simultanées et de reprise après coupure.
12. Parcours libre dans toute la boutique, sans zones et sans confirmation des anciennes dates : ouvrir, scanner ou chercher, saisir la date limite et la quantité, enregistrer, continuer. Accès rapide aux produits déjà relevés et aux corrections.

## 3. Règles conservées de la v2

La v2 n'est pas dans le dépôt. Les règles suivantes en sont reprises telles qu'elles ont été transmises :

- Chaque quantité porte sa date ou son âge.
- Corrections : changement de date (moins n sur l'ancienne, plus n sur la nouvelle, les deux liées) et annulation (motif obligatoire).
- Plancher à zéro vérifié côté serveur, sous verrou de ligne.
- Hors ligne : contrôle local, puis recontrôle serveur, refus visible, clé d'idempotence fabriquée au moment du geste.
- `inventaire_mouvements` est mis de côté (sa colonne `quart_id` est obligatoire, un retrait hors quart n'y passe pas).
- Bandes d'alerte : expiré, 0 à 7 jours, 8 à 30 jours, 31 à 60 jours. Ordre : expiré d'abord, puis jours croissants, puis quantité décroissante. Aucun score. Grisé à 7 jours ; quantité masquée au delà de 14 jours.
- Jours calendaires, fuseau de la Martinique.
- EAN-13 et EAN-8 avec contrôle de la clé.
- Lecture : détecteur natif sinon ZXing figé en version.
- Le réglage `seuilPeremptionJours` (écran Paramètres Inventaire, sans lecteur dans le dépôt) est retiré.

## 4. Découpage en lots

Sept lots conservés. Seuls les lots 1 à 3 sont fiches ici.

| Lot | Contenu |
|---|---|
| 1 | Socle métier et données : relevés, corrections, consolidation station + EAN + date limite, tournées, historique, anti-doublon, droits, isolation multisite |
| 2 | Parcours mobile : scan caméra, recherche, saisie rapide, corrections, maquettes Jour et Nuit, recette iPhone Safari |
| 3 | Exploitation et alertes : échéances, tableau de suivi du manager, quantités consolidées, signalements et retraits physiques, traçabilité des actions |
| 4 à 7 | Rien n'est anticipé sans besoin démontré. Renumérotation à faire à partir de ce qui reste de la v2 |

Fiches : `fiche-lot-1.md`, `fiche-lot-2.md`, `fiche-lot-3.md`. Annexes : `matrice-permissions.md`, `modele-donnees.md`, `plan-recette.md`, `questions-metier.md`, `modifications-vs-v2.md`.

## 5. Contraintes transverses

- Écrans soumis à `docs/conception/NEXUS-REFERENTIEL-CONCEPTION.md` (NEXUS-REFERENTIEL-CONCEPTION v1.0) : fiche de la section 7 remplie aux lots 2 et 3.
- Dépôt public : pseudonymes (R1, R2, M1), produits fictifs, aucune vente réelle. Seule exception : l'EAN de recette 3168930171683.
- Aucune icône dessinée par l'assistant.
- Aucun tiret dans les textes affichés à l'écran.

## 6. Hors périmètre

Promotion, destruction, démarque automatique ; intégration comptable ; zones ; inventaire de stock ; création automatique de référence catalogue.

## 7. Limites de ce document

- La v2 n'a pas été relue dans le dépôt : ses règles sont reprises du message d'arbitrage.
- Les noms de tables et de colonnes sont des propositions, non vérifiées contre la base Production.
- Une mesure en Production a été faite par Guardian (lecture seule, 21/11) : `normalized_products` est vide, d'où la clé sur le libellé normalisé. Rien d'autre n'est mesuré, rien sur Test.
