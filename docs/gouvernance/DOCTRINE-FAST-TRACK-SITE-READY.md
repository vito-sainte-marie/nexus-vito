# Doctrine NEXUS — Fast Track & Site-Ready

Statut : **CANONIQUE**
Autorité humaine : Frédéric
Date d'adoption : 2026-10-06
Rail d'autorité : `handoff-continuite-20260920`

## 1. Finalité

NEXUS doit pouvoir progresser rapidement sur plusieurs chantiers métier parallèles sans qu'un mouvement Production volontaire et attribuable immobilise l'ensemble du Handoff.

L'objectif de livraison n'est plus seulement « Production verte ». Le critère de préparation à l'extension est **NEXUS Site-Ready** : un socle multisite prouvé, puis des modules qualifiés indépendamment pour leur activation sur un autre site.

## 2. Attribution obligatoire des mouvements

Tout chantier urgent ou parallèle doit déclarer :
- son identifiant / lot ;
- son périmètre fonctionnel et fichiers attendus ;
- son autorité de branche ;
- ses migrations éventuelles ;
- ses preuves CI / recette ;
- ses dépendances explicitement justifiables.

Un mouvement de `production` provenant d'un chantier déjà identifié et autorisé (exemples ayant motivé cette doctrine : FDJ, Client en compte) n'est **pas une anomalie par sa seule existence**.

Le Handoff doit requalifier automatiquement le nouveau SHA et vérifier l'attribution des changements avant de décider s'il existe un conflit réel.

## 3. Trois niveaux de décision

### FAST TRACK

Le rail peut poursuivre sans nouvel arbitrage humain lorsque :
- le chantier est déclaré et son périmètre attribuable ;
- CI et contrôles requis sont verts ou ne présentent que des échecs historiques explicitement tolérés ;
- les migrations éventuelles sont attribuées ;
- les invariants de sécurité, gouvernance et multisite sont respectés ;
- aucune collision avec un autre lot n'est constatée ;
- aucune nouvelle décision métier n'est nécessaire.

### ARBITRAGE RAPIDE

Si `production` ou une autre référence protégée a bougé mais que les changements sont attribuables à des chantiers autorisés :
1. mesurer les nouveaux SHA ;
2. attribuer commits, fichiers et migrations ;
3. vérifier leurs impacts sur le lot actif ;
4. rafraîchir les preuves devenues obsolètes ;
5. continuer si aucun invariant n'est violé.

Le changement de SHA seul ne constitue donc plus un STOP global.

### STOP HUMAIN

Retour obligatoire à l'autorité humaine en cas de :
- changement non attribué ou inexpliqué ;
- conflit / non-fast-forward / lease caduc ou divergence non maîtrisée ;
- nouvelle régression CI ;
- collision de migrations ou altération d'un invariant ;
- contamination inter-site / RLS / sécurité ;
- modification applicative inattendue hors périmètre ;
- preuve obligatoire réellement manquante ;
- nouvelle décision métier ou extension de périmètre ;
- opération Production non couverte par une autorisation humaine explicite.

## 3 bis. Escalade à deux paliers

**Demande de Frédéric du 07/10/2026** : « que le handoff fonctionne sans moi
sauf vraiment production ou changement de philosophie ». Motif mesuré :
l'arbitre redemandait à Frédéric des arbitrages déjà rendus, parce que rien ne
les lui rappelait.

« Autorité humaine » au §3 désigne désormais deux paliers distincts :

- **Palier Frédéric** — seul motif qui le réveille : fusion, déploiement ou
  promotion Production ; mutation Supabase Production ; violation
  sécurité/RLS/`site_id` ; secret, permission ou élargissement de la surface de
  sécurité ; armement d'une boucle automatique agissant en son nom ; nouvelle
  décision métier non arbitrée ; changement de doctrine.
- **Palier arbitre** — tout autre STOP du §3 (changement non attribué,
  conflit ou lease, régression CI, preuve impossible, extension de périmètre,
  modification hors périmètre) est tranché par l'arbitre désigné, sans
  Frédéric. L'arbitre peut refuser, demander une preuve, ou remonter au palier
  Frédéric **en nommant le motif codé** qui l'y autorise.

Un commit ou un push sur le rail Handoff n'appelle aucun GO humain ; seuls
`main` et `production` restent gardés.

Une question déjà tranchée ne se repose pas : `docs/handoff/ARBITRAGES-ACQUIS.json`
liste les arbitrages rendus avec leur source, et `outils/escalade-humaine.js`
répond `DEJA_ARBITRE` pour eux. Une escalade sans motif codé n'atteint pas
Frédéric. Ce paragraphe ne retire rien au §7 : aucune opération Production
n'est jamais déléguée.

## 4. Qualification modulaire

Les modules NEXUS doivent pouvoir progresser indépendamment selon une qualification explicite :

`NON_QUALIFIE -> TESTE -> RECETTE_TERRAIN -> SITE_READY`

Exemples : FDJ, Client en compte, Verify, Planning, Carburants, Inventaire, Pointage, Paye.

Une évolution d'un module ne doit pas bloquer un autre module lorsque leurs périmètres et invariants sont indépendants.

## 5. Invariant multisite

Avant qu'un module soit déclaré `SITE_READY`, il faut prouver qu'il ne dépend pas implicitement de Sainte-Marie Usine.

Contrôles minimaux :
- portée `site_id` explicite pour les données et mutations concernées ;
- policies RLS cohérentes avec cette portée ;
- paramètres et référentiels configurables par site lorsqu'ils sont métier ;
- absence d'identifiant, règle, séquence ou hypothèse codée implicitement pour Sainte-Marie Usine ;
- isolation inter-site démontrée ;
- migrations compatibles avec le modèle multisite ;
- recette du parcours critique du module.

## 6. Validation terrain différée

Un chantier peut être techniquement qualifié sans prétendre à une validation métier définitive lorsqu'une campagne réelle future est nécessaire.

La validation différée doit être inscrite comme contrôle métier futur, sans bloquer artificiellement un rail indépendant.

Cas initial : **Client en compte** est satisfaisant à ce stade ; sa validation métier définitive reste à confirmer lors de la campagne réelle de factures et de bons prévue au début du mois suivant.

## 7. Frontière Production

Cette doctrine accélère l'analyse et le Handoff ; elle ne constitue jamais une autorisation implicite de :
- fusionner vers Production ;
- déployer en Production ;
- exécuter une migration Production ;
- écrire/réparer/muter Supabase Production ;
- promouvoir implicitement un lot vers Production.

Ces opérations restent soumises aux autorisations humaines explicites applicables.

## 8. Principe directeur

**Attribuer avant de bloquer. Requalifier avant de stopper. Stopper sur une anomalie réelle, pas sur le simple mouvement d'une référence.**

Le but est de maintenir un rail rapide, traçable et sûr afin de préparer NEXUS à sa mise en service sur plusieurs sites.


## 9. Portefeuille prioritaire et vitesse de croisière

La procédure Fast Track est une **priorité opérationnelle NEXUS** : elle doit permettre d'avancer concrètement sur plusieurs chantiers sans sérialiser artificiellement les travaux indépendants.

### Priorités explicites

1. **NEXUS Paye** — priorité fonctionnelle. Des ajustements restent à réaliser ; le module doit être rapproché du planning officiel et des règles métier déjà décidées, puis progresser vers `SITE_READY`.
2. **Cockpit & Brief** — priorité moteur. Ces composants constituent le moteur principal de pilotage et de synthèse NEXUS et doivent être améliorés en continu, avec contrats stables pour les modules consommateurs.
3. **Chantiers métier actifs** — notamment FDJ, Client en compte, Verify, Planning, Carburants, Inventaire et Pointage : progression parallèle autorisée lorsque les périmètres sont indépendants.

### Règle d'orchestration

Un chantier prioritaire ne doit pas attendre la clôture d'un autre chantier indépendant. L'orchestrateur doit :
- identifier les dépendances réelles avant de sérialiser ;
- maintenir des lots distincts et attribuables ;
- transporter et arbitrer les preuves par lot ;
- requalifier les mouvements de références protégées selon la présente doctrine ;
- éviter qu'une recette terrain différée sur un module bloque les autres ;
- remonter immédiatement les collisions réelles plutôt que créer des blocages préventifs globaux.

### Cadence mesurable

La vitesse de croisière est considérée atteinte lorsque :
- plusieurs lots indépendants peuvent avancer sans interférence ;
- chaque lot connaît son prochain geste minimal ;
- les `request-N` propres à un chantier délégué sont arbitrées sans nouveau GO
  humain répétitif lorsqu'une délégation existe — **par l'arbitre désigné,
  jamais par l'auteur de la demande** : voir `docs/skills/nexus-handoff-fast-track/SKILL.md`
  § « Séparation des rôles », qui fait foi sur qui peut arbitrer quoi ;
- les STOP correspondent à des anomalies réelles ;
- l'état de qualification de chaque module est explicite ;
- le socle multisite reste protégé à chaque étape ;
- aucune étape déjà autorisée ne se termine en silence : fin d'étape signifie
  action suivante ou relais explicite vers l'acteur capable d'agir — voir
  `docs/skills/nexus-handoff-fast-track/SKILL.md` § « Continuité active —
  anti-pause », qui fait foi sur la mécanique du relais (`FAST_TRACK_PAUSE`,
  `FAST_TRACK_STALL`) sans introduire de gate supplémentaire.

L'accélération ne réduit jamais les exigences RLS, `site_id`, sécurité, traçabilité, CI ou append-only du Handoff.
