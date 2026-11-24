# RLS lot 3 — rapport étape 1 (avant le code)

Branche `claude/rls-lot3`, partie de `production` 8c4b71a4. Test uniquement. Rien en Production.
Fiche des lecteurs : `docs/rls_lot3_releve_lecteurs.md`. Migration : `supabase/migrations/20261125180000_rls_lot3_vues_security_invoker.sql`. Recette : `outils/recette/rls_lot3/01_recette_rls_lot3.sql`.

## 1. Définition de chaque vue : Production contre migration GitHub

Mesuré par Guardian en Production (catalogue seulement, aucune donnée lue), reporté ici :

| Vue | Propriétaire | reloptions | md5 de pg_get_viewdef | Droits |
|---|---|---|---|---|
| v_caisse_ecart_a_traiter | postgres | aucune | b97e780f | authenticated : tous |
| nexus_stock_etat_v2 | postgres | aucune | 558fb9d4 | authenticated : tous |
| nexus_stock_etat_v3 | postgres | aucune | 0ab34cb2 | authenticated : tous |
| view_inventaire_dernier_controle_produit | postgres | aucune | e8abb6ab | authenticated : tous |
| nexus_stock_etat (référence) | postgres | security_invoker=true | 0dfb92a9 | anon et authenticated : tous |

- Les définitions sont identiques en Production et sur Test.
- Les politiques SELECT des 6 tables sources sont identiques pour `authenticated`. Seules différences : `recette_ci_site_test` sur Test, `audit_nexus_readonly_select` (rôle `nexus_prod_readonly`) en Production. Aucune ne concerne les utilisateurs de l'application.
- La recette sur Test vaut donc pour la Production.

## 2. Propriétaire, droits, dépendances, lecteurs (mesuré sur Test)

| Vue | Propriétaire | SELECT | Dépend de | Lecteur applicatif |
|---|---|---|---|---|
| `v_caisse_ecart_a_traiter` | postgres | authenticated (tous privilèges) ; `anon` : aucun droit, en Production comme sur Test | audits_caisse, employees | Conseiller et Brief (`nexus-conseiller-donnees.js:92`), manager/gérant |
| `nexus_stock_etat_v2` | postgres | idem (authenticated seul) | nexus_stock_etat (déjà invoker) | aucun |
| `nexus_stock_etat_v3` | postgres | idem | v2, inventaire_categories_zones_stock, inventaire_stock_localise_releves, inventaire_mouvements | aucun (la fonction DEFINER `nexus_stock_lire_etat_json` la lit, sans effet du lot) |
| `view_inventaire_dernier_controle_produit` | postgres | idem | inventaire_comptages | `nexus-inventaire-plan-donnees.js:94,299`, tout employé du site |

Droits confirmés en Production par Guardian (point 1).

## 3. Tables lues sans leur RLS, et ce que chaque rôle lit à tort aujourd'hui

Une vue sans `security_invoker` s'exécute en `postgres` : la RLS des tables sources est ignorée.
- `v_caisse_ecart_a_traiter` : **fuite réelle**. Tout `authenticated`, employé compris, lit les écarts de caisse et les noms des employés de **toutes** les stations. Mesuré dans la recette (cas 2.1, informatif) : avant le lot, l'employé A lit 2 écarts, dont celui de l'autre station.
- Les trois vues de stock et d'inventaire : fuite faible. Un employé lit ce que ses tables d'origine réservent au manager (`stock_releves`, snapshots), et les lignes d'une autre station si la vue n'est pas filtrée par l'appelant.

## 4. Solution par vue

`security_invoker = true` sur les quatre. Justification : aucun lecteur légitime n'a besoin des droits du propriétaire.
- `v_caisse_ecart_a_traiter` : le manager et le gérant lisent leur station et les noms de leurs employés (`select_employees`). L'employé tombe à 0 ligne, ce qui ferme la fuite. Le créateur suit `acces_createur_autorise`.
- `nexus_stock_etat_v2/v3` : aucun écran ne les lit ; chaque rôle ne voit que sa station.
- `view_inventaire_dernier_controle_produit` : la politique de `inventaire_comptages` est « même site », donc le plan d'inventaire garde ses données.

Aucune fonction gardée ni filtre explicite n'est nécessaire. Aucune politique n'est ajoutée.

## 5. Plan sur Test et retour arrière

1. Appliquer la migration (idempotente ; une garde échoue si une vue ou une politique SELECT manque ; vérification finale des `reloptions`).
2. Lancer la recette (rollback final, rapport `RAPPORT_RLS_LOT3`).
3. Retour arrière, une ligne par vue : `alter view public.<vue> set (security_invoker = false);`. Aucune donnée modifiée, donc rien à restaurer.

## Recette

6 identités sur 4 stations de recette fictives : employé A, manager A, gérant A, employé B, manager B, créateur (deux stations, avec et sans `acces_createur_autorise`, fixé à l'INSERT).
Exécutée sur Test **dans une seule transaction annulée** (migration appliquée dans la transaction puis rollback, donc **la migration n'est pas appliquée sur Test**) : **48 cas, 0 KO**. Le cas informatif 2.1 montre 2 écarts lus par l'employé A avant le lot.
Couvre : l'employé ne lit aucun écart ; le manager et le gérant ne lisent que leur station et gardent les noms ; les vues de stock et d'inventaire respectent la station ; aucune requête directe ne donne accès à une autre station ; le créateur suit `acces_createur_autorise`.
À rejouer par Guardian après application réelle (la garde de la recette refuse tant que la migration n'est pas appliquée).

## 6. Risques de régression, écran par écran

| Écran | Lit | Risque |
|---|---|---|
| Conseiller, Brief | `v_caisse_ecart_a_traiter` | Faible : manager/gérant gardent leur station et les noms. Un employé qui verrait ces écrans n'aurait plus d'écart (voulu). À rejouer. |
| Inventaire (plan), Inventaire Manager, Paramètres Inventaire | `view_inventaire_dernier_controle_produit` | Faible : même station. À rejouer. |
| Caisse, Stock | aucune des 4 vues | Aucun lecteur direct trouvé. Stock passe par `nexus_stock_lire_etat` (DEFINER). |
| Créateur sur une autre station | écarts et contrôles | Sur l'inventaire il ne lit plus que sa propre station ; aucun écran ne filtre autrement qu'avec `employee.site_id`. |

## Anomalies restantes, hors lot, non traitées

- `authenticated` garde tous les privilèges (écriture comprise) sur les 4 vues ; `anon` n'en a aucun sur ces 4 vues, mais en garde sur `nexus_stock_etat`. Dette inscrite au registre de l'étape 3, hors de ce lot.

## Preuves

- Tête avant : 7ffaa4f3 (fiche). Base : 8c4b71a4.
- `MIGRATIONS_REELLES_NOMBRE` 353 → 354 ; `MIGRATIONS_REELLES_EMPREINTE` à fixer avec la valeur mesurée par la CI.
