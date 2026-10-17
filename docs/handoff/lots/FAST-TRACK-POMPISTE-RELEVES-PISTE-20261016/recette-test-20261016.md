# Recette Test — relevés piste (état au 16/10/2026, incrément 2)

Périmètre : NEXUS Test uniquement (`handoff-continuite-20260920.nexus-test-ddf.pages.dev/NEXUS-Releves-Piste-v1`), base Test `udljdqxerrbbbajxubfn`, compte pompiste de recette, viewport mobile émulé 375×812 dans le browser pane. **Ce n'est pas une validation terrain réelle.** Safari iOS : NON TESTÉ. Caméra : bloquée dans le browser pane (aucun test photo possible).
Aucune fusion, aucun déploiement Production, aucune écriture Production.

Preuves automatisées : `test_releves_piste_logique_20261016.js` 14/14 ; `test_carburant_index_releves_piste_20261016.js` 10/10 (RLS/migration, rejoués avant l'incrément).

| # | Scénario | Résultat | Preuve |
|---|---|---|---|
| 1 | Jaugeage Veeder-Root photo + OCR | PARTIEL (simulé) | Lecture OCR réelle de la photo TLS4B par Apple Vision (local, gratuit) : SP 20085, GO cuve 1 11875, GO cuve 2 7577, GNR 4365, GO total 19452 ; lecteur couvert par `test_veeder_root_lecture_20261016.js` 9/9. **Non exécuté de bout en bout** : caméra bloquée dans le browser pane, et l'envoi de la photo est refusé à un pompiste (voir constat d) ; worker PaddleOCR de l'iMac non exécuté |
| 2 | Échec OCR, saisie manuelle | RÉUSSI (navigateur Test) | Photo refusée (RLS storage) → « Photo non envoyée », saisie manuelle des 4 volumes, GO total 19452 affiché, relevé du jour existant signalé (non écrasé), case de confirmation, enregistrement. Base : `carburant_releves` v2 (SP 20085 / GO 11875 / 7577 / GNR 4365), v1 conservée, version append-only `origine=terrain_pompiste`, `provenance.source=saisie_manuelle`, `mesure_le` renseigné, aucun doublon |
| 3 | Pompe 1 : GO à gauche, SP à droite | RÉUSSI (navigateur) | Écran pompe 1 : GO puis SP |
| 4 | Pompe 2 : SP puis GO | RÉUSSI (navigateur) | Écran pompe 2 : SP puis GO |
| 5 | Pompe 3 : GO puis SP | RÉUSSI (navigateur, ordre lu dans la revue) | Revue : P3 GO, P3 SP |
| 6 | Pompe 4 : SP puis GO | RÉUSSI (navigateur, ordre lu dans la revue) | Revue : P4 SP, P4 GO |
| 7 | Conversion 7→6 chiffres | RÉUSSI | `0123456` → `123456`, chiffre retiré 0, « sans perte » affiché ; base : `valeur_decenium` = 6 derniers chiffres |
| 8 | Passage d'un palier | NON TESTÉ en navigateur | |
| 9 | Index inférieur au précédent | RÉUSSI (navigateur) | Alerte forte (-456 L), justification obligatoire, motif listé dans la revue, ligne dans `carburant_index_corrections` (confirmation exceptionnelle = vrai) |
| 10 | Écart > 4 000 L | NON TESTÉ en navigateur (logique seule) | |
| 11 | Fin Q1 = début Q2 | NON TESTÉ en navigateur | Comparaison branchée dans la revue (8d79be5b), non rejouée |
| 12 | Fin Q1 ≠ début Q2 | NON TESTÉ en navigateur | idem ; logique `comparerQ1Q2` couverte par les tests purs |
| 13 | GNR hors service à 1191213 | RÉUSSI (affichage) | Ligne GNR « hors service · référence », jamais saisie ; non semé dans `carburant_gnr_statuts` (constante de page) |
| 14 | Interruption puis reprise | PARTIEL | Rechargement de page pendant la saisie : reprise du moment proposée ; brouillon serveur confirmé (« brouillon enregistré sur le serveur », 8 lignes en base) |
| 15 | Perte de connexion | NON TESTÉ | |
| 16 | Correction d'une valeur recopiée | PARTIEL | Décocher une ligne annule la confirmation finale et désactive « Terminer » (navigateur) ; l'annulation de coche lors d'une correction de valeur est couverte par la logique, pas par le navigateur |
| 17 | Validation d'un relevé incomplet | NON TESTÉ en navigateur | Bouton « Valider » désactivé tant que la revue est bloquante (logique) |
| 18 | Historique manager | NON TESTÉ | Écran non construit |
| 19 | Droits et isolation | PARTIEL | Épreuves SQL de la migration (10/10) ; pas de compte tiers testé dans le navigateur |
| 20 | Aucune vente / caisse / écriture Decenium | PARTIEL | La page n'écrit que dans `carburant_index_*` ; aucune requête vers d'autres tables dans le code de page ; mesure réseau non rejouée |

Parcours réel exécuté : fin Q1 (8 index, revue « Aucune anomalie », validation, recopie, 8 coches persistées, texte exact « Je confirme avoir recopié les valeurs dans Decenium. », « Terminer » actif seulement toutes coches + confirmation) puis début Q2 avec recul justifié (revue, validation). Base Test : `fin_q1` final 8 valeurs, `debut_q2` final 8 valeurs, 1 correction tracée.

Constats : (a) la RPC `carburant_index_corriger_valeur` accepte une valeur identique à celle insérée et la trace (doute levé) ; (b) `.html` redirige en 308 vers l'URL sans extension sur Test ; (c) les erreurs console « pointage arrivée » viennent de `nexus-auth.js`, hors périmètre.

Reste à construire : photo Veeder-Root + file OCR avec repli manuel, écran d'historique manager, régularisation Q1/Q2, point d'entrée contextuel depuis l'App, tests de page. Arbitrages encore provisoires : seuil 4 000 L, qui régularise Q1/Q2, conservation photos/brouillons, hébergement OCR, remise en service GNR, quart sans Q2.

## Constats du test jaugeage (16–17/10/2026, Test)

d. **Blocage à arbitrer (surface de sécurité, NON modifié)** : la politique `documents_a_traiter_ecriture_site` du bucket `documents-a-traiter` n'autorise l'INSERT qu'à `manager`/`gerant` (`nexus_clients_ecriture_ok`). Un pompiste ne peut donc pas téléverser la photo du Veeder-Root (« new row violates row-level security policy »), alors que la table `documents_ocr_file` l'accepte (`depose_par = auth.uid()`). Le parcours photo→OCR reste donc inutilisable par le pompiste tant qu'une décision n'est pas prise. Proposition à soumettre par le Handoff : INSERT pour le pompiste du jour, limité au dossier `<site>/jaugeage_veeder_root/`, sur son propre site. Aucune politique n'a été modifiée ; rien n'est déployé hors Test.
e. **Défaut corrigé (ccace99e)** : la case de confirmation et le bouton d'enregistrement n'apparaissaient qu'au rendu suivant la saisie ; rendu déclenché à la sortie du champ. Rejoué en navigateur : OK.
f. `type_version = correction_manager` est inscrit pour une version `terrain_pompiste` : libellé hérité de l'existant, non modifié.
g. Relevé du jour préexistant en Test (v1) : la saisie ajoute une version de correction avec motif, sans écrasement.

## Incrément 3 (17/10/2026, Test) — début de Q1, début rapide, habilitation, écart de nuit

Constat d (mise à jour) : la politique d'envoi de photo est appliquée sur Test depuis le GO du 17/10 (migration `20261017120000`). La recette d'upload réel par un pompiste reste à rejouer ; Safari iOS : NON TESTÉ.

Livré (commit `d3577cc9`, migration Test-only `20261017130000`, aucun grant ni politique modifié) :

| Scénario | Preuve | État |
|---|---|---|
| Quatre moments dont `debut_q1` ; début/fin distingués | logique 22/22 | AUTOMATISÉ |
| Habilitation : un pompiste ne voit que les moments de son quart réel (primitive `nexusServiceCourant`, service en cours) | logique ; navigateur à rejouer | PARTIEL |
| Début rapide : référence affichée, 2 derniers chiffres, bascule en 7 chiffres si différent ou douteux, référence indisponible → 7 chiffres | logique ; navigateur à rejouer | PARTIEL |
| Tolérance de nuit 0 / +1 / +2..+9 / ≥+10 / diminution, par compteur, non bloquante | logique | AUTOMATISÉ |
| Index identiques fin/début, retour à zéro du compteur | logique | AUTOMATISÉ |
| Aucune recopie Decenium aux débuts ; recopie aux fins seulement | code de page, navigateur à rejouer | NON TESTÉ en navigateur |
| Contraintes SQL (moment, référence, anomalie) | lues sur Test | OBSERVÉ |

Unité de l'écart de nuit (+1) à confirmer par le métier. La vérification à deux chiffres n'est pas une preuve d'identité des sept chiffres. Safari iOS : NON TESTÉ.

## Recette navigateur Test — début de Q1 avec référence (17/10/2026, viewport mobile émulé)

Résultats observés (déploiement `ef1b5493`, puis correctif `5a8d70d0`) :

| Scénario | Résultat |
|---|---|
| Référence validée affichée aux débuts ; saisie des 2 derniers chiffres identiques | RÉUSSI : « Confirmé… contrôle partiel, non une preuve des 7 chiffres » ; base `ref_statut=confirmee_deux_chiffres` |
| 2 chiffres différents → bascule en 7 chiffres + case de vérification visuelle ; « Pompe suivante » désactivée tant qu'elle n'est pas cochée | RÉUSSI |
| Écart de nuit 0 / +1 / +2 / −10 / +10 saisis et validés | RÉUSSI : `conforme` / `toleree` / `a_justifier` / `diminution` / `alerte_prioritaire`, `ecart_nuit` 0/1/2/−10/10, messages en direct non bloquants, regroupés dans la revue |
| Aucune recopie Decenium aux débuts | RÉUSSI : « rien à recopier » |
| Couleurs : numéro de pompe rouge, GO jaune, SP vert, GNR rouge brique | RÉUSSI (écran de saisie et revue) |

Défaut trouvé et corrigé (`5a8d70d0`) : un brouillon local commencé avant l'existence de la référence conservait `ref_statut='indisponible'` alors que `ref_valeur_sept` était renseignée au moment de l'envoi. Le statut devient `saisie_complete` dans ce cas. Constat de conception : en mode rapide, taper 7 chiffres dans le champ à 2 chiffres ne bascule pas ; il faut le bouton « Valeur différente ou douteuse ».

Relevé de recette Test supprimé et rejoué (aucune donnée réelle). Restent NON TESTÉS : fin avec recopie confirmée, début Q2 ↔ fin Q1 en navigateur, Safari iOS, caméra.

## Recette navigateur Test — fin de Q1, recopie, début de Q2 (17/10/2026, viewport mobile émulé)

| Scénario | Résultat |
|---|---|
| Fin de Q1 : 8 valeurs en 7 chiffres sans préremplissage, revue « Aucune anomalie », validation | RÉUSSI : `fin_q1` final, 8 valeurs |
| Recopie Decenium : 8 coches, puis case « Je confirme avoir recopié les valeurs dans Decenium. » | RÉUSSI : case de confirmation active seulement après les 8 coches, « Terminer » actif seulement après la confirmation ; base : `recopiee` vrai sur 8 lignes sur 8 (0 sur le début de Q1) |
| Habilitation, service `soir` | RÉUSSI : seuls Début de Q2 et Fin de Q2 sont proposés |
| Début de Q2 : référence = dernière fin de Q1 validée, 2 derniers chiffres identiques sur 6 compteurs, 7 chiffres identiques sur 1 | RÉUSSI : `confirmee_deux_chiffres` ×6, `saisie_complete` ×1 |
| Fin de Q1 ≠ début de Q2 (P4 SP 7890200 → 7890205) | RÉUSSI : « fin de Q1 ≠ début de Q2 (+5 L). Les deux valeurs sont conservées. » dans la revue, non bloquant ; les deux valeurs sont en base |
| Aucune recopie au début de Q2 | RÉUSSI : « rien à recopier » |

Constat sur un essai antérieur : cases de recopie qui paraissaient ne pas se cocher. Reproduit seulement avec des clics JS enchaînés sans attente (re-rendus entre deux clics) ; avec des clics espacés de 1,5 s, le comportement est correct. Aucun défaut de page établi. À confirmer sur appareil réel.

En début rapide, la case de vérification visuelle est exigée à chaque pompe, même quand tous les chiffres sont confirmés (voulu par le code, `visuelOk`).

Reste NON TESTÉ : Fin de Q2 → début de Q1 suivant, Safari iOS, caméra, perte de connexion. Le service de recette est restauré à `quart='soir'`.
