# Exécution de decision-5 — nom des photos de jaugeage (JAUGEAGE-OCR-2-20261022)

Décision : `decision-5.md` (Frédéric, APPROVED, closes:true) sur la request-5 amendée `426c20dc`. Prise en charge : `f72b027d`.
Code : branche applicative `jaug-nom-fichier`, commit `ae8d2254`, **PR #151 en brouillon** (https://github.com/vito-sainte-marie/nexus-vito/pull/151). Ni fusion, ni déploiement, ni écriture Production : GO de Frédéric requis.

## Ce qui est fait
- Nom : `AAAA-MM-JJ_<uid>_nexus-jaug_<site>_<HHhMM>[-N][_qforcee-n…-r…].<ext>`, à l'heure de la station (`nexusFuseauSite`), dossier `<site>/jaugeage_veeder_root/` inchangé. Fonction pure `nomPhotoJaugeage` dans `nexus-capture-guidee.js` ; sans fuseau, uid, site ou extension valides, elle rend `null` et l'envoi échoue.
- Envoi `upsert: false`, réessai `-2` à `-9`, puis erreur d'envoi existante. Suffixe `_qforcee` et extension réelle conservés.
- **Aucune migration** : l'uid reste en 2e position, comme l'exige `documents_a_traiter_jaugeage_pompiste`.

## Preuve des conditions de decision-5
- Épreuves rouges d'abord : `test_jaugeage_nom_fichier_20261022.js` avait 6 échecs sur le code d'avant, 30 vérifications vertes ensuite.
- Mutation qui déplace l'identifiant hors de sa place : tuée (après le nom, en tête avant la date, retiré, date retirée). 19 mutants sur 19 tués au total ; les 3 mutants de #150 devenus inapplicables sont remplacés (17 sur 17).
- Suite complète rejouée après `outils/build.sh` (valeurs factices de la CI) : seuls les 7 échecs connus. Le banc `test_releves_piste_jauge_saisie_directe_20261022.js` a été aligné (fuseau et module de capture), 22 contrôles verts.
- CI verte sur la PR #151 : `non-regression` et « Construire et éprouver l'artefact » ; état `CLEAN`, brouillon.

## Limites
- L'acceptation par la politique est éprouvée par une expression équivalente, **pas par la base** : aucun envoi réel sur Test, aucune validation iPhone.
- Les objets déjà déposés ne sont pas renommés.

## Reste (nouveau lot JAUGEAGE-OCR-3, ouvert par Frédéric à l'iMac)
Étape B (lecteur Vision, délai de 4 min 30), validation de la capture sur iPhone réel, quinze photos sans donnée personnelle, calibration des seuils, branchement Python du worker.
