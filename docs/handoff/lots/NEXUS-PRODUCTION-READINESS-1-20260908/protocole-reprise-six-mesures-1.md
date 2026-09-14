# Reprise des six mesures Production — ce qu'il reste, et rien d'autre

**14/09/2026.** Le blocage fonctionnel Pointage est levé (decision-1.md du lot
NEXUS-POINTAGE-CORRECTIF-1-20260911). Il reste **un seul critère BLOQUE** :
`impacts_production_mesures_horodates`.

Les mesures datent du **11/09/2026 à 22:39 UTC** et valent 24 h. Elles sont
périmées depuis le **12/09 à 22:39 UTC**. Ce n'est pas un défaut : c'est la
règle d'âge qui fait son travail, et elle ne se contourne pas en rééditant un
horodatage.

**Rien de ce document ne s'exécute sans autorisation.** Aucune écriture, aucune
migration, aucune gate proposée avant validation complète.

---

## Avant de mesurer

| | |
|---|---|
| Rôle | `nexus_prod_readonly_login`, membre de `nexus_prod_readonly`, `CONNECTION LIMIT 1` |
| Secret | trousseau local, service `nexus-prod-db-readonly`, compte `nexus` — **jamais affiché, jamais journalisé** |
| Projet | Production `uzhjpqpctpvxytxpxoqz` |
| Requêtes | `preuve-re-mesure-finale-2.md`, à l'identique |

Le rôle porte huit politiques de lecture `audit_nexus_readonly_select` et des
colonnes restreintes. Si une mesure rend **zéro** là où elle rendait un nombre,
vérifier d'abord que ce zéro n'est pas un refus déguisé — c'est le défaut qui a
coûté une demi-journée le 11/09.

## Les cinq mesures du rôle en lecture seule

| # | Mesure | Référence du 11/09 | Bloque si |
|---|---|---|---|
| 1 | Référentiel Advisor | 0 ECRASEE, 0 COMPLETEE, 37 IDENTIQUE | une seule ligne `ECRASEE` |
| 2 | Cohérence `site`/`site_id` | 17 shifts, 89 mission_catalog | écart inexpliqué |
| 3 | Résolution du fuseau | `sites.timezone` ABSENTE, 2 sites repris | un site nouveau non couvert |
| 4 | Reprise des services ouverts, **CTE canonique** | 26 en cours, 24 seraient clos | écart ≥ facteur 2 avec la référence 16 du 08/09, sans explication écrite |
| 6 | `nexus_live_events` | `false` | `true` → **ARRÊT**, écriture hors migration |

**La mesure #4 se joue avec le CTE canonique**, chemin `shifts → employees →
sites` intact. La variante par site porté par le service ne la remplace pas :
elle coïncidait le 11/09 parce que trois écarts valaient zéro, et ces trois
écarts sont à remesurer, pas à supposer.

Attendu en hausse sur #4 : chaque parcours de recette du 13/09 a ouvert puis
clos des services sur Test, pas sur Production. Un écart Production inexpliqué
reste donc un écart.

## La mesure #5, par un observateur privilégié

`outils/mesure-5-ecriture-en-vol-observateur-privilegie.sql`, via le connecteur
Supabase, en lecture seule, **dans les minutes** précédant la fenêtre — c'est
une mesure d'instant, pas un contrôle de la veille.

**Ne pas accorder `pg_read_all_stats`** au rôle d'audit : ce droit livrerait le
texte des requêtes de toutes les sessions.

Une session `active` n'est pas une écriture. Sont retenus : `backend_xid` non
nul — **signal principal** — ou un verrou `RowExclusiveLock` ou supérieur sur
`shifts`, `mission_catalog`, `pointages` — signal complémentaire. Toute
détection entraîne un **arrêt** : ne tuer aucune session, n'improviser aucun
contournement, ne pas attendre en boucle. Rapporter pid, rôle,
`application_name`, état, ancienneté, motif — **aucun texte de requête**.

## Après les mesures

1. `git fetch origin && git rev-parse origin/config-par-environnement` — le SHA
   complet.
2. `gh run list --commit <SHA COMPLET>` — le **complet** ; le court ne filtre
   rien et rend zéro run, ce qui se lit à tort « CI absente ». `push` ET
   `pull_request` en `success`, et les étapes Test du run `push` non `skipped`.
3. `node outils/evaluer-pret-pour-production.js`, **après** le dernier commit
   et après la fin des runs. Vérifier que le SHA imprimé est celui du §1.
4. Lire **la liste complète** des critères, pas seulement le verdict. C'est en
   n'affichant que le verdict que la péremption des mesures est passée
   inaperçue pendant deux jours.

## Ce qui reste interdit jusqu'à validation complète

Aucune écriture Supabase Production. Aucune migration. Aucun déploiement.
Aucune fusion vers `main` ou `production`. **Aucune gate proposée**, et aucune
autorisation suggérée, même si les onze critères ressortent verts — les
critères n'autorisent rien, la gate appartient à Frédéric Bragance.

`outils/correction-horaires-production-a-executer-par-frederic.sql` reste non
appliqué : autorisation distincte, après le rapport.
