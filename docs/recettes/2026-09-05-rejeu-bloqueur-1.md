# Rejeu navigateur réel — fermeture du bloqueur 1

Ouvert le 05/09/2026. Exigé par la décision S-5 et reconfirmé par la décision
Handoff v2. **Le bloqueur 1 ne se ferme pas sans ce rejeu**, et un échec ne
doit jamais être masqué par une correction manuelle en base.

## Ce qu'il s'agit de prouver

S-1 à S-3 ont donné un cycle de vie aux services : reprise et unicité,
clôture au pointage de départ, clôture à la prise de poste suivante. S-4 a
unifié le lecteur, S-5 le rattachement. Tout cela a été éprouvé en base, avec
mes droits. **Rien n'a encore été exercé sous RLS réelle, dans une session
employé.** C'est la seule chose qui manque.

## État de départ, constaté le 05/09/2026 à 20:28 (America/Martinique)

| | |
|---|---|
| Fuseau de la station | `America/Martinique` |
| Heure locale | 20:28, le 05/09/2026 |
| Quart courant | soir — quart 2 va de 13:00/14:00 à 20:00/22:00 |
| `inventaire_quarts` du quart courant | `46fcf220-74f3-44b3-b594-20bae74a3b57` |
| Employé Test A | `868d0b92-bf65-4c99-be43-656911919afd` |
| Services de A | 1 au total, **0 en cours** |
| Pointages de A ce jour | 0 |
| Ligne de A sur le quart courant | **aucune** — le couple est libre |
| Services en cours, tous employés | 2 (Manager Test, Employé Test B) |
| `inventaire_quart_employes` | 6 lignes, **0 avec `shift_id`** |

C'est cet état qui rend le rejeu possible : A est le seul compte vierge pour
la journée, et la contrainte d'unicité `(quart_id, employee_id)` fait qu'un
compte déjà présent sur le quart ne créerait aucune ligne — donc ne prouverait
rien de S-5.

## Ordre des étapes — celui de la décision S-5

Arbitrage du 05/09/2026 : le rejeu suit **l'ordre littéral de la décision
S-5**. J'avais proposé d'avancer la seconde prise de poste avant le départ ;
cet ordre n'est pas retenu.

Conséquence à consigner d'avance, pour qu'elle ne soit pas découverte après
coup : l'étape 8 de la décision demande une nouvelle prise de poste « afin
d'exercer S-3 ». **Dans cet ordre, elle ne l'exercera pas.** Le déclencheur
S-3 ne clôture un service qu'à l'insertion d'un service alors qu'un autre est
encore ouvert ; après le départ de l'étape 5, Employé Test A n'a plus de
service en cours, et l'étape 8 sera une insertion ordinaire. C'est un fait
mécanique, pas une opinion — il sera constaté et rapporté tel quel.

Une **étape 11**, ajoutée à la fin, exerce donc S-3 pour de bon : une
troisième prise de poste alors que le service de l'étape 8 est encore ouvert.
Elle n'altère aucune étape de la décision ; elle vient après.

| # | Étape | Qui | Ce que je vérifie ensuite |
|---|---|---|---|
| 1 | Ouvrir Inventaire **avant toute prise de poste** | Frédéric (PIN) | Écran d'arrêt, motif « absent » ; **aucune ligne créée** |
| 2 | Prise de poste réelle | Frédéric (PIN) | Un service `en_cours`, site et rôle attendus |
| 3 | Ouvrir Inventaire | moi | Ligne créée portant **exactement** le `shift_id` de l'étape 2 |
| 4 | Pointage d'arrivée si le parcours l'exige | Frédéric | Cohérence `pointages` / `shifts` |
| 5 | Départ réel, avec photo | Frédéric | Pointage `depart` enregistré |
| 6 | — | moi | S-2 : service clos, `cloture_source = pointage_depart` ; **aucun service en cours** |
| 7 | — | moi | Cohérence pointage/shift ; aucun refus silencieux ; aucune écriture partielle |
| 8 | Nouvelle prise de poste | Frédéric (PIN) | Nouveau service ; **S-3 non sollicité** — à constater, pas à masquer |
| 9 | — | moi | Ancien service clos, nouveau seul `en_cours` |
| 10 | — | moi | Branches `ROW_COUNT` de S-2/S-3 sous RLS réelle |
| 11 | Troisième prise de poste, service de l'étape 8 **encore ouvert** | Frédéric (PIN) | S-3 réellement exercé : `cloture_source = prise_de_poste_suivante`, `heure_fin` = début du nouveau |

## Points de vigilance

**Refus silencieux.** Un `insert` refusé par la RLS remonte un `42501`. Un
`update` refusé ne remonte rien : zéro ligne modifiée, aucune erreur. C'est
pourquoi S-2 et S-3 contrôlent explicitement `ROW_COUNT` et lèvent si le
compte n'est pas 1. Le rejeu doit confirmer que ces branches ne laissent
jamais une écriture partielle — un pointage enregistré sans clôture, ou
l'inverse.

**Ne rien corriger à la main.** Si une étape échoue, le bloqueur 1 reste
ouvert et l'échec est consigné tel quel. Réparer en base masquerait
précisément ce que le rejeu cherche à établir.

## Journal du rejeu — exécuté le 05/09/2026 de 20:38 à 20:52 (heure station)

Déploiement éprouvé : commit `c2b28c3`, génération `020995cd6b06`, `test`.

| # | Résultat | Constaté en base |
|---|---|---|
| 1 | **PROUVÉ**, par un autre mécanisme qu'annoncé | Aucune ligne créée (6 → 6). La porte d'accès a redirigé vers Prise de poste **avant** qu'Inventaire ne s'initialise : l'écran d'arrêt A11 n'a pas été atteint. Fail-closed réel, prédiction inexacte. |
| 2 | **PROUVÉ** | Service `d73ff4cf`, `en_cours`, `caissiere`, quart `soir`, début 20:39:11. Écran affichant « Quart du soir » sans indication de ma part — contrat C2 vérifié en session réelle. |
| 4 *(avant 3)* | **PROUVÉ** | L'application **exige** le pointage d'arrivée avant Inventaire. Arrivée 20:43:35 avec photo ; `heure_debut_quart` = 20:39:10, soit le début du service courant. |
| 3 | **PROUVÉ — preuve 2 de S-5, en suspens depuis sa fermeture** | Ligne `68e1ee3b` créée avec `shift_id = d73ff4cf`, identique au service courant. Première ligne de l'histoire de la base à porter un rattachement. |
| 5 | **PROUVÉ** | Départ 20:47:37 avec photo. |
| 6 | **PROUVÉ** | S-2 sous RLS réelle : `termine`, `heure_fin` = 20:47:37 **exactement** l'heure du pointage, `cloture_source = pointage_depart`. Aucun service en cours ensuite. |
| 7 | **PROUVÉ** | 0 clôture incomplète, 0 service terminé sans `heure_fin` sur toute la table. Aucune écriture partielle. |
| 8 | **PROUVÉ, et S-3 non sollicité — comme annoncé** | Service `41c935d4` (pompiste, 20:49:20). Le précédent était déjà clos par S-2 ; son `cloture_source` reste `pointage_depart`. |
| 9 | **PROUVÉ** | `41c935d4` unique `en_cours`. |
| 10 | **PARTIEL** | Branches `ROW_COUNT` de S-2 : jamais déclenchées, aucune écriture partielle. Celles de S-3 : **jamais atteintes**, voir ci-dessous. |
| 11 | **ÉCHEC — BLOQUANT PRODUCTION** | Troisième prise de poste refusée : `23505 duplicate key value violates unique constraint "shifts_un_seul_service_en_cours"`. **S-3 n'a pas clôturé le service précédent.** |

## Échec 11 — S-3 n'a jamais fonctionné depuis l'application

L'écran de prise de poste insère `site`, **jamais `site_id`**
([NEXUS-Prise-De-Poste-v1.html:332](../../NEXUS-Prise-De-Poste-v1.html)).
C'est le trigger `shifts_site_unique` qui remplit `site_id`.

Or les triggers `BEFORE` d'un même événement se déclenchent **par ordre
alphabétique de nom**, et `nexus_cloturer_shift_precedent` précède
`shifts_site_unique`. Quand S-3 s'exécute, `new.site_id` vaut donc encore
`NULL`. Sa recherche du service actif porte sur
`sh.site_id = new.site_id` : elle ne trouve rien, conclut « première prise de
poste : rien à clôturer », et rend la main. L'index d'unicité de S-1 refuse
alors l'insertion.

Isolation de la cause, en transaction annulée, hors RLS :

```
A. insert avec site seul (ce que fait l'écran)  : REFUSE — duplicate key … shifts_un_seul_service_en_cours
B. insert avec site_id explicite (mes tests S-3) : ACCEPTE — S-3 a cloture le precedent
```

**Ma validation de S-3 était invalide.** Mes essais fournissaient `site_id`
explicitement — une forme de données que l'application n'envoie jamais. Le
défaut est resté invisible aux étapes 2 et 8 parce qu'aucun service n'y était
ouvert : S-3 n'avait rien à clôturer. Il fallait une véritable prise de poste
*suivante* pour le révéler, c'est-à-dire exactement l'étape que l'ordre de la
décision S-5 ne prévoyait pas d'atteindre.

**Aucune correction n'a été appliquée.** Le service `41c935d4` reste ouvert,
`clotures_par_S3 = 0`, et le bloqueur 1 reste **ouvert**.

## Effet de bord opérationnel

Tant que le défaut subsiste, un employé ayant un service ouvert **ne peut pas
prendre un nouveau poste** : l'insertion est refusée par l'index. Le seul
moyen de repartir est le pointage de départ, qui déclenche S-2. Ce n'est pas
un blocage total, mais c'est un chemin métier légitime aujourd'hui impossible.

## Rejeu correctif — 05/09/2026, 21:02 (heure station)

Migration `20260905213000_prise_de_poste_contrat_unique.sql` appliquée en Test.
Déploiement : commit `bd30c7a`, génération `020995cd6b06`, `coherent = true`.

Le service `41c935d4`, laissé ouvert comme l'exigeait Q18, a servi de
précondition. Troisième prise de poste sous Employé Test A, en session réelle,
par le même parcours qui avait échoué :

| | Avant | Après |
|---|---|---|
| `41c935d4` (pompiste) | `en_cours`, `heure_fin` NULL | **`termine`**, `heure_fin` 21:02:12, `cloture_source = prise_de_poste_suivante` |
| `6f336e94` (renfort) | — | `en_cours`, début 21:02:12, `site` et `site_id` = `nexus-station-test` |

`heure_fin` de l'ancien = `heure_debut` du nouveau, à la seconde. Un seul
service en cours pour A. Sur toute la table : 0 clôture incomplète, 0 service
terminé sans `heure_fin`, 0 incohérence `site`/`site_id`, 0 clôture débordant
sur un autre employé. `clotures_par_S3 = 1`, `clotures_par_S2 = 1`.

**S-3 fonctionne pour la première fois depuis l'application.** Rien n'a été
corrigé à la main : le défaut a été réparé par migration, puis le même geste
qui échouait a été rejoué.
