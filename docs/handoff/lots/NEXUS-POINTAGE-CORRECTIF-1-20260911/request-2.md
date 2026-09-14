---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-POINTAGE-CORRECTIF-1-20260911
seq: 2
author: Claude
branch: config-par-environnement
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=10c65d0 production=d5a8b77
  - id: cause-verifiee
    classe: VERIFIED
    valeur: dejaFaitDuService_retourne_vide_sans_serviceId_nexus-pointage-regles_ligne_76
  - id: contrat-servicedujourseulement
    classe: VERIFIED
    valeur: controle_date_uniquement_statut_filtre_en_amont_nexusServiceCourant
  - id: correctif-journeeterminee
    classe: VERIFIED
    valeur: nexus-pointage-regles_js_et_NEXUS-App-v1_html_wires
  - id: epreuve-comportementale
    classe: VERIFIED
    valeur: test_pointage_accueil_journee_terminee_20260914_js_20_sur_20
  - id: temoin-mutation-894e306
    classe: VERIFIED
    valeur: 7_echecs_sur_HEAD_pre-correctif_20_reussites_post-correctif
  - id: regression-globale
    classe: VERIFIED
    valeur: run-tests_js_aucune_regression_9_echecs_historiques_inchanges
  - id: garde-langage-lang003
    classe: VERIFIED
    valeur: test_garde_langage_nexus_20260908_14_sur_14
  - id: parcours-pointage-preserve
    classe: VERIFIED
    valeur: NEXUS-Pointage-v1_html_non_modifie
  - id: donnees-test-b
    classe: VERIFIED
    valeur: aucun_service_cree_rouvert_clos_supprime_aucune_action_employe_clique
  - id: recette-navigateur-employe-test-b
    classe: NOT_APPLICABLE
    valeur: aucun_identifiant_supabase_test_dans_ce_canal
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune_requete_aucun_merge_aucun_deploiement
---
## Nouvelle preuve humaine — accueil, journée déjà terminée (14/09/2026)

Cette demande succède à `request-1.md` (antérieure aux correctifs et à la
preuve ci-dessous) sans le réécrire, conformément à l'append-only : `request-1.md`
reste tel quel.

### Le défaut signalé par Frédéric

Après une déconnexion complète puis reconnexion d'Employé Test B, l'accueil
(`NEXUS-App-v1.html`) affichait encore :

- « Votre service est en cours » ;
- progression 0 % ;
- « Votre arrivée n'a pas encore été pointée » ;
- bouton « Pointer l'arrivée ».

alors que Supabase confirmait le dernier service clos par `pointage_depart`,
arrivée et départ présents, zéro service ouvert.

### Diagnostic (lecture seule — aucun service créé, rouvert, clôturé ou
supprimé ; aucun clic sur une action employé)

Confirmé exactement comme demandé par l'Orchestrator : au SHA candidat
`894e306cebf2140c52e149a79b94d010ab43f6c8`,
`NexusPointageRegles.serviceDuJourSeulement` contrôle bien la date du
service mais ne vérifie **jamais** `statut === 'en_cours'` — ce contrôle
est fait en amont, côté lecture (`nexusServiceCourant`, `nexus-auth.js`,
requête `.eq('statut', 'en_cours')`), pas dans la fonction elle-même. Ce
n'est donc pas là qu'était le défaut.

La cause réelle est en aval, dans `NEXUS-App-v1.html::initAccueilEmploye` :
quand `nexusServiceCourant` ne trouve aucun service ouvert (`r.aucun`),
`serviceCourant` reste `null`. `serviceDuJourSeulement(null, …)` rend alors
`null` (comportement correct), donc `serviceCourantId = null`. Mais
`dejaFaitDuService(pointagesJour, null)` rend un état **vide** `{}` —
quel que soit le contenu réel de `pointagesJour` — parce que cette
fonction refuse tout pointage sans `serviceId` réel (garde
`if (!serviceId) return dejaFait;`, ligne 76 de `nexus-pointage-regles.js`).
`prochaineEtape({})` renvoie donc systématiquement `'arrivee'`, même
quand la journée porte déjà deux arrivées et deux départs sur des
services désormais clos.

L'écran Pointage (`NEXUS-Pointage-v1.html`) ne souffre pas de ce défaut :
il porte sa propre garde locale, `journeeTerminee = (pointagesJour || []).length > 0`
quand `!serviceDuJourSeulement(shiftActif, today)`, et affiche alors
« Votre journée est enregistrée. Il n'y a plus de poste ouvert. » sans
proposer aucun pointage — c'est exactement le message que l'accueil
aurait dû reprendre, et ne reprenait pas (« L'accueil annonçait une étape
que l'écran Pointage refusait », titre du commit 894e306, qui avait
corrigé deux autres défauts de la même fonction — portée par
`service_id`, séquence stricte — sans traiter celui-ci).

### Correctif appliqué (Test uniquement, aucune écriture Supabase)

- `nexus-pointage-regles.js` : nouvelle fonction pure et partagée
  `journeeTermineeSansService(serviceDuJour, pointagesJour)` — même
  contrat que la garde locale de l'écran Pointage, désormais disponible
  à l'accueil sans dupliquer la règle (ARCH-001). L'écran Pointage n'est
  **pas modifié** : son parcours reste celui déjà prouvé.
- `NEXUS-App-v1.html::initAccueilEmploye` : nouvelle constante
  `journeeTerminee`, qui neutralise `prochainPointage` à `null`
  (`prochainPointageEffectif`), porte `arriveeFaite`/`departFait` à `true`
  dans le `ctx` (l'arrivée et le départ ont bien eu lieu ce jour-là, sur
  un service désormais clos), et bascule le texte de statut sur « Votre
  journée est terminée » — jamais « en cours », quel que soit le nombre
  de missions restantes.
- `determinerProchaineActionEmploye` : nouvelle branche en tête, avant
  même la vérification du pointage, qui renvoie « Votre journée est
  enregistrée. Il n'y a plus de service ouvert. » sans lien ni bouton
  quand `ctx.journeeTerminee` est vrai — y compris si des missions
  obligatoires restent à faire (vérifié explicitement par une épreuve
  dédiée).

Aucune ligne pinnée par les épreuves existantes n'a été modifiée : les
définitions historiques de `arriveeFaite`/`departFait` (`!!dejaFaitService.arrivee`
/`.depart`) restent inchangées littéralement ; la neutralisation se fait
en aval, dans le `ctx`.

### Preuve comportementale (nouvelle) — mutation témoin confirmée

`test_pointage_accueil_journee_terminee_20260914.js`, 20/20, reproduisant
exactement le scénario exigé : deux services terminés le même jour, zéro
service ouvert.

Témoin de mutation exécuté réellement (pas supposé) : en rejouant ce test
contre `NEXUS-App-v1.html` tel qu'il existait au commit `894e306` (avant
ce correctif — `git show 894e306:NEXUS-App-v1.html`), **7 assertions
échouent** sur les sections qui vérifient l'intégration réelle du
correctif (câblage de `journeeTerminee`, neutralisation de
`prochainPointage`, absence de tout pointage proposé même avec des
missions restantes, titre annonçant « Pointer l'arrivée » au lieu d'une
journée terminée). Sur le HEAD corrigé, les 20 assertions passent.

### Régression et Guardians

- `node run-tests.js` → aucune régression : seuls les 9 échecs historiques
  déjà tolérés par la CI subsistent.
- `test_app_prochaine_action_par_service_20260913.js` (épreuve existante,
  y compris son équivalence à 64 verdicts avec l'écran Pointage) → 24/24,
  inchangé.
- `test_garde_langage_nexus_20260908.js` (garde LANG-003, tirets
  cadratins) → détecté un tiret ajouté par un premier libellé, corrigé
  avant dépôt (« Votre journée est enregistrée. Il n'y a plus de service
  ouvert. », sans tiret cadratin) → 14/14, conforme.
- `node outils/guardians-router.js` → 1 finding, la collision `NexusStock`
  déjà connue et tracée (ARCH-002), sans lien avec ce lot.
- `node outils/verifier-apprentissage.js` → conforme, 21 règles.
- `node outils/guardian-qa.js` → 0 finding, 272 épreuves.
- `node outils/handoff.js verifier` → conforme (30 lots, 10 avertissements
  préexistants, 0 nouvelle erreur).

### Ce qui n'a pas été fait

Aucune preuve navigateur réelle contre `nexus-station-test` (Employé Test
B) n'a été rejouée dans ce canal : aucun identifiant Supabase Test n'y est
disponible (obstacle structurel documenté sur ce fil depuis le 06/09/2026).
Le correctif est prouvé au niveau du code (extraction et exécution réelle
des fonctions concernées, mutation négative confirmée) mais pas encore
revérifié par une recette navigateur réelle sur le compte Employé Test B —
à faire depuis une session avec accès Test avant toute clôture de lot.

Aucune donnée Test B n'a été touchée : aucun service créé, rouvert, clos
ou supprimé ; aucune action employé cliquée.

### Invariants respectés

Aucun changement `main`/`production`, aucune opération Supabase (aucun
identifiant disponible dans ce canal), aucune promotion Production, aucun
secret ajouté ou exposé, `NEXUS-Pointage-v1.html` non modifié (parcours
déjà prouvé préservé), aucune donnée Test B modifiée.
