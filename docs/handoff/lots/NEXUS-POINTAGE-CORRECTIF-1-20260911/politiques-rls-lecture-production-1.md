# Les sept politiques de lecture posées en Production — et pourquoi chacune

**11/09/2026.** Mandat voie A de Frédéric Bragance. Rôle `nexus_prod_readonly`,
connexion `nexus_prod_readonly_login`.

## L'obstacle

Le rôle avait le `SELECT` sur sept tables et lisait **zéro ligne** partout. RLS
était active (`relrowsecurity = t`) sans aucune politique le concernant : en
PostgreSQL, l'absence de politique n'est pas « tout passe », c'est « rien ne
passe ». Le droit existait, la visibilité non. C'est exactement le défaut
récurrent de ce dépôt — mesurer un proxy (le grant) au lieu du fait (la ligne
rendue).

## Ce qui a été resserré AVANT d'ouvrir

Ouvrir la ligne élargit la surface : les colonnes devaient donc être réduites
d'abord, pas après. Le `SELECT` de table entière a été révoqué puis re-accordé
colonne par colonne sur trois tables :

| table | colonnes accordées |
|---|---|
| `sites` | `site_id` |
| `station_config` | `site`, `fuseau_horaire` |
| `mission_catalog` | `mission_id`, `site`, `site_id` |

Vérifié après coup par `information_schema.columns`, qui ne montre au rôle que
ce sur quoi il a un privilège : `sites` ne rend qu'une colonne, `station_config`
deux, `mission_catalog` trois. `pointages.photo_url` n'apparaît pas.

## Les politiques

```sql
create policy audit_nexus_readonly_select on public.<table>
  for select to nexus_prod_readonly using (true);
alter role nexus_prod_readonly_login connection limit 1;
```

| table | pourquoi la preuve en a besoin |
|---|---|
| `pointages` | l'objet même du backfill : les 92 lignes à rattacher |
| `shifts` | les services candidats au rattachement, et la mesure #4 |
| `sites` | la liste des sites, pour distinguer `site-fantome-test` |
| `station_config` | le fuseau horaire, pré-image de la migration #4 |
| `mission_catalog` | la mesure #2 de cohérence `site`/`site_id` |
| `advisor_rules` | la mesure #1, comparaison au seed |
| `nexus_language_templates` | la mesure #1, comparaison au seed |

**`using (true)` est délibéré.** L'audit doit voir *toutes* les lignes, y compris
les dix exceptions `site-fantome-test` : une politique qui les filtrerait ferait
disparaître précisément ce que la preuve doit compter. La restriction ne vit pas
dans la ligne, elle vit dans les colonnes accordées et dans l'absence de toute
autre opération.

## Ce que ces politiques ne font pas

- Aucune politique pour `public`, `anon`, `authenticated` ou `service_role`.
- Aucune politique `INSERT`, `UPDATE`, `DELETE` ou `ALL`.
- Aucune table `employees`, aucune colonne `photo_url`, aucun PIN, aucun accès
  Auth ni Storage.
- Aucune fonction `SECURITY DEFINER` créée ou modifiée.
- Les restrictions de colonnes préexistantes sont conservées, et trois tables
  en ont reçu de nouvelles.

## Vérifié après création

```
pointages 92 · shifts 253 · sites 2 · station_config 2
mission_catalog 308 · advisor_rules 31 · nexus_language_templates 6
```

Colonnes interdites, toutes refusées : `pointages.photo_url`, `employees.nom`,
`sites.logo_url`, `station_config.paye_config`.

Sondes d'écriture rejouées **avec `set transaction read write`**, donc sans le
filet de la transaction en lecture seule — toutes refusées sur le privilège :

| sonde | refus |
|---|---|
| `insert into public.pointages` | permission denied for table pointages |
| `update public.shifts` | permission denied for table shifts |
| `delete from public.pointages` | permission denied for table pointages |
| `create table public.sonde_x` | permission denied for schema public |
| `alter table public.pointages` | must be owner of table pointages |
| `fdj_synchroniser_releves_courants(...)` | permission denied for function |
| `run_scheduled_inventory_reviews()` | permission denied for function |

Fonctions `SECURITY DEFINER` écrivantes exécutables par ce rôle : **0**.

## Reste à arbitrer après la gate

Désactivation du `LOGIN` ou expiration du mot de passe, et retrait des sept
politiques. **Proposé, pas exécuté** : ces gestes appartiennent à Frédéric.
