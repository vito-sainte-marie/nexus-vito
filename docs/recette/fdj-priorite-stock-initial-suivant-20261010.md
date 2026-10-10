# Recette — continuité des stocks Q1/Q2 (FDJ Manager, nexus-test)

**Arbitrage définitif du 10/10/2026 (Frédéric).** Il remplace la règle « priorité au stock initial du quart suivant » du même jour.

1. **Initialisation bidirectionnelle.** Fin Q1 absente et début Q2 présent : la fin Q1 est renseignée depuis le début Q2. Début Q2 absent et fin Q1 présente : le début Q2 est prérempli depuis la fin Q1.
2. **Autorité du stock initial Q2.** Toute modification du début Q2 rapproche la fin Q1. Une modification de Q1 n'écrase jamais un début Q2 enregistré.
3. **Contrôle et traçabilité.** Rupture signalée ; manager alerté quand une fin Q1 enregistrée est corrigée ; motif exigé pour toute correction d'une valeur enregistrée ; ancienne et nouvelle valeur, auteur, horodatage et motif conservés ; aucune certification automatique ; `valide_le` préservé.
4. **Recalculs financiers.** Ventes, caisse théorique et écart du quart corrigé recalculés ; montants comptés et historiques de clôture préservés.

**Environnement.** Base Test `udljdqxerrbbbajxubfn`, site `nexus-station-test`, 30 jeux copiés de Production (« Jeu Recette FDJ » désactivé). Aucun essai en Production. **La migration `20261010170000_fdj_continuite_stock_q1_q2.sql` n'est appliquée nulle part** : les essais base ont été faits dans une transaction annulée.

## Ce qui a changé

| Couche | Avant | Après |
|---|---|---|
| Base | aucune commande d'alignement ; `fdj_manager_modifier_quart` réécrit `valide_le` à chaque enregistrement | `fdj_manager_aligner_fin_quart_precedent(p_shift_id, p_motif)` ; `valide_le = coalesce(valide_le, now())` |
| Moteur | `propagationCorrectionStock` réécrit un début Q2 hérité | jamais : tout écart part dans `aRevoir` ; ajout de `initialisationContinuite`, `rapprochementFinQ1`, `correctionsValeursEnregistrees`, `motifCorrectionStockValide` |
| Écran Manager | `appliquerCorrectionsAutomatiquesContinuite` via `fdj_manager_corriger_comptages` (sans motif ni journal) ; « Certifier le contrôle » sur tout enregistrement | supprimée ; motif exigé avant enregistrement quand une fin Q1 enregistrée sera corrigée ; rapprochement serveur après ; certification par case explicite |

## Les cinq situations

| # | Situation | Attendu | Preuve |
|---|---|---|---|
| S1 | fin Q1 absente, début Q2 présent | fin Q1 renseignée, sans alerte ni motif saisi | moteur + SQL (G15 → 18) |
| S2 | début Q2 absent, fin Q1 présente | début Q2 prérempli | moteur ; `NEXUS-FDJ-v1.html` préremplissait déjà |
| S3 | les deux présents et différents | rupture signalée, Q2 fait autorité | moteur (`verdictContinuiteStock`) |
| S4 | début Q2 modifié, fin Q1 enregistrée | fin Q1 corrigée, alerte manager, motif exigé | moteur + écran + SQL (G10 25 → 26) |
| S5 | correction de Q1 | Q2 jamais réécrit, hérité ou confirmé | moteur + migration (aucun `update … stock_initial`) |

Le tableau métier cité par l'arbitrage n'a pas été fourni : ces cinq situations sont déduites du texte.

## Suite automatique

- `test_fdj_priorite_stock_initial_suivant_20261010.js` : 9/9 (situations, ventes, câblage écran, contenu de la migration). Mutation contrôlée : renommer la RPC dans le HTML rougit le test de câblage.
- `test_fdj_continuite_auto_recalcul.js` et `test_fdj_fiabilisation_etape2_propagation.js` : réécrits pour la nouvelle règle (la décision du 16/08 de réécrire un Q2 hérité est abandonnée).
- `test_fdj_masquage_ecart_cloture_v2266.js` : le libellé « Certifier le contrôle » est désormais celui de la case, le bouton porte `libelleBoutonEdition()`.

## Essais base sous rollback (nexus-test, migration chargée puis annulée)

1. **Motif.** Correction d'une fin Q1 enregistrée sans motif : refus `22023`.
2. **Correction et renseignement.** G10 25 → 26 (ventes recalculées, 90 €) et G15 absent → 18 (30 €) ; `alerte_manager = true` ; Q2 intact ; `fdj_audit_log` (`alignement_fin_sur_quart_suivant`) et `fdj_corrections` (`stock_final_aligne_quart_suivant`) présents avec ancienne valeur, nouvelle valeur, auteur, motif.
3. **Rejeu.** Second appel : `deja_continu`, rien d'écrit.
4. **`valide_le`.** Un quart validé réenregistré garde sa date de validation.
5. **Caisse confirmée.** Ventes 160 → 120, attendue 200 → 160, écart +40 ; `caisse_reelle` et son origine préservées ; `valide_le`/`valide_par` de la caisse inchangés ; relevé de clôture en version 2 (`correction_manager`).
6. **Accès.** Employé et appel sans session : `42501`.

## Points ouverts

- Une caisse déjà validée reste « conforme » après une correction qui crée un écart (+40 dans l'essai) : comportement existant, la correction ne recertifie ni ne décertifie.
- Un simple renseignement d'une fin absente prend un motif par défaut (« Fin de quart renseignée depuis le début du quart suivant »).
- Un retour en brouillon remet `valide_le` à NULL, comme avant.
- Ordre de déploiement : la migration doit précéder le code (l'écran appelle la nouvelle RPC). Application Test puis Production sur autorisation distincte. Servi sans la migration, l'écran enregistre le quart puis signale que la fin du quart précédent n'a pas été rapprochée : rien ne casse, mais rien n'est aligné.
