# Re-mesure finale — exécution du 11/09/2026, avec un rôle réellement limité

**11/09/2026, 22 h 39 UTC** (18 h 39 heure de Martinique). Projet Production
`uzhjpqpctpvxytxpxoqz`. Exécutant : `nexus_prod_readonly_login`, membre de
`nexus_prod_readonly`, `connection limit 1`, mot de passe lu dans le trousseau
local et jamais affiché.

**SHA sur lequel ces mesures portent : `b10f9b6`** — voir `identite-du-candidat-1.md`.
La première rédaction de ce rapport recalculait les critères sur `febb3d6`
puis annonçait un push `b10f9b6` : deux SHA dans un même verdict, corrigé.

Cette exécution **remplace** celle du 10/09/2026, périmée depuis
14 h 02 UTC. Différence de fond : la mesure du 10/09 passait par le connecteur
Supabase, c'est-à-dire par un rôle capable d'écrire. Celle-ci passe par un rôle
dont l'incapacité d'écrire est démontrée sonde par sonde, sans le filet d'une
transaction en lecture seule.

---

## 1 · Référentiel Advisor

`comparaison-seed-referentiel-advisor.sql` rejoué intégralement.

| verdict | lignes |
|---|---|
| IDENTIQUE (no-op) | **37** |
| COMPLETEE | 0 |
| **ECRASEE** | **0** |

Inchangé depuis le 09/09 et le 10/09. La condition #5 du manifeste reste
satisfaite.

## 2 · Cohérence `site` / `site_id`

```
shifts          site_id distinct de site : 17
mission_catalog site distinct de site_id : 89
```

Identique au 10/09. Ces écarts sont réparés **par** la migration #3 avant
qu'elle ne contraigne ; ils documentent l'ampleur, ils ne décident pas.

## 3 · Résolution du fuseau par site

| site_id | `sites.timezone` déjà présente | `station_config.fuseau_horaire` | repris automatiquement | couvert par décision explicite |
|---|---|---|---|---|
| `site-fantome-test` | false | America/Martinique | true | true |
| `vito-sainte-marie` | false | America/Martinique | true | true |

`colonne_timezone_deja_presente` rend **false** : la migration #4 n'a pas été
appliquée, cette mesure mesure bien l'avant. Deux sites, tous deux repris
automatiquement. Aucun site nouveau non couvert.

`nexus-station-test` n'existe pas en Production : la décision explicite de la
migration le couvre pour rien, ce qui est sans effet.

## 4 · Reprise des services ouverts

```
services_en_cours_total                        26
CANONIQUE  (join employees, join sites)        24
VARIANTE   (site porté par le service)         24
différence symétrique entre les deux ensembles  0 ligne
```

**Seul le résultat canonique porte le critère : 24.**

### Comment le CTE canonique a pu être joué

Le CTE d'origine passe par `employees`, qui était hors du périmètre du rôle.
Sur autorisation explicite de Frédéric Bragance du 11/09, le rôle a reçu le
`SELECT` sur **les deux seules colonnes que la requête lit** :

```sql
grant select (id, site_id) on public.employees to nexus_prod_readonly;
create policy audit_nexus_readonly_select on public.employees
  for select to nexus_prod_readonly using (true);
```

Les sept autres colonnes restent refusées, vérifié une par une :
`nom`, `username`, `role`, `actif`, `est_createur`, `compte_test`, `created_at`.
La table ne porte aucune colonne de PIN ni de coordonnées.

Le CTE a ensuite été exécuté avec son chemin de jointure intact —
`shifts → employees → sites`. La seule substitution est celle déjà actée le
10/09 et documentée en §3 : `sites.timezone` n'existe pas encore, la migration
#4 l'ajoute, donc la pré-image (`station_config.fuseau_horaire` valide, sinon
la décision explicite de la migration) tient sa place. Une requête de pré-mesure
ne peut pas lire l'état d'après.

### Pourquoi les deux résultats coïncident

Non pas par chance, et la coïncidence de deux nombres ne démontrerait rien à
elle seule. Les trois conditions qui les font diverger ont été mesurées, et
valent zéro :

| condition de divergence | mesuré |
|---|---|
| service en cours dont le site diffère de celui de son employé | **0** |
| service en cours dont l'employé est introuvable | **0** |
| service en cours dont le site de l'employé est absent de `sites` | **0** |

Les deux ensembles de `shift_id` sont donc identiques, et la différence
symétrique le confirme directement : zéro ligne dans un sens comme dans l'autre.
La variante n'est pas « équivalente » par principe — elle l'est **aujourd'hui,
sur cet état-là**, parce que ces trois écarts sont nuls. Rien ne garantit
qu'ils le resteront ; c'est le canonique qu'il faudra rejouer dimanche.

### Fenêtre

Écart avec la référence du 08/09 (16) : **facteur 1,63**, sous le seuil de 2
posé par `plan-reparation-rollback-1.md`. La fenêtre reste ouverte sans
explication supplémentaire.

Dix services ouverts de plus en trois jours : **augmentation compatible avec la
persistance de services ouverts sans clôture ; cause individuelle non
attribuée.** Aucun de ces dix n'a été relié à une session, un employé ou un
écran précis — aucune corrélation n'a été établie, et un rapprochement de date
n'en est pas une.

## 5 · Écriture en vol — **INCONNU jusqu'à la gate**

Résultat brut de la première tentative : 1 ligne. **C'était ma propre requête.**
Le motif `ilike '%insert into public.shifts%'` figure littéralement dans le
texte de la sonde, que `pg_stat_activity` expose : la sonde se reconnaissait
elle-même. Rejouée avec le motif reconstruit par concaténation : `0`.

Mais ce zéro-là ne valait rien non plus :

```
current_setting('is_superuser')                           off
pg_has_role(current_user, 'pg_read_all_stats', 'member')  f
onze sessions non-idle avec query = '<insufficient privilege>'
```

Le rôle ne voit le texte d'**aucune** autre session. Un zéro qui vient d'un
aveuglement n'est pas une mesure.

**`pg_read_all_stats` ne sera pas accordé** à `nexus_prod_readonly` : ce droit
livrerait le texte des requêtes de toutes les sessions, donc potentiellement des
données personnelles, des identifiants et des valeurs métier. Le rôle d'audit
n'a pas à les voir.

### Ce que « écriture en vol » veut dire

Une session `active` n'est pas une écriture. Elle peut exécuter un SELECT, un
VACUUM, un `pg_dump` : rien de cela ne verrouille une ligne ni ne menace une
migration. Confondre les deux, c'est encore mesurer un proxy.

La mesure retenue, `outils/mesure-5-ecriture-en-vol-observateur-privilegie.sql`,
ne lit aucun texte de requête. Elle retient une session si **au moins l'une** de
ces deux conditions tient :

- **`backend_xid is not null`** — PostgreSQL n'attribue un identifiant de
  transaction réel qu'au moment où la transaction écrit. Une transaction qui n'a
  fait que lire n'en a pas.
- **un verrou `RowExclusiveLock` ou supérieur** sur `public.shifts`,
  `public.mission_catalog` ou `public.pointages` — les niveaux que seuls
  INSERT / UPDATE / DELETE / DDL prennent ; un SELECT prend `AccessShareLock`,
  qui n'y figure pas.

Aucune des deux ne dépend d'un motif textuel, donc aucune ne peut se
reconnaître elle-même ; `pg_backend_pid()` exclut l'observateur. La sortie ne
porte que du technique : pid, rôle, `application_name`, état, ancienneté, motif.

### Validation de l'instrument, 11/09

Jouée une fois par le connecteur privilégié, uniquement pour prouver qu'elle
s'exécute et qu'elle discrimine :

```
sessions_totales            12
non-idle hors observateur    1
écritures en vol             0
textes masqués (privilégié)  0
```

Une session non-idle, zéro écriture en vol : exactement la distinction que la
mesure du 10/09 ne faisait pas.

**Ceci ne vaut pas mesure de gate.** Le critère #5 reste **INCONNU** jusqu'à son
exécution par un observateur privilégié déjà autorisé, en lecture seule, dans
les minutes précédant la fenêtre de déploiement.

## 6 · `nexus_live_events`

```
table_existe_deja_en_production : false
```

Aucune écriture hors migration n'a créé la table. Rien à remonter.

---

## Ce que cette re-mesure ne dit pas

Elle ne juge pas la fenêtre de déploiement au sens métier. Elle ne mesure ni
PREPROD ni la répétition Test. Et elle ne lève rien : le critère
`aucun_blocage_non_resolu` reste **BLOQUE** par la décision du 11/09, donc le
verdict reste **NON_PRET** et l'autorisation **NON_AUTORISEE**.

## Validité

Ces mesures expirent le **2026-09-12 à 22 h 39 UTC**. La gate du dimanche
13/09 tombe après : **aucune mesure de ce rapport ne peut autoriser la gate de
dimanche.** Le protocole de reprise est dans `protocole-gate-dimanche-1.md`.
