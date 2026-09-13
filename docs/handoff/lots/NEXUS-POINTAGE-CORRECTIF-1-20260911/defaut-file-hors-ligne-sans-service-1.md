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

## Ce que ce lot ne fait pas

Il ne lève aucun blocage. `aucun_blocage_non_resolu` reste **BLOQUE** :
Frédéric Bragance a déclaré ce défaut bloquant le 13/09 et exige, avant toute
gate, le correctif, les tests **et un parcours navigateur réel**. Ce dernier
n'a pas été fait : il demande une connexion avec un PIN, que Frédéric saisit
lui-même.

Aucune écriture Production. Aucune migration.
