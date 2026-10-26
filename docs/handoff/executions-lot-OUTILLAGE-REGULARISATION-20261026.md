# Exécution — OUTILLAGE-REGULARISATION-20261026, decision-2 (286edb06)

Exécutant : session locale, sur l'autorisation de reprise donnée par Frédéric pour ce lot
après un nouvel arrêt du runner sans consommation. Rien sur `main`, rien en Production.

## Conditions de la décision et preuves
1. **BRANCHE_DU_LOT obligatoire.** Garde dans `handoff.js` (`controlerMarqueurBranche`),
   module `outils/marqueur-branche-du-lot.js`. Arrivée du marqueur dans les décisions
   futures : (a) `materialiser-decision-ci.js` refuse un marqueur multiple ou invalide dans
   la réponse de l'arbitre et injecte `BRANCHE_DU_LOT: <rail>` si absent ; (b) consigne 6 bis
   de `ARBITRE-CHATGPT.md`. Épreuves : `test_marqueur_branche_du_lot_obligatoire_20261026.js`
   (livraison L1–L5, mutations MU1–MU4), `test_preuve_action_branche_du_lot_20261026.js`.
   Decision-1 reste un cas régularisé (ancre `286edb06`).
2. **Proposition A, étape 1.** `outils/semer-employe-automate-test.sql` : « Employé Test
   Auto », Test seul, idempotent, sans secret, sans compte Auth.
   Épreuve : `test_employe_automate_test_20261026.js` (8 règles, 8 mutations).
   **Reste à faire (étape 2)** : scénario navigateur sur ce compte ; décision sur le compte
   Auth selon une épreuve ; « Employé Test A » conservé jusqu'à trois exécutions vertes
   consécutives, puis épreuve d'isolation et sa mutation avant retrait.
3. **Proposition B.** `observerVersionBornee` : 3 observations espacées de 120 s, puis
   `::warning::` (commit attendu, commit servi, nombre de tentatives) ; non bloquant
   (ENV-003) mais jamais muet. Épreuves dans `test_recette_navigateur_test_20260907.js`.
4. **Runner incomplet.** `outils/juger-tour-claude.js` : `TOUR_INCOMPLET`, `::error::`,
   sortie non nulle. Épreuve : `test_juger_tour_claude_20261026.js`. Câblage dans
   `claude.yml` : voir `docs/handoff/propositions/claude-yml-juger-tour-incomplet.md`
   (à appliquer par un humain sur `main`).
5. **Corrections factuelles au message de `b9e34f97`** (sans réécriture d'historique) :
   - les épreuves 6510a2e3, 631f5d00 et b9e34f97 sont déjà exécutées en CI par
     `run-tests.js` : il n'y a aucun câblage `tests.yml` à ajouter ;
   - la « demande Handoff » annoncée par le runner n'existe pas.
6. **Aucun accès à `main` ni à la Production, aucune mutation Production.**
