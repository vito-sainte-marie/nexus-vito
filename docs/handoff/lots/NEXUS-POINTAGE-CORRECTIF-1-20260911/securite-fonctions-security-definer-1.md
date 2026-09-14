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

---

## 3 · `run_scheduled_inventory_reviews()` — fermée, sur autorisation

**Audit avant toute révocation**, comme demandé.

| | |
|---|---|
| signature | `run_scheduled_inventory_reviews()` — sans argument |
| propriétaire | `postgres` |
| tâche planifiée | `cron.job` #2, `*/15 * * * *` |
| commande | `select public.run_scheduled_inventory_reviews();` |
| **rôle d'exécution** | **`postgres`** — déterminé, pas supposé |
| appels applicatifs | **aucun** : zéro `rpc()` dans le dépôt |
| privilèges avant | `{postgres=X, anon=X, authenticated=X, service_role=X}` |

**L'intention d'origine était déjà la bonne, et elle était silencieusement
défaite.** Les deux migrations qui définissent cette fonction portent
`revoke all on function … from public;` — et aucun `grant` à `anon`,
`authenticated` ou `service_role`. Ces trois droits viennent des privilèges par
défaut que Supabase applique à toute fonction créée dans `public`. Un `revoke
… from public` ne les retire pas : ce sont des octrois nommés, pas PUBLIC.

L'auteur avait donc écrit la fermeture. Elle n'a jamais pris effet.

| | |
|---|---|
| privilèges après | **`{postgres=X/postgres}`** |
| `anon` · `authenticated` · `service_role` | **non** · **non** · **non** |
| `postgres` (le planificateur) | oui |
| rôles readonly | **non** |
| tâche planifiée | **active**, exécutée par `postgres` |

Le fonctionnement de la tâche est conservé : elle s'exécute en tant que
`postgres`, propriétaire de la fonction.

## 4 · Inventaire global après corrections

Sur les **25** fonctions `SECURITY DEFINER` du schéma `public` :

| | |
|---|---|
| appelables directement (hors triggers) | 17 |
| appelables **et** écrivant | 5 |
| écrivantes ouvertes à **PUBLIC** | **0** |
| écrivantes ouvertes à **`anon`** | **2** |
| écrivantes accessibles à `nexus_prod_readonly` | **0** |
| écrivantes accessibles à `nexus_prod_readonly_login` | **0** |

**Les deux qui restent ouvertes à `anon`** vérifient toutes deux `auth.uid()`
et lèvent une exception sans session valide :

- `inventaire_enregistrer_transfert_localise`
- `fdj_corriger_caisse_employe`

Elles se défendent elles-mêmes. Je ne les touche pas : votre autorisation
portait sur `run_scheduled_inventory_reviews`, et fermer un droit sans savoir
qui l'utilise est la faute que ce lot combat.
