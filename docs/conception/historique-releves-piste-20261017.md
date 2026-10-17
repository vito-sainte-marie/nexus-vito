# Historique intelligent des relevés piste et Paramètres « Pompes et relevés »

Lot du 17/10/2026. Environnement : **Test exclusivement**. Étapes A (diagnostic), B (maquettes, voir `maquettes-historique-releves-piste-20261017.html`) et C (revue Guardian). Aucun code livré, aucune permission modifiée, rien poussé.

## A. Diagnostic

### Ce qui existe et se réutilise

| Besoin | Existant | Décision |
|---|---|---|
| Relevés, valeurs, corrections | `carburant_index_releves` / `_valeurs` / `_corrections` (append-only, RLS lecture par site) | Réutiliser tels quels. Ajouter une colonne `config_snapshot jsonb` (photographie immuable) sur `carburant_index_releves`. |
| Classement d'écart de nuit | `anomalie_nuit`, `ecart_nuit` sur `_valeurs` ; `classerEcartNuit` dans `nexus-releves-piste.js` | Remplacer les seuils codés en dur (0 / 1 / 2–9 / 10) par la configuration. Les anciens codes `a_justifier` (2–9) deviennent « toléré » ; l'historique n'est **pas réécrit**, la classe est recalculée à la lecture depuis la configuration de la photographie. |
| Disposition des pompes, ordre de recopie | Constantes `ORDRE_PHYSIQUE`, `POMPES`, `ordreRecopieDecenium` (code) | Extraire vers la configuration. Le code garde ces valeurs comme **repli de sécurité identique** à la configuration initiale, pour qu'un site sans configuration se comporte comme aujourd'hui. |
| Horaires de quart | `station_config.horaires` + `calculer_horaires_quart(site, quart, date)` (moteur unique, régimes, fuseau `station_config.fuseau_horaire`) | Seule source de l'heure de fin. Aucun second paramétrage. L'échéance du relevé manquant = fin de quart + délai, calculée dans le fuseau du site, y compris au passage de minuit. |
| Qualification humaine tracée | `nexus_ecarts_qualifications` (motif fermé, qualifié par, date, unique par source) | **Non réutilisable telle quelle** : `source_module` est limité à `verify`/`fdj`, `motif` à cinq valeurs, et la table autorise UPDATE (pas de trace de correction). Voir « Écart au brief » ci-dessous. |
| Alertes | `fdj_alertes` (dédoublonnage et résolution automatique FDJ) | Patron à reprendre (clé d'unicité + résolution), pas la table : ses types sont propres à la FDJ. |
| Page Paramètres | `NEXUS-Parametres-Station-v1.html`, sections accordéon (`psec`) | Ajouter une section, sans nouvelle page. |

### Écart au brief : deux tables nouvelles, justifiées

Le brief interdit une deuxième source de vérité. Il n'en crée pas : aucune table existante ne porte ces faits.
1. `carburant_index_config` : configuration des compteurs et seuils, **append-only** (une ligne par version, auteur, horodatage, avant/après, motif). La version courante est la plus récente. Pas de dates d'effet futures.
2. `carburant_index_alertes` : une ligne par (site, type, événement), clé unique pour l'idempotence, statut (`ouverte`, `resolue_auto`, `qualifiee`), raison de clôture.
3. `carburant_index_qualifications` : append-only. Une correction de qualification est une **nouvelle ligne** qui en remplace une autre (`remplace_id`), jamais un UPDATE. 

Ces trois tables, leurs RLS et les fonctions d'écriture sont des **surfaces de sécurité** : elles passent par une demande Handoff avant d'être appliquées, même sur Test.

### Point bloquant à lever avant tout code : l'échelle des compteurs

Le brief demande de convertir les index « en litres selon l'échelle physique ». Le code actuel dit lui-même « unité d'index à confirmer ». Les données Test (ex. pompe 1 SP `0167528`, Decenium `167528` = les 6 derniers chiffres) ne permettent pas de trancher : 1 unité peut valoir 1 L, 0,1 L ou 0,01 L.
- Conséquence assumée : tant que `litres_par_unite` n'est pas **confirmé par un humain** dans les paramètres, tout contrôle exprimé en litres répond « Comparaison impossible : unité de mesure non confirmée ». Il ne devine pas.
- **Question à Frédéric** : à la lecture du Tokheim, 1 de plus sur le dernier chiffre = combien de litres ?
- **Réponse (HUMAN, Frédéric, 17/10/2026, en chat)** : « +1 correspond à un litre ». `litres_par_unite = 1`. Fait déclaré par le responsable ; à consigner dans la première version de `carburant_index_config` avec son auteur et sa date. La logique pure `comparerPassation` (tolérance 9 L, seuil 10 L, compteur par compteur, fail-closed) est écrite et testée localement, sans toucher la base.

### Contrôles réalisables avec les données disponibles

| Contrôle | Données | Réalisable ? |
|---|---|---|
| Passation fin Q1 → début Q2 | valeurs `fin_q1`, `debut_q2` du même jour | Oui, compteur par compteur, si configuration de même photographie. |
| Nuit fin Q2 → début Q1 | `fin_q2` veille, `debut_q1` du jour | Oui. Le début Q1 porte déjà une référence validée. |
| Relevé de fin manquant | `calculer_horaires_quart` + absence de relevé final | Oui, à l'échéance configurée. Dit « non enregistré dans NEXUS », jamais « non fait ». |
| Comparaison à Decenium | aucune donnée Decenium indépendante | **Non.** Seulement l'attestation humaine, affichée comme telle. |
| Cause d'un écart | aucune | **Non.** Hypothèses seulement. |

### Où l'humain est réellement nécessaire

Seulement pour **qualifier** un écart ≥ seuil dont les données ne donnent pas la cause (erreur de lecture / mouvement confirmé / cause inconnue), et pour confirmer l'échelle des compteurs et modifier la configuration. Tout le reste (tolérance, absence de relevé, clôture après correction validée) est tranché par NEXUS.

## B. Maquettes

Voir `maquettes-historique-releves-piste-20261017.html` : Décisions du jour, fiche d'alerte, historique détaillé, Paramètres « Pompes et relevés ». Chaque écran porte sa justification Guardian.

## Architecture proposée (pour revue, non implémentée)

- **Logique pure** dans `nexus-releves-piste.js` : `comparerPassation(configA, configB, valA, valB)` renvoie un état parmi `conforme | tolere | anomalie | non_controle | impossible` + le détail par compteur ; elle compare les photographies de configuration et renvoie `impossible` si la disposition, le carburant, l'état de service ou le nombre de chiffres diffèrent. Une seule décision d'alerte par (site, jour, type), jamais par compteur.
- **Évaluation idempotente** `evaluer_controles_piste(site, date)` (fonction SQL) : upsert d'alertes sur la clé unique, résolution automatique si le recalcul sur données **finales** ne retrouve plus l'écart. Un brouillon ne résout rien. Appelée à l'ouverture de l'écran manager et à chaque relevé final ; une alerte « relevé manquant » à échéance exige une horloge : soit l'ouverture de l'écran (sans notification), soit une tâche planifiée (**décision à prendre**, voir ci-dessous).
- **Écriture** de configuration et de qualification par fonctions réservées manager/gérant du site ; le pompiste n'a aucun accès.
- **Aucun total de ventes** n'est calculé ni affiché. Les litres servent uniquement à comparer des index entre eux.

## C. Revue Guardian (neuf critères)

1. **Simplicité** : trois tables append-only, une fonction d'évaluation, un seul écran à deux niveaux. Pas de dates d'effet futures, pas de moteur de règles. Retiré par rapport à une première idée : un journal d'événements séparé (l'alerte et la qualification suffisent).
2. **Automatisation / humain par exception** : tolérance, calcul des litres, détection du manque, clôture après correction validée = automatiques. Humain : qualifier, confirmer l'échelle, modifier la configuration, chacun justifié ci-dessus.
3. **Pas de double saisie ni de double surveillance** : horaires lus de `calculer_horaires_quart` ; relevés lus tels quels ; ventes laissées à Carburants/Decenium.
4. **Explicabilité** : chaque alerte = constat vérifié, signification, hypothèses étiquetées, vérification recommandée, niveau de certitude. L'écran dit combien de relevés et de valeurs ont réellement été contrôlés.
5. **Attribution de la décision** : une qualification porte manager, date, choix, commentaire ; sa correction est une ligne distincte. « Mouvement confirmé » = déclaration du manager, libellée ainsi.
6. **Prévention de la dérive ERP** : aucun total de vente, aucun classement ni filtre par pompiste, aucun score. L'auteur n'est visible que dans le détail d'un relevé. Le pompiste n'est pas évalué ; les indicateurs mesurent le dispositif.
7. **Complexité cumulative** : trois tables et une fonction, aucun nouveau service, aucune dépendance externe. L'import Decenium est documenté comme évolution future, non préparé dans le schéma.
8. **Fail-closed** : donnée manquante, configuration changée, unité non confirmée, relevé précédent absent ⇒ « non contrôlé » ou « comparaison impossible », jamais « conforme » ni écart de zéro.
9. **Isolation des données** : toutes les lignes portent `site` ; RLS par site pour la lecture ; écriture via fonctions qui vérifient le site du manager. Cette surface passe par le Handoff.

Composants retirés après revue : filtre par pompiste, bouton « Vue », classement, graphiques d'évolution, tableau dense par défaut.

## Décisions à prendre (aucune ne bloque l'étape B)

1. **Échelle des compteurs** (voir plus haut) : bloque tout contrôle en litres.
2. **Horloge du relevé manquant** : à l'ouverture de l'écran seulement (simple, pas de notification) ou tâche planifiée (alerte rouge même si personne n'ouvre l'écran). Je recommande l'ouverture d'abord, tâche planifiée ensuite si l'usage le justifie.
3. **Demande Handoff** pour les trois tables, leurs RLS et les fonctions d'écriture, avant tout SQL sur Test.
4. **Seuils** : Q1 → Q2 orange à 10 L et nuit rouge à 10 L ; les valeurs 9 L / 10 L / 30 min viennent de la configuration, pas du code.

## Question finale

« Le dirigeant prendrait-il de moins bonnes décisions si cette fonctionnalité disparaissait ? » Réponse provisoire, à confirmer par les mesures de la recette : sans elle, un écart de passation ou de nuit n'est vu que si quelqu'un compare à la main deux relevés, et rien ne distingue « non contrôlé » de « conforme ». La valeur se mesurera au nombre d'écarts détectés avant la recopie Decenium déclarée, au nombre de manques régularisés et au délai d'apparition → qualification, jamais à un nombre « d'erreurs évitées ».
