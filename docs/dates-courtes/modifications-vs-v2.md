# Table des modifications : v3 contre v2

| # | Sujet | v2 (telle que transmise) | v3 | Source |
|---|---|---|---|---|
| 1 | Nature | Contrôle structuré par rayon | Relevé libre, pas un inventaire de stock | Arbitrage 1 |
| 2 | Zones | Réglage de zones, passages, ouverture et clôture, confirmation d'absence, remplacement par zone | Supprimés. Session de travail facultative, sans clôture automatique ni découpage géographique | Arbitrage 2 |
| 3 | Identification | Scan ou recherche | Scan caméra iPhone Safari, recherche nom ou EAN, EAN manuel, photo facultative, EAN inconnu en entrée provisoire marquée avec nom libre facultatif, rattachée seule à la fiche du catalogue quand l'EAN apparaît dans un import, produit sans EAN par nom (libellé normalisé) | Arbitrage 3 et complément |
| 4 | Clé | Dépendait de la zone | Station + EAN normalisé + date limite exacte (sans EAN : station + libellé normalisé + date limite, geste manager « même produit que… » pour un renommage) | Arbitrage 4 |
| 5 | Corrections | Remplacement par zone | Ajouter des unités et Corriger le relevé, positives et négatives, plancher à zéro | Arbitrage 5 |
| 6 | Droits | Non figés | Renfort complet ; manager plus supervision et validation ; caissière fermée par défaut, activable par manager, gérant ou créateur ; pompiste aucun | Arbitrage 6 et complément |
| 7 | Retraits | Un seul état | Trois états : signalé, retiré physiquement, démarque comptabilisée | Arbitrage 7 |
| 8 | Alertes | Bandes | Date limite à moins de 60 jours, bandes conservées, rien d'automatique | Arbitrage 8 |
| 9 | Synchronisation | Idempotence | Trois états visibles, renvoi compté une fois | Arbitrage 9 |
| 10 | Parcours | Par zone | Ouvrir, scanner ou chercher, date limite et quantité, enregistrer, continuer | Arbitrage 10 |
| 11 | Lots | Non précisé ici | Sept lots, lots 1 à 3 fiches, lots 4 à 7 non anticipés | Arbitrage |
| 12 | `seuilPeremptionJours` | Présent | Retiré | v2 |
| 13 | Recette | Non figée | 26 cas (numérotés 1 à 26, avec 6b, 6c et 16b) | Arbitrage et décisions du 21/11 |
| 14 | Tournée | Remplacement par zone | Tournée hebdomadaire jamais fermée : les relevés d'une même tournée s'additionnent, le premier d'une nouvelle tournée remplace la quantité précédente, un groupe non recompté garde sa quantité avec son âge | Décision du 21/11 |
| 15 | Date | DLC avec type possible | Une seule « Date limite », sans type : DLC et DDM traitées de la même façon | Décision du 21/11 |
| 16 | Retrait physique | Non précisé | Diminue la quantité consolidée comme mouvement à part ; les unités vont dans « à comptabiliser » | Décision du 21/11 |

Conservé sans changement : vocabulaire « quantité relevée », date ou âge sur toute quantité, annulation motivée, plancher à zéro sous verrou, hors ligne avec clé d'idempotence, bandes d'alerte et ordre, jours calendaires Martinique, contrôle de clé EAN, lecteur natif sinon ZXing figé.

Limite : la v2 n'étant pas dans le dépôt, la colonne « v2 » reprend ce qui a été transmis, sans relecture du texte d'origine.
