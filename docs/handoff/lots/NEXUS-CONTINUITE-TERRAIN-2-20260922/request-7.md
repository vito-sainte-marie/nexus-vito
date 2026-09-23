---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-CONTINUITE-TERRAIN-2-20260922
seq: 7
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=5b047e0 production=2bc7b39
  - id: mesure-avant-portage-fe36a8e
    classe: VERIFIED
    valeur: 217-224-exactement-7-connus-confirme-independamment
  - id: mesure-apres-portage-664af985
    classe: VERIFIED
    valeur: 198-224-26-echecs-7-connus-plus-19-nouveaux
  - id: reperes-repares
    classe: VERIFIED
    valeur: liste-connus-intacte-aucun-repare
  - id: cause-isolee-290a217f
    classe: VERIFIED
    valeur: diff-664af985-290a217f-limite-a-tests-yml-reverifie-cette-session
  - id: nexus-auth-shrink
    classe: VERIFIED
    valeur: 932-lignes-avant-305-apres-reverifie-git-show-cette-session
  - id: stack-trace-reception-m3
    classe: VERIFIED
    valeur: nexusEstManager-absent-match-null-ligne174
  - id: garde-permission-role-du-jour
    classe: VERIFIED
    valeur: test-role-du-jour-20260905-compte-58-occurrences-echoue
  - id: absence-sur-rail
    classe: VERIFIED
    valeur: git-grep-nexusEstManager-nexusFuseauValide-zero-hit-sur-HEAD-reverifie-cette-session
  - id: liste-connus-non-modifiee
    classe: VERIFIED
    valeur: aucune-ecriture-tests-yml-candidate
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune-requete-aucun-merge-aucun-deploiement
---
# Diagnostic — l'écart à « Comparer aux échecs connus » est une régression fonctionnelle réelle, pas de la dette mécanique

Réponse au réveil qui rapporte le run `35838111274` sur `664af985` (candidate
`rebuild/carburants-65-20260922`) : `Cohérence des épingles de cache` verte,
`Suite de non-régression` termine, puis échec à `Comparer aux échecs connus`.

## 1. Méthode — mesure réelle, pas une lecture de commentaire

Aucune écriture Git (checkout/fetch/push/worktree/archive/ls-tree toutes
refusées par le harnais dans ce canal, comme lors des sessions précédentes de
ce lot). Le contenu des arbres a été reconstruit en lecture seule fichier par
fichier (`git show <ref>:<chemin>` pour chacun des ~1146 fichiers, aucune
écriture Git au sens propre) dans un répertoire hors dépôt, puis exécuté
réellement avec `node run-tests.js`. Deux arbres mesurés :

- `664af9853481cb6676a900dd37f89257898c4a20` (candidate actuelle) ;
- `fe36a8ebafb2a64dd1cc4f558424f3915749b4eb` (candidate juste avant le
  portage mécanique, dernier commit dont le message affirme « 217/224,
  exactement les 7 échecs de la liste CONNUS, aucun nouveau, aucun réparé »).

## 2. La liste des 7 échecs connus est intacte — aucun test réparé

Sur `664af985`, les 7 tests de `CONNUS` (déclarés dans
`.github/workflows/tests.yml` de la candidate) échouent toujours, à
l'identique (`test_inventaire_categorie_mixte_deux_lieux.js`,
`test_inventaire_production_journaliere_q1.js`,
`test_inventaire_sprint4_ux_flash.js`,
`test_inventaire_sprint4bis_ecriture_immediate.js`,
`test_pilotage_qualite_receptions.js`, `test_reception_moteur.js`,
`test_reception_v1_dom.js`). `REPARES` est vide : la liste ne doit pas être
réduite.

## 3. Mais 19 tests supplémentaires échouent désormais — mesuré, pas supposé

`node run-tests.js` sur `664af985` : **198/224**, 26 échecs (les 7 connus +
19 nouveaux). Sur `fe36a8e` (mesuré indépendamment, sans se fier au message
du commit) : **217/224**, exactement les 7 connus, confirmé. Le nombre total
de tests (224) est identique des deux côtés — aucun fichier de test
ajouté/retiré entre les deux mesures.

Les 19 nouveaux échecs :
```
test_acces_hors_service_20260916.js
test_accueil_hors_service_20260918.js
test_cloture_services_obsoletes_20260916.js
test_connexion_nest_pas_presence_20260916.js
test_fuseau_parametres_station_20260920.js
test_fuseau_station_20260918.js
test_jour_metier_pointage_20260919.js
test_missions_jour_station_20260918.js
test_pointage_interrupteur_global.js
test_reception_compartiments_incomplet.js
test_reception_compartiments_saut_multiple_v2254.js
test_reception_entete_partagee.js
test_reception_jaugeage_correctifs.js
test_reception_m3_et_vide.js
test_reception_regularisation_20260919.js
test_reception_visite_render.js
test_regularisation_manager_20260916.js
test_role_du_jour_20260905.js
test_service_courant_unique_20260905.js
```

## 4. Cause exacte, isolée par mesure — le portage « mécanique » ne l'était pas

Seuls deux commits séparent `fe36a8e` de `664af985` :

- `290a217f0f07d4f408469bc9cb8239814544f092` — « rebuild(65): porter la
  chaine de build/config du rail (7 fichiers, mécanique) » ;
- `664af9853481cb6676a900dd37f89257898c4a20` — « ci: aligner la garde build
  du candidat carburants #65 ».

`git diff --name-only 290a217f… 664af985…` confirme que le second commit ne
touche que `.github/workflows/tests.yml` (exactement le patch approuvé par
`decision-5.md`, déjà mesuré vert sur cette étape). **Les 19 nouveaux échecs
viennent donc entièrement de `290a217f`.**

Les « 7 fichiers » de ce portage :
```
_headers
nexus-auth.js
nexus-bandeau-environnement.js
nexus-page.js
outils/build.sh
outils/generer-config.js
outils/poser-build-id.js
```

`nexus-auth.js` passe de **932 à 305 lignes**. Ce n'est pas un ajustement de
chaîne de build : ce fichier perd des fonctions et blocs nommés que la
candidate avait développés elle-même (travail « Continuité terrain » du
16 au 20/09, indépendant du rail) :

- `nexusEstManager` (4 occurrences avant, 0 après) ;
- `nexusFuseauValide` (2 → 0) ;
- le bloc `/* NEXUS-FUSEAU-METIER:DEBUT */` (2 → 0).

Recherche sur l'intégralité de la branche canonique `handoff-continuite-20260920`
(ce checkout) : **aucune** occurrence de `nexusEstManager` ni
`nexusFuseauValide`, nulle part. Cette logique n'existe donc pas ailleurs sur
le rail sous un autre nom accessible — elle n'a simplement jamais été
répliquée depuis la candidate. Le portage a réintroduit le fichier du rail
tel quel, effaçant le seul exemplaire de cette logique.

Preuve d'exécution directe (`node test_reception_m3_et_vide.js`) :
```
TypeError: Cannot read properties of null (reading '0')
    at .../test_reception_m3_et_vide.js:174:50
```
— la ligne 174 extrait `nexus-auth.js` par
`.match(/function nexusEstManager\([\s\S]*?\n}/)[0]` pour la rejouer dans un
bac à sable : la fonction n'existe plus, le `match` renvoie `null`, `[0]`
lève. Le même mécanisme (extraction/assertion de texte sur `nexus-auth.js`)
explique directement `test_acces_hors_service_20260916.js`,
`test_accueil_hors_service_20260918.js`, `test_fuseau_station_20260918.js`,
`test_missions_jour_station_20260918.js`,
`test_pointage_interrupteur_global.js`,
`test_connexion_nest_pas_presence_20260916.js`, et le reste du groupe
« reception » (même extraction de `nexusEstManager`).

Cas le plus parlant : `test_role_du_jour_20260905.js` est une **garde de
non-régression dédiée**, qui compte les occurrences des contrôles de
permission sur la fiche employé à travers tout le dépôt et échoue si le total
change. Il attend 58 occurrences (`nexus-auth.js` en portant 2 auparavant) ;
après le portage, ce total a changé et le test — construit précisément pour
détecter la disparition silencieuse d'un contrôle de permission — a échoué.
C'est le signal, pas un bruit.

## 5. Verdict du diagnostic demandé

- **Aucun test réparé.**
- **19 nouveaux échecs**, tous imputables au seul commit `290a217f`.
- **Ce n'est ni de la dette mécanique ni un défaut de la liste legacy** : la
  liste `CONNUS` reste correcte pour l'arbre d'avant `290a217f`. Le problème
  n'est pas la liste, c'est le contenu porté.
- Conclusion : **régression fonctionnelle réelle**, sur un fichier qui porte
  de l'authentification et de l'autorisation. Je n'ai ni modifié la liste des
  échecs connus, ni tenté de restaurer les fonctions supprimées, ni rejoué la
  CI — restaurer du code métier/sécurité sans savoir laquelle des deux lignes
  de développement (rail vs candidate) doit faire foi pour `nexus-auth.js`
  dépasse un diagnostic déterministe.

## 6. Ce qui reste à arbitrer

`nexus-auth.js` porte deux évolutions divergentes depuis un fork ancien :
côté rail, le refactor build/config du 04-05/09 (garde `NEXUS_CFG` fail
closed, `NexusPage`/`NexusBuild`) ; côté candidate, des ajouts métier
(fuseau station, pointage, accès hors service, jour métier) faits entre le
16 et le 20/09 sans jamais recevoir ce refactor. Le portage du 22/09 a fait
comme si le fichier n'était qu'un maillon de la chaîne build/config et l'a
remplacé en bloc, perdant la seconde ligne. Décision nécessaire, hors de ce
diagnostic : fusionner les deux (garder le refactor build/config du rail
**et** réintégrer les fonctions métier de la candidate dans `nexus-auth.js`
ou dans un module dédié type `nexus-station.js`/`nexus-pointage-regles.js`
déjà présents sur le rail), ou toute autre voie que l'Orchestrator retient —
ce choix n'est pas déterministe et n'a pas été fait ici.

## Ce que ceci ne change pas

`decision-5.md` reste exécutée telle quelle : le patch CI est bien en place
et fonctionne (`Cohérence des épingles de cache` verte, confirmé par le
réveil). La candidate n'est pas déclarée prête. Le ciblage Supabase Test réel
et la preuve navigateur restent, comme avant, subordonnés à une CI
réellement verte — qui ne l'est pas tant que ce point n'est pas arbitré.

## Invariants respectés

Aucun changement `main`/`production`, aucune opération Supabase, aucune
migration/écriture Supabase Production, aucun déploiement Production, aucune
règle métier/UX/RLS/rôle modifiée, aucun secret créé/lu/exposé, la liste des
échecs connus n'a pas été touchée, aucune garde affaiblie, `nexus-auth.js`
n'a pas été modifié par cette session (diagnostic en lecture seule
uniquement, hors dépôt de travail).
