# Livrable A — Audit initial : Parcours Pompiste (relevés piste, jaugeage Veeder-Root, recopie Decenium)

Date : 16/10/2026 · Lecture seule de `origin/production` (clone `nexus-vito-github`) + worker OCR. Aucune branche, migration ni modification produit à ce stade. Aucun geste Production/main.

## 1. État réel de l'existant

| Sujet | Constat |
|---|---|
| Index des pompes (Tokheim, 8 totalisateurs) | **Rien n'existe** : ni table, ni écran, ni code. |
| Jaugeage Veeder-Root | Existe pour les **cuves** : `carburant_releves` (stock par site/date, GO cuve1/cuve2, SP95, GNR), `carburant_releve_versions` (historique append-only, `origine`, `controle_statut`), `carburant_jaugeage_statuts_jour`, drapeau `station_config.jaugeage_carburant_actif`. Saisie manuelle uniquement, pas de photo. |
| Qui peut écrire | Manager, et le pompiste du jour via `est_pompiste_du_jour(site)` (SECURITY DEFINER, fuseau station) — pont ouvert par `20260819105641`. |
| Où le pompiste jauge | `NEXUS-Inventaire-v1.html` (bloc jaugeage Q1 pompiste, drapeau + statut du jour) ; `NEXUS-App-v1.html` carte « Prochaine action » (« jaugeage d'ouverture », Q1 uniquement). |
| Prise de poste | `NEXUS-Prise-De-Poste-v1.html` (rôle « Piste ») — aucun point d'accroche pour des index. |
| Brouillon / reprise | Aucun mécanisme générique. `localStorage` en try/catch (Inventaire l.528-612 : brouillon + file d'attente) = **motif réutilisable**. |
| OCR | **Pas d'OCR dans l'app web.** Worker Python sur l'iMac (`ocr_engine.py`, PaddleOCR, local, coût zéro) alimenté par `documents_ocr_file` (Supabase) : traitement **asynchrone**, destiné aux documents. Aucun appel réseau pendant l'OCR. |
| Tests existants | `test_pont_jaugeage_carburant_inventaire.js`, `test_reception_jaugeage_correctifs.js`, `test_parametres_station_ordre_jaugeage_sync.js`, `test_prise_de_poste_contrat_unique_20260905.js`, `test_carburant_commande_ancre_jaugeage_v2255.js`, etc. |

## 2. Composants réutilisables

1. **Jaugeage** : table `carburant_releves` + versions + statuts du jour → réutiliser telle quelle pour les 4 cuves (GO1+GO2, SP, GNR). La somme GO reste une aide d'affichage (pas stockée, pas de seconde vérité). Il manque la **provenance** (photo/OCR vs manuel) et la **trace des corrections de valeur OCR**.
2. **RLS** : `est_pompiste_du_jour`, `current_employee_site_id()`, `current_employee_role()`.
3. **Brouillon local** : motif localStorage de l'Inventaire (try/catch obligatoire).
4. **Contexte de moment** : `calculerControlesQuartJour` / « Prochaine action » (App) pour l'entrée contextuelle.
5. **OCR** : `documents_ocr_file` + worker PaddleOCR (gratuit, local).

## 3. Écarts à combler

- **Structure neuve pour les index** (obligatoire — aucune structure existante ne convient). Proposition Test-seulement : `carburant_index_releves` (une ligne par déclaration : site, date, quart, moment `fin_q1 | debut_q2 | fin_q2`, auteur, statut `brouillon | final`, horodatages) + `carburant_index_valeurs` (pompe 1-4, côté, produit, valeur 7 chiffres, valeur Decenium 6 chiffres + conversion, recopiée oui/non) + historique append-only des corrections (motif, auteur, avant/après). Aucune colonne ne touche ventes, caisse, Verify, Paye. Migration à présenter explicitement (périmètre, risques, preuve de compatibilité) et appliquée **sur Test uniquement**.
- **GNR hors service** : état de référence (1191213) + historique des changements de statut / remise en service avec contrôle explicite ; jamais de relevé physique fictif, aucun événement de mesure.
- **Écart Q1/Q2** : deux déclarations indépendantes ; comparaison compteur par compteur côté lecture ; régularisation réservée aux droits managers.
- **Brouillon serveur** : le brouillon doit survivre à la fermeture (local) et être synchronisé quand le réseau répond, avec état honnête (« enregistré sur l'appareil » ≠ « enregistré sur le serveur »).
- **OCR de la photo Veeder-Root** : voir §5.

## 4. Risques de régression

| Risque | Mesure |
|---|---|
| Casser le jaugeage Q1 existant / la carte « Prochaine action » (`jaugeageApplicable/jaugeageFait`) | Ne pas modifier `calculerControlesQuartJour` ; ajouter l'entrée index à côté, tests existants rejoués. |
| Seconde vérité cuves | Réutiliser `carburant_releves` ; pas de duplication. |
| Moteur carburant (Article 11) | Aucune lecture/écriture des index par `nexus-carburant-moteur.js` ; ventes non calculées. |
| Verify / FDJ / Paye | Aucune jointure, aucune lecture de `shifts` pour déduire des heures ; seul l'identifiant de quart est référencé. |
| RLS : fuite entre sites / lecture par un autre pompiste | Politiques dédiées + épreuve SQL d'isolation (scénario 19). |
| Épreuves de manifeste (ajouter une migration rougit des épreuves) | Prévoir leur mise à jour dans le même commit, pas d'affaiblissement de garde. |
| Déploiement Test | Une branche issue de `production` code en dur Production dans `nexus-auth.js` → **branche issue de la lignée rail / `config-par-environnement`**, jamais PR vers `production`. |

## 5. Décisions techniques proposées

1. **Branche dédiée** `pompiste-releves-piste-test-20261016` depuis le rail (lignée Test) ; commits identifiés ; **aucune PR vers `main`/`production`**.
2. **Index** : nouvelle structure Test-only (§3), ajout par migration horodatée appliquée sur Test via psql (ou geste humain si le classifieur refuse).
3. **Saisie** : 7 chiffres complets, dernier index en référence discrète, pas de préremplissage silencieux, clavier numérique, un écran par pompe dans l'ordre physique (P1 GO|SP, P2 SP|GO, P3 GO|SP, P4 SP|GO), recopie dans l'ordre Decenium (SP puis GO par pompe, puis GNR), conversion 7→6 chiffres contrôlée et visible.
4. **Contrôles** : < précédent = alerte forte + confirmation exceptionnelle justifiée tracée ; > 4000 L = alerte indicative non bloquante (constante paramétrable plus tard, non présentée comme validée) ; Q1 fin vs Q2 début compteur par compteur ; revue des anomalies avant validation finale, pas de modales en rafale.
5. **OCR** — le point à arbitrer : PaddleOCR tourne sur l'iMac, en différé, via file Supabase ; il n'est ni instantané ni disponible dans Safari iOS. Option retenue pour la livraison Test : **photo prise → envoyée dans la file existante → résultat proposé quand disponible → vérification visuelle + saisie manuelle toujours possible** ; repli manuel immédiat si l'OCR échoue ou tarde. Pas de service payant. Confidentialité : photo limitée au bandeau d'écran Veeder-Root (cadrage guidé), conservée comme preuve à durée à définir. Performance temps réel non garantie (déclaré dans le rapport).
6. **Recopie** : coche « recopiée » = aide de progression ; texte exact « Je confirme avoir recopié les valeurs dans Decenium. » ; corriger une valeur cochée annule la coche.
7. **Pas de pointage, pas de déduction d'heures** : l'association se fait au quart réel via `shifts`, en lecture.

## 6. Arbitrages métier restants (à soumettre, non bloquants pour démarrer sur Test)

1. Valeur du **seuil 4000 L** et son éventuelle paramétrisation (par site ? par produit ?).
2. **Qui peut régulariser** un désaccord Q1/Q2 (manager seul ? gérant ?) et sous quelle forme.
3. **Durée de conservation** des photos Veeder-Root et des brouillons abandonnés.
4. **Hébergement de l'OCR** : acceptation du traitement différé via l'iMac, ou besoin d'un OCR navigateur (hors périmètre « gratuit » à vérifier).
5. **Remise en service du GNR** : qui valide et quel index de départ.
6. Politique si un **quart n'a pas de Q2** (fin de journée) : la déclaration reste-t-elle « fin Q1 » seule.

## 7. Prochaines étapes (sans geste Production)

1. Lire la `decision-1` de l'arbitre sur `FAST-TRACK-POMPISTE-RELEVES-PISTE-20261016`, la consommer, puis déposer `request-2` avec le **brief complet** + cet audit + les arbitrages §6.
2. Créer la branche Test, écrire la migration Test-only (présentée avant application), puis implémentation, tests automatisés, déploiement sur l'alias Test, recette navigateur mobile (Safari iOS = NON TESTÉ si indisponible), rapports C, D, E.

*Non autorisé et non entrepris : fusion, déploiement Production, migration Production, modification de données réelles, OCR payant.*
