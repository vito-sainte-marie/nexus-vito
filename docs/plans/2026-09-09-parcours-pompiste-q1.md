# Parcours pompiste Q1 — scène par scène

**09/09/2026.** Architecture demandée par Frédéric Bragance, méthode retenue :
pour chaque scène, ce que vit l'employé, ce que NEXUS connaît, ce que l'écran
montre, ce que le Coach dit, les actions, la preuve, les exceptions, la
sécurité, le passage à la suite, la contribution à la progression.

**Ce document ne conçoit rien sur du vide.** Chaque « NEXUS connaît » a été
vérifié dans le dépôt ou en Production en lecture seule le 09/09/2026, et porte
son état : `ACQUIS`, `À CÂBLER` (la donnée existe, l'écran ne la montre pas) ou
`N'EXISTE PAS`. Une expérience bâtie sur des données supposées se démonterait au
premier vrai quart.

---

## Ce que la vérification a trouvé

**Le vocabulaire de l'expérience existe déjà dans le modèle.** `mission_catalog`
porte, pour chaque mission : `titre`, **`pourquoi`**, `role_required`,
`time_window`, `priority`, `estimated_duration_min`, `proof_required`,
`validation_type`, `photo_par_action`, `points`, `impact_attendu_eur`,
`checklist`.

Ton « Sécurisons les stocks avant les premières ventes » a donc déjà sa colonne :
`pourquoi`. Et elle est remplie.

| Sur les 138 missions actives de la station | |
|---|---|
| avec `pourquoi` renseigné | **138 — toutes** |
| avec durée estimée | 138 |
| avec checklist | 130 |
| avec preuve exigée | 69 |
| **avec `time_window` renseigné** | **2** |
| pompiste / caissière | 23 / 35 |

### Le seul vrai manque, et il commande tout le reste

**136 missions sur 138 ne savent pas quand elles se placent dans le quart.**

Tes cinq états — Maintenant, Ensuite, Plus tard, En attente, Terminé — ont besoin
d'un placement temporel pour trancher. Sans `time_window`, NEXUS ne peut pas
distinguer « maintenant » de « plus tard », et retombe mécaniquement sur la
liste des 23 missions du pompiste. C'est exactement l'écran que tu veux
supprimer, et ce n'est pas un problème de rendu : c'est une donnée absente.

**Mais le placement est déjà écrit — en français, dans les titres.** « Relevé
d'index (prise de poste) », « Comptage gaz et glaçons (prise de poste) »,
« Ronde de sécurité (fermeture) », « Nettoyage final piste », « Nettoyage final
boutique ». Ces missions annoncent leur moment et le champ reste vide.

Ce n'est donc pas un travail d'invention, c'est un travail de confirmation : il
faut que tu tranches, mission par mission, à quel moment du quart chacune
appartient. **Je ne le déduirai pas tout seul** — un placement deviné produirait
un parcours qui envoie quelqu'un nettoyer la piste au milieu d'une livraison.

### Ce qui n'existe pas du tout

| Notion | État |
|---|---|
| Transmission d'une information au quart suivant | **N'EXISTE PAS** — aucun modèle, aucune table, aucune colonne |
| Retard mesuré à la prise de poste | `N'EXISTE PAS` sous cette forme (l'heure d'arrivée est enregistrée, l'écart au planning n'est pas calculé) |
| Consignes de sécurité par site | `N'EXISTE PAS` en base — l'avertissement pompiste est écrit en dur dans l'écran |

---

## Les six moments

### Moment 1 — Arrivée · 5 h 40

**Ce que vit l'employé.** Il arrive avant l'ouverture, souvent dans le noir, avec
son téléphone dans une main. Il n'a pas envie de choisir quoi que ce soit.

**Ce que NEXUS connaît**

| Ce qu'il faut | État | D'où |
|---|---|---|
| Le site | `ACQUIS` | `employees.site_id` |
| La date locale et le quart en cours | `ACQUIS` | `sites.timezone` + `station_config.horaires` (quart1 06:00–13:00) |
| Le rôle du jour | `ACQUIS` | choix à la prise de poste, `role_prevu` = rôle habituel |
| Le quart planifié | `À CÂBLER` | `planning_shifts` porte `quart`, `statut`, `tache` — non lu par l'écran de prise de poste |
| Le retard | `N'EXISTE PAS` | l'heure d'arrivée est posée, l'écart au planning n'est calculé nulle part |
| Les consignes de sécurité | `À CÂBLER` | texte en dur dans l'écran, non paramétrable par site |

**Ce que l'écran montre.** Le prénom, le rôle, le quart, l'heure de début. Une
seule action. Pas de liste.

> Bonjour Dylan
> Pompiste • Quart du matin • Sainte-Marie Usine
> Votre poste commence à 6 h 00.

**Ce que le Coach dit.** Rien encore. Il parle après la confirmation, pas avant :
à 5 h 40 l'employé confirme, il ne lit pas.

**Actions.** Confirmer la prise de poste. Rien d'autre.

**Preuve.** Une ligne `shifts` avec `heure_debut`, `role`, `confirmed_by`.

**Exceptions.** Un service de la veille resté ouvert se ferme seul
(`prise_de_poste_suivante`) — **éprouvé à l'écran le 09/09/2026**. Le rôle
choisi peut différer du rôle habituel : `role_prevu` conserve les deux.

**Sécurité.** L'avertissement piste s'affiche ici et nulle part ailleurs dans le
parcours : c'est le seul moment où l'employé n'est pas encore sur la piste.

**Passage.** Automatique vers le Moment 2. Pas de menu intermédiaire — c'est
précisément là que 16 quarts sur 18 s'arrêtent aujourd'hui.

**Progression.** Aucune. Prendre son poste n'est pas une performance.

---

### Moment 2 — Prise en main de la piste · 5 h 45

**Ce que vit l'employé.** La station n'est pas ouverte. C'est le seul moment
calme du quart, et le seul où regarder un écran ne le met pas en défaut.

**Ce que NEXUS connaît**

| Ce qu'il faut | État | D'où |
|---|---|---|
| Que le jaugeage d'ouverture s'applique au site | `ACQUIS` | `jaugeageActifSite` |
| Qu'il concerne ce rôle | `ACQUIS` | `jaugeagePertinentRole` |
| Qu'il n'est pas déjà fait | `ACQUIS` | `jaugeageFait`, `jaugeageOuvertureLe` (horodatage réel) |
| Sa fenêtre | `ACQUIS` | `SOP-26`, `time_window = avant-13:00` |
| Les autres gestes d'ouverture | `À CÂBLER` | `CHK-004 Ouverture station` porte `avant-06:00` ; `CHK-047 Relevé d'index (prise de poste)` et `CHK-048 Comptage gaz et glaçons (prise de poste)` n'ont **aucune** fenêtre |

**Ce que l'écran montre.** Une action, sa durée, son sens.

> **Sécurisons les niveaux avant les premières ventes**
> Relevé jaugeage carburant — 8 minutes

Le titre réel de `SOP-26` est « Relevé jaugeage carburant (matin) » et son
`pourquoi` dit « Garantir la cohérence entre stocks physiques et informatiques,
et détecter toute anomalie ». **La phrase d'expérience se compose du `pourquoi`,
pas d'un texte à écrire ailleurs.**

**Ce que le Coach dit**, après validation, avec l'heure réelle :

> Niveaux enregistrés à 5 h 56. La référence d'ouverture est sécurisée.

**Actions.** Saisir les niveaux. Signaler une anomalie de cuve — `CHK-061
Signaler une anomalie technique` existe déjà, priorité haute, preuve exigée.

**Preuve.** Le relevé lui-même, horodaté. `SOP-26` exige une preuve
(`proof_required`).

**Exceptions.** Jaugeage désactivé sur le site : le moment saute entièrement.
Déjà fait par un collègue : il disparaît, sans reproche.

**Sécurité.** Station fermée : c'est le seul moment où une saisie longue est
acceptable. Tout ce qui demande de l'attention doit tenir ici.

**Passage.** Après validation, `SOP-26` disparaît et NEXUS passe en mode
discret.

**Progression.** 7 points, valeur réelle du catalogue.

---

### Moment 3 — Service actif · 6 h 00 – 12 h 30

**Ce que vit l'employé.** Des clients, du carburant, du bruit. Il ne doit **pas**
regarder son téléphone, et l'interdiction est écrite.

**Ce que NEXUS connaît**

| Ce qu'il faut | État |
|---|---|
| Les missions du rôle | `ACQUIS` — 23 pour le pompiste, avec durée, priorité, points, `pourquoi` |
| Ce qui est déjà fait dans CE quart | `ACQUIS` — `mission_progress.shift_id` depuis le 04/09/2026 |
| **Laquelle vient maintenant** | **`N'EXISTE PAS`** — 21 des 23 sans `time_window` |
| Une réception carburant autorisée | `ACQUIS` — `station_config.reception_carburant_role` |
| Un inventaire assigné | `À CÂBLER` — `mission_assignments` existe |

**Ce que l'écran montre.** Rien qui appelle. Une seule ligne, consultable quand
l'employé le décide. C'est le sens de « mode discret » : NEXUS se tait, il
n'attend pas.

**Ce que le Coach dit.** Rien, sauf sollicité. Une relance pendant le service
est une infraction à la règle de sécurité, pas une aide.

**Actions.** Ouvrir la mission suivante. Signaler une anomalie. Rien d'autre à
portée immédiate.

**Exceptions.** C'est ici que le manque de `time_window` se voit : sans
placement, « la prochaine mission pertinente » retombe sur un tri par priorité,
c'est-à-dire sur une liste. **Ce moment ne peut pas être construit avant que le
placement soit décidé.**

**Sécurité.** Aucune notification pendant le service. Aucun compte à rebours.
Aucun rappel qui s'affiche seul.

**Progression.** Les points du catalogue, à la validation. Jamais un
pourcentage.

---

### Moment 4 — Événement · à tout instant

**Ce que vit l'employé.** Une pompe s'arrête, un client renverse, une livraison
arrive. Il a les mains prises et peu de temps.

**Ce que NEXUS connaît**

| Ce qu'il faut | État |
|---|---|
| Signaler une anomalie technique | `ACQUIS` — `CHK-061`, priorité haute, preuve exigée, 5 min |
| Sécuriser une livraison | `ACQUIS` — `SOP-05 Sécurisation livraison carburant`, **critique**, 20 min |
| Réception carburant | `ACQUIS` — écran dédié, gaté par `reception_carburant_role` |
| Qualifier un incident client | `N'EXISTE PAS` comme mission dédiée |
| Chaîner observer → qualifier → sécuriser → prévenir → suivre | `À CONSTRUIRE` — les briques existent, l'enchaînement non |

**Ce que l'écran montre.** Trois ou quatre choix, une photo si nécessaire, une
précision courte. Jamais un formulaire.

**Ce que le Coach dit.** Il confirme que c'est transmis, et à qui. Le silence
après un signalement est ce qui décourage le signalement suivant.

**Preuve.** La photo quand `proof_required` l'exige — 69 missions sur 138 sont
dans ce cas, le mécanisme est éprouvé.

**Exceptions.** Un événement interrompt le parcours et **ne le fait pas échouer**.
Au retour, NEXUS reprend où l'on en était.

**Sécurité.** Un danger n'attend pas une saisie. La séquence doit pouvoir être
complétée **après** la mise en sécurité — jamais l'inverse.

---

### Moment 5 — Passage de relais · 12 h 45

**Ce que vit l'employé.** Il veut partir. C'est le moment le plus fragile : les
deux seuls quarts engagés de la station, à 16 et 64 missions validées, sont
restés ouverts.

**Ce que NEXUS connaît**

| Ce qu'il faut | État |
|---|---|
| Ce qui a été accompli dans ce quart | `ACQUIS` — `mission_progress.shift_id` |
| Ce qui reste dû | `À CÂBLER` — calculable, jamais présenté |
| Les anomalies encore ouvertes | `À CÂBLER` — les signalements existent, leur état ouvert/fermé n'est pas suivi comme tel |
| **L'information à remettre au quart suivant** | **`N'EXISTE PAS`** — aucun modèle |
| La clôture par pointage de départ | `ACQUIS` — `nexus_cloturer_shift_au_depart`, fonctionnel |

**Ce que l'écran montre.**

> Votre piste est prête à être transmise.
> Une information sera remise au prochain quart : pompe 4 sous surveillance.

**Cette phrase est aujourd'hui impossible.** Rien ne porte « pompe 4 sous
surveillance » d'un quart au suivant. C'est la seule brique entièrement neuve du
parcours, et c'est aussi celle qui donne son sens au mot « relais ».

**Actions.** Pointer son départ. Laisser une information au quart suivant.

**Preuve.** `shifts.statut = termine`, `heure_fin`, `cloture_source =
pointage_depart`.

**Exceptions.** L'employé part sans pointer : le service reste ouvert et le
suivant le fermera automatiquement. **C'est le cas ordinaire aujourd'hui, et
c'est celui que ce moment doit faire reculer.**

**Sécurité.** La clôture ne doit jamais bloquer un départ. Un employé qui doit
partir part.

**Progression.** Le récapitulatif du quart, pas une note.

---

### Moment 6 — Reconnaissance · 13 h 02

**Ce que vit l'employé.** Il a fini. Trente secondes d'attention, pas plus.

**Ce que NEXUS connaît.** Tout, sauf la transmission : durée réelle du quart,
missions validées, points, anomalies signalées. `mission_completions` et
`progression_badges` existent.

**Ce que l'écran montre.**

> Quart terminé à 13 h 02
> Jaugeage sécurisé • 4 missions réalisées • aucune anomalie non transmise
> La piste est prête pour l'équipe suivante.

**Règle.** La reconnaissance porte sur la contribution réelle. Un quart à zéro
mission ne reçoit pas de félicitations : il reçoit un résumé honnête. Fabriquer
un encouragement sur du vide est ce qui décrédibilise le plus vite un outil
auprès de gens qui savent ce qu'ils ont fait.

---

## Les cinq états, adossés aux données

| État | Ce qui le détermine | Disponible ? |
|---|---|---|
| **Maintenant** | `time_window` de la mission + heure locale du site | **NON** — 136 missions sans fenêtre |
| **Ensuite** | la suivante dans le même moment | **NON** — même cause |
| **Plus tard** | fenêtre postérieure dans le quart | **NON** — même cause |
| **En attente** | dépend d'un événement ou d'un tiers | partiellement — `mission_assignments`, autorisations de site |
| **Terminé** | `mission_progress` du quart | **OUI** |

**Quatre états sur cinq dépendent de la même donnée manquante.** C'est le
chemin critique du projet, avant tout écran.

---

## Ce qu'il faut décider ou construire, dans l'ordre

1. **Le placement temporel des 23 missions du pompiste.** Ton arbitrage, mission
   par mission. Sans lui, le Moment 3 ne peut pas exister — et six missions
   annoncent déjà leur moment dans leur titre, ce qui réduit le travail à une
   confirmation.
2. **Le modèle de transmission au quart suivant.** Entièrement neuf. Une
   information courte, rattachée au service, lue par le suivant à son Moment 1.
3. **Le suivi ouvert/fermé des anomalies signalées.** Nécessaire au Moment 5
   pour dire « aucune anomalie non transmise » sans mentir.
4. **Le quart planifié lu à la prise de poste.** `planning_shifts` existe et
   n'est pas lu ; c'est ce qui permet « votre poste commence à 6 h 00 » plutôt
   qu'une heure déduite.
5. **Le retard**, si tu le veux. Il n'existe pas et il touche à l'appréciation
   du travail : à décider avec précaution, ou à écarter.

---

## Ce que je n'ai pas fait

- **Je n'ai pas déduit le placement des missions.** Un placement deviné enverrait
  quelqu'un nettoyer la piste pendant une livraison.
- **Je n'ai pas inventé de mission.** Les 23 du pompiste sont celles de la
  station, relevées en lecture seule.
- **Je n'ai pas réécrit les `pourquoi`.** Ils existent, ils sont de toi, et ce
  sont eux qui portent le sens que tu décris.
- **Je n'ai écrit aucune ligne de code.**
