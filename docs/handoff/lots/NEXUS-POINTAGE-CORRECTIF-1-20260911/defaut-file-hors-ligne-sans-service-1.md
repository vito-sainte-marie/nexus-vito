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

## Ce que ce lot ne fait pas

Il ne lève aucun blocage. `aucun_blocage_non_resolu` reste **BLOQUE** :
Frédéric Bragance a déclaré ce défaut bloquant le 13/09 et exige, avant toute
gate, le correctif, les tests **et un parcours navigateur réel**. Ce dernier
n'a pas été fait : il demande une connexion avec un PIN, que Frédéric saisit
lui-même.

Aucune écriture Production. Aucune migration.
