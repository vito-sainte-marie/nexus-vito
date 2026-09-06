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

## Ordre des étapes — et pourquoi il diffère de la liste initiale

La décision S-5 énumère : départ (étape 5), puis nouvelle prise de poste pour
exercer S-3 (étape 8). **Cet ordre n'exerce pas S-3.** Le déclencheur ne
clôture un service qu'à l'insertion d'un service alors qu'un autre est encore
ouvert ; après le départ, A n'a plus de service en cours, et l'étape 8 ne
serait qu'une insertion ordinaire. S-3 resterait non éprouvé sous RLS réelle.

La deuxième prise de poste est donc placée **avant** le départ. Toutes les
étapes demandées sont conservées, aucune n'est retirée ; seule leur position
change, pour que chaque déclencheur soit réellement sollicité.

| # | Étape | Qui | Ce que je vérifie ensuite |
|---|---|---|---|
| 1 | Ouvrir Inventaire sous A **avant toute prise de poste** | Frédéric (PIN) | Écran d'arrêt, motif « absent » ; **aucune ligne créée** en base |
| 2 | Prise de poste réelle sous A | Frédéric (PIN) | Un service `en_cours`, site et rôle attendus |
| 3 | Ouvrir Inventaire | Frédéric | Une ligne créée portant **exactement** le `shift_id` du service ouvert à l'étape 2 |
| 4 | Pointage d'arrivée si le parcours l'exige | Frédéric | Cohérence `pointages` / `shifts` |
| 5 | **Deuxième prise de poste, sans départ** | Frédéric (PIN) | S-3 : le premier service passe à `termine`, `cloture_source = prise_de_poste_suivante`, `heure_fin` = début du second ; le second est l'unique `en_cours` |
| 6 | Départ réel, avec photo | Frédéric (PIN) | S-2 : le second service se clôt, `cloture_source = pointage_depart`, `heure_fin` cohérente avec l'heure du pointage |
| 7 | Contrôle final | moi | Aucun service `en_cours` pour A ; aucun refus silencieux ; aucune écriture partielle |

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

## Journal du rejeu

*(rempli au fur et à mesure ; aucune étape encore exécutée)*

| # | Résultat | Constaté en base |
|---|---|---|
| 1 | en attente | — |
| 2 | en attente | — |
| 3 | en attente | — |
| 4 | en attente | — |
| 5 | en attente | — |
| 6 | en attente | — |
| 7 | en attente | — |
