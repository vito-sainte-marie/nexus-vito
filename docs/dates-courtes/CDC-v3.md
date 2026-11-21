# Cahier des charges v3 : Dates courtes (DLC et DDM)

Statut : brouillon de documentation. Aucun code, aucune migration, rien sur Test ni en Production.
Cette version v3 est autonome : elle se lit sans la v2. Elle reprend l'arbitrage du 21/11 et l'emporte sur la v2 partout où elles divergent.

## 1. Objet

Permettre à une station de relever les produits à date courte (DLC, DDM) en circulant librement dans le magasin, et de savoir à tout moment, produit par produit et date par date, combien d'unités ont été relevées et quand. Le module n'est pas un inventaire de stock. Il alimente un suivi par le manager : alertes à moins de 60 jours, signalements, retraits physiques.

Vocabulaire imposé : « quantité relevée », jamais « stock ». Toute quantité affichée porte sa date de relevé ou son âge.

## 2. Principes arbitrés (21/11)

1. Pas un inventaire de stock. Circulation libre : on scanne ou on cherche, on saisit la DLC et la quantité, on enregistre, on continue.
2. Pas de zones. Aucun réglage de zone, aucun passage par zone, aucune ouverture ni clôture de zone, aucune confirmation d'absence en fin de zone, aucun remplacement zone par zone. Une session de travail peut subsister pour la traçabilité, sans clôture automatique ni découpage géographique.
3. Identification d'un produit :
   - scan caméra sur iPhone Safari ;
   - recherche par nom ou par EAN ;
   - saisie manuelle de l'EAN si la lecture échoue ;
   - photo facultative ;
   - EAN inconnu : entrée provisoire clairement marquée, aucune création automatique de référence ;
   - produit sans EAN : identifié par son nom via la recherche rapide (suggestions dès les premières lettres, un geste). La clé n'est jamais le texte tapé mais la référence catalogue de la fiche choisie (voir fiche lot 1, section « Produit sans EAN »).
4. Clé de consolidation : station + EAN normalisé + DLC exacte. 6 + 4 = 10, puis correction de moins 2 = 8, relevés et correction restent visibles. Deux DLC donnent deux groupes. Jamais de fusion sur le seul nom commercial.
5. Corrections positives et négatives, chacune enregistrant produit et DLC, quantité, auteur, date et heure, motif s'il est donné, relevé ou groupe visé. La quantité consolidée n'est jamais négative. Deux actions distinctes : « Ajouter des unités » et « Corriger le relevé ». Une correction n'est ni une vente ni une démarque.
6. Droits portés par le serveur, isolation stricte par `site_id` : le renfort a le contrôle complet ; le manager pareil plus la supervision et la validation ; la caissière n'a pas d'accès par défaut ; le pompiste n'a aucun accès opérationnel. Complément : l'accès de la caissière peut être activé dans les réglages de la station, par trois profils seulement : manager, gérant, créateur. Fermé par défaut.
7. Retraits en trois états : signalé, retiré physiquement, démarque comptabilisée. Le renfort peut confirmer le retrait physique, jamais le comptabiliser. Aucune intégration comptable inventée.
8. Alertes à DLC de moins de 60 jours. Affichés : produit et EAN, DLC, jours restants, quantité consolidée, historique des corrections, état de traitement, action du manager. Les seuils complémentaires ne sont que des propositions. Rien d'automatique (promotion, destruction, démarque).
9. États de synchronisation : Enregistré, En attente, Refusé. Une opération renvoyée compte une fois. Tests de corrections simultanées et de reprise après coupure.
10. Parcours : ouvrir, scanner ou chercher, saisir DLC et quantité, enregistrer, continuer. Accès rapide aux produits déjà relevés et aux corrections.

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
| 1 | Socle métier et données : relevés, corrections, consolidation station + EAN + DLC, historique, anti-doublon, droits, isolation multisite |
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
- Rien n'est mesuré sur Test ni en Production.
