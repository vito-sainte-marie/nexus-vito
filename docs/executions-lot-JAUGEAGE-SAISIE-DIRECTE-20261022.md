# JAUGEAGE-SAISIE-DIRECTE-20261022 — compte rendu d'exécution

Exécution de decision-1 (APPROVED, closes:false), 22/10/2026.

- Base : `origin/production` ccedfa836f63ff6b899a7ab7b8b29be3812ecee5 (celle mesurée dans request-1, inchangée).
- Code : commit `6c20b192`, branche `lot-jaugeage-saisie-directe-20261022` (créée depuis `origin/production`, jamais depuis la branche locale du rail, qui était en retard de plusieurs lots sur ce fichier).
- Fichiers : `NEXUS-Releves-Piste-v1.html` (écran jaugeage uniquement), `nexus-releves-piste.js` (fonction pure nouvelle `fusionnerLectureTardive`) ; épreuve nouvelle `test_jaugeage_saisie_directe_20261022.js`.

## Les cinq points du périmètre

1. Message après la photo : `LIB_STATUT.en_attente` devient « Photo enregistrée. Saisissez les quatre volumes affichés sur l'écran du Veeder-Root. » ; `envoyerPhoto()` appelle `focusPremierVolumeVide()` après un envoi réussi, qui place le focus sur le premier champ `data-j` encore vide (aucun focus si les quatre sont déjà remplis).
2. « elle peut tarder » supprimé ; le mot « échec » n'apparaît plus nulle part sur cet écran (le statut `erreur` devient « Lecture automatique non disponible : les volumes restent à saisir à la main. »).
3. « Actualiser la lecture » : classe `btn2` (bouton plein, 100% de largeur) remplacée par une nouvelle classe `.lien` (fond transparent, largeur auto, soulignée, couleur atténuée) — un lien discret, plus un bouton.
4. Une lecture tardive (clic sur le lien) : `actualiserLecture()` délègue à `R.fusionnerLectureTardive(jauge.saisies, jauge.propositions)`, qui ne remplit que les clés encore vides et ne touche jamais une saisie déjà présente ; dès qu'au moins une proposition exploitable arrive, `jauge.confirme` repasse à `false`.
5. Épreuves du rouge au vert avec mutation : voir ci-dessous.

## Preuves

- `test_jaugeage_saisie_directe_20261022.js` : 14/14 verts sur le code final.
- Rouge avant chaque correction, vérifié un à un (mutation locale de l'état courant, jamais réécrit après coup) :
  - texte `en_attente` restauré à l'ancien (« elle peut tarder ») → échec de l'épreuve de texte ;
  - classe du bouton `jrafraichir` restaurée à `btn2` → échec de l'épreuve de classe ;
  - ligne `if (photoEnregistree) focusPremierVolumeVide();` retirée → échec de l'épreuve de focus ;
  - `fusionnerLectureTardive` mutée pour toujours écraser (suppression du test de vacuité) → échec de l'épreuve « n'écrase jamais une saisie ».
  - Les quatre mutations ont mordu, puis ont été restaurées (code final = celui du commit `6c20b192`).
- Suite complète (`node run-tests.js`) sur le code final : 290/297, mêmes 7 échecs pré-existants que `origin/production` (`test_inventaire_categorie_mixte_deux_lieux.js`, `test_inventaire_production_journaliere_q1.js`, `test_inventaire_sprint4_ux_flash.js`, `test_inventaire_sprint4bis_ecriture_immediate.js`, `test_pilotage_qualite_receptions.js`, `test_reception_moteur.js`, `test_reception_v1_dom.js`) — aucune régression introduite par ce lot.

## Écart constaté — PR brouillon non ouverte dans cette session

Le code est poussé (`lot-jaugeage-saisie-directe-20261022`, commit `6c20b192`), mais la PR brouillon vers `production` n'a pas pu être créée : trois appels `gh pr create` / `gh pr list` ont chacun été refusés par la passerelle d'autorisation de l'outil Bash de cette session (« This command requires approval »), sans qu'aucun humain ne soit présent pour l'accorder dans ce réveil autonome. C'est une capacité absente de CETTE session, pas une gate NEXUS — rien dans la décision ni dans la gouvernance n'interdit la PR brouillon ; c'est l'outillage `gh` qui n'a pas pu s'exécuter ici. `git push` a imprimé l'URL de création directe :
https://github.com/vito-sainte-marie/nexus-vito/pull/new/lot-jaugeage-saisie-directe-20261022
Un geste humain (un clic sur ce lien) ou une session future disposant de l'autorisation `gh` peut ouvrir la PR sans rejouer le code : il est déjà sur la branche, prouvé, et n'a pas besoin d'être réécrit.

## Restant humain

- Ouvrir la PR brouillon (lien ci-dessus), puis la recette sur iPhone (aperçu Test, format téléphone) par un pompiste sans aide, chronométrée de la photo à l'enregistrement — non exécutée dans cette session : pas de Playwright installé localement, worker OCR en panne au 22/10 (diagnostic connu), aperçu Cloudflare Pages pas encore construit faute de PR ouverte.
- Aucune fusion ni déploiement sans le GO de Frédéric (palier PRODUCTION_FUSION_DEPLOIEMENT_PROMOTION).

## Hors périmètre, non touché

OCR (worker, moteur Vision, parseur), SQL, migration, RLS, Supabase Production, autres écrans, lot 3, JAUGEAGE-OCR-2, déploiement.
