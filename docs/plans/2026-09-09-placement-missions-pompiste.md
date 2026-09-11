# Placement des 23 missions du pompiste — feuille d'arbitrage

**09/09/2026.** Les 23 missions sont relevées en lecture seule sur Production
(`mission_catalog`, station réelle, `actif = true`, `role_required` contenant
`pompiste`). Aucune n'est inventée, aucun `pourquoi` n'est réécrit.

**Ce document ne place pas d'autorité.** Il place ce que les missions
**déclarent elles-mêmes**, laisse vide ce qu'elles ne déclarent pas, et te rend
la décision. Un placement deviné enverrait quelqu'un nettoyer la piste pendant
une livraison.

---

## D'abord : dans quoi place-t-on ?

`time_window` porte aujourd'hui une **heure** — `avant-06:00`, `avant-13:00`.
C'est juste pour l'ouverture de la station, qui est un fait d'horloge.

**Ça casse pour tout ce qui est relatif au quart.** « Ronde de sécurité
(fermeture) » se place à 13 h pour le Q1 et à 20 h pour le Q2 : une heure ne
peut pas l'exprimer une seule fois. Le pompiste Q2 hériterait des consignes du
matin, ou de rien.

**Proposition : placer par MOMENT, pas par heure.** Un moment se dit une fois et
vaut pour les deux quarts. Les deux heures existantes restent où elles sont
quand elles décrivent vraiment l'horloge.

| Moment | Quand | Ce qu'il porte |
|---|---|---|
| `ouverture` | avant l'accueil du public, station fermée | les gestes qui ne peuvent se faire qu'à ce moment-là |
| `prise-en-main` | premières minutes du quart, quel qu'il soit | ce qui sécurise le départ du service |
| `service` | pendant l'accueil des clients | ce qui se fait entre deux clients, sans monopoliser |
| `evenement` | déclenché par le réel, jamais planifié | livraison, anomalie, incident |
| `relais` | dernière demi-heure du quart | ce qui prépare la transmission |

`ouverture` et `prise-en-main` se confondent pour le Q1 du matin et se
séparent pour le Q2 : c'est justement pourquoi ils sont distincts.

**Et ils doivent valoir pour le RENFORT**, confirmé le 09/09/2026 comme
travaillant de 9 h à 17 h avec pause. Il arrive après la prise en main du Q1 et
part avant le relais du Q2 : `ouverture` ne le concerne jamais, et son
`prise-en-main` tombe à 9 h. Un vocabulaire de moments attaché aux horaires du
quart 1 lui enverrait les missions d'ouverture en milieu de matinée. Ce n'est
pas un cas marginal : l'employé le plus engagé de toute la mesure, 64 missions
le 08/09, est un renfort.

**À trancher :** ce vocabulaire te convient-il, ou faut-il d'autres moments ?

---

## Ce que les missions déclarent elles-mêmes — 10 sur 23

Placées sur **preuve textuelle**, pas sur intuition : le titre ou le `pourquoi`
nomme le moment. À confirmer d'un mot, ou à corriger.

| # | Mission | Titre | Ce qui le déclare | Moment |
|---|---|---|---|---|
| 1 | `CHK-004` | Ouverture station | `time_window = avant-06:00` déjà posé · critique · 20 min | `ouverture` |
| 2 | `SOP-26` | Relevé jaugeage carburant (matin) | `time_window = avant-13:00` déjà posé · titre « matin » · 8 min | `ouverture` |
| 3 | `CHK-047` | Relevé d'index (prise de poste) | titre : « (prise de poste) » | `prise-en-main` |
| 4 | `CHK-048` | Comptage gaz et glaçons (prise de poste) | titre : « (prise de poste) » | `prise-en-main` |
| 5 | `CHK-046` | Nettoyer la piste et ses abords | pourquoi : « en début de service » | `prise-en-main` |
| 6 | `CHK-052` | Nettoyer les pompes | pourquoi : « en prise de poste » | `prise-en-main` |
| 7 | `CHK-051` | Vider les poubelles extérieures de la piste | pourquoi : « en début de quart » | `prise-en-main` |
| 8 | `SOP-11` | Ronde de sécurité (fermeture) | titre : « (fermeture) » | `relais` |
| 9 | `CHK-059` | Nettoyage final piste | titre « final » · pourquoi : « en fin de service » | `relais` |
| 10 | `CHK-060` | Nettoyage final boutique | titre « final » · pourquoi : « fin de service » | `relais` |

---

## Ce que je déduis, et que je ne pose pas — 3 sur 23

Ces trois-là ne nomment aucun moment, mais leur **nature** en désigne un. C'est
une déduction, pas une déclaration : elle t'est soumise, elle n'est pas
appliquée.

| # | Mission | Titre | Déduction | Moment déduit |
|---|---|---|---|---|
| 11 | `SOP-05` | Sécurisation livraison carburant | critique · 20 min · ne se planifie pas, se déclenche | `evenement` |
| 12 | `CHK-061` | Signaler une anomalie technique | haute · preuve exigée · est la réponse à un fait | `evenement` |
| 13 | `CHK-022` | Aide ponctuelle en poste | pourquoi : « surcharge ponctuelle d'un collègue » | `evenement` |

---

## Ce que je laisse VIDE — 10 sur 23

Aucune de ces missions ne dit quand elle se fait, et rien dans le modèle ne
permet de le déduire honnêtement. **Ce sont elles qui attendent ton ordre.**

| # | Mission | Titre | Prio | Durée | Preuve | Moment |
|---|---|---|---|---|---|---|
| 14 | `CHK-049` | Installer les extincteurs à leur emplacement | critique | 5 min | oui | — |
| 15 | `CHK-062` | Contrôle des équipements de service | haute | 5 min | oui | — |
| 16 | `CHK-023` | Renseigner et orienter les clients | normale | 3 min | non | — |
| 17 | `CHK-063` | Nettoyer les poignées et écrans des pompes | normale | 5 min | non | — |
| 18 | `CHK-053` | Balayer et nettoyer la piste | normale | 5 min | oui | — |
| 19 | `CHK-054` | Enlever les déchets de la piste et des abords | normale | 5 min | oui | — |
| 20 | `CHK-055` | Ranger les produits d'entretien dans le local prévu | normale | 5 min | oui | — |
| 21 | `CHK-056` | Vider les poubelles | normale | 5 min | oui | — |
| 22 | `CHK-057` | Respecter le tri sélectif | normale | 5 min | oui | — |
| 23 | `CHK-058` | Plier et stocker les cartons à l'endroit prévu | normale | 5 min | oui | — |

### Deux remarques sur ce lot, avant que tu tranches

**`CHK-049` est critique et n'a pas de moment.** Des extincteurs à leur place
est une obligation de sécurité ; la laisser flotter dans le quart est le seul
placement qui me paraisse franchement mauvais, quel que soit celui que tu
choisis.

**Sept des dix sont du nettoyage et des déchets**, tous à 5 minutes et priorité
normale. Si elles atterrissent toutes dans le même moment, ce moment redevient
une liste de sept — exactement ce que le parcours doit supprimer. Deux façons de
l'éviter, et c'est ton choix : les répartir entre `prise-en-main`, `service` et
`relais` ; ou n'en proposer qu'une à la fois, en rotation.

---

## Comment me répondre

Le plus court : `14 → service`, `15 → prise-en-main`, etc. Une ligne par
mission, ou par groupe. Corrige aussi les 10 premières si l'une est mal placée —
elles sont proposées, pas acquises.

Il me faut aussi ta réponse sur trois points :

1. **Le vocabulaire des moments** ci-dessus te convient-il ?
2. **Le lot nettoyage** : réparti, ou en rotation ?
3. **`CHK-004` et `SOP-26`** gardent-elles leur heure, ou passent-elles au
   moment `ouverture` ? Garder les deux systèmes en parallèle est possible mais
   se paiera plus tard.

---

## Ce que ce placement produira

Une fois l'ordre donné, l'écriture est mécanique : une migration qui pose
`time_window` sur 23 lignes de `mission_catalog` pour la station, avec sa
migration jumelle pour le site de recette, et une épreuve qui vérifie qu'aucune
mission active du pompiste ne reste sans moment.

C'est ce qui débloque le **Moment 3 — Service actif**, aujourd'hui impossible :
sans placement, « la prochaine action utile » retombe sur un tri par priorité,
c'est-à-dire sur la liste des 23.
