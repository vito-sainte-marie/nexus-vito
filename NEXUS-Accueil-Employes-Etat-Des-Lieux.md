# Accueil employés — état des lieux avant travaux

Branche `accueil-employes-20260918`, partie de `52cd4a4` (Production du 18/09,
hotfix Angélique inclus). Ce document a d'abord constaté l'existant, puis
proposé un périmètre à arbitrer.

> **Mise à jour du 18/09/2026.** Le périmètre a été arbitré depuis (voir §4) et
> un premier lot est livré sur cette branche : « l'accueil hors service ». Les
> numéros de ligne cités plus bas ont été retirés : ils périmaient à chaque
> commit, et un repère faux est pire qu'un repère absent. Les symboles cités
> (`initAccueilEmploye`, `CAPACITES_ROLE_DEFAUT`, …) se retrouvent par
> recherche dans `NEXUS-App-v1.html`.

---

## 1. Ce qui existe déjà, et qui est bon

L'accueil employé n'est pas une page laissée de côté. Il a son propre
orchestrateur, `initAccueilEmploye()` (dans `NEXUS-App-v1.html`), issu de la
refonte du 20/08/2026, et il est **piloté par le rôle du jour**, pas par le
rôle habituel de la fiche :

* `CAPACITES_ROLE_DEFAUT` — matrice rôle du jour → modules (FDJ,
  réception carburant), combinée aux réglages de site existants (forfait
  Professional, `reception_carburant_role`) sans les remplacer.
* `roleADroitModule()` — rôle inconnu ⇒ on **n'interdit pas**, on
  laisse passer (Article 5). Le bon réflexe.
* Les missions obligatoires, l'inventaire, FDJ, la réception et le jaugeage
  sont filtrés par ce même rôle du jour, avec les cas particuliers documentés
  (un renfort n'a pas de comptage, on n'interroge même pas la table).

**Conséquence directe du hotfix d'aujourd'hui, et elle est correcte** : un
pompiste qui prend désormais un poste de caissière voit l'accueil d'une
caissière — FDJ inclus. Rien à corriger de ce côté, la chaîne est cohérente.

## 2. Les trois écarts constatés

### 2.1 — `polyvalent` est un rôle du jour impossible à choisir

`polyvalent` existe en base (`shifts.role`, `mission_catalog.role_required`),
il est traité par la matrice de l'accueil et porte un libellé
(`LIBELLE_ROLE_JOUR`). Il est également géré par
`NEXUS-Assignations-v1.html`.

Mais `NEXUS-Prise-De-Poste-v1.html` ne propose que quatre rôles — pompiste,
caissière, renfort, manager. Un employé assigné « polyvalent » ne peut pas
prendre ce poste lui-même ; il le reçoit par assignation ou pas du tout.

C'est soit un rôle à retirer du code, soit un rôle à rendre sélectionnable.
Les deux se défendent ; ce qui ne se défend pas, c'est qu'il vive à moitié.

### 2.2 — La granularité de visibilité s'arrête à « manager / tous »

`PAGES_INDEX` ne connaît que trois valeurs de `role` : `all`, `manager`,
`createur`. Toute finesse par rôle du jour est donc codée en dur, au cas par
cas, dans le filtre de recherche :

* Pointage masqué si le site l'a désactivé ;
* Inventaire masqué pour un renfort.

Deux exceptions aujourd'hui, écrites à la main. C'est tenable à deux ; ça ne
l'est plus à six, et c'est la trajectoire connue de cet écran.

### 2.3 — La note de conception de l'accueil ne parle pas des employés

`NEXUS-Refonte-Accueil-Note-Conception.md` (24/07/2026) cadre l'accueil **du
Directeur** : Indice NEXUS, Capital NEXUS, Conseiller, 3 décisions. Le mot
« employé » n'y désigne que des écrans à ranger au niveau 4.

L'accueil employé a bien été refondu depuis (20/08), mais **sans note de
conception équivalente**. Les règles vivent dans les commentaires du code, qui
sont excellents et datés, mais dispersés. C'est ce qui rend aujourd'hui
difficile de répondre à « que doit voir Angélique en ouvrant NEXUS ? » sans
relire six cents lignes.

## 3. Périmètre proposé, par ordre de valeur

| # | Travail | Pourquoi maintenant | Risque |
|---|---|---|---|
| 1 | Trancher `polyvalent` : le rendre sélectionnable ou le retirer | Incohérence visible en base, et le hotfix du jour vient de rouvrir le sujet des rôles | Faible |
| 2 | Porter la finesse « rôle du jour » dans `PAGES_INDEX` | Supprime les exceptions codées en dur avant qu'elles se multiplient | Moyen — touche la navigation de tous |
| 3 | Écrire la note de conception « Accueil employés » | Fixe la règle hors du code, comme l'a été la règle de pointage | Nul |

## 4. Le périmètre arbitré, et ce qui a été livré

Cette section demandait un arbitrage ; il a été rendu le 18/09/2026 : « le
parcours doit guider Angélique et les autres employés : prendre ou reprendre
leur poste, voir leur rôle du jour, comprendre la prochaine action et accéder
directement aux missions correspondantes ».

Ce n'est aucun des trois lots proposés ci-dessus — c'est un quatrième écart,
que le tableau ne voyait pas parce qu'il regardait le code plutôt que l'écran
tel qu'un employé le reçoit. **Depuis le 16/09/2026, l'accueil est en catégorie
`consultation` : on peut l'ouvrir sans avoir pris son poste**, alors qu'il
était resté écrit pour quelqu'un en service.

### 4.1 — Lot livré : « l'accueil hors service »

Une seule notion introduite, `enService` — le service ouvert **aujourd'hui**, et
lui seul (un quart laissé ouvert la veille n'en est pas un, même règle que
l'écran Pointage). Six conséquences :

| Avant | Après |
|---|---|
| « Votre service est en cours · 3 actions à terminer », sans service | « Aucun poste en cours », ou « Consultation externe » |
| Prochaine action « Pointer l'arrivée » | « Prenez votre poste pour démarrer votre service » → prise de poste |
| Inventaire / FDJ / réception / jaugeage prescrits sans quart | Aucun contrôle de quart hors quart |
| Tuiles Missions / Inventaire / FDJ qui **rebondissent** (catégorie `operationnel`) | Les écrans réellement atteignables, plus le geste qui débloque le reste — *hors service seulement ; voir §4.1 bis* |
| Barre de progression à 0 % sur une journée qui n'a pas commencé | Barre masquée — et **toujours cochée** sur une journée terminée |
| Rôle du jour inconnu ⇒ ligne de statut sans rôle | Rôle affiché brut (même esprit que l'Article 5) |

**Ce que le lot ne fait pas, volontairement** : aucune écriture, aucune
redirection d'office. L'accueil propose la prise de poste, il ne l'impose pas —
« l'authentification n'est jamais une preuve de présence », et le seul `insert`
sur `shifts` reste le bouton « Confirmer » de la prise de poste.

### 4.1 bis — Second lot : « en service ne suffit pas »

La ligne « tuiles qui rebondissent » du tableau ci-dessus était **plus large que
le correctif du matin**. `nexusRequireAuth` a deux portes, pas une :

1. `nexusPriseDePosteManquante` — exige un service ouvert **aujourd'hui** ;
2. `nexusPointageArriveeManquant` — exige **en plus** l'arrivée pointée **de la
   journée**, et renvoie sinon toute page `operationnel` vers le pointage.

Le premier lot ne fermait que la première. Mesuré sur Test le 18/09/2026 : un
pompiste en service mais sans arrivée pointée (S2) et une caissière
`professional` dans le même état (S5) recevaient Missions, Inventaire, FDJ et
Réception — qui rebondissaient **exactement comme hors service**. Relevé brut
de S5 avant correctif :

```
· tuile « FDJ » → NEXUS-FDJ-v1.html [operationnel]
    ✓ lien autorisé   : categorie operationnel
    ✗ écran ouvert    : nexusRequireAuth renvoie vers NEXUS-Pointage-v1.html
    ✗ action accomplie: ecran non ouvert — rien n'a pu etre tente
```

La règle est désormais écrite **une fois**, dans `nexus-auth.js`, à côté des
deux gardes qu'elle résume — `nexusEcranOperationnelAtteignable(etat)`. L'accueil
la **lit** ; il ne la redevine pas une troisième fois. Quatre conséquences :

| Avant | Après |
|---|---|
| Tuiles Missions / Inventaire / FDJ en service sans arrivée pointée | Pointer mon arrivée · Progression · Mon planning · Mon évolution |
| Coach « Commencez par l'inventaire… » — consigne impossible à suivre | « Pointez votre arrivée : vos missions et vos contrôles s'ouvriront ensuite. » |
| Titre « Mes outils du quart » alors qu'aucun outil n'ouvre | « Mes écrans » |
| Rien ne nommait le geste qui débloque le reste | La tuile `pointage` le nomme, et `NEXUS-Pointage-v1.html` est en catégorie `sequence` : il ne se garde pas lui-même |

**Deux notions distinctes, volontairement** : `arriveePointeeJour` (l'arrivée de
la **journée**, ce que la garde regarde) et `arriveeFaite` (l'arrivée du
**service courant**, `NexusPointageRegles.dejaFaitDuService`, correctif du
13/09/2026 pour la barre de progression). Deux services le même jour et une
seule arrivée pointée : la garde laisse passer, la barre continue de compter par
service. Les deux sont justes, chacune dans sa question.

**Ce que le lot ne change pas, volontairement** : `inventaireApplicable`,
`fdjApplicable`, `receptionApplicable` et le compte d'actions restent vrais. Ces
contrôles sont réellement **applicables** — ils ne sont simplement pas encore
**atteignables**. Confondre les deux effacerait de l'écran le travail du quart
au lieu de le dater d'après.

Gardé par `test_accueil_hors_service_20260918.js` (98 contrôles) et
`test_fuseau_station_20260918.js` (121 contrôles), éprouvé par
`outils/mutation-accueil-hors-service.js` (27 défauts réintroduits un à un,
27 tués, 0 survivant) en trois campagnes : l'écran, la journée métier, la règle
d'atteignabilité.

### 4.1 ter — La date métier suit le fuseau du site

Troisième écart, trouvé par le parcours et non par la lecture : la date métier
était calculée sur l'**horloge de l'appareil**. À instant identique, un
téléphone à Paris et un téléphone en Martinique ne prenaient pas la même
décision pour le même site — y compris dans la logique qui referme les anciens
services.

Le fuseau du site (`station_config.fuseau_horaire`, défaut
`America/Martinique`) est désormais lu et appliqué, sous les bornes
`NEXUS-FUSEAU-METIER` de `nexus-auth.js`. Mesure : les six situations du
parcours rejouées sous six fuseaux d'appareil rendent **six condensés
identiques au bit près**.

### 4.1 quater — La clôture ne referme que le passé

Une version antérieure de ce document rangeait le point suivant parmi les
« anomalies mineures », **non traitées**, au motif qu'« en usage réel, un
service du futur ne devrait pas exister ». Ce classement était faux sur les
deux termes, et il est corrigé ici.

`serviceObsolete` testait `jourDuService !== ctx.jourStation`. Un jour
**différent** n'est pas un jour **antérieur** : un service daté du lendemain
était donc refermé, sous le motif `jour_precedent` — un motif faux.

Ce n'était pas une anomalie d'affichage. La clôture **écrit**
(`statut`, `cloture_source`, `cloture_motif`, `cloture_par`) et elle part
**sans geste humain**, au simple retour dans l'application. Quant à l'usage
réel : une horloge d'appareil déréglée à la prise de poste, une saisie
d'avance ou un fuseau de site corrigé après coup suffisent à produire un tel
service. Il était détruit en silence.

Le test est désormais `jourDuService < ctx.jourStation` — légitime sans
conversion, les deux valeurs venant d'`Intl` en `'en-CA'` où l'ordre
lexicographique **est** l'ordre chronologique. Et le jour postérieur rend
explicitement « pas obsolète », sans passer au second critère : celui-ci
compare `minutesStation`, l'heure du jour **courant**, et aurait conclu
« quart terminé » dès l'après-midi sur un service qui n'a pas commencé.

Gardé à deux niveaux : la règle seule
(`test_cycle_services_pilote_20260916.js`, deux cas ajoutés dont la frontière
au jour près — changement de mois et d'année dans les deux sens) et la chaîne
complète jusqu'à l'écriture (`test_fuseau_station_20260918.js`, scénarios S7 à
S9 : le service du lendemain reste intact depuis les trois appareils, y compris
lorsqu'un vrai service ancien déclenche le ménage dans le même passage).

### 4.2 — Ce qui reste ouvert

Les trois lots du §3 (`polyvalent` à trancher, finesse de `PAGES_INDEX`, note de
conception) n'ont pas été touchés. Ils restent à arbitrer.
