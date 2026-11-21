# Table des modifications : v3 contre v2

| # | Sujet | v2 (telle que transmise) | v3 | Source |
|---|---|---|---|---|
| 1 | Nature | Contrôle structuré par rayon | Relevé libre, pas un inventaire de stock | Arbitrage 1 |
| 2 | Zones | Réglage de zones, passages, ouverture et clôture, confirmation d'absence, remplacement par zone | Supprimés. Session de travail facultative, sans clôture automatique ni découpage géographique | Arbitrage 2 |
| 3 | Identification | Scan ou recherche | Scan caméra iPhone Safari, recherche nom ou EAN, EAN manuel, photo facultative, EAN inconnu en entrée provisoire marquée avec nom libre facultatif, rattachée seule à la fiche du catalogue quand l'EAN apparaît dans un import, produit sans EAN par nom (libellé normalisé) | Arbitrage 3 et complément |
| 4 | Clé | Dépendait de la zone | Station + EAN normalisé + date limite exacte (sans EAN : station + libellé normalisé + date limite, geste manager « même produit que… » pour un renommage) | Arbitrage 4 |
| 5 | Corrections | Remplacement par zone | Ajouter des unités et Corriger le relevé, positives et négatives, plancher à zéro | Arbitrage 5 |
| 6 | Droits | Non figés | Renfort complet ; manager pareil (aucune action « valider » : aucun effet défini) ; caissière fermée par défaut, activable par manager, gérant ou créateur ; pompiste aucun | Arbitrage 6 et complément |
| 7 | Retraits | Un seul état | Trois états : signalé, retiré physiquement, démarque comptabilisée | Arbitrage 7 |
| 8 | Alertes | Bandes | Date limite à moins de 60 jours, bandes conservées, rien d'automatique | Arbitrage 8 |
| 9 | Synchronisation | Idempotence | Trois états visibles, renvoi compté une fois | Arbitrage 9 |
| 10 | Parcours | Par zone | Ouvrir, scanner ou chercher, date limite et quantité, enregistrer, continuer | Arbitrage 10 |
| 11 | Lots | Non précisé ici | Sept lots, lots 1 à 3 fiches, lots 4 à 7 non anticipés | Arbitrage |
| 12 | `seuilPeremptionJours` | Présent | Retiré | v2 |
| 13 | Recette | Non figée | 34 cas (numérotés 1 à 34, avec 6b, 6c et 16b) | Arbitrage et décisions du 21/11 |
| 14 | Tournée | Remplacement par zone | Tournée hebdomadaire jamais fermée, chaque tournée étant un contrôle indépendant : les relevés d'une même tournée s'additionnent, les quantités actives repartent de zéro, celles de la tournée précédente restent en historique | Décision du 21/11 et arbitrage du pilote du 21/11 (17:54) |
| 15 | Date | DLC avec type possible | Une seule « Date limite », sans type : DLC et DDM traitées de la même façon | Décision du 21/11 |
| 16 | Retrait physique | Non précisé | Diminue la quantité consolidée comme mouvement à part ; les unités vont dans « à comptabiliser » | Décision du 21/11 |
| 17 | Quantité consolidée | Gestes de toute la tournée comptés | Quantité active de la tournée en cours seulement : un geste appartient à la tournée de son heure de geste, hors ligne comprise (règle de la tournée retenue abandonnée) | Arbitrage du pilote du 21/11 (17:54) |
| 18 | Date passée | Non précisé | État d'affichage « signalé, à retirer » pour une quantité active de la tournée en cours seulement, sans mouvement ni action automatique ; action « valider » retirée | Revue Guardian du 21/11 et arbitrage du pilote |
| 19 | Date non revue | Gardait sa dernière quantité | Quantité active zéro, ni alerte ni demande de retrait ni mouvement écrit | Arbitrage du pilote du 21/11 (17:54) |
| 20 | Retrait sans relevé préalable | Refusé par le plancher | Geste « trouvé et retiré » : relevé et retrait de même quantité, quantité active zéro, « à comptabiliser » | Arbitrage du pilote du 21/11 (17:54) |
| 21 | Ouverture manuelle de tournée | Geste tracé | Confirmation à l'écran, remise à zéro de toutes les quantités actives, geste tracé | Arbitrage du pilote du 21/11 (17:54) |
| 22 | Tableau manager en début de tournée | Non précisé | Affiche l'avancement (« 0 produit relevé »), historique de la tournée précédente distinct | Arbitrage du pilote du 21/11 (17:54) |

Conservé sans changement : vocabulaire « quantité relevée », date ou âge sur toute quantité, annulation motivée, plancher à zéro sous verrou, hors ligne avec clé d'idempotence, bandes d'alerte et ordre, jours calendaires Martinique, contrôle de clé EAN, lecteur natif sinon ZXing figé.

Limite : la v2 n'étant pas dans le dépôt, la colonne « v2 » reprend ce qui a été transmis, sans relecture du texte d'origine.
