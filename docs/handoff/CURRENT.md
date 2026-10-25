<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/PRISE-DE-POSTE-UN-ECRAN-20261025/request-1.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: request
lot_id: PRISE-DE-POSTE-UN-ECRAN-20261025
seq: 1
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: https://github.com/vito-sainte-marie/nexus-vito/issues/28
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=f56edb0d production=f6b145df
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 164-fichiers
---
# PRISE-DE-POSTE-UN-ECRAN-20261025 : un seul écran à l'ouverture, un seul appui pour prendre son poste

## Contexte
Décisions de Frédéric du 25/10/2026 : ce lot passe **avant** la chaîne d'initialisation de l'inventaire, « Jaugeage Carburant » et le langage. L'ordre ensuite : chaîne d'initialisation, « Jaugeage Carburant », langage (P1, P2 et §3 dans un même lot, décisions du 25/10 déjà prises).

Aujourd'hui un employé sans service ouvert fait 5 appuis sur 4 écrans avant de photographier le Veeder-Root : « Deux chemins » (`NEXUS-App-v1.html`, l. 3079), choix du poste, « Voir mes missions » (`NEXUS-Prise-De-Poste-v1.html`, l. 372, libellé trompeur), récapitulatif, écran « confirmée ». Le jaugeage du matin est le premier geste du pompiste : l'adoption se joue là.

Code lu en lecture seule, aucune ligne écrite. Rail `handoff-continuite-20260920` à `d71433ec`, `production` à `f6b145df` (#157 fusionnée et servie, `lot_actif` encore `INVENTAIRE-RELECTURES-20261024`, clos par decision-3).

## Ce que fait le lot (cadrage de Frédéric)
- **A. Un seul écran.** Sans service ouvert, NEXUS s'ouvre sur le choix du poste, en affichage propre de l'Accueil, pas en redirection d'office (doctrine E2 de `test_accueil_hors_service_20260918.js` respectée). « Deux chemins » et « Consulter mon espace » disparaissent. Manager et gérant gardent leur arrivée.
- **B. Choix du poste.** Trois grandes cartes illustrées : Piste, Caisse, Renfort. **Un seul appui** valide le poste et ouvre la suite (jaugeage du fil pour Piste, destination actuelle pour les autres). Ni « Continuer », ni récapitulatif, ni écran « confirmée ». Le quart reste déterminé comme aujourd'hui. Rappel de sécurité visible sans appui, texte inchangé (« Strictement interdit » reste). Le récapitulatif « missions prévues, priorités, temps estimé » passe sur l'Accueil, une fois le service pris.
- **Poste proposé = planning du jour, jamais l'habitude.** Carte mise en avant si le planning donne le poste ; sans planning, aucune présélection.
- **C. « Ma progression »** en bas, pour consulter sans prendre de service. Ne crée jamais de service, de pointage ni de retard (épreuve dédiée, avec mutation). Planning « repos » ou journée terminée : « Ma progression » en premier (« Vous êtes de repos aujourd'hui » / « Votre service est terminé »), cartes derrière « Je travaille quand même ».
- **D. Graphisme NEXUS** : `#0B0F14`, cartes `#141B22`, carte mise en avant cernée `#4FC3D9`, vert `#34D399` réservé aux confirmations. De la maquette, seule la structure est reprise. Lisible en 375 × 812.
- **E. Images** : les trois images du zip (pompiste, caissière, renfort ; générées par ChatGPT pour Frédéric, usage confirmé le 25/10), converties en WebP d'environ 400 px, 50 Ko au plus, épinglées `?v=`, avec une note d'origine à côté. Les PNG d'origine (~2 Mo) ne sont pas versés.
- **F. `RULES.json`**, cinq règles : jaugeage d'ouverture par le pompiste du jour avant les premières ventes ; la caissière ne le saisit jamais (photo Veeder-Root avec son téléphone, contrôle croisé et recours) ; aucun écran n'ouvre cette saisie à un autre rôle que pompiste ou polyvalent en poste piste ; poste proposé = planning du jour ; consulter ne crée rien.
- **Hors périmètre** : vacataires, pointage (désactivé à Sainte-Marie), toute écriture en Production, toute migration, le contenu du fil.

## Ce que dit la base Test sur le planning (demandé avant de coder la présélection)
1. **`shifts.role_prevu` n'est pas une source de planning.** C'est le rôle écrit à la création du service, après le choix de l'employé. Sur Test il vaut `caissier` pour 690 services et diffère du rôle réellement tenu dans plusieurs cas (4 + 3 « caissier » devenus pompiste, 3 « manager » devenus pompiste ou caissière). L'utiliser pour présélectionner ferait réintroduire l'habitude par la porte de derrière.
2. **La source de planning est `v_planning_officiel`** (projection de `planning_shifts` filtrée par `source_planning_applicable`), déjà lue par `NexusStation.quartPlanifie` (`nexus-station.js`, l. 218-245) pour le quart : colonnes `quart` (`quart1`, `quart2`, `renfort`), `statut` (`travail_normal`, `manager`, `renfort`, `repos`, `conge`, `transfert_site`), `publie`.
3. **Le poste, lui, s'écrit dans `planning_shifts.tache`**, contrainte `piste` ou `caisse` ou NULL. Aucun écran du dépôt ne lit `tache` pour proposer un poste aujourd'hui ; `role_planifie` (texte libre) n'est lu nulle part.
4. **`planning_shifts` est vide sur Test** (0 ligne), de même que `planning_regles_effectif` n'est pas rempli pour un jeu de recette : la recette devra donc **semer des lignes de planning fictives sur Test** (un pompiste, une caissière, un renfort, un repos), avec un script borné et rejouable, Test seulement.
5. **Proposition de lecture** du poste du jour : `tache` = `piste` donne Piste, `caisse` donne Caisse, quart `renfort` ou statut `renfort` donne Renfort ; statut `repos` ou `conge` donne « de repos » ; `tache` NULL, ligne absente, plusieurs lignes contradictoires ou lecture en échec : **aucune présélection**, jamais de devinette. Une panne de planning ne doit jamais empêcher de prendre son poste (comportement de `quartPlanifie`).
6. **Inconnu : Sainte-Marie en Production.** Je ne sais pas si `tache` y est renseigné, ni si le planning publié y est complet. C'est la condition de la présélection (« 1 appui quand le planning connaît le poste »). **Je ne lis pas la Production sans le GO de Frédéric.**

## À arbitrer
1. **GO de Frédéric** pour une lecture seule de Production, filtrée sur `vito-sainte-marie`, de `v_planning_officiel` : nombre de lignes publiées par statut et par `tache` sur les 14 derniers jours (agrégats, aucun nom d'employé). Sans ce GO, le lot livre l'écran et les règles, et la présélection reste inactive là où `tache` est vide.
2. La lecture du poste proposée ci-dessus (point 5, `tache` puis `renfort`, jamais `role_prevu`) convient-elle ?
3. Le lot est-il d'abord construit sur le jeu de planning fictif de Test, PR en brouillon vers `production`, recette Claude Guardian sur l'aperçu de la PR ?

Aucune fusion, aucun déploiement, aucune lecture ni écriture de la Production sans le GO de Frédéric.
