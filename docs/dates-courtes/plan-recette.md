# Plan de recette : Dates courtes (v4)

Données fictives, stations pseudonymes (R1, R2), employés pseudonymes (M1 manager, R1 et R2 renforts). Seule exception : l'EAN de recette 3168930171683. Aucune recette n'est jouée sur Test sans accord ; rien en Production.

La date saisie est une seule « Date limite », sans type. Les quantités s'additionnent dans une tournée, jamais entre tournées : la tournée qui porte le dernier relevé effectif d'un article l'emporte.

| # | Cas | Critère mesurable | Lot |
|---|---|---|---|
| 1 | Même EAN et même date limite à deux endroits, même tournée (4 au frigo, 3 en gondole) | Un seul groupe, quantité 7, les deux relevés visibles | 1 |
| 2 | Même EAN, deux dates limites | Deux groupes distincts, aucune fusion | 1 |
| 3 | Correction de moins 2 sur un groupe de 10 | Total 8, relevés et correction visibles dans l'historique | 1 |
| 4 | Renvoi réseau de la même opération | Une seule ligne créée, même résultat renvoyé | 1 |
| 5 | Deux envois simultanés vers la même tournée pour le même groupe | Total égal à la somme, aucun relevé perdu | 1 |
| 6 | EAN inconnu du catalogue, `3168930171683` saisi avec nom libre facultatif | Entrée marquée « provisoire », aucune référence créée | 1 et 2 |
| 6b | Même EAN `3168930171683` présent ensuite dans un import de test | Un seul groupe, historique intact, plus de marque « provisoire » | 1 |
| 6c | Manager rattache à la main une ligne provisoire à un produit sous un autre code | Rattachement accepté, tracé ; renfort refusé ; l'âge de la ligne ne change pas | 1 |
| 7 | Caissier sans habilitation | Refus par le serveur sur relevé, ajout et correction | 1 |
| 8 | Pompiste | Refus par le serveur sur toute action | 1 |
| 9 | Retrait physique de 3 sur un groupe de 8 relevés, puis renfort tente la démarque comptabilisée | Quantité 5 dans la tournée, 3 dans « à comptabiliser » ; renfort refusé sur la comptabilisation | 1 et 3 |
| 10 | Changement de station | Aucun relevé de l'autre station visible ni modifiable | 1 |
| 11 | Scan réel iPhone Safari, EAN de recette 3168930171683, y compris à 90 degrés | Lu et identifié, ou marqué « non fait » | 2 |
| 12 | Accès caissier : manager, gérant ou créateur l'active | Accepté ; le caissier accède ensuite à cette station seulement | 1 |
| 13 | Accès caissier : renfort ou caissier tente de l'activer | Refusé par le serveur | 1 |
| 14 | Activation sur la station R1 | Aucun effet sur R2 | 1 |
| 15 | Produit sans EAN trouvé par nom, relevé deux fois (deux dates limites) | Un groupe par date, clé sur le libellé normalisé | 1 et 2 |
| 16 | Même produit sans EAN, casse ou espaces différents | Toujours le même groupe | 1 |
| 16b | Renommage d'un produit sans EAN | Deux groupes tant que rien n'est fait ; « même produit que… » du manager : un groupe, historique intact ; renfort refusé | 1 |
| 17 | Correction qui ferait passer sous zéro dans la tournée | Refus serveur visible, quantité inchangée | 1 |
| 18 | Coupure réseau pendant la saisie puis reprise | État En attente puis Enregistré, aucun doublon | 2 |
| 19 | Alerte : date limite à 59 puis 61 jours | 59 apparaît, 61 non | 3 |
| 20 | Ordre du tableau d'alertes | Expiré, puis jours croissants, puis quantité décroissante | 3 |
| 21 | Tournées individuelles : R1 et R2 créent chacune une tournée dans la même station | Les deux ouvertes en même temps ; nom facultatif, généré par le serveur (lot 2.1) ; aucun produit exclu par le nom | 1 |
| 22 | Addition dans une tournée : 6 puis 4 puis correction moins 2 | 8 | 1 |
| 23 | Simultanées A et B sur le même article : A relève 6 à 10:00 et 4 à 10:30, B relève 5 à 10:15 | Courant : A = 10 ; B en historique ; mention « relevé aussi dans la tournée B (R2, 10:15), en historique » ; jamais 15 | 1 |
| 24 | Remplacement par article entre tournées non simultanées : A relève 10, A est terminée, B relève ensuite 5 | Courant : B = 5 ; A en historique ; aucune addition | 1 |
| 25 | Date non retrouvée dans la tournée gagnante : A relève 15/12 = 10 ; B relève ensuite seulement 22/12 = 6 | Courant : 22/12 = 6 ; 15/12 sans quantité courante, présente en historique | 1 |
| 26 | Âge à 7, 8, 14 et 15 jours après le dernier relevé | 7 : courante ; 8 : « à vérifier » ; 14 : « à vérifier » ; 15 : « À recontrôler » | 1 et 3 |
| 27 | Relevé à J, correction à J+5, certification à J+6 | À J+8 la ligne est « à vérifier » : ni la correction ni la certification ne rajeunissent | 1 |
| 28 | Date dépassée, relevé de 10 jours | Étiquette « DLC dépassée, présence à vérifier » ; aucune demande de retrait | 1 et 3 |
| 29 | Date dépassée, relevé de 3 jours | « à retirer » | 1 et 3 |
| 30 | Quantité de plus de 7 jours | Aucune demande de retrait déclenchée | 1 et 3 |
| 31 | Terminer ma tournée : enregistre auteur, heure, empreinte et dernière opération | État TERMINEE_A_CERTIFIER ; version identifiable ; terminer deux fois sans changement : même version | 1 |
| 32 | Terminer avec une saisie en attente sur le téléphone | Bouton bloqué, message explicite (contrôle côté appareil) | 2 |
| 33 | Saisie reçue après clôture mais faite avant | Rattachée à sa tournée, marquée « reçue après clôture » | 1 |
| 34 | Saisie reçue après certification | La tournée repasse à certifier ; l'ancienne certification reste tracée | 1 |
| 35 | Manager certifie une tournée | Enregistre tournée, manager, heure, version certifiée, observations, statut | 1 |
| 36 | Renfort ou caissier tente de certifier | Refusé par le serveur | 1 |
| 37 | Manager certifie sa propre tournée | Accepté, mention « réalisateur et certificateur identiques » | 1 |
| 38 | Manager demande une correction sur des relevés visés avec motif | État CORRECTION_DEMANDEE ; le renfort répond ; la tournée repasse à certifier | 1 et 3 |
| 39 | Rectification après certification | Tracée ; nouvelle certification requise | 1 |
| 40 | Certification : effets sur les quantités | Aucune démarque, aucun blocage de la clôture, quantités « non certifiées » avant | 1 et 3 |
| 41 | Renfort lit les tournées d'un autre employé | Refusé ; manager voit toutes les tournées de la station | 1 |
| 42 | Vacataire | Refusé par le serveur sur toute action (aucun accès, arbitrage du pilote du 21/11) | 1 |
| 43 | Retrait le premier jour d'une tournée : geste « trouvé et retiré » de 3 | Quantité courante 0 dans la tournée, 3 dans « à comptabiliser », aucun refus de plancher ; renfort autorisé | 1 et 3 |
| 44 | Geste hors ligne reçu plus tard | Compté à l'heure du geste dans sa tournée ; heure de réception conservée | 1 et 2 |

Les trois cas de résolution de conflit à trois choix sont retirés : il n'y a ni écran ni table de résolution.

Autres preuves attendues aux lots 2 à 4 : maquettes Jour et Nuit, captures à largeur iPhone, recette Safari iOS sur appareil réel, exports.

Limite : aucun de ces cas n'a été joué sur Test. Le plan décrit ce qu'il faudra démontrer.

## Lot 5 : Prévention des pertes

| # | Cas | Résultat attendu | Lot |
|---|-----|------------------|-----|
| 45 | Manager ouvre la page | Compteurs, A, B, C, D, liste ; A, B, C, D jamais additionnés | 5 |
| 46 | Vacataire, pompiste, caissier, renfort | `droit_refuse` côté serveur ; écran « Accès réservé à la gestion » | 5 |
| 47 | Nature fiscale non déterminée | Unités seulement, aucun montant | 5 |
| 48 | Ligne sans prix d'achat | Unités comptées, hors montant, signalée | 5 |
| 49 | Démarque antérieure au lot 5 | B « Partiellement reconstitué », part reconstituée affichée | 5 |
| 50 | C et D | « Calcul indisponible » et quatre raisons, jamais « Estimation » | 5 |
| 51 | Dix secondes sur iPhone | Un manager non formé nomme en moins de 10 s le premier produit à traiter, sa quantité, son échéance et l'action attendue | 5 |

Rappel : la recette locale du lot 5 compte 76 contrôles (banc pglite). Les cas ci-dessus restent à jouer sur Test après GO.

## Lot 2 : Relevé employé

Rappel : la recette locale du lot 2 compte 41 contrôles (banc pglite, `outils/recette/dates_courtes_lot2/`). Elle couvre les parties serveur des cas 6, 15, 18, 38, 43 et 44, la recherche produit (sans prix, sans autre station, 20 lignes au plus) et les refus du pompiste, du vacataire et du caissier sans accès. Le scan réel sur iPhone Safari (cas 11) et le blocage de « Terminer » avec une saisie en attente (cas 32) se jouent sur l'appareil. Aucun de ces cas n'a été joué sur Test.

## Lot 2.1 : Nom de tournée généré et renommage

Recette locale : `outils/recette/dates_courtes_lot2_1/` (banc pglite, 56 contrôles). Personnes fictives R1, M1, G1.

| N° | Scénario | Résultat attendu |
|---|---|---|
| 61 | R1 touche « Nouvelle tournée » | Tournée ouverte en un geste, sans champ de nom ; nom `Contrôle DLC · <prénom> · <JJ/MM>` construit par le serveur |
| 62 | Création à 23 h 30 heure de la station | La date du nom est celle de la station, pas celle d'UTC |
| 63 | Deux tournées le même jour | Noms identiques acceptés, l'heure de début les distingue, aucune fusion |
| 64 | Renommer par l'auteur | Seul le libellé change ; auteur, id, saisi_le, terminée par et le restent intacts ; trace écrite |
| 65 | Renommer par un autre employé | Refusé (`droit_refuse`) |
| 66 | Renommer par un manager, un gérant ou le créateur de la même station | Accepté |
| 67 | Renommer une tournée certifiée | Refusé (`tournee_certifiee`) |
| 68 | Même clé d'idempotence rejouée | Aucun second renommage, aucune seconde trace |
| 69 | Ancienne tournée sans nom | Libellé de repli calculé à la lecture, ligne non réécrite |
| 70 | Affichage | Nom sur une ligne, puis `Commencée à 14 h 05 · En cours` (idem liste et bandeau) |
