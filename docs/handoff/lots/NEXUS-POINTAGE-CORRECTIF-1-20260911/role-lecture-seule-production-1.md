# `nexus_prod_readonly` — créé, vérifié, et volontairement sans mot de passe

**11/09/2026.** Créé en Production sur autorisation explicite de Frédéric
Bragance. Aucune donnée métier modifiée, aucune migration, aucun déploiement.

## Pourquoi il ne peut pas encore se connecter

Le rôle est créé **`NOLOGIN`**. C'est délibéré : poser son mot de passe depuis
cette conversation le ferait transiter par un appel d'outil, donc par un
journal. La garantie 6 l'interdit sans réserve.

**Le mot de passe sera posé par Frédéric Bragance lui-même**, et je ne le
verrai jamais.

## Les garanties, mesurées et non déclarées

Vérifié sur **217 tables** des schémas `public`, `auth` et `storage` :

| droit | tables où le rôle l'a |
|---|---|
| INSERT | **0** |
| UPDATE | **0** |
| DELETE | **0** |
| TRUNCATE | **0** |
| SELECT | 5 tables entières + 2 en colonnes choisies |

| garantie | état |
|---|---|
| ni superutilisateur, ni `CREATEDB`, ni `CREATEROLE`, ni réplication | **oui** |
| membre d'aucun rôle | **oui** (`membre_de` nul) |
| propriétaire d'aucun objet | **oui** (0 objet) |
| ne contourne pas la RLS | **oui** (`rolbypassrls = false`) |
| transaction en lecture seule | **oui** (`default_transaction_read_only = on`) |
| `USAGE` sur le schéma `auth` | **non** |
| `USAGE` sur le schéma `storage` | **non** |
| `CREATE` dans `public` | **non** |
| lecture de `public.employees` (noms) | **non** |
| lecture de `pointages.photo_url` (URL signée) | **non** |

Un `statement_timeout` de 120 s est posé : un audit ne doit pas pouvoir
occuper Production indéfiniment.

## Ce qu'il peut lire, et rien d'autre

- `pointages` — uniquement `id, employee_id, site, date, type, heure, quart, retard_min, heure_debut_quart, photo_echec_technique`
- `shifts` — uniquement `id, employee_id, site, site_id, statut, quart, role, heure_debut, heure_fin, cloture_source`
- `sites`, `station_config`, `mission_catalog`, `advisor_rules`, `nexus_language_templates`

Ni noms, ni PIN, ni médias, ni URL signées, ni données `auth`.

## Ce qui reste à faire, et par qui

1. **Frédéric** pose le mot de passe :
   Supabase → projet Production → `Database` → `Roles` → `nexus_prod_readonly`,
   ou par SQL Editor. Le rôle doit passer `LOGIN`.
2. **Frédéric** dépose l'entrée `nexus-prod-db-readonly` dans son trousseau,
   contenant l'URL complète.
3. **Moi**, alors seulement : la garantie 7 — prouver qu'une écriture de
   contrôle est **refusée**, dans une transaction annulée aussitôt. Sans
   connexion, elle ne peut être ni tentée ni démontrée, et le mandat dit de
   s'arrêter là.
4. Puis la preuve du backfill et les six re-mesures.

**Tant que la garantie 7 n'est pas démontrée, aucune extraction n'a lieu.**

---

## `nexus_prod_readonly_login` — membre, et rien de plus

**11/09/2026.** Rôle de connexion créé par Frédéric Bragance depuis le
Dashboard, avec `User can login` seul et **aucun mot de passe défini ni
affiché**. Je lui ai attribué l'appartenance à `nexus_prod_readonly`, et rien
d'autre.

**Un piège évité, et il valait d'être vu.** Les réglages de rôle ne
s'héritent **pas** : ils s'appliquent au rôle qui se connecte. Poser
`default_transaction_read_only = on` sur le groupe et s'arrêter là aurait
affiché la garantie sans la tenir. Le réglage est donc posé aussi sur le rôle
de connexion, et vérifié sur lui.

Mesuré sur les mêmes **217 tables** :

| | `nexus_prod_readonly_login` |
|---|---|
| membre de | `{nexus_prod_readonly}` — et de rien d'autre |
| réglages | `default_transaction_read_only=on`, `statement_timeout=120s` |
| INSERT · UPDATE · DELETE · TRUNCATE | **0 · 0 · 0 · 0** |
| SELECT | 5 tables + colonnes choisies de `pointages` et `shifts` |
| `pointages.date` · `shifts.heure_debut` | lisibles |
| `pointages.photo_url` · `public.employees` | **non lisibles** |
| `USAGE` sur `auth` · `storage` | **non** · **non** |
| `CREATE` dans `public` | **non** |
| objets possédés | **0** |
| superutilisateur, `CREATEDB`, `CREATEROLE`, réplication, `BYPASSRLS` | tous **non** |

Il hérite exactement des droits prévus, et d'aucun autre.

**Une tentative refusée, et c'est rassurant :** `alter role … nosuperuser …`
a été rejetée — `permission denied to alter role`. Le rôle du connecteur n'est
pas superutilisateur, il ne peut donc pas manipuler les attributs de rôle.
C'est une limite que je n'ai pas cherché à contourner.

---

## Privilèges indirects — ce que PUBLIC donne déjà, et une découverte

**Ce que PUBLIC accorde à tout le monde**, donc aussi à ce rôle :

| ACL relevée | conséquence |
|---|---|
| base : `=Tc/postgres` | **TEMP** et **CONNECT** pour PUBLIC |
| schéma `public` : `=U/pg_database_owner` | **USAGE** pour PUBLIC |

`has_database_privilege(…, 'TEMP') = true` ne vient donc **pas** de mes
octrois : il vient de PUBLIC, et une table temporaire n'est pas une écriture
dans les données métier. Ce n'était pas une sonde valable, et je ne touche
pas aux droits globaux de PUBLIC pour la faire échouer.

En revanche : `CREATE` sur la base et sur le schéma `public` restent **refusés**
au rôle.

### 34 fonctions exécutables, 16 en `SECURITY DEFINER`

Cinq d'entre elles écrivent. Quatre sont des **fonctions de trigger**
(`returns trigger`, rattachées à un trigger) : elles ne sont pas appelables
directement.

**La cinquième l'est** :

> `public.fdj_synchroniser_releves_courants(p_site text) returns integer`
> `SECURITY DEFINER`, propriétaire `postgres`, `EXECUTE` accordé à **PUBLIC**,
> écrit dans `fdj_releves_cloture`.

C'est le **seul chemin d'écriture appelable** accessible à ce rôle, et il
contourne par construction les octrois de lecture seule, puisqu'il s'exécute
en tant que `postgres`.

**Elle se défend elle-même**, et c'est ce qui change tout :

```sql
if auth.uid() is null then raise exception 'Authentification requise'; end if;
if not exists (select 1 from employees e
               where e.id = auth.uid() and e.site_id = p_site
                 and e.role in ('manager','gerant'))
then raise exception 'Accès manager requis'; end if;
```

Une connexion `psql` n'a **jamais** d'`auth.uid()` : le premier garde lève
avant toute écriture. L'autorisation ne repose donc pas sur le seul droit
`EXECUTE`, mais sur une vérification interne.

**Ce qui reste à démontrer, et que je ne peux pas démontrer sans connexion :**
que cet appel échoue bien pour ce rôle. Tant que ce n'est pas constaté,
la garantie « aucune capacité d'écriture » n'est pas acquise — elle est
seulement *plausible*, et ce n'est pas la même chose.
