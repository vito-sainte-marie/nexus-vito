# La file promettait un envoi que la base refusait

**13/09/2026.** Relevé par Frédéric Bragance sur `Employé Test B` :
« la sauvegarde hors ligne fonctionne, mais la synchronisation ne s'effectue
pas actuellement depuis ce navigateur. »

## Fait observé

Le pointage est accepté à l'écran, le bandeau annonce « enregistré sur ce
téléphone — envoi en attente. Rien ne sera perdu ». L'entrée ne part jamais.

## Cause démontrée

Sonde en transaction annulée sur Test, témoin négatif dans la même
transaction :

```
sans service : REFUSÉE [23502] service_id est obligatoire depuis le 11/09/2026
avec service : ACCEPTÉE
```

Une seule variable. Rien n'a été écrit — vérifié après coup : B conserve
0 service, 0 pointage, et les 57 lignes du scénario de recette sont intactes.

`Employé Test B` n'a **aucun service** — une réinitialisation du scénario Test
a effacé celui du 11/09 sur lequel la preuve hors ligne avait été faite. Sans
service du jour, `service_id` part à `null`, et le trigger
`nexus_pointage_exige_service` refuse. À chaque rejeu.

## Ce qui était réellement en cause

Pas le refus : **le classement du refus**. `NEXUS-Pointage-v1.html` traitait
toute erreur d'insertion comme une coupure réseau. Une violation de contrainte
produisait donc le même message qu'une perte de connexion, et `viderLaFile` la
rejouait à chaque ouverture de l'écran. `console.error` était la seule trace.

Les deux couches se contredisaient depuis le 11/09 : la base exige un service,
l'écran était explicitement conçu pour s'en passer — son commentaire le disait
encore, « ex. pointage fait avant toute prise de poste », avec un repli
`quart: 'non_defini'`. Personne ne les avait réconciliées.

Ce n'est pas théorique : sur les 92 pointages Production, 12 sont sans service,
dont 2 sur `vito-sainte-marie`.

## Règle métier posée

Frédéric Bragance, 13/09/2026 : **une employée sans service ouvert ne doit pas
pouvoir pointer.** Le pointage reste obligatoirement rattaché à un service
fiable.

## Ce qui a été corrigé

1. **La garde d'absence de service**, posée avant la photo et avant toute
   lecture des pointages du jour. Message exact : « Aucun poste n'est ouvert.
   Prenez d'abord votre poste pour pouvoir pointer », et un bouton qui ouvre
   NEXUS Prise de poste.
2. **`erreurDefinitive(erreur)`** distingue un refus d'une coupure. PostgREST
   et PostgreSQL renvoient un code (`23502`, `42501`, `PGRST…`) ; une coupure
   de transport n'en a pas. Hors ligne franc, aucun refus n'est jamais tenu
   pour définitif — la réponse ne peut pas venir du serveur.
3. **Un refus ne part plus en file** et ne promet plus rien. La tentative est
   retirée immédiatement, et le message dit que ce n'est pas le réseau.
4. **`viderLaFile` retire les entrées refusées** au lieu de les rejouer sans
   fin, et les rapporte — l'écran les nomme à l'employée et l'oriente vers son
   manager. C'est ce qui traite l'entrée déjà bloquée sur l'appareil de Test B,
   sans intervention.

## Épreuves

`test_pointage_sans_service_20260913.js` — 27 vérifications.

**Témoin de mutation** : rejouées sur le fichier d'avant correction, les huit
vérifications de source échouent toutes, et les huit vérifications de
classement d'erreur sont impossibles — la fonction n'existait pas. Une épreuve
qui passerait des deux côtés ne prouverait rien.

## Une garde périmée, réécrite plutôt que contournée

`test_pointage_depart_sans_pause_20260911.js` interdisait toute trace de hors
ligne : « tant que ce n'est pas construit, rien ne doit le laisser croire ».
Il a été construit le 11/09 et prouvé en direct. La garde avait survécu par
accident — son motif ne listait pas `addEventListener('online')`, pourtant
présent.

Elle garde son esprit et change de cible : ce qui reste réellement absent
(`serviceWorker`, `indexedDB`) doit le rester, et `navigator.onLine` ne doit
servir qu'à **refuser de conclure** hors ligne, jamais à promettre un envoi.
Un seul usage autorisé, vérifié.

## Le parcours navigateur a trouvé deux défauts de plus — les miens

**13/09/2026, parcours réel de Frédéric Bragance sur `Employé Test B`.** Base
vérifiée après coup : arrivée 12:27:58, départ 12:32:05, service `termine`,
`heure_fin` 12:32:05, `cloture_source = pointage_depart`, 0 service ouvert,
0 `fin < début`. Les deux pointages portent leur `service_id` et leur
`client_event_id`. La garde et le classement des erreurs ont fonctionné.

Mais la garde que j'avais posée le matin même en portait deux défauts, que
seul le parcours pouvait révéler.

### Le compteur de service continuait de courir

`#serviceLive` vit dans l'en-tête, **hors de `#app`**, et n'est mis à jour que
par les affectations `etatCompteur` / `referenceCompteur` du rendu complet.
Ma garde sortait AVANT elles : après un départ, l'écran affichait encore
« Service en cours depuis 4 minutes », et le compteur montait indéfiniment.

La garde remet désormais les deux à `null` et rafraîchit l'en-tête avant tout
rendu.

### Une journée finie n'est pas une journée absente

Pire, et plus bête : une employée qui venait de pointer son départ recevait
« Aucun poste n'est ouvert. Prenez d'abord votre poste » et un bouton l'invitant
à en rouvrir un. Elle perdait au passage l'historique du jour, donc la preuve de
ce qu'elle venait d'enregistrer.

La garde distingue maintenant les deux situations, sur un fait et non sur une
supposition : y a-t-il des pointages aujourd'hui ?

| situation | écran |
|---|---|
| aucun service, **aucun** pointage du jour | « Aucun poste n'est ouvert… » et le bouton de prise de poste |
| aucun service, **des** pointages du jour | « Votre journée est enregistrée… », l'historique et l'activité du jour, aucun bouton |

Les pointages du jour sont donc lus AVANT la garde. Ce n'est pas un
affaiblissement : ce qui doit précéder la garde, c'est la caméra et l'écriture,
pas une lecture.

### Une leçon sur mes propres épreuves

Trois de mes vérifications sont devenues fausses en corrigeant, et une
quatrième matchait le commentaire qui expliquait pourquoi la phrase ne devait
PAS être affichée. Une garde qui lit du code sans distinguer le commentaire du
rendu mesure le texte, pas le comportement. Elles portent désormais sur ce qui
est rendu.

Et LANG-003 a refusé un tiret cadratin ajouté dans une phrase affichée. Le
plafond n'a pas été relevé : la phrase a été reformulée.

## Un troisième défaut, trouvé par la reconnexion

**13/09/2026.** Frédéric se déconnecte, se reconnecte, reprend un poste. NEXUS
annonce « début de pause » comme prochaine étape, et tous les boutons sont
éteints. Mesuré en base :

```
pointages du jour : arrivee 12:27:58 · depart 12:32:05
services du jour  : termine 12:27:48 → 12:32:05 | en_cours 12:48:23 → ouvert
```

La session n'y était pour rien : le nouveau service héritait des pointages du
service précédent.

### La base n'avait jamais interdit ce cas

`pointages_un_par_service_et_type` porte sur `(service_id, employee_id, type)`.
Deux services dans la journée, deux arrivées : permis, depuis le 11/09.
**Seul l'écran raisonnait encore en journée**, parce qu'il datait d'avant
`service_id` : `dejaFait` se construisait sur tous les pointages de la date.

### Et « prochaine étape » était un reste de la séquence stricte

`prochainType = ORDRE_TYPES.find(t => !dejaFait[t])` — exactement la ligne que
le correctif du 11/09 avait remplacée pour la DISPONIBILITÉ des boutons, mais
qui avait survécu pour le LIBELLÉ. D'où l'incohérence visible à l'écran : une
étape annoncée que les boutons refusaient.

Le correctif du 11/09 avait traité l'endroit où l'on se cognait, pas la règle.
C'est la deuxième fois que ce proxy réapparaît ailleurs.

### Ce qui a été corrigé

- `service_id` est chargé avec les pointages du jour ;
- `dejaFait` ne retient que les pointages **du service courant** ;
- `prochainType` vaut la première étape réellement **disponible**, la même
  règle que les boutons ;
- l'historique reste celui de la **journée** : c'est le contexte que l'employée
  veut voir, et il ne commande rien.

`test_pointage_par_service_20260913.js` — 18 vérifications, dont le scénario
exact du 13/09 et la démonstration que l'ancien calcul annonçait une étape
indisponible.

## Le refus silencieux : cinq endroits, une seule erreur

**13/09/2026.** Sur le second service, « Enregistrer sans photo » deux fois :
aucune arrivée, aucun message, le bouton revient à son état initial.

Le refus ne venait ni du réseau ni de la base : **rien n'a jamais été envoyé.**
La relecture anti-doublon cherchait par `(employé, DATE, type)`, retrouvait
l'arrivée de 12:27 du service précédent, concluait « déjà enregistré » et
rendait `true` **sans écrire**.

Et le message qui l'expliquait était écrit dans un élément invisible :
`.confirm-banner` est en `display:none`, seule `.show` l'affiche. La ligne
posait `className = 'confirm-banner ok'` — sans `show`, et avec une classe
`ok` qui n'existe dans aucun CSS. **Le refus parlait dans une pièce vide.**

La même erreur de portée vivait à cinq endroits, tous hérités d'avant
`service_id` :

| endroit | portée fausse | corrigé en |
|---|---|---|
| `dejaFait` de l'écran | la journée | le service |
| `prochainType` | `ORDRE_TYPES.find(!dejaFait)` | la première étape disponible |
| relecture anti-doublon avant écriture | `(employé, date, type)` | `(employé, service, type)` |
| déduplication de la file | `(employé, date, type)` | `(employé, service, type)` |
| rejeu de la file | `(employé, date, type)` | `(employé, service, type)` |

Plus deux défauts trouvés en chemin :

- **Deux bandeaux écrits sans `show`** — le refus anti-doublon et l'échec de
  clôture de pause. Tous deux invisibles, tous deux avec une classe inventée.
- **L'insertion de `pause_fin` au départ ne portait ni `service_id` ni
  `client_event_id`.** Le trigger la refusait donc systématiquement depuis le
  11/09 : un départ avec une pause ouverte échouait toujours, et le message
  d'échec était l'un des deux invisibles.

Une entrée de file sans service n'est plus interrogée en base : elle est
**inenvoyable** par construction, elle sort et elle est dite. C'est le sort des
entrées restées sur un téléphone avant le 11/09.

### Deux leçons sur mes propres épreuves

`test_pointage_depart_sans_pause_20260911.js` **exigeait la portée fausse** —
« la relecture cible (employé, jour, type) ». Une épreuve qui exige la mauvaise
portée protège le défaut, pas la règle. Corrigée, avec une seconde assertion
qui interdit désormais le retour de la journée.

Et deux épreuves que j'avais ajoutées se trouvaient **enregistrées après
l'exécution du runner**, dans le `.then()` final : elles ne tournaient jamais.
Vertes par construction — exactement ce que Guardian QA traque, et qu'il ne
peut pas voir, sa règle étant par fichier.

## Le sixième endroit — le tableau ci-dessus en comptait cinq

**13/09/2026, au soir.** Le tableau des cinq endroits était incomplet. Une
sixième relecture gardait encore la portée par journée, et c'est celle qui
protège l'écriture de la fin de pause posée à l'heure du départ :

```
.eq('employee_id', employee.id).eq('date', today).eq('type', 'pause_fin')
```

Elle n'avait pas été vue parce que le chemin de la clôture de pause avait été
corrigé le matin même **sur un autre point** : l'insertion ne portait ni
`service_id` ni `client_event_id`. On avait réparé ce que la base refusait, et
laissé intacte la question posée juste avant.

### Ce qu'elle produit

Deux services du même employé le même jour, la pause du premier refermée, la
pause du second encore ouverte. Au départ du second service, la relecture
retrouve la fin de pause **du premier**, conclut « déjà fait » et saute
l'écriture. Le départ, lui, s'enregistre.

Résultat : un service clos dont la pause ne se referme jamais, et aucun
message — la sortie est un succès. La journée close montre trois pointages là
où quatre gestes ont été faits. Le compteur de temps de pause d'un service
ainsi clos reste ouvert sur une pause sans fin.

C'est le même défaut que le premier de la série, à un endroit de plus : une
règle changée dans l'écran, pas partout où elle s'applique. Le correctif du
matin traitait les endroits où l'on s'était cogné.

### Ce qui a été corrigé

La relecture cible désormais `(employee_id, service_id, type)` — la portée de
l'index unique `pointages_un_par_service_et_type` du 11/09, et celle des cinq
autres chemins. La date ne dit rien de ce qui est dû à CE service.

**La file hors ligne et son rejeu ont été revérifiés : ils étaient déjà
corrects.** `viderLaFile` interroge `(employee_id, service_id, type)` et la
déduplication de la file porte sur `(service_id, type)`. Aucun autre chemin
d'écriture ne déduplique plus par `(date, type)` — c'est désormais une
vérification, pas une relecture à faire de mémoire.

Les trois autres lectures par date subsistent et doivent subsister : l'activité
du site, l'historique du jour et les missions du jour affichent un contexte.
Elles ne gardent aucune écriture.

### Épreuve

`test_pause_fin_par_service_20260913.js` — 25 vérifications.

Elle ne lit pas seulement la source, **elle la joue**. Le bloc de clôture est
extrait de l'écran et exécuté contre une base simulée qui applique les filtres
réellement demandés, l'unicité `pointages_un_par_service_et_type` et le refus
`nexus_pointage_exige_service`. Le scénario du §1 est celui mesuré sur Test :
service du midi clos avec sa pause refermée, service du soir avec sa pause
ouverte.

**Témoin de mutation**, `NEXUS_SOURCE_POINTAGE=<fichier d'avant> node …` :
six vérifications échouent, dont quatre par comportement et non par motif de
texte. Le témoin montre aussi la forme exacte du silence — « le départ peut
suivre » reste **vert** sur le fichier d'avant correction : le départ
s'enregistrait bel et bien, seul. Une épreuve qui passerait des deux côtés ne
prouverait rien.

Le chemin du refus est éprouvé lui aussi : si la base refuse la fin de pause,
le départ n'est pas pointé et l'employée le lit dans un bandeau visible. Règle
6 — mieux vaut un départ à repointer qu'une pause laissée ouverte derrière un
départ enregistré.

### Ce que cette épreuve dit de la précédente

`test_pointage_par_service_20260913.js` vérifiait déjà, en son §6, que
l'insertion de `pause_fin` portait `service_id` et `client_event_id`. Elle
regardait l'écriture et jamais la question posée avant elle. Une garde qui
suit un correctif au lieu de suivre la règle laisse passer le même défaut à
l'endroit voisin.

## Ce que ce lot ne fait pas

Il ne lève aucun blocage. `aucun_blocage_non_resolu` reste **BLOQUE** :
Frédéric Bragance a déclaré ce défaut bloquant le 13/09 et exige, avant toute
gate, le correctif, les tests **et un parcours navigateur réel**. Ce dernier
n'a pas été fait : il demande une connexion avec un PIN, que Frédéric saisit
lui-même.

Aucune écriture Production. Aucune migration.
