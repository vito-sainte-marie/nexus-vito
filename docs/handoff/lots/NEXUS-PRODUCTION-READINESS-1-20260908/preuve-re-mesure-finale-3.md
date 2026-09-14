# Re-mesure Production du 14/09/2026

**14/09/2026, 13 h 42 UTC** (09 h 42 heure de Martinique). Projet
`uzhjpqpctpvxytxpxoqz`. Mesures #1 à #4 et #6 par `nexus_prod_readonly_login`,
secret lu au trousseau et jamais affiché ; `default_transaction_read_only`
confirmé à `on` par la base elle-même. Mesure #5 par le connecteur privilégié.

Remplace `preuve-re-mesure-finale-2.md`, périmée depuis le 12/09 à 22:39 UTC.

---

## 1 · Référentiel Advisor

| verdict | lignes |
|---|---|
| IDENTIQUE | **37** |
| COMPLETEE | 0 |
| **ECRASEE** | **0** |

Inchangé depuis le 09/09. Condition #5 du manifeste satisfaite.

## 2 · Cohérence `site` / `site_id`

```
shifts          site_id distinct de site : 17
mission_catalog site distinct de site_id : 89
```

Identiques au 10/09 et au 11/09. Réparés **par** la migration #3 avant qu'elle
ne contraigne.

## 3 · Résolution du fuseau

| site | `sites.timezone` présente | `station_config` | repris automatiquement |
|---|---|---|---|
| `site-fantome-test` | false | America/Martinique | true |
| `vito-sainte-marie` | false | America/Martinique | true |

`sites.timezone` reste **absente** : la migration #4 n'est pas appliquée, cette
mesure mesure bien l'avant. Aucun site nouveau non couvert.

## 4 · Reprise des services ouverts — CTE canonique

```
services_en_cours_total            30
CANONIQUE : seraient clos          28
```

Chemin `shifts → employees → sites` intact. Les trois conditions de divergence
ont été remesurées, pas supposées, et valent toutes **zéro** :

| condition | mesuré |
|---|---|
| site du service ≠ site de l'employé | 0 |
| employé introuvable | 0 |
| site de l'employé absent de `sites` | 0 |

### La tendance, qui compte plus que le nombre

| date | services en cours | rapport à la référence 16 du 08/09 |
|---|---|---|
| 08/09 | 16 | référence |
| 11/09 | 26 | 1,63 |
| **14/09** | **30** | **1,88** |

Le seuil du `plan-reparation-rollback-1.md` est **le facteur 2, soit 32**. Au
rythme observé — quatorze services en six jours, environ deux par jour — il
sera franchi **d'ici un à deux jours**.

Ce n'est pas une alarme, c'est une échéance : passé 32, la migration #6 ne peut
plus être exécutée sans une explication écrite de l'écart. La fenêtre
raisonnable pour appliquer la release se referme d'elle-même, et elle se
referme par le défaut que la release répare.

## 5 · Écriture en vol — observateur privilégié

`outils/mesure-5-ecriture-en-vol-observateur-privilegie.sql`, en lecture seule.
`pg_read_all_stats` n'a pas été accordé au rôle d'audit et ne le sera pas.

```
0 ligne
```

Aucune session ne porte de transaction écrivante ni de verrou
`RowExclusiveLock` ou supérieur sur `shifts`, `mission_catalog`, `pointages`.
Aucun texte de requête n'a été lu ni rapporté.

**Cette mesure ne vaut PAS pour la gate.** C'est une mesure d'instant : prise à
09 h 42, elle ne dit rien de la fenêtre de 22 h–23 h. Elle devra être rejouée
dans les minutes qui la précèdent. Ce qu'elle établit aujourd'hui, c'est que
l'instrument fonctionne et qu'aucune écriture ne tourne en ce moment.

## 6 · `nexus_live_events`

```
existe déjà en Production : false
```

Aucune écriture hors migration n'a créé la table.

---

## Validité

Ces mesures expirent le **2026-09-15 à 13 h 42 UTC**. La fenêtre de
déploiement est 22 h–23 h locales, soit 02 h–03 h UTC le lendemain : une
application ce soir tomberait **dans** la validité, une application demain soir
non.

## Ce que cette re-mesure ne lève pas

Rien. Elle rend le critère `impacts_production_mesures_horodates` frais ; elle
n'autorise aucun déploiement et ne vaut pas gate. Les onze critères
n'autorisent rien : la gate appartient à Frédéric Bragance.
