# Horaires canoniques — ce que NEXUS porte, et les écarts

**09/09/2026.** Horaires donnés par Frédéric Bragance comme définitifs pour
Vito Sainte-Marie Usine. Comparés à `station_config.horaires` lu **en lecture
seule** sur Production le même jour. Aucune écriture, aucune correction
appliquée : corriger la configuration de Production est une opération
Production, donc un geste de Frédéric.

## Les horaires canoniques

| Jours | Quart 1 | Quart 2 | Station ouverte |
|---|---|---|---|
| dimanche → mercredi | 5 h 45 – 13 h 15 | 12 h 40 – 20 h 05 | 6 h 00 – 19 h 50 |
| jeudi → samedi | 5 h 45 – 14 h 15 | 13 h 40 – 22 h 05 | 6 h 00 – 21 h 50 |

Règles : arrivée du Q1 quinze minutes avant l'ouverture ; départ du Q2 quinze
minutes après la fermeture ; chevauchement de trente-cinq minutes.

## Ce que Production porte aujourd'hui

```json
"quart1": { "normal": "05:45", "fin_normal": "12:45",
            "etendu": "05:45", "fin_etendu": "13:45" },
"quart2": { "normal": "12:40", "fin_normal": "20:05",
            "etendu": "13:40", "fin_etendu": "22:05" },
"renfort": { "debut": "09:00", "fin": "17:00",
             "pause_debut": "13:00", "pause_fin": "14:00" },
"temps_habillage_min": 15
```

**La structure est la bonne.** `normal` correspond à dimanche–mercredi,
`etendu` à jeudi–samedi — l'écran Paramètres Station étiquette d'ailleurs ces
champs « Jeudi à Samedi » en toutes lettres. Et `temps_habillage_min: 15` porte
déjà la règle des quinze minutes.

---

## Écart 1 — Le quart 1 finit trente minutes trop tôt, les deux groupes de jours

| | en base | canonique | écart |
|---|---|---|---|
| fin Q1 dimanche–mercredi | 12:45 | **13:15** | 30 min |
| fin Q1 jeudi–samedi | 13:45 | **14:15** | 30 min |

Le quart 2 est **exact** des deux côtés : 12:40 → 20:05 et 13:40 → 22:05.

**Conséquence directe, et c'est elle qui prouve l'erreur** : la règle de
chevauchement de trente-cinq minutes est cassée. En base, le chevauchement vaut
**cinq minutes** dans les deux cas. Avec les horaires canoniques, il vaut bien
trente-cinq minutes des deux côtés. Le contrôle croisé tombe juste, ce n'est pas
une interprétation.

---

## Écart 2 — NEXUS bascule au quart 2 une heure trop tôt, trois jours sur sept

`NexusStation.seuilDeBascule` lit **`horaires.quart2.normal`**, soit `12:40`, et
l'applique **tous les jours**, sans regarder lequel. `NEXUS-Prise-De-Poste`
s'en sert pour afficher « matin » ou « soir » et pour enregistrer le quart.

| Jeudi, 13 h 00 | |
|---|---|
| ce que NEXUS dit | quart 2 |
| la réalité | le quart 2 commence à **13 h 40**, et le quart 1 court jusqu'à **14 h 15** |

**Du jeudi au samedi, entre 12 h 40 et 13 h 40**, un employé qui prend son poste
est enregistré sur le mauvais quart. Une heure, trois jours par semaine.

Le dimanche au mercredi, 12 h 40 tombe dans le chevauchement réel : le seuil est
alors défendable.

**Ce n'est pas la même chose que le moteur carburant.** Celui-ci prend
délibérément l'horaire étendu (`fenetreQuartLarge`) pour être prudent sur
l'isolation d'une fenêtre — « mieux vaut déclarer chevauche à tort que
l'inverse ». J'ai vérifié avant de conclure : ce choix-là est sain et n'est pas
en cause.

---

## Écart 3 — Les horaires d'OUVERTURE n'existent pas dans le modèle

`station_config.horaires` ne porte que les quarts. L'ouverture de la station —
6 h 00 – 19 h 50, et 6 h 00 – 21 h 50 du jeudi au samedi — **n'est stockée nulle
part**.

Elle est pourtant nécessaire au parcours : « votre poste commence à 6 h 00 »
n'est pas l'heure du quart (5 h 45), c'est l'heure d'ouverture. Aujourd'hui,
cette phrase ne peut être ni affichée ni vérifiée.

---

## Deux points à trancher avant que je touche à quoi que ce soit

**La durée annoncée du quart 2.** Les horaires donnent 12 h 40 → 20 h 05, soit
**7 h 25**, et 13 h 40 → 22 h 05, soit **8 h 25**. Les durées annoncées sont
7 h 30 et 8 h 30. Cinq minutes d'écart, sur le quart 2 seulement — le quart 1
tombe exactement juste. Faut-il lire 20 h 10 et 22 h 10, ou la durée
est-elle nominale ?

**Le renfort — TRANCHÉ le 09/09/2026 par Frédéric Bragance : les horaires sont
bons.** Renfort 9 h 00 – 17 h 00, pause 13 h 00 – 14 h 00. Rien à corriger, et
la mise à jour de Production laisse ce bloc intact.

### Mais cette confirmation en révèle un quatrième

**Le planning connaît TROIS quarts, l'exécution n'en connaît que deux.**

`planning_shifts.quart` et `planning_regles_effectif.quart` acceptent tous deux
`quart1`, `quart2` et **`renfort`**. L'écran Planning lui donne son libellé et
sa couleur. Le renfort est donc un quart de plein droit côté planification.

Côté exécution, `quartDepuisMinutes` ne sait rendre que `'1'` ou `'2'`. La
prise de poste écrit cette valeur dans `shifts.quart` : **un renfort est
enregistré « matin » ou « soir », jamais « renfort »**.

Ce n'est pas théorique. Sur les deux seuls quarts engagés de la station depuis
le 04/09, **celui qui a validé 64 missions le 08/09 est un renfort.** L'employé
le plus engagé de la mesure travaille dans le régime que l'exécution ne sait pas
nommer.

**Et ça touche directement le parcours.** Un renfort arrive à 9 h, après la
prise en main du quart 1, et part à 17 h, avant le relais du quart 2. Les
moments `ouverture` et `relais` ne lui vont ni l'un ni l'autre. Le vocabulaire
des moments doit donc valoir pour un service qui n'est ni Q1 ni Q2 — sinon le
renfort recevra les missions d'ouverture à 9 h du matin.

**À trancher :** `shifts.quart` doit-il accepter `renfort`, et la prise de poste
doit-elle le proposer quand l'employé est planifié comme tel ? Je ne l'ai pas
fait : c'est un changement de schéma et de parcours, pas une correction.

---

## Ce que je propose, et qui décide de quoi

| Correction | Où | Qui |
|---|---|---|
| Fin Q1 : `12:45 → 13:15` et `13:45 → 14:15` | `station_config` **Production** | **Frédéric** — opération Production |
| Horaires d'ouverture de la station | nouveau champ, à concevoir | à cadrer ensemble |
| Bascule de quart consciente du jour | `nexus-station.js` | moi, après ton arbitrage sur le comportement attendu |
| Instantané de recette rendu fidèle à la forme de Production | Test | moi |

**Je n'ai rien appliqué.** La correction de Production est à toi ; celle du
seuil de bascule attend que tu dises ce que NEXUS doit répondre entre 12 h 40 et
13 h 40 un jeudi — le quart 1, puisqu'il est encore ouvert, ou une bascule
avancée assumée.

---

## Pourquoi ça passe avant le placement des missions

Le placement range les missions dans des moments du quart. Si NEXUS se trompe
de quart trois jours sur sept, les missions du matin remonteront à quelqu'un qui
commence l'après-midi, et l'inverse.

Un employé qui prend son poste un jeudi à 13 h et lit « quart du soir » alors
qu'il fait le quart du matin n'a pas besoin d'un parcours guidé pour conclure
que NEXUS ne fonctionne pas. Il l'a déjà conclu.
