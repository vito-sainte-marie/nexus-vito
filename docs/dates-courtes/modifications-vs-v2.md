# Table des modifications : v3 contre v2, puis v4 contre v3

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
| 13 | Recette | Non figée | v3 : 34 cas. v4 : 44 cas (voir `plan-recette.md`) | Arbitrage et décisions du 21/11 |
| 14 | (remplacé en v4, ligne v4-A) Tournée | Remplacement par zone | Tournée hebdomadaire jamais fermée, chaque tournée étant un contrôle indépendant : les relevés d'une même tournée s'additionnent, les quantités actives repartent de zéro, celles de la tournée précédente restent en historique | Décision du 21/11 et arbitrage du pilote du 21/11 (17:54) |
| 15 | Date | DLC avec type possible | Une seule « Date limite », sans type : DLC et DDM traitées de la même façon | Décision du 21/11 |
| 16 | Retrait physique | Non précisé | Diminue la quantité consolidée comme mouvement à part ; les unités vont dans « à comptabiliser » | Décision du 21/11 |
| 17 | (remplacé en v4, ligne v4-A) Quantité consolidée | Gestes de toute la tournée comptés | Quantité active de la tournée en cours seulement : un geste appartient à la tournée de son heure de geste, hors ligne comprise (règle de la tournée retenue abandonnée) | Arbitrage du pilote du 21/11 (17:54) |
| 18 | (remplacé en v4, ligne v4-A) Date passée | Non précisé | État d'affichage « signalé, à retirer » pour une quantité active de la tournée en cours seulement, sans mouvement ni action automatique ; action « valider » retirée | Revue Guardian du 21/11 et arbitrage du pilote |
| 19 | (remplacé en v4, ligne v4-A) Date non revue | Gardait sa dernière quantité | Quantité active zéro, ni alerte ni demande de retrait ni mouvement écrit | Arbitrage du pilote du 21/11 (17:54) |
| 20 | Retrait sans relevé préalable | Refusé par le plancher | Geste « trouvé et retiré » : relevé et retrait de même quantité, quantité active zéro, « à comptabiliser » | Arbitrage du pilote du 21/11 (17:54) |
| 21 | (remplacé en v4, ligne v4-A) Ouverture manuelle de tournée | Geste tracé | Confirmation à l'écran, remise à zéro de toutes les quantités actives, geste tracé | Arbitrage du pilote du 21/11 (17:54) |
| 22 | (remplacé en v4, ligne v4-A) Tableau manager en début de tournée | Non précisé | Affiche l'avancement (« 0 produit relevé »), historique de la tournée précédente distinct | Arbitrage du pilote du 21/11 (17:54) |

Conservé sans changement : vocabulaire « quantité relevée », date ou âge sur toute quantité, annulation motivée, plancher à zéro sous verrou, hors ligne avec clé d'idempotence, bandes d'alerte et ordre, jours calendaires Martinique, contrôle de clé EAN, lecteur natif sinon ZXing figé.

Limite : la v2 n'étant pas dans le dépôt, la colonne « v2 » reprend ce qui a été transmis, sans relecture du texte d'origine.

## v4 contre v3 (arbitrages du pilote du 21/11, complément de tournées individuelles)

| # | Sujet | v3 | v4 | Source |
|---|---|---|---|---|
| v4-A | Tournée | Hebdomadaire, jamais fermée, ouverte le lundi 00:00 ou manuellement par le manager | Individuelle : chaque employé autorisé crée et mène la sienne, plusieurs ouvertes en même temps, nom facultatif sans effet sur les produits | Complément du 21/11 |
| v4-B | États | Aucun | `EN_COURS`, `TERMINEE_A_CERTIFIER`, `CERTIFIEE`, `CORRECTION_DEMANDEE` | Complément du 21/11 |
| v4-C | Clôture | Aucune | « Terminer ma tournée » : auteur, heure, empreinte et dernière opération ; bouton bloqué avec saisies en attente (côté appareil) ; saisie tardive « reçue après clôture » | Complément du 21/11 |
| v4-D | Quantité courante | Active de la tournée en cours, remise à zéro à chaque tournée | Addition dans une tournée seulement ; entre tournées, la tournée du dernier relevé effectif de l'article l'emporte, les autres vont en historique ; date non retrouvée : aucune quantité courante | Arbitrage du 21/11 |
| v4-E | Conflits | Trois choix | Aucun écran ni table ; mention « relevé aussi dans la tournée X, en historique » | Arbitrage du 21/11 |
| v4-F | Âge | Quantité masquée au delà de 14 jours | Ligne par date limite, depuis le dernier relevé effectif : 7 jours et moins courante, 8 à 14 « à vérifier », plus de 14 « À recontrôler » ; ni correction ni certification ne rajeunit | Arbitrage du 21/11 |
| v4-G | Date dépassée | « à retirer » | Relevé de 7 jours ou moins : « à retirer ». Plus de 7 jours : « DLC dépassée, présence à vérifier », sans demande de retrait | Arbitrage du 21/11 |
| v4-H | Certification | Aucune | Manager, gérant, créateur certifient ou demandent une correction ; renfort et caissier jamais ; réalisateur et certificateur identiques permis avec mention ; sans effet sur démarque ou clôture | Arbitrage du 21/11 |
| v4-I | Droits | Renfort complet, caissière activable | Renfort : créer, terminer, répondre, voir ses tournées ; manager et au dessus : tout, plus certifier, exporter ; rôle `caissier` ; `vacataire` sans accès (arbitrage du 21/11) | Arbitrage du 21/11 |
| v4-J | Emplacement | Non fixé | Page employé dédiée, suivi manager dans Produits | Arbitrage du 21/11 |
| v4-K | Lots | Sept lots | Lot 1 données et droits, lot 2 page employé, lot 3 suivi Produits, lot 4 exports | Arbitrage du 21/11 |
