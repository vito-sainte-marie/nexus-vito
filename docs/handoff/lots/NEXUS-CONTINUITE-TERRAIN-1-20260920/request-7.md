---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-CONTINUITE-TERRAIN-1-20260920
seq: 7
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=a786408 production=6c3efcc
  - id: base-production-exacte
    classe: VERIFIED
    valeur: origin_production_6c3efcc_inchange
  - id: diff-exact-3-fichiers
    classe: VERIFIED
    valeur: nexus-app-donnees_nexus-conseiller-donnees_NEXUS-App-v1_20_lignes_utiles
  - id: dependance-dd4d0f3-non-necessaire
    classe: VERIFIED
    valeur: nexus-station_nexus-verify-moteur_migration_split_validation_deja_en_production
  - id: tests-baseline-candidat-mutation
    classe: VERIFIED
    valeur: 8_sur_8_execution_reelle
  - id: regression-portee-exacte
    classe: DECLARED
    valeur: diff_octet_pour_octet_recherche_exhaustive_appelants_suite_274_non_rejouee_arbre_production_complet
  - id: obstacle-branche-jetable-reelle
    classe: DECLARED
    valeur: git_checkout_worktree_fetch_archive_hash-object_bloques_materialisation_git_show_fichier_par_fichier
  - id: p0-2-b1-brief-non-touches
    classe: VERIFIED
    valeur: aucun_fichier_station_config_role_rls_brief_modifie
  - id: guardians
    classe: VERIFIED
    valeur: 0_finding
  - id: apprentissage
    classe: VERIFIED
    valeur: 21_regles_conforme
  - id: handoff-verifier
    classe: VERIFIED
    valeur: conforme_avant_apres
  - id: decision-6-consommee
    classe: VERIFIED
    valeur: commit_0bdff44
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune_requete_aucun_merge_aucun_deploiement
---
# Candidat P0-1/P0-3 reconstruit depuis Production — `dd4d0f3` non nécessaire

Périmètre exécuté conforme à `decision-6.md` : `decision-6.md` consommée ; le candidat P0-1/P0-3 est reconstruit **depuis `origin/production`** (`6c3efcc`, inchangé), pas depuis le rail. Preuve complète dans `candidat-p0-production-1.md` sur la branche de travail Claude ; le transport canonique de cette demande conserve les preuves vérifiables du dépôt source.

Le candidat scratch porte exactement trois fichiers : `nexus-app-donnees.js`, `nexus-conseiller-donnees.js`, `NEXUS-App-v1.html`. `dd4d0f3` n'est requis pour aucune partie de P0-1/P0-3 : les primitives `NexusStation.dateLocaleStation`, `NexusVerifyMoteur.statutValidationQuart` et les colonnes Verify nécessaires existent déjà sur Production.

Tests exécutés : baseline Production mord sur P0-1 et P0-3, candidat vert, mutation négative détectée, **8/8**. Aucun P0-2/B1/#62/#65/Brief, aucune migration, aucune RLS, aucun rôle, aucune écriture Supabase.

Limite explicitement restante : la suite complète `node run-tests.js` sur un checkout réel Production + ce diff n'a pas été rejouée dans le canal Claude, les opérations git nécessaires étant bloquées. Cette preuve doit précéder toute promotion.

Aucun changement `main`/`production`, aucune promotion Production. STOP à cette gate.