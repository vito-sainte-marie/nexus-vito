# PARCOURS-POMPISTE-LOT2-FIL-DEBUT-DE-QUART-20261021 — compte rendu d'exécution

Exécution de decision-1 (APPROVED_WITH_CONDITIONS, closes:false), 21/10/2026.

- Base : `origin/production` 2f412bdfbf043294856450656893a91d18402297 (mesurée après fetch).
- Code : commits `6d54ed5e` et `fc1a4636`, branche `lot2-fil-debut-quart-20261021`, PR brouillon #147 vers `production` (ni fusion ni déploiement sans le GO de Frédéric).
- Fichiers : `nexus-fil-debut-quart.js` (nouveau), `NEXUS-App-v1.html`, `NEXUS-Prise-De-Poste-v1.html`, `NEXUS-Releves-Piste-v1.html`, `NEXUS-Inventaire-v1.html` ; épreuve `test_fil_debut_quart_20261021.js` (rouge sur la base, verte, 31 mutations) ; trois épreuves existantes adaptées (`test_accueil_hors_service_20260918.js`, `test_inventaire_parcours_depot_boutique_reste.js`, `test_releves_piste_sortie_et_etat_20261021.js`).
- Précisions de Frédéric : le plan ne retient que les étapes restantes (« Étape 1 sur 2 »), jamais un « sur 3 » figé (F2b–F2d) ; pas de FDJ dans le fil (F2e).
- Écart de périmètre : l'Accueil connaît seul les faits du jour ; la prise de poste y envoie le pompiste par `?fil=demarrer`. L'épreuve E2 de l'Accueil (aucune redirection d'office) est amendée d'une exception unique et nommée.
- Suite complète : 289/296, mêmes 7 échecs que la base. Aucun SQL, migration, pointage ni lot 3.
- Recette Test (aperçu `lot2-fil-debut-quart-2026102.nexus-test-ddf.pages.dev`, format téléphone, Employé Test B) : « Étape 1 sur 2 » aux index (jaugeage déjà fait) ; sortie puis reprise à la même étape ; inventaire « Étape 2 sur 2 », « Terminer mon début de quart » rend à l'Accueil. Saisie complète des index non rejouée (7 chiffres par pompe), couverte par l'épreuve.

## Compte rendu complémentaire — 22/10/2026 (suite au retour de Frédéric sur #147 : pas de GO de fusion)

- Corrections faites et poussées, HEAD `bcbf51b4` : pointage prioritaire sur le fil ; seul le pompiste entre dans le fil ; étape 3 limitée à gaz, glaçons et écailles (épreuve I5 : huiles et lave-glace ne comptent jamais comme stock à zéro ni comme écart). Épreuve `test_fil_debut_quart_20261021.js` : 55 contrôles OK. Jeu de recette Test idempotent `supabase/recette-jeux/20261021_jeu_recette_fil_debut_quart.sql` (Gaz, Glaçons, Écailles, Huiles, Lave-glace) ; aucune écriture en Production.
- Suite complète relancée : 289/296, mêmes 7 échecs que la base.
- Recette « après » (aperçu Test de la branche, 375×812, Employé Test B) : un seul parcours, zéro retour en arrière à l'Accueil ; index 4 pompes × 2 champs, Revue, Valider ; deux boutons « Continuer vers… / Terminer mon début de quart » ; durée d'environ 5 à 6 minutes saisie comprise. Comptage de l'étape 3 non vu dans le navigateur.
- Mesure « avant » (aperçu Test de `origin/production` 2f412bd, branche jetable `avant-lot2-fil-20261022` créée puis supprimée, 375×812, même compte) : de « Prendre mon poste » au premier écran de travail, **9 appuis dont 1 retour à l'Accueil** (Prendre mon poste, Piste, Voir mes missions, Confirmer, Ouvrir mon tableau de bord → Missions, Commencer cette mission, Menu → Accueil, Faire le jaugeage, tuile du catalogue Inventaire).
  - « Commencer cette mission » ne fait que déplier la mission (« Valider la mission ») et n'ouvre pas le relevé d'index.
  - Le jaugeage s'ouvre dans le catalogue Inventaire (« Couverture du quart 0 sur 6 »), que le fil évite.
  - **Non mesuré** : la saisie (jaugeage, index, inventaire) n'a pas été rejouée côté « avant » pour ne pas écrire de données fictives ; durée et total d'appuis des trois étapes « avant » restent une estimation. La saisie n'est pas modifiée par le lot.
- Trace Test : la prise de poste de l'« avant » a ouvert un service pompiste matin pour Employé Test B ; non supprimé (pas d'autorisation).
- Restant humain : GO de fusion de #147 par Frédéric ; recette sur iPhone par un pompiste sans aide ; création de la catégorie « Écailles » en Production = demande séparée soumise au GO. Rien fusionné ni déployé ; lot 3 non démarré.
