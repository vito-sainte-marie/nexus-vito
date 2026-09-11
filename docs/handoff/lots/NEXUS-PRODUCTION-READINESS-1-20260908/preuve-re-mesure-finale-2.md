# Re-mesure finale — exécution du 11/09/2026, avec un rôle réellement limité

**11/09/2026, 22 h 39 UTC** (18 h 39 heure de Martinique). Projet Production
`uzhjpqpctpvxytxpxoqz`. Exécutant : `nexus_prod_readonly_login`, membre de
`nexus_prod_readonly`, `connection limit 1`, mot de passe lu dans le trousseau
local et jamais affiché.

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
services_en_cours_total                    26
services qui seraient clos sans pointage   24
shifts en_cours dont le site est introuvable  0
```

**Écart avec la référence du 08/09 (16) : facteur 1,63.** Sous le facteur 2 posé
par `plan-reparation-rollback-1.md` — la fenêtre reste ouverte sans explication
supplémentaire. La progression est cohérente avec le défaut du parcours
Caissière : l'écran continue de créer des services que personne ne ferme. Dix
de plus en trois jours.

**Limite à ne pas maquiller.** Le CTE d'origine passe par
`employees.site_id`. La table `employees` est hors du périmètre autorisé du
rôle, volontairement. La variante jouée ici prend le site porté par le service
lui-même (`coalesce(shifts.site_id, shifts.site)`). Les deux ne coïncident que
si aucun service n'est rattaché à un site différent de celui de son employé —
**ce que cette mesure ne peut pas vérifier**. Le nombre 24 est un fait sur la
variante ; son équivalence au CTE de la migration est **INCONNUE**.

Ce que la mesure établit tout de même : les 26 services en cours portent tous
un site résoluble (0 orphelin), donc la variante ne perd aucune ligne.

## 5 · Absence d'écriture concurrente — **INCONNU**

Résultat brut de la première tentative : 1 ligne. **C'était ma propre requête.**
Le motif `ilike '%insert into public.shifts%'` figure littéralement dans le
texte de la sonde, que `pg_stat_activity` expose ; la sonde se reconnaissait
elle-même. Rejouée avec le motif reconstruit par concaténation :

```
moi : 0 · autres visibles : 0 · masquées : 0
```

Et la raison de fond :

```
current_setting('is_superuser')                          off
pg_has_role(current_user, 'pg_read_all_stats', 'member')  f
onze sessions non-idle avec query = '<insufficient privilege>'
```

Onze sessions tournent, et le rôle ne voit le texte d'**aucune**. Cette mesure
ne peut pas être rendue par un rôle correctement restreint : elle exige
`pg_read_all_stats`, c'est-à-dire précisément l'élargissement que le mandat
interdit.

**Statut : INCONNU, pas OK.** Le 10/09, la même mesure avait été déclarée « 0
écriture en vol » — c'était faux au sens strict : elle avait été jouée par un
rôle privilégié, et le zéro observé aujourd'hui par un rôle aveugle aurait été
lu de la même façon. Une mesure qui rend zéro parce qu'elle ne voit rien n'est
pas une mesure.

Elle reste de toute façon qualifiée d'heuristique par
`re-mesure-finale-gate-1.md`. La décision de fenêtre s'appuie sur
`mesure-fenetre-deploiement-1.md`, pas sur elle.

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
13/09 tombe après : elles devront être rejouées.
