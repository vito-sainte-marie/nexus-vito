# Lot A0 — Rapprochement Brief v4 §18.2 / audit #393 §13, fiches de conformité

Statut : document seul. Aucun code, aucune migration, aucune lecture Production. Sources : Brief v4 §18.2 (PR #392, brouillon) et audit des moteurs §13 (PR #393). GO du gérant du 26/11 : lots A0 et A1, sur Test seulement.

## 1. Rapprochement

| Brief v4 §18.2 | Audit #393 | Verdict | Autorité retenue | Lot |
|---|---|---|---|---|
| 1. Commerce : `estProduitAppel` retiré des périodes importées, `vente_boutique` fait autorité | §8, §12.3 ; pas de ligne propre au §13.1 | Brief plus précis que l'audit. Le périmètre est un fait à étiqueter, pas un doublon à supprimer | `vente_boutique` pour le suivi quotidien ; chaque chiffre d'import porte son périmètre | B (affichage) |
| 2. Marge : `detecterEcartsMarge` contre Scanner tarifaire | §12.3 : deux notions de « marge anormale » (écart aux pairs, seuil absolu), aucune lecture croisée ; §13.1 rang 5 : cible 25 % en trois endroits | Confirmé. L'audit ajoute le doublon de cible | `nexus-marge.js` pour l'écart aux pairs ; `tarif_seuils` ou `station_objectifs` pour la cible (§13.5 ordre 7) | A4 puis R |
| 3. Opérations : `calculerStatutOperations`, `chargerConstatTempo` copiés ; écart de caisse « à confirmer » | §12.1 : quatre lectures de la gravité, aucune commune ; §13.1 rang 1 ; §13.5 ordre 1 | **Confirmé et élevé au rang 1.** Le « à confirmer » du Brief est levé : Tempo somme en net, Verify en absolu | `nexus-ecarts-moteur.js`, valeurs absolues (G-7) | **A1** |
| 4. Fuseau : chargeur carburant en UTC | §13.3 : la liste est bien plus large (risques, Conseiller, Tempo, projection A4, rappels, coach FDJ, carburant, inventaire) | Le Brief ne cite qu'un cas sur au moins huit | Une fonction « aujourd'hui de la station » (§13.5 ordre 4) | A3 |
| 5. Note globale recalculée (`construireVerdictDirection`) | §2.3 (écart Boussole / Brief v4) ; §13.1 rang 4 (trois ordres de priorité) | Brief : retirée du premier niveau (§17.2). Reste le doublon Boussole | Boussole garde sa lecture ; le Brief n'en recalcule aucune | B |
| 6. Potentiel compté deux fois | §11, §13.1 rang 6 : trois sens, aucun total légitime | Confirmé, l'audit va plus loin : le total lui-même est illégitime | Une définition nommée par grandeur ; jamais de somme entre natures (principe des trois natures) | R / B |

Points de l'audit absents du Brief §18.2 : ponctualité en quatre versions dont deux sans filtre station (§12.2, §13.2, rang 3) ; niveau « risque avéré » qui noie l'urgence (§5.1, rang 2) ; « jour complet » défini trois fois (§8, rang 7) ; champ FDJ `ecarts` mort (§7.5, rang 9) ; constantes provisoires jamais recalibrées (§13.4). Ils restent hors du lot A1 et sont rangés ci-dessous.

## 2. Lots d'autorité (rappel du plan)

| Lot | Grandeur | Statut |
|---|---|---|
| A1 | Gravité d'un écart de caisse | GO 26/11, Test seulement |
| A2 | Annulation des versements de régularisation (7203252709) | Attend le signal du Guardian |
| A3 | Fuseau de la station | Pas de GO |
| A4 | Niveau/urgence, priorité, ponctualité, filtre station | Pas de GO |

## 3. Fiches de conformité par moteur

Légende : **C** conforme, **P** partiel, **N** non conforme à l'autorité proposée. Lecture du code par l'audit ; non rejoué ici.

| Moteur / fichier | Grandeur | État | Écart constaté | Lot |
|---|---|---|---|---|
| `nexus-ecarts-moteur.js` | Gravité et cycle de vie d'un écart de caisse | **P** | Autorité canonique du cycle de vie et des seuils (l.14) ; n'expose pas de « gravité du jour » en absolu | A1 |
| `nexus-verify-moteur.js` | Écart de caisse | **C** | `max(|piste|, |boutique|)` par audit, sans compensation (l.34). À noter : par audit, pas la somme (G-7 demande la somme des deux valeurs absolues) | A1 (vérifier la différence max / somme) |
| `nexus-tempo.js` | Écart de caisse par jour | **N** | Somme nette (l.181–182) : +50 et −50 donnent 0 | A1 |
| `nexus-tempo.js` | Jour complet, aujourd'hui, mois écoulés | **N** | Trois définitions ; dates en UTC (l.229, 233) | A3 |
| `nexus-rapport-direction-donnees.js` | Écart de caisse | **C** | Relit `audits_caisse` puis `agregerAudits` (l.82) | A1 (inventaire) |
| `nexus-risques-moteur.js` | Niveau, urgence, caisse | **P** | Risque de caisse calculé à part ; « avéré » masque l'urgence (§5.1) | A1 (caisse), A4 |
| `nexus-risques-donnees.js` | Ponctualité A ; chargeurs | **P** | Filtre `site` présent ; fenêtres en UTC | A3, A4 |
| `nexus-brief-donnees.js` | Ponctualité B, FDJ référence | **N** | Pointages sans filtre station (l.633–646) ; `fdj_stock_reference_lignes` l.136 | A4 |
| `nexus-app-donnees.js` | Ponctualité C | **N** | Sans filtre station ni fenêtre (l.73–80) | A4 |
| `nexus-conseiller-donnees.js` | `calculerStatutOperations`, `chargerConstatTempo` | **N** | Copie du statut Opérations ; le Brief en garde des alias | A1 (statut), A3 |
| `nexus-conseiller.js` | Priorité, graine du jour | **N** | Trois ordres ; graine en UTC (§6.2–6.3) | A3, A4 |
| `nexus-secteurs-moteur.js` | Secteurs Brief | **P** | Constantes provisoires ; recalculs listés au §18.2 | B |
| `nexus-boussole-moteur.js` | Score par secteur | **C** | Mécanique propre ; écart avec Brief v4 §2.3 documenté | — |
| `nexus-marge.js` | Écart aux pairs | **C** | Autorité pour l'écart aux pairs ; deux comptes de marge jamais fusionnés (§1.2) | A4 |
| `nexus-pointage-regles.js` | Retard d'un pointage | **C** | `null` = non calculable ; consommée par A à C | — |
| `nexus-paye-moteur.js` | Retards payés | **C** (par décision) | Retard saisi, non dérivé du pointage ; à mentionner à l'écran | — |
| `nexus-fdj-moteur.js` | Cycle de vie de l'écart FDJ | **C** | Délègue à `nexus-ecarts-moteur.js` | — |
| `nexus-carburant-moteur.js` | Potentiel carburant | **P** | Sens propre de « potentiel » (l.1377–1398) ; dates UTC | A3, R |
| `nexus-coach-fdj-donnees.js` | Référence FDJ | **P** | `fdj_stock_reference_lignes` sans filtre `site` (l.81), table commune ou par station à vérifier | A4 |

## 4. Écarts à signaler au Guardian

1. **Max contre somme.** G-7 retient la somme `|piste| + |boutique|` par poste. Verify retient le maximum des deux par audit. Les deux sont « sans compensation » mais ne donnent pas le même nombre : +10 piste et −10 boutique donnent 20 en somme, 10 en maximum. Le comptage « piste dominante / boutique dominante » de Verify suppose le maximum. A1 dira, écran par écran, ce qui change.
2. **Le Brief ne voit qu'un fuseau sur huit.** Le lot A3 serait plus large que l'item 4 du §18.2.
3. **La liste des alias du Brief** (item 3) est à vérifier dans le code de `origin/production` au moment d'A1, pas ici : cette fiche ne la prouve pas.
