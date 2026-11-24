# RLS lot 3 — relevé des lecteurs (fiche avant migration)

Migration prévue : `supabase/migrations/20261125180000_rls_lot3_vues_security_invoker.sql` (non appliquée, rien en Production).
Recette : `outils/recette/rls_lot3/01_recette_rls_lot3.sql` (Test uniquement, rollback final, rapport `RAPPORT_RLS_LOT3`).

## Ce que le lot change

Les 4 vues `public` restantes (propriétaire `postgres`, sans `security_invoker`, lisibles par `authenticated`) passent en `security_invoker = true`. Elles s'exécutent alors avec les droits de l'appelant : la RLS des tables sous-jacentes s'applique.

| Vue | Tables lues | Sensibilité |
|---|---|---|
| `v_caisse_ecart_a_traiter` | audits_caisse, employees | **fuite réelle** : écarts de caisse et noms des employés visibles de tout `authenticated`, toutes stations |
| `nexus_stock_etat_v2` | nexus_stock_etat (déjà invoker) | faible |
| `nexus_stock_etat_v3` | v2, inventaire_categories_zones_stock, inventaire_stock_localise_releves, inventaire_mouvements | faible |
| `view_inventaire_dernier_controle_produit` | inventaire_comptages | faible |

Chaîne de dépendance : `nexus_stock_etat` → `v2` → `v3`. Les deux autres vues n'ont pas de dépendant.

## Relevé des lecteurs (.js, .html, SQL ; hors tests et migrations)

| Vue | Lecteur | Rôle qui passe | Effet du lot |
|---|---|---|---|
| v_caisse_ecart_a_traiter | `nexus-conseiller-donnees.js:92` (`.eq('site', siteId)`, via `fetchAllRows`) — alimente le Conseiller et le Brief | manager, gérant (écrans gardés gestion) | inchangé : leur station, noms d'employés conservés (`select_employees` laisse le manager/gérant lire les employés de sa station) |
| v_caisse_ecart_a_traiter | commentaires ou conversions seulement : `nexus-conseiller.js:892,937`, `NEXUS-Brief-v1.html:714,900`, `NEXUS-Cockpit-v2.html:1500`, `nexus-secteurs-moteur.js:436` | — | aucun |
| view_inventaire_dernier_controle_produit | `nexus-inventaire-plan-donnees.js:94` et `:299` (`chargerCouverturePhysique`, `.eq('site', site)`), chargé par Inventaire-v1, Inventaire-Manager-v1, Parametres-Inventaire-v1 | tout employé du site (Inventaire-v1) ; manager/gérant (les deux autres) | inchangé : la politique de `inventaire_comptages` est « même site » |
| nexus_stock_etat_v2 / v3 | aucun lecteur JS | — | aucun |
| nexus_stock_etat_v3 | `nexus_stock_lire_etat_json(p_site)` : SECURITY DEFINER, `row_security=off`, garde `nexus_site_autorise`. Aucun appel JS | propriétaire | insensible au lot (s'exécute en propriétaire) |

Autres chemins du stock, sans passer par ces vues : `nexus-stock-moteur.js` appelle la RPC `nexus_stock_lire_etat`, qui lit les tables via `nexus_stock_lire_etat_donnees(p_site)` (DEFINER).
Tests qui ne font que simuler ou citer les vues : `test_conseiller_precharge_contexte_v2229.js`, `test_inventaire_plan_snapshot_s4.js`, `test_inventaire_relectures_20261024.js`.

## Politiques sous-jacentes vérifiées sur Test (SELECT)

- `audits_caisse` : manager/gérant de la station, ou créateur sur station à accès autorisé.
- `employees` : soi-même, manager/gérant de la même station, ou créateur sur station autorisée.
- `inventaire_comptages`, `inventaire_categories`, `inventaire_zone_produit`, `inventaire_categories_zones_stock`, `inventaire_stock_localise_releves`, `inventaire_mouvements` : `site = current_employee_site_id()` (tout employé du site).
- `stock_releves` : manager/gérant ou créateur autorisé. `inventaire_decenium_snapshots(_lignes)` : manager/gérant.

## Rôles : qui a besoin de quoi

- **Écarts de caisse à traiter** : manager et gérant seulement. L'employé tombe à 0 ligne, ce qui ferme la fuite.
- **État du stock v2/v3** : aucun écran ne les lit aujourd'hui. Après le lot, chaque rôle ayant accès voit sa station seulement. Le manager et le gérant sont les lecteurs légitimes (le stock est une donnée de gestion) ; un employé ne voit plus ce qui dérive de `stock_releves` ou des snapshots.
- **Dernier contrôle par produit** : tout employé du site (plan d'inventaire).

## Points à arbitrer ou à savoir

- **Créateur** : sur `view_inventaire_dernier_controle_produit` et la chaîne stock, il ne lit plus que sa propre station (aucune branche créateur sur ces tables). Les écrans ci-dessus filtrent par `employee.site_id`, donc aucun ne lit une autre station : **pas de politique ajoutée**, pas de régression. Sur `v_caisse_ecart_a_traiter`, il suit `acces_createur_autorise`. La recette calcule ces valeurs attendues.
- **Droits d'écriture sur les vues** : `authenticated` garde tous les privilèges sur les 4 vues (`anon` n'en a aucun sur ces 4 vues ; il en garde sur `nexus_stock_etat`). Dette existante, hors de ce lot ; à traiter à part si le pilote le souhaite.
- La migration est idempotente et ne modifie aucune donnée. `MIGRATIONS_REELLES_NOMBRE` passe à 354 ; l'empreinte est à mesurer par la CI ou Guardian.
