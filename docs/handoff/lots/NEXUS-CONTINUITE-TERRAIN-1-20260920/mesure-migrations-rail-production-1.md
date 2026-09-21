# Les 25 migrations qui séparent le rail de Production — ce qu'elles sont

Complément à `cartographie-rail-production-1.md`, qui laissait explicitement
cette question non mesurée : « le contenu des 30 commits de migration face aux
14 migrations de Production absentes du rail ». Mesure en lecture seule, aucun
accès base, aucune écriture hors ce document.

## Méthode

```
git ls-tree -r --name-only origin/production                 -- supabase/migrations/ | sed 's#.*/##' | sort
git ls-tree -r --name-only origin/handoff-continuite-20260920 -- supabase/migrations/ | sed 's#.*/##' | sort
comm -23 / comm -13
```

Comparaison de fichiers par nom, pas d'effet en base. Une migration peut exister
en Production sous une autre estampille sans fichier au dépôt — c'est une dette
connue et distincte, hors de cette mesure.

## Le compte

| | |
|---|---|
| Migrations sur `production` | 276 |
| Migrations sur le rail | 273 |
| Présentes sur Production, absentes du rail | 14 |
| Exclusives au rail | 11 |
| Supprimées d'un côté ou de l'autre | 0 |

La divergence est **purement additive**. Personne n'a retiré de migration.

## Les 14 absentes du rail ne sont pas un assortiment : c'est un lot

Dix des quatorze nomment `planning`, `horaires`, `source` ou `bascule` :

```
20260919160000_horaires_moteur_unique_et_retard_nullable.sql
20260919180000_planning_source_officielle_projection_normalisee.sql
20260919200000_import_planning_google_sheets.sql
20260919220000_bascule_source_planning_tracee.sql
20260919240000_horodatage_serveur_planning_shifts.sql
20260919260000_bascule_source_planning_date_effet.sql
20260919280000_source_precedente_a_la_date_d_effet.sql
20260920120000_droits_v_planning_officiel.sql
20260920140000_bascule_source_precedente_et_change_le.sql
20260916195000_cloture_source_cycle_pilote.sql
```

Les quatre autres forment un second ensemble cohérent, autour de la caisse et
de la prise de poste :

```
20260914210000_mes_ecarts_caisse_projection_employe.sql
20260916193000_prise_de_poste_ninvente_plus_la_fin.sql
20260916194000_regularisation_fins_inventees_prise_de_poste.sql
20260916210000_mes_ecarts_caisse_masque_le_provisoire.sql
```

**Ces 14 migrations sont du travail Production qui n'est jamais redescendu sur
le rail** — l'inverse exact du sens habituel de la file d'attente.

### Une vérification que cette mesure permet de clore

`20260916193000_prise_de_poste_ninvente_plus_la_fin.sql` porte l'identifiant
**P-1**, pas **P0-1**. Elle corrige en base le trigger
`nexus_shifts_avant_insertion`, qui clôturait le service précédent avec
`heure_fin = NEW.heure_debut` et fabriquait des durées (jusqu'à 2 j 00 h 24 en
Production). Le candidat **P0-1** de ce lot porte sur le fuseau des deux
chargeurs de l'Accueil, dans `nexus-app-donnees.js` et
`nexus-conseiller-donnees.js`. **Aucune collision, aucun recouvrement** : la
proximité des noms ne recouvre pas la même chose. Le candidat de ce lot ne
réimplémente pas un correctif déjà livré.

## Les 11 exclusives au rail : neuf n'ont pas vocation à monter

Neuf sur onze sont de l'outillage Test/CI, sans existence possible en
Production :

```
20260906113147_pompiste_du_jour_fuseau_station_test.sql
20260907222249_creer_nexus_live_events_test.sql
20260908033743_acces_rls_role_ci_recette_site_test.sql
20260908035027_lecture_sites_role_ci_recette_pour_evaluation_rls.sql
20260909110000_lecture_station_config_test_pour_derive_recette.sql
20260909140000_droits_table_role_ci_recette_semis.sql
20260909150000_usage_schema_public_role_ci_recette.sql
20260909160000_publication_journal_live_par_la_ci.sql
20260909170000_mode_environnement_test_preprod.sql
```

Les deux autres méritent chacune un traitement propre, et **aucune des deux ne
relève de ce lot** :

- `20260904175747_login_non_enumerable.sql` — elle se désavoue elle-même dès
  son en-tête (« ⚠️ CE N'EST PAS LE REMPLACEMENT PRÉVU »), le cadrage de
  recette du 04/09 ayant écarté la solution qu'elle retient. Elle exige du code
  avant d'être appliquée.
- `20260908200000_actor_role_human_pour_autorisation_frederic.sql` — élargit la
  contrainte d'acteur de la table d'événements à `human`. Sans elle, le bouton
  « J'autorise » de l'écran Live échoue en base à l'instant précis où NEXUS
  demande à Frédéric de décider.

## Ce que cette mesure change pour l'arbitrage

1. **« Réconcilier les migrations » n'est pas un échange de 25 fichiers.** C'est
   un transport **à sens unique** de 14 migrations Production vers le rail. Les
   11 du rail ne partent pas dans l'autre sens : neuf n'ont pas de destination,
   deux relèvent de décisions distinctes.
2. **Ce transport verdirait l'étape CI qui masque tout le reste.** L'étape
   « Immuabilité des migrations déjà en production » compare précisément ces
   deux listes ; elle échoue et **saute les 45 étapes suivantes**, dont toutes
   les épreuves Handoff. Le vert Handoff de ce rail n'a donc jamais été mesuré
   par la CI — seulement en local.
3. **Le lot Planning est le vrai contenu de la divergence en base.** Il touche
   l'import Google Sheets et la bascule de source, sur lesquels une interdiction
   explicite du Créateur est en vigueur (« ne déclenche aucune bascule de source
   réelle »). Transporter ces fichiers sur le rail n'est pas les exécuter, mais
   la distinction doit être tenue par écrit avant le geste.

## Ce que je n'ai pas mesuré

Si les 14 fichiers s'appliquent proprement sur le rail (conflit d'estampille,
dépendance à un objet absent), et si leur transport suffit à verdir l'étape 5
ou seulement à la faire échouer plus loin.

## STOP

Document de mesure. **Aucun transport n'est engagé, aucun ordre n'est proposé.**
Refs au moment de la mesure : `main=a786408`, `production=6c3efcc`,
`handoff-continuite-20260920=11b5283`.
