# Recette Test — relevés piste (état au 16/10/2026, incrément 2)

Périmètre : NEXUS Test uniquement (`handoff-continuite-20260920.nexus-test-ddf.pages.dev/NEXUS-Releves-Piste-v1`), base Test `udljdqxerrbbbajxubfn`, compte pompiste de recette, viewport mobile émulé 375×812 dans le browser pane. **Ce n'est pas une validation terrain réelle.** Safari iOS : NON TESTÉ. Caméra : bloquée dans le browser pane (aucun test photo possible).
Aucune fusion, aucun déploiement Production, aucune écriture Production.

Preuves automatisées : `test_releves_piste_logique_20261016.js` 14/14 ; `test_carburant_index_releves_piste_20261016.js` 10/10 (RLS/migration, rejoués avant l'incrément).

| # | Scénario | Résultat | Preuve |
|---|---|---|---|
| 1 | Jaugeage Veeder-Root photo + OCR | NON TESTÉ | Non construit (incrément suivant) ; caméra indisponible dans le pane |
| 2 | Échec OCR, saisie manuelle | NON TESTÉ | idem |
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
