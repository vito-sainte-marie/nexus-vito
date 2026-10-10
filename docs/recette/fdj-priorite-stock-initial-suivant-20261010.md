# Recette — priorité au stock initial du quart suivant (FDJ Manager, nexus-test)

**Règle (10/10/2026).** Quand le stock final de Q1 diffère du stock initial de Q2, c'est le stock initial de Q2 qui fait référence. Le manager corrige rétroactivement le stock final de Q1 pour l'aligner. Cette correction :
- préserve le stock initial de Q2 ;
- recalcule les ventes, la caisse théorique et l'écart de Q1 ;
- conserve l'historique des valeurs et l'auteur ;
- exige un motif ;
- ne certifie jamais le contrôle manager.

**Environnement.** `https://production.nexus-test-ddf.pages.dev`, base Test `udljdqxerrbbbajxubfn`, site `nexus-station-test`. Aucun essai en Production.

## Ce que couvre la suite automatique

`test_fdj_priorite_stock_initial_suivant_20261010.js` teste le moteur seul :

| Test | Exigence | État au 10/10 (6a59137) |
|---|---|---|
| ventes recalculées depuis le stock final corrigé | recalcul de Q1 | vert |
| continuité rétablie après alignement | l'alerte de Q2 peut se clore | vert |
| Q2 confirmé : ni réécriture ni alerte | préserver Q2 | vert |
| Q2 hérité, Q1 aligné : Q2 garde sa valeur | préserver Q2 | vert |
| Q2 hérité, Q1 non aligné : Q2 n'est pas réécrit | préserver Q2 | **rouge** |

Le cinquième test contredit le premier test de `test_fdj_fiabilisation_etape2_propagation.js`. Celui-ci encode la décision du 16/08/2026 : un stock initial encore hérité (`stock_initial_auto = true`) est réécrit automatiquement par `appliquerCorrectionsAutomatiquesContinuite`, via `fdj_manager_corriger_comptages`. Cette RPC ne prend ni motif ni journal.

## Scénario navigateur (désignations requises)

Préparation, sur désignation : Q1 du 10/10 pour un employé de test, avec un stock initial S0 et un stock final F ≠ 50. Le stock initial de Q2 (quart `9400fffc…`) vaut 50, confirmé par l'employé (`stock_initial_auto = false`).

1. **Écart visible.** L'accueil manager montre « Continuité de stock à vérifier » sur Q2 (50 contre F).
2. **Correction.** Ouvrir Q1 depuis « Corriger le quart précédent », remplacer F par 50 et saisir un motif.
3. **Contrôles en base (lecture seule)** :
   - Q2 : `stock_initial` = 50, inchangé, `updated_at` inchangé ;
   - Q1 : `stock_final` = 50, ventes = S0 − 50, `ventes_valeur` = (S0 − 50) × 2 ;
   - caisse de Q1 : `caisse_attendue` et `ecart` recalculés ; `caisse_reelle_origine` et `ecart_origine` intacts ;
   - historique : `fdj_audit_log` `correction_manager` avec avant F et après 50, auteur le manager ; relevé de clôture en nouvelle version ;
   - motif : présent dans l'audit, et c'est celui qui a été saisi, pas un texte de repli ;
   - certification : `fdj_cash_controls.valide_le` et `valide_par` inchangés par la correction ;
   - continuité : l'alerte de Q2 est close par `resolue_automatiquement`.

## Écarts connus avant recette (lecture du code servi, 6a59137)

1. **Certification automatique.** L'enregistrement d'un quart existant porte le libellé « Certifier le contrôle ». Si la caisse est confirmée mais pas encore validée, il appelle toujours `fdj_valider_caisse`. Aucune correction n'est donc possible sans certifier.
2. **Motif non exigé pour un stock.** Un changement de stock final ne demande de motif que si l'écart de caisse en exige un (`motifEcartObligatoire`). Sinon, `motifCaisseManager()` se replie sur « Saisie manager du … — Quart N ». `fdj_manager_enregistrer_comptages` n'a pas de paramètre de motif.
3. **Historique côté serveur.** `fdj_manager_enregistrer_comptages` écrase la ligne par un upsert sans rien journaliser. L'ancienne valeur ne survit que par l'insert direct de l'écran dans `fdj_audit_log` et par le relevé versionné.
4. **`valide_le` du quart écrasé** par `fdj_manager_modifier_quart` à chaque enregistrement. Ce comportement est antérieur à #96 : constaté lors de la recette (b).
5. **Réécriture de Q2 hérité** quand Q1 n'est pas aligné : c'est le test rouge ci-dessus.
