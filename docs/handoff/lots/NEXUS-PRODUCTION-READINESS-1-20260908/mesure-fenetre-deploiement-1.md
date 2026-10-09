# Fenêtre de déploiement — activité mesurée

**10/09/2026.** Mesures en **lecture seule** sur Production
(`uzhjpqpctpvxytxpxoqz`), heures exprimées dans le fuseau de la station
(`America/Martinique`, UTC−4). Aucune écriture.

---

## 1. Activité par heure locale — 30 derniers jours

Prises de poste, missions validées et comptages d'inventaire confondus.

| heure | total | | heure | total | | heure | total |
|---|---|---|---|---|---|---|---|
| 00 h | 1 | | 08 h | **909** | | 16 h | 6 |
| 01 h | 1 | | 09 h | 4 | | 17 h | 7 |
| 02 h | 1 | | 10 h | 25 | | 18 h | 1 |
| **03 h** | **0** | | 11 h | 242 | | 19 h | 35 |
| 04 h | 5 | | 12 h | 2 | | 20 h | 18 |
| 05 h | 72 | | 13 h | 21 | | 21 h | 8 |
| 06 h | 274 | | 14 h | 116 | | 22 h | 3 |
| 07 h | 22 | | 15 h | 122 | | 23 h | 2 |

Les pics (06 h, 08 h, 11 h, 14 h, 15 h) sont portés par les comptages
d'inventaire, pas par les prises de poste.

## 2. Prises de poste — le geste qui casserait le plus visiblement

Vérifié séparément, parce qu'un pic ancien et un pic actuel ne se traitent pas
pareil. **Le pic apparent de 20 h est historique** : 16 occurrences avant les
sept derniers jours, **2** depuis, la plus récente le 07/09.

Sur les **sept derniers jours**, 22 prises de poste au total, soit environ trois
par jour. Heures à **zéro** prise de poste sur cette fenêtre :

> 00 h, 01 h, 02 h, 03 h, 07 h, 11 h, 12 h, 14 h, 16 h, 18 h, 21 h, 23 h

## 3. Deux tâches planifiées écrivent en permanence

| tâche | fréquence | effet |
|---|---|---|
| `nexus-inventaire-reviews` | **toutes les 15 min** | `insert into inventory_reviews`, `insert into inventaire_alertes` |
| `nexus-simulateur-caisse` | **toutes les 15 min** | simule une vente caisse sur `vito-sainte-marie` |

**Aucune heure de la journée n'en est libre.** Choisir une fenêtre « calme »
ne les évite pas : au mieux, on se place entre deux passages.

**Et la promotion remplace la fonction qu'appelle la première.**
`20260905131500_fuseau_horaire_par_site.sql` contient un
`create or replace function public.run_scheduled_inventory_reviews()` — la
fonction exécutée toutes les quinze minutes. Le croisement est donc certain à
brève échéance, pas hypothétique.

Ce croisement n'est pas dangereux en soi : la fonction vérifie l'existence
avant chaque insertion, un passage manqué se rattrape quinze minutes plus tard.
Mais il impose de démarrer **juste après un top de quart d'heure**, pour
disposer de la marge la plus large.

---

## Fenêtre recommandée

> **Dimanche à mercredi, entre 22 h 00 et 23 h 00 locales**
> (soit 02 h 00 – 03 h 00 UTC le lendemain), en démarrant juste après
> `:00`, `:15`, `:30` ou `:45`.

**Pourquoi celle-là, et pas 03 h du matin** — qui est pourtant l'heure la plus
calme, avec zéro activité sur trente jours. Parce que personne n'est là pour
regarder. Une release qui casse à 03 h ne se découvre qu'à 05 h 45, par
l'employé du quart 1, et c'est exactement la personne qu'il ne faut pas
surprendre.

Ce que cette fenêtre offre :

- **la station est fermée depuis 19 h 50** du dimanche au mercredi, et le
  quart 2 est parti à 20 h 10 ;
- **zéro prise de poste à 21 h et 23 h** sur les sept derniers jours, une seule
  à 22 h ;
- **environ sept heures** avant la prise de poste du quart 1 à 05 h 45 — le
  temps de constater, de corriger ou de revenir en arrière ;
- **Frédéric est éveillé**, ce qui est la condition que le silence de 03 h ne
  remplit pas.

Le jeudi au samedi est écarté : la station ferme à 21 h 50 et le quart 2 part à
22 h 10 — la fenêtre chevaucherait la fin de service.

---

## Limites de cette mesure

**La durée de la promotion n'est pas chiffrée.** Le journal de la répétition
n'horodate pas ses étapes : je ne sais pas combien de temps les 26 migrations
prennent réellement. Je ne l'estime pas. À mesurer lors de la prochaine
répétition, ou à constater le jour même — le démarrage après un top de quart
d'heure est précisément la marge qui protège de cette inconnue.

**La mesure est datée du 10/09/2026** et porte sur trente jours. L'usage de
NEXUS est en train de changer : seize quarts sur dix-huit sans mission validée,
et un parcours employé en cours de conception. Une fenêtre choisie sur cette
photographie devra être revérifiée si l'adoption remonte.

**Aucune fenêtre n'est sûre par construction.** Celle-ci minimise le nombre de
personnes exposées et maximise le délai de détection. Elle ne remplace ni le
plan de rollback (`plan-reparation-rollback-1.md`), ni la présence de quelqu'un
pendant l'opération.

**La décision reste celle de Frédéric.** Ce document mesure et recommande ; il
n'autorise rien.
