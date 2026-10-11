# Recette — continuité des stocks Q1/Q2 (FDJ Manager, nexus-test)

**Arbitrage définitif du 10/10/2026 (Frédéric).** Il remplace la règle « priorité au stock initial du quart suivant » du même jour.

1. **Initialisation bidirectionnelle.** Fin Q1 absente et début Q2 présent : la fin Q1 est renseignée depuis le début Q2. Début Q2 absent et fin Q1 présente : le début Q2 est prérempli depuis la fin Q1.
2. **Autorité du stock initial Q2.** Toute modification du début Q2 rapproche la fin Q1. Une modification de Q1 n'écrase jamais un début Q2 enregistré.
3. **Contrôle et traçabilité.** Rupture signalée ; manager alerté quand une fin Q1 enregistrée est corrigée ; motif exigé pour toute correction d'une valeur enregistrée ; ancienne et nouvelle valeur, auteur, horodatage et motif conservés ; aucune certification automatique ; `valide_le` préservé.
4. **Recalculs financiers.** Ventes, caisse théorique et écart du quart corrigé recalculés ; montants comptés et historiques de clôture préservés.

**Environnement.** Base Test `udljdqxerrbbbajxubfn`, site `nexus-station-test`, 30 jeux copiés de Production (« Jeu Recette FDJ » désactivé). Aucun essai en Production. **La migration `20261010170000_fdj_continuite_stock_q1_q2.sql` est appliquée sur Test le 11/10/2026 à 02:34Z (GO TEST de Frédéric), pas en Production** : voir la dernière section. Les essais antérieurs ont été faits dans une transaction annulée.

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

- `test_fdj_priorite_stock_initial_suivant_20261010.js` : 11/11 (situations, ventes, libellés d'écart, câblage écran, contenu de la migration). Mutation contrôlée : renommer la RPC dans le HTML rougit le test de câblage.
- `test_fdj_continuite_auto_recalcul.js` et `test_fdj_fiabilisation_etape2_propagation.js` : réécrits pour la nouvelle règle (la décision du 16/08 de réécrire un Q2 hérité est abandonnée).
- `test_fdj_masquage_ecart_cloture_v2266.js` : le libellé « Certifier le contrôle » est désormais celui de la case, le bouton porte `libelleBoutonEdition()`.

## Essais base sous rollback (nexus-test, migration chargée puis annulée)

1. **Motif.** Correction d'une fin Q1 enregistrée sans motif : refus `22023`.
2. **Correction et renseignement.** G10 25 → 26 (ventes recalculées, 90 €) et G15 absent → 18 (30 €) ; `alerte_manager = true` ; Q2 intact ; `fdj_audit_log` (`alignement_fin_sur_quart_suivant`) et `fdj_corrections` (`stock_final_aligne_quart_suivant`) présents avec ancienne valeur, nouvelle valeur, auteur, motif.
3. **Rejeu.** Second appel : `deja_continu`, rien d'écrit.
4. **`valide_le`.** Un quart validé réenregistré garde sa date de validation.
5. **Caisse confirmée.** Ventes 160 → 120, attendue 200 → 160, écart +40 ; `caisse_reelle` et son origine préservées ; relevé de clôture en version 2. *Corrigé par la revue : une caisse certifiée dont le résultat change perd sa certification (voir C16), et une propagation écrit `recalcul_automatique_chaine`, pas `correction_manager` (voir C06f).*
6. **Accès.** Employé et appel sans session : `42501`.

## Points ouverts

- ~~Une caisse déjà validée reste « conforme » après une correction qui crée un écart~~ : corrigé par la revue (C16). La certification est retirée quand le résultat change ; elle est gardée quand il ne change pas (C09).
- Un simple renseignement d'une fin absente prend un motif par défaut (« Fin de quart renseignée depuis le début du quart suivant »).
- Un retour en brouillon remet `valide_le` à NULL, comme avant.
- Ordre de déploiement : la migration doit précéder le code (l'écran appelle la nouvelle RPC). Application Test puis Production sur autorisation distincte. Servi sans la migration, l'écran enregistre le quart puis signale que la fin du quart précédent n'a pas été rapprochée : rien ne casse, mais rien n'est aligné.

## Revue obligatoire du 10/10/2026 — essais base sous rollback (nexus-test)

Rejoués le 11/10 vers 00:10Z avec la migration corrigée : **39 cas, rc=0, transaction annulée**. Le registre Test n'a pas bougé (316).

| Cas | Ce qui est éprouvé | Résultat |
|---|---|---|
| C01 | libellés manager | « Caisse conforme », « Excédent constaté : 2,00 € », « Manquant constaté : 2,00 € » |
| C02–C03 | anon, caissier sur l'alignement | `42501` |
| C04–C05b | motif absent ou court | `22023`, rien écrit |
| C06–C06h | alignement avec motif | fin Q1 20 → 18 corrigée, Q2 intact ; caisse recalculée (−2 → −4, compté conservé) ; événement `reouverture`, audit, `fdj_corrections` avec l'origine `propagation_q1_q2` ; relevé `recalcul_automatique_chaine` ; GUC d'origine remise à vide ; `valide_le` du quart préservé |
| C07–C07b | double clic / rejeu | `deja_continu`, rien écrit |
| C08–C08b | excédent, caisse non certifiée | « Excédent constaté : 4,00 € », compté et origine conservés |
| C09–C09b | caisse certifiée, résultat inchangé | certification gardée |
| C10 | caissier corrige une caisse | `42501` |
| C11 | `fdj_manager_modifier_quart` | `valide_le` gardé |
| C12–C12c | stock incohérent (fin > début + appro) | ventes négatives signalées `stock_incoherent`, `nb_stocks_incoherents` |
| C16–C16e | correction d'une caisse certifiée | `valide_le` et `valide_par` vidés, `fdj_caisse_certification_revoquee`, relevé `certification_retiree` |
| C17 | écriture directe sur `fdj_cash_controls` | `42501` |
| C13–C14b | suppression de l'historique (événements, audit, relevés) | refusée ou 0 ligne |
| C15 | autres stations | empreintes identiques |
| **C17b–C17d** | **un caissier écrit directement dans `fdj_releves_cloture`, `fdj_reports`, `fdj_audit_log`** | **accepté (A6, critique, préexistant ; grants identiques en Production)** |

Écarts restants, hors de ce lot :
- **A6** : écriture directe par un caissier, ci-dessus. Lot séparé, bloquant avant Production.
- **Libellé employé côté serveur.** `fdj_libelle_ecart_employe` renvoie « Écart provisoire en plus : +2.00 € ». Ce n'est pas le vocabulaire de la revue (« Écart en plus : 2,00 € »).
- Badges « Manque non expliqué » de l'écran Manager, figés par deux tests existants.
- Exports PDF : le montant reste signé.
- La concurrence est garantie par la structure (verrou `for update` sur le quart et la caisse), pas par un essai à deux sessions.

## Application sur Test du 11/10/2026 (GO TEST, Production inchangée)

Commit testé `a753bf259c74dc40dadd533d1921ac56326a154d`, blob de la migration `fd0e1e7a2205539572b3606a980739cf67a2c0dd`. PR #98 non fusionnée.

1. **Préflight en lecture seule** : base Test (`udljdqxerrbbbajxubfn`, site `nexus-station-test` présent), registre 316, dernière estampille `20261010150000`, `20261010170000` absente, fonction d'alignement absente, quatre md5 `pg_get_functiondef` égaux à ceux du tableau de la procédure (identiques à Production).
2. **Application** par psql vers Test, en une transaction : bloc `DO` gardé (site Test, registre exact, version et fonction absentes, quatre md5), texte du fichier, ligne du registre (`version`, `name`, comme les lignes voisines). `ON_ERROR_STOP`, rc=0.
3. **Constat** : registre **317**, dernière estampille `20261010170000`.

| Fonction | secdef | search_path | EXECUTE | md5 après |
|---|---|---|---|---|
| `fdj_manager_aligner_fin_quart_precedent(uuid,text)` | oui | `""` | postgres, authenticated, service_role | `1fdf48c170120387b37e5bc65a29f969` |
| `fdj_manager_modifier_quart(uuid,date,text,text)` | oui | `""` | inchangé | `c19f7b24bae242456f50a002ef980d22` |
| `fdj_corriger_caisse_manager(uuid,text,numeric,numeric,text)` | oui | `""` | inchangé | `70d5dd41aec171c43ac575932a37f4cc` |
| `fdj_libelle_ecart_manager(numeric)` | non | `""` | inchangé | `eccb4bc1cc706efd3357a130c9877896` |
| `fdj_sync_releve_apres_cash_control()` | oui | `public` | inchangé (PUBLIC, préexistant) | `5722cb598bdc545f1a50bac1829bf52a` |

   Nouveau commentaire du libellé présent ; `fdj_libelle_ecart_manager` rend « Manquant constaté : 2,00 € », « Excédent constaté : 2,00 € », « Caisse conforme », « Non comparable » ; déclencheur actif.
4. **Rejeu des 39 cas sous rollback**, migration servie et non rechargée : rc=0, résultats identiques à l'essai de référence une fois identifiants et horodatages normalisés. Seule différence : l'ordre des trois actions de C16e, triées par `id` (uuid aléatoire), contenu identique. C17b–C17d toujours acceptés (A6).
5. **Suites** : ciblée 11/11, empreinte 32/32, garde d'ordre verte, suite complète 260/267 (sept échecs préexistants : inventaire ×4, réception ×3).
6. **Production** relue en lecture seule après coup : registre 306, quatre md5 d'origine, fonction d'alignement absente.

Retour arrière sur Test : celui de la procédure, registre ramené à 316.
