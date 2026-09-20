---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-CONTINUITE-TERRAIN-1-20260920
seq: 1
author: Claude
branch: config-par-environnement
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=10c65d0 production=6c3efcc
  - id: deploiement-production
    classe: DECLARED
    valeur: production_servie_6c3efcc_deploye_2026-09-20T17-28-13Z_7_sur_7_ecrans_sha256_identiques_au_depot
  - id: pointage-inactif
    classe: DECLARED
    valeur: station_config_pointage_actif_false_et_manager_pointage_requis_false_depuis_2026-09-03
  - id: planning-officiel
    classe: DECLARED
    valeur: v_planning_officiel_335_lignes_max_2026-08-31_sans_effet_la_prise_de_poste_cree_le_shift
  - id: acces-remplacant
    classe: HUMAN
    valeur: angelique_role_renfort_et_lydie_audrey_yannick_sans_connexion_depuis_juillet_2026
  - id: missions
    classe: DECLARED
    valeur: 553_completions_aucune_depuis_2026-09-13
  - id: rappels
    classe: DECLARED
    valeur: table_publique_rappels_0_ligne_rls_deja_ecrite
  - id: datation-accueil
    classe: DECLARED
    valeur: deux_chargeurs_datent_en_UTC_bascule_sur_demain_des_20h_locale_America_Martinique
  - id: urgence-fdj
    classe: DECLARED
    valeur: raccourci_configure_FDJ-Analyse_non_reconnu_par_urgenceRaccourci_urgence_toujours_0_pour_22_alertes_non_vues
  - id: audits-caisse
    classe: DECLARED
    valeur: 126_audits_1_non_valide_du_2026-09-19
  - id: perimetre-passe
    classe: DECLARED
    valeur: lecture_seule_aucune_ecriture_metier_aucun_correctif_applique
---
# Le remplaçant n'a pas de porte d'entrée

Lot ouvert le 20/09/2026 sur demande de Frédéric Bragance, absent du site une
semaine à partir du 21/09/2026. La question posée n'est pas « NEXUS est-il
fini » ni « la dette est-elle réduite », mais : **un parcours terrain
indispensable va-t-il tomber demain, obligeant le manager à intervenir à
distance ?**

La passe de diagnostic a été menée **en lecture seule** sur la Production
servie et sur `origin/production`. Aucune écriture métier, aucune mutation,
aucune modification de code, aucune branche poussée.

## Verdict

**AUTONOMIE TERRAIN 7 JOURS : OUI AVEC LIMITATIONS.**

Aucun parcours quotidien n'est cassé côté logiciel. Le seul blocage est
d'identité et d'accès, et il est humain : NEXUS n'a pas de manager joignable
sur place pendant l'absence.

## Le seul bloquant — B1, l'accès du remplaçant

Angélique est déclarée `renfort`. `current_employee_role()` lit
`employees.role`, pas le rôle du jour : aucune prise de poste ne lui donnera
les droits manager. Elle ne peut donc ni ouvrir Verify, ni valider un audit de
caisse.

Les trois comptes qui portent les droits — lydie, audrey, yannick (gérant) —
n'ont plus de connexion depuis fin juillet. Réinitialiser un accès est un
geste que seul Frédéric peut faire, et il ne peut pas être fait par un agent :
je ne saisis aucun identifiant et je ne crée aucun compte.

**Ce qui est demandé ici est un arbitrage, pas un correctif.** Deux voies :

1. promouvoir temporairement le compte qui tiendra la semaine — décision
   métier, avec un retour arrière daté ;
2. laisser les droits où ils sont et accepter que la validation des audits de
   caisse attende le retour.

Aucune des deux ne s'invente. La première a un effet RLS réel et immédiat.

**Preuve attendue, quelle que soit la voie :** `auth.users.last_sign_in_at` du
compte retenu passe à la date du jour. Tant que cette valeur n'a pas bougé,
l'accès n'est pas établi — l'avoir annoncé ne le prouve pas.

## Ce qui tient

| parcours | état | fondement |
|---|---|---|
| Connexion, Accueil, navigation | OPÉRATIONNEL | 7/7 écrans critiques servis identiques au dépôt (sha256) |
| Prise de poste | OPÉRATIONNEL | elle **crée** le shift ; elle ne consomme pas le planning |
| Carburants, FDJ, Inventaire | OPÉRATIONNEL | écritures continues jusqu'au 20/09 |
| Audits de caisse | DÉGRADÉ MAIS UTILISABLE | la saisie passe ; la validation exige un manager (voir B1) |
| Pointage | SANS OBJET | `pointage_actif=false` depuis le 03/09 — l'écran annonce lui-même la désactivation |
| Missions | DÉGRADÉ | aucune complétion depuis le 13/09 ; l'écran exige un shift du jour |

Trois hypothèses antérieures sont **corrigées** par cette passe, et il faut
qu'elles cessent de circuler :

- le planning officiel figé au 31/08 **n'est pas bloquant** : la prise de
  poste crée le shift sans le planning ;
- le rôle `renfort` **est bien écrit** dans `shifts.role` ; seul le libellé de
  quart retombe sur l'horloge, défaut cosmétique ;
- le faux retard de pointage **est sans objet terrain**, le pointage étant
  éteint depuis le 03/09.

## Ce que NEXUS ne fait pas — quatre défauts de pilotage, tous dans l'existant

Le manque n'est pas un module absent : c'est que ce qui existe ne conduit pas.

1. `chargerControlesVerifyRestants` compte les quarts **saisis**, pas les
   audits **non validés**. Le chiffre affiché ne désigne donc pas le travail
   qui reste.
2. Le raccourci configuré `NEXUS-FDJ-Analyse-v1.html` n'est pas reconnu par
   `urgenceRaccourci()`, qui ne connaît que `NEXUS-FDJ-Manager-v1.html` :
   l'urgence FDJ vaut **toujours 0**, quel que soit le nombre d'alertes non
   vues. Il y en a 22.
3. `descriptionRaccourci()` n'a aucun cas Carburants : l'urgence remonte sans
   jamais dire pourquoi.
4. Les deux chargeurs de l'Accueil datent en **UTC**
   (`new Date().toISOString().slice(0,10)`). Le site est en
   `America/Martinique` : **dès 20 h locale, en plein service du soir, NEXUS
   bascule sur demain** et affiche « à jour » ce qui ne l'est pas.

Un cinquième, mineur : le badge « Urgent » de l'Accueil lit `localStorage` et
un calendrier codé en dur, jamais la base. Il ne dit rien de l'état réel du
site, et il ne dit rien du tout à un poste qui n'est pas celui du manager.

## Les trois plus petites modifications — non appliquées, soumises à décision

Elles sont **identifiées, mesurées, et volontairement non faites**. Aucune
n'ouvre de chantier ; aucune ne touche la RLS, les migrations ni le pointage.

- **P0-1 — dater au fuseau de la station** dans les deux chargeurs de
  l'Accueil. Corrige le basculement de 20 h. Code seul, deux appels.
- **P0-2 — corriger `station_config.raccourcis`.** C'est une **donnée**, pas
  du code : aucun déploiement, aucune PR. Remplacer l'entrée FDJ par celle que
  `urgenceRaccourci()` reconnaît rend l'urgence FDJ visible.
- **P0-3 — compter les audits non validés** plutôt que les quarts saisis.

Hors code, et sans doute le plus utile des trois : les consignes de la semaine
ont leur place dans `public.rappels` — table qui existe, dont la RLS est
déjà écrite, et qui est **vide** — plutôt que dans le `localStorage` d'un
poste que le remplaçant n'ouvrira jamais.

## Ce qui ne doit pas être fusionné

Ni #62 ni #65 n'offre de chemin sûr : les deux sont `CONFLICTING`, et
**aucune ne corrige un blocage des sept jours**. L'imminence du départ ne
réduit pas les exigences Production. Elles attendent.

## Ce que cette demande ne demande pas

Aucune autorisation de déploiement. Aucune écriture Production. Aucun
correctif appliqué. Le gel du lot `config-par-environnement` et l'investigation
« frontière migrations » restent fermés et hors périmètre de ce lot.

## Questions à arbitrer

1. **B1** — quelle voie pour l'accès du remplaçant, promotion temporaire datée
   ou attente du retour ?
2. **P0-2** — la correction de `station_config.raccourcis` est-elle autorisée
   dès maintenant, étant une donnée et non un déploiement ?
3. **P0-1 et P0-3** — sont-elles ouvertes comme lot de correctif avant le
   départ, ou reportées au retour ?
4. Les consignes de semaine sont-elles portées dans `public.rappels`, et par
   qui ?
