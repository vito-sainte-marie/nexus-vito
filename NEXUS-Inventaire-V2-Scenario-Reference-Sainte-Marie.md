# Scénario de référence Sainte-Marie — Inventaire V2

*Rédigé le 29/08/2026, à la suite du Sprint 4 ("Répartition par rôles"), à la demande de Frédéric — verbatim de sa doctrine : "Le seul document supplémentaire qui apporterait encore beaucoup de valeur serait maintenant un « Scénario de référence Sainte-Marie — Inventaire V2 », avec une journée complète, les différents employés, les écrans successifs, les comptages, un écart qui se résorbe et un autre qui finit en contrôle manager. Ce scénario servirait à la fois de maquette fonctionnelle et de recette pour le développeur."*

## Méthode (Article 5 — jamais une fausse précision)

Tout ce qui suit décrit un mécanisme **déjà construit et testé** (Sprints 1 à 4) ou une **donnée réellement présente en base** pour `vito-sainte-marie`. Rien n'est inventé pour les besoins du récit :

- Les 8 règles de mission (`inventaire_mission_rules`) sont celles réellement seedées (Data Dictionary v2.288, section D).
- Le mécanisme d'écart (seuils par catégorie, alertes qui se résorbent, décisions manager) est celui réellement codé dans `nexus-inventaire-moteur.js` et `NEXUS-Inventaire-Manager-v1.html` (fonctions `seuilEcartEffectif`, `reconciliationAlertesDemarque`, liste `DECISIONS`).
- Les écrans employé décrits (« Mes missions », les deux jauges) sont ceux livrés au Sprint 3/4 dans `NEXUS-Inventaire-v1.html`.
- Les prénoms d'employés (Marie, Jean, Léa, Awa) sont **illustratifs** — aucune donnée personnelle réelle n'est utilisée.
- Un seul point du scénario ci-dessous décrit un mécanisme **qui n'existe pas encore** : il est signalé explicitement en section 9 ("Ce que ce scénario ne couvre pas encore"), jamais présenté comme construit.

## 1. Rappel de la doctrine non négociable (Frédéric)

- L'employé ne voit jamais le théorique. Il compte uniquement ce qu'il voit.
- NEXUS décide qui compte quoi et quand.
- La couverture n'est pas la conformité.
- Un écart isolé ne sollicite pas le manager.
- Les règles d'une station sont dans les paramètres, jamais dans le code.
- Une alerte doit toujours proposer une issue.

## 2. Configuration réelle mobilisée (Sainte-Marie, `inventaire_mission_rules`)

| Mission | Rôle | Repli | Quart | Moment | Catégories | Sélection | Priorité |
|---|---|---|---|---|---|---|---|
| Piste — ouverture | Piste | — | — (Q1 et Q2) | début | Gaz, Glaçons | complet | normale |
| Piste — fin de quart | Piste | — | — (Q1 et Q2) | fin | Gaz, Glaçons | complet | normale |
| Caisse — Cigarettes | Caisse | — | Q1 et Q2 | début | Cigarettes | complet | **sensible** |
| Caisse — Presse/Pains/CBD | Caisse | — | Q1 | fin | Journaux, Pains, Viennoiserie, CBD | complet | normale |
| Caisse — Presse/Pains/Boissons chaudes | Caisse | — | Q2 | pendant | Journaux, Pains, Viennoiserie, Boissons chaudes | complet | normale |
| Caisse — rotation Cigarettes | Caisse | — | Q2 | pendant | Cigarettes | tournant (15 réf.) | sensible |
| Renfort — Dépôt/Boutique | Renfort | *(repli configuré)* | — | pendant | Boissons chaudes, Huiles | complet, zone Boutique | normale |

La mission "Caisse — Cigarettes" est la seule marquée **priorité sensible** — c'est elle qui sert de base au scénario "écart en contrôle manager" (section 6).

## 3. Personnel du jour — Q1 (matin), scénario A : effectif complet

- **Marie** — rôle Piste, seule sur ce rôle.
- **Jean** et **Léa** — rôle Caisse, tous les deux présents (cas à deux employés sur un même rôle → répartition, Sprint 4).
- **Awa** — rôle Renfort.

## 4. Déroulé minute par minute — écrans réels

**05h50 — Marie ouvre son quart (Piste).**
Écran d'accueil (`renderAccueil`) : bannière de zone, puis dans l'ordre :
1. **Couverture du quart** (jauge collective, Sprint 4) — ex. `0 sur 34`, 0 % : rien n'a encore été compté sur le site ce quart-ci, tous rôles confondus.
2. **🎯 Mes missions aujourd'hui** — une seule mission affectée à Marie : *Piste — ouverture*, moment "Début de quart", jauge `0 sur 6` (Gaz + Glaçons).
3. Bouton "Commencer mon inventaire".

Marie compte les 6 références. Chaque comptage validé écrit immédiatement en base (`ecrireComptageImmediat`, Sprint 4bis de l'ancien backlog Inventaire 2.0 — mécanisme inchangé). Les deux jauges de l'accueil se mettent à jour au prochain retour à cet écran : Mes missions → `6 sur 6` (100 %), Couverture du quart → `6 sur 34`.

**05h55 — Jean et Léa ouvrent leur quart (Caisse), tous les deux présents.**
`chargerMissionsDuJour()` charge la mission "Caisse — Cigarettes" (rôle Caisse) puis appelle `chargerEmployesPresentsParRole` : deux employés sont présents sur Caisse. La règle couvre par exemple 40 références Cigarettes → `repartirPerimetreParEmploye` répartit ces 40 références en deux parts déterministes d'environ 20 chacune. Jean voit dans "Mes missions" : *Caisse — Cigarettes*, `0 sur 20`. Léa voit la même mission, mais avec les 20 AUTRES références, `0 sur 20`. Aucun des deux ne voit le périmètre de l'autre — pas de double comptage, pas de trou.

**06h10 — Awa ouvre son quart (Renfort).**
Mission "Renfort — Dépôt/Boutique" affectée normalement (Awa est présente). "Mes missions" affiche Boissons chaudes + Huiles, zone Boutique.

## 5. Scénario B — Renfort absent (repli)

Même matin, mais Awa est absente. `chargerRolesPresentsQuart` ne retourne pas "Renfort" parmi les rôles présents. `resoudreAffectationRegleMission` applique alors la stratégie de repli configurée sur la règle ("reporter au quart suivant") :
- La mission apparaît côté manager (pas côté employé) avec le statut `non_affectee` et `strategieAppliquee: reporter_quart_suivant` — **jamais silencieusement perdue** (doctrine : "dette de couverture" visible, distincte d'une anomalie de comptage).
- Aucun écran employé n'affiche cette mission : personne présent pour l'assumer aujourd'hui.
- `couvertureMissions()` reflète ce trou dans son compteur `nonAffectees`, distinct de la Fiabilité/conformité.

## 6. Un écart qui se résorbe (Piste — Gaz)

Le lendemain matin, un écart apparaît sur une référence Gaz de la Piste : stock transmis 12, compté 10 (écart -2). Ce produit n'est pas en catégorie sensible et l'écart (2) est sous le seuil configuré pour sa catégorie (`seuilEcartEffectif('quantite_alerte', ...)`) — **aucune alerte immédiate**, conformément à la doctrine "un écart isolé ne sollicite pas le manager". Une alerte est tout de même ouverte en base (`gravite: 'attention'`) pour suivi.

Au quart suivant, Marie recompte cette même référence : le stock recalculé colle désormais (écart résorbé). `reconciliationAlertesDemarque` compare les alertes ouvertes existantes aux écarts au-dessus du seuil recalculés : cette alerte n'a plus de correspondance → elle est proposée à la résolution automatique (`aResoudre`), avec la trace "Écart disparu après nouvel import Decenium" déjà utilisée ailleurs dans le manager. **Aucune intervention manager n'a été nécessaire.**

## 7. Un écart qui finit en contrôle manager (Caisse — Cigarettes)

Le même jour, un écart de 5 unités apparaît sur une référence Cigarettes chez Jean. Cigarettes est une catégorie marquée **priorité sensible** dans la mission_rule elle-même, et c'est précisément le type de catégorie que `depasseSeuilException` (NEXUS-Inventaire-Manager-v1.html) reconnaît via `categorieSensible` — l'alerte remonte **immédiatement** dans le bloc "À contrôler" du manager, quelle que soit sa taille, conformément au réglage réel de cette catégorie (seuil quantité le plus souvent réglé à 0 pour Cigarettes sur ce type de site).

Le manager ouvre l'alerte et choisit l'une des décisions réellement disponibles à l'écran (`DECISIONS`) :
- *Valider* — écart validé, aucune action ;
- *Recomptage* — demandé au prochain quart ;
- *Explication reçue* — de l'employé ;
- *Erreur de saisie* — confirmée, écart non réel ;
- *Démarque à surveiller* — signalé pour suivi.

Chaque décision ferme l'alerte avec une trace explicite (qui, quand, pourquoi) — **jamais une suppression silencieuse**, conformément à la doctrine.

## 8. Récapitulatif des deux jauges (doctrine)

| Jauge | Périmètre | Ce qu'elle répond |
|---|---|---|
| Mission (Sprint 3) | Les produits de LA mission de cet employé, déjà réduits à sa part s'il partage son rôle (Sprint 4) | "Ma part du travail est-elle terminée ?" |
| Collective (Sprint 4) | Tout le plan du quart, tous rôles confondus | "Le quart entier est-il couvert ?" |

Aucune des deux jauges ne mesure la fiabilité/conformité (traitée séparément par le mécanisme d'écarts, sections 6-7) — la Couverture n'est jamais confondue avec la conformité (doctrine).

## 9. Ce que ce scénario ne couvre pas encore (à cadrer avant le Sprint 5)

Le rapprochement Decenium existant (`qualiteRapprochementProduit`, fonctionnel depuis les lots "Phase 1/Phase 2" antérieurs à la doctrine Inventaire V2) compare l'écoulement physique aux ventes Decenium **au niveau du jour**, pas au niveau du quart/moment d'une Mission précise. Autrement dit : aujourd'hui, rien ne relie explicitement un `Snapshot Decenium` à UNE mission (site+rôle+employé+quart+moment) au sens strict de la doctrine — c'est exactement le travail du Sprint 5, qualifié par Frédéric lui-même de "complexe", et volontairement non entamé dans ce document ni dans le code. Deux questions restent à trancher avec Frédéric avant de coder quoi que ce soit :

1. À quelle granularité temporelle Decenium peut-il réellement fournir des ventes (par quart ? par heure ? uniquement par jour) ?
2. Quand un produit est réparti entre deux employés (Sprint 4), comment le rapprochement Decenium doit-il s'appliquer : par employé (chacun sa part) ou uniquement au niveau de la mission entière (les deux parts recomposées) ?

## 10. Checklist de recette (pour le développeur)

- [ ] Un seul employé sur un rôle → aucune différence de comportement avec avant le Sprint 4.
- [ ] Deux employés sur un même rôle → périmètres disjoints, somme = périmètre complet, stable à chaque rechargement.
- [ ] Rôle Renfort absent → mission `non_affectee`, repli affiché **côté manager uniquement**, jamais une exception ni un blocage employé.
- [ ] Écart sous le seuil, catégorie non sensible → aucune alerte immédiate ; alerte de suivi silencieuse.
- [ ] Écart qui disparaît au recomptage suivant → résolution automatique, trace explicite.
- [ ] Écart sur catégorie sensible (Cigarettes) → remonte immédiatement au manager, quelle que soit sa taille.
- [ ] Jauge de mission et jauge collective jamais confondues, jamais un pourcentage de fiabilité affiché à la place d'une couverture.
- [ ] Aucun écran employé n'affiche jamais : stock théorique, comptage passé, raison de sélection, ou le mot "anomalie".
