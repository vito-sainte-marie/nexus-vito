# Les fonctions qui écrivent sous l'identité de `postgres`

**11/09/2026.** Audit né d'une question étroite — « ce rôle de lecture peut-il
écrire ? » — et qui a trouvé plus large. Aucune donnée métier modifiée.

## 1 · `fdj_synchroniser_releves_courants(text)` — fermée, sur autorisation

**Consommateurs connus : aucun.** Recherche exhaustive dans le dépôt : la
fonction est **définie** par une migration et **appelée nulle part**. Aucun
`rpc('fdj_synchroniser_releves_courants')` dans le code applicatif.

| | privilèges |
|---|---|
| avant | `{=X/postgres, postgres=X, anon=X, authenticated=X, service_role=X}` |
| après | `{postgres=X, authenticated=X, service_role=X}` |

`=X` — c'est-à-dire **PUBLIC** — a disparu, et `anon` avec lui. `authenticated`
et `service_role` sont accordés explicitement : l'appel légitime vient d'un
manager connecté, et le contrôle interne `auth.uid()` + rôle manager/site est
**conservé intact**. Le parcours FDJ légitime passe donc toujours.

Pour le rôle de lecture : `has_function_privilege = false`. Il ne peut plus
l'appeler, et le refus tombera sur la **permission**, avant toute exécution du
corps.

**Après cette fermeture, `nexus_prod_readonly_login` n'a plus AUCUN chemin
d'écriture appelable** en `SECURITY DEFINER`. Mesuré : liste vide.

## 2 · Ce que l'audit a trouvé au passage, et que je n'ai pas touché

Cinq fonctions `SECURITY DEFINER` appelables écrivent en Production. Trois sont
exécutables par **`anon`**, c'est-à-dire par quiconque détient la clé
publiable :

| fonction | `anon` | vérifie `auth.uid()` | écrit dans |
|---|---|---|---|
| `fdj_corriger_caisse_employe` | **oui** | oui | `fdj_audit_log`, `fdj_cash_controls`, `fdj_corrections` |
| `inventaire_enregistrer_transfert_localise` | **oui** | oui | `inventaire_mouvements` |
| **`run_scheduled_inventory_reviews`** | **oui** | **NON** | `inventaire_alertes`, `inventory_reviews` |
| `fdj_synchroniser_releves_courants` | non (fermée ce jour) | oui | `fdj_releves_cloture` |
| `nexus_simulate_cash_sale` | non | **NON** | 6 tables d'intégration |

**Le point qui mérite votre attention : `run_scheduled_inventory_reviews`.**
Elle est appelable par `anon`, elle écrit, et elle **ne vérifie aucune
identité** — ni `auth.uid()`, ni rôle, et elle ne lève aucune exception. Les
deux autres fonctions ouvertes à `anon` se défendent elles-mêmes ; celle-ci
non.

C'est aussi la fonction que la tâche planifiée exécute toutes les quinze
minutes, et que la migration `20260905131500_fuseau_horaire_par_site.sql`
remplace dans la release en cours.

**Je n'ai rien révoqué.** Votre autorisation portait sur la seule fonction FDJ.
Toucher aux droits de celles-ci est une modification de sécurité qui vous
revient, et elle demande d'abord de savoir qui les appelle.
