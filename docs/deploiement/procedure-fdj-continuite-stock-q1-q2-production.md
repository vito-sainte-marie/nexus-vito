# Procédure — 20261010170000, continuité des stocks Q1/Q2 (Production)

**Statut : non exécutée.** Projet `uzhjpqpctpvxytxpxoqz`.
Fichier : `supabase/migrations/20261010170000_fdj_continuite_stock_q1_q2.sql`. Le blob git est celui qu'enregistre `qualification-ordre-migration-code.json` (`mesure.blob_migration`) : un fichier ne peut pas nommer sa propre empreinte, et toute retouche de la migration fait tomber la qualification.

Version corrigée après la revue obligatoire du 10/10/2026. Elle remplace la procédure de 03ca722, qui ne couvrait que deux fonctions.

## Ce que la migration touche

| Objet | Nature | Origine du texte remplacé | md5 `pg_get_functiondef` servi (11/10 00:09Z) |
|---|---|---|---|
| `fdj_manager_aligner_fin_quart_precedent(uuid, text)` | **créée** | — | absente |
| `fdj_manager_modifier_quart(uuid, date, text, text)` | remplacée | `20261010150000_fdj_shifts_counts_ecriture_directe_fermee.sql` | `4c49e39b6aae9ed607e25dceab80bcc7` |
| `fdj_corriger_caisse_manager(uuid, text, numeric, numeric, text)` | remplacée | `20260916220700_fdj_commandes_caisse_manager.sql` | `0e718a831c6857b15a6bc1c2e10be11e` |
| `fdj_libelle_ecart_manager(numeric)` | remplacée (+ commentaire) | `20260916220700_fdj_commandes_caisse_manager.sql` (corps identique, md5 `prosrc` `bc9be5bf…` des deux côtés) | `dfd20752375bbbe649558ece4720798a` |
| `fdj_sync_releve_apres_cash_control()` (déclencheur `trg_fdj_sync_releve_apres_cash_control` sur `fdj_cash_controls`) | remplacée, déclencheur non recréé | `20260901225945_fdj_correction_caisse_employee_tracee.sql` | `c6e0bb5bd74b9385cc1d69d0e23e6639` |

Aucun DDL de table. Les quatre remplacements gardent signature, type de retour, `security definer` / `search_path` et ACL :
- trois fonctions `search_path=""` et EXECUTE à `postgres`, `authenticated` et `service_role` ;
- le déclencheur reste `security definer`, `search_path=public` ; son ACL ouverte à PUBLIC et à `anon` est préexistante et n'est pas modifiée. Une fonction de déclencheur ne peut pas être appelée directement.

Les littéraux écrits sont autorisés par les CHECK mesurés en Production le 10/10 :
- `fdj_caisse_evenements.evenement` : `reouverture`, `correction_manager`, avec un motif d'au moins 3 caractères ;
- `fdj_releves_cloture` : `type_version` vaut `recalcul_automatique_chaine`, `statut` vaut `recalcule_automatiquement` ;
- `fdj_cash_controls` : `statut` vaut `confirmee`, `resultat_controle` est NULL ; `valide_par` et `valide_le` sont tous deux NULL ou tous deux renseignés (`validation_complete_check`).

### Effets visibles côté serveur

- **Libellé manager.** `libelle_ecart` est renvoyé par huit RPC manager.
  - Avant : « Conforme », « Excédent : +2.00 € », « Manquant : -2.00 € ».
  - Après : « Caisse conforme », « Excédent constaté : 2,00 € », « Manquant constaté : 2,00 € ».
  - Le seul consommateur écran (`NEXUS-FDJ-Manager-v1.html`) affiche le texte tel quel.
- **Certification révoquée.** Une correction manager qui change le résultat d'une caisse certifiée vide `valide_le` et `valide_par`. Elle journalise `fdj_caisse_certification_revoquee` et marque le relevé `certification_retiree`. Une correction sans changement de résultat garde la certification.
- **Origine.** Une propagation Q1/Q2 écrit un relevé `recalcul_automatique_chaine` / `recalcule_automatiquement`, distinct d'une régularisation manager.

## Ordre : migration d'abord, code ensuite

- **Migration d'abord** : l'écran servi continue de fonctionner. `fdj_manager_modifier_quart` préserve `valide_le` au lieu de le réécrire. Les libellés `libelle_ecart` servis changent de vocabulaire, ce qui est conforme à la revue. Aucune rupture.
- **Code d'abord** : l'écran du candidat enregistre le quart, puis l'appel de `fdj_manager_aligner_fin_quart_precedent` échoue en `PGRST202`. L'écran signale alors que la fin du quart précédent n'a pas été rapprochée. Aucune écriture partielle.

## Gestes (chacun sur GO distinct de Frédéric)

1. **Préflight en lecture seule** (`begin read only … rollback`), rejoué juste avant d'écrire. Toute valeur différente arrête la procédure.
   - registre = 306, dernière estampille `20261010150000`, `20261010170000` absente ;
   - `fdj_manager_aligner_fin_quart_precedent` absente ;
   - les quatre md5 du tableau ci-dessus.
2. **Application Test, puis Production**, par le connecteur `execute_sql` (jamais `apply_migration`), en une transaction :
   - un bloc `DO` gardé (registre exact, version absente, quatre md5 attendus) ;
   - le texte du fichier ;
   - la ligne du registre.
3. **Constat en lecture seule.**
   - Les cinq fonctions sont présentes, avec `security definer`, `search_path` et ACL inchangés (la fonction neuve : `search_path=''`, EXECUTE à `authenticated` et `service_role`).
   - Le commentaire de `fdj_libelle_ecart_manager` est le nouveau.
   - `select public.fdj_libelle_ecart_manager(-2)` rend « Manquant constaté : 2,00 € ».
   - L'estampille figure au registre.
4. **Fusion** de la PR vers `production`, puis **déploiement constaté** par le sha256 de `NEXUS-FDJ-Manager-v1.html` et de `nexus-fdj-moteur.js` servis.
5. **Recette navigateur** sur désignation :
   - correction d'un début Q2 alors que la fin Q1 est enregistrée (motif exigé, alerte) ;
   - renseignement d'une fin Q1 absente ;
   - affichage « Manquant constaté » ou « Excédent constaté » ;
   - correction d'une caisse certifiée : la certification est retirée et le relevé le signale.

## Retour arrière (GO distinct)

Une transaction :
1. `drop function public.fdj_manager_aligner_fin_quart_precedent(uuid, text);`
2. rétablir `fdj_manager_modifier_quart` depuis `20261010150000_fdj_shifts_counts_ecriture_directe_fermee.sql` ;
3. rétablir `fdj_corriger_caisse_manager` et `fdj_libelle_ecart_manager`, **avec son `comment on function`**, depuis `20260916220700_fdj_commandes_caisse_manager.sql` ;
4. rétablir `fdj_sync_releve_apres_cash_control` depuis `20260901225945_fdj_correction_caisse_employee_tracee.sql` ;
5. supprimer la ligne du registre ;
6. vérifier que les quatre md5 sont revenus aux valeurs du tableau.

Les lignes déjà écrites restent en place (historique immuable) :
- `fdj_caisse_evenements`, `fdj_audit_log`, `fdj_corrections` et les versions de relevé ;
- les certifications révoquées ne sont pas rétablies.

L'écran du candidat retombe alors dans le cas « code d'abord » ci-dessus.

## Hors périmètre, bloquant avant Production (revue A6)

La revue a confirmé sur Test, et par les grants mesurés en Production, qu'un caissier peut écrire directement dans trois tables. Les grants INSERT, UPDATE, DELETE et TRUNCATE à `anon` et `authenticated` le permettent :
- `fdj_releves_cloture` ;
- `fdj_reports` ;
- `fdj_audit_log`.

Cette migration ne l'aggrave pas et ne le corrige pas. C'est un lot séparé.
