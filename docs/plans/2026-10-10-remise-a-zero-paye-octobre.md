# Remise à zéro Paye d'octobre 2026 — dossier

- **Lot :** NEXUS-HEURES-VERIFY-PAYE-1-20261009, decision-1 (Frédéric, #28, 10/10 11:36:58Z et 11:40:30Z ; matérialisée sur le rail en c298f68).
- **Objet :** GO **de principe** pour remettre à zéro les données Paye dérivées et incohérentes : retards automatiques, heures supplémentaires automatiques, durées aberrantes de pointages non arrêtés. Date d'effet : 2026-10-01.
- **Statut :** dossier prêt. **STOP SUPABASE_PRODUCTION_MUTATION** : aucune écriture Production n'est faite ni proposée par ce dossier (voir §6).
- **Mesures :** Production `uzhjpqpctpvxytxpxoqz`, lecture seule (`begin read only … rollback`), 10/10/2026 vers 12:00Z, rejouées par le préflight à **12:07:18Z**.

## 1. Conclusion

**Le périmètre de remise à zéro en base est vide : 0 ligne.**

- Aucune ligne `retard`, `retard_incoherent` ou `heure_supplementaire` n'existe en base, quel que soit le mois.
- Les retards et heures supplémentaires « automatiques » ne sont **jamais persistés**. Le moteur Paye les calcule à l'affichage (`nexus-paye-moteur.js`). Ils disparaîtront quand le moteur servi changera, sans aucune écriture SQL.
- Les 10 lignes Paye persistées sont toutes des **décisions manager**, avec `cree_par` renseigné (0 ligne sans auteur). Ce sont des données manuelles fiables : la decision-1 interdit d'y toucher, sous peine de STOP.
- Les durées aberrantes ne sont pas des données Paye. Ce sont 15 services d'octobre sans heure de fin, et Production n'en tire aucune durée (`dureeServiceMs` rend `null`). Elles relèvent d'une clôture par le manager (§5.3), pas d'une purge.

La remise à zéro d'octobre est donc **un changement de code**, pas une mutation de données. Le chemin de code a des dépendances non maîtrisées (§4), ce qui déclenche lui aussi un STOP.

## 2. Inventaire (condition 1)

### 2.1 `nexus_paye_items` — 10 lignes

Statistiques de la table : 10 insertions, 0 mise à jour, 0 suppression. Les 10 lignes concernent le site `vito-sainte-marie` et ont toutes été créées par le manager `188ddf1f`.

| Période | Type | Origine | Statut | Impact paie | Lignes |
|---|---|---|---|---|---|
| 2026-09 | presence_exceptionnelle | — | valide | non | 1 (e0850538, 09-01) |
| 2026-09 | presence_exceptionnelle | — | exclu | — | 1 (e0850538, 09-01) |
| 2026-09 | absence_a_verifier | indisponibilité 0911a20f | valide | oui | 1 (09-30) |
| 2026-10 | presence_exceptionnelle | verify | valide | oui | 7 |

Les 7 lignes d'octobre ont été saisies le 10/10 entre 10:39 et 10:40Z, **avant** la décision. Chacune porte la note « Heures corrigées manuellement : N h (barème NEXUS : N h) ».

| Employé | 10-01 | 10-02 | 10-07 | 10-08 |
|---|---|---|---|---|
| e0850538 | 480 min | 480 min | 420 min | 480 min |
| 0d44032a | 480 min | — | 420 min | 480 min |

Septembre est de l'historique à préserver (decision-1), et octobre est entièrement manuel. **Cible : 0.**

### 2.2 `nexus_paye_periodes` — 0 ligne

Aucun mois n'est en brouillon, vérifié ou transmis.

### 2.3 `pointages` — 0 ligne en octobre

Le dernier pointage date du 2026-08-30. En août : 50 arrivées, dont 18 avec un `retard_min > 0` (11 902 min au total).

Le moteur servi tire ses retards **uniquement** de `pointages.retard_min`. Il ne peut donc afficher aucun retard en octobre. La question « faut-il neutraliser `retard_min` d'octobre » ne se pose pas.

### 2.4 `shifts` — 15 services en octobre, tous sans `heure_fin`

| Statut | Nombre | Détail |
|---|---|---|
| clos_sans_pointage | 11 | 9 par cycle_pilote, 1 par manager, 1 par prise_de_poste_suivante |
| en_cours | 4 | 1568a637 (c3445093) depuis le 10-06 ; 0a266349 (f98c64f6) depuis le 10-07 ; aadcde23 (e0850538) depuis le 10-09 ; 8d7a51ab (d0656292) depuis le 10-10 |

Entre `heure_debut` et `cloture_le`, il s'écoule de 0,8 h à 49,7 h.

Aucune durée n'en est tirée :
- `nexus-pointage-regles.js` rend `null` sans `heure_fin`, et `finNonEnregistree(service)` le signale ;
- la Paye ne lit pas `shifts`.

Ces lignes sont des **sources** et ne sont pas des cibles (decision-1 : ne jamais supprimer les sources).

## 3. Sauvegarde et journal (condition 2)

Rien n'est modifié, donc il n'y a rien à restaurer. Si un rechiffrage faisait apparaître des cibles, l'export préalable serait le suivant, exécuté par un rôle qui lit la table et archivé avant tout geste :

```sql
\copy (select * from public.nexus_paye_items where periode >= date '2026-10-01' order by id) to 'nexus_paye_items_2026-10_avant.csv' csv header
```

Le journal d'audit est ce dossier, accompagné de la sortie du préflight (§6), et il est versionné sur le rail.

## 4. Dépendances et non-régression (condition 3)

Le seul levier réel est le moteur Paye servi. Quatre dépendances ne sont **pas maîtrisées**, et chacune déclenche à elle seule le STOP « dépendance non maîtrisée » :

1. **La refonte n'existe que dans un checkout local.**
   - Elle vit sur la branche `config-par-environnement`, en 0fce89b, dans `~/Documents/nexus-vito-github`.
   - Elle a 10 commits d'avance sur `origin/config-par-environnement` (18ce051), et aucune ref distante ne la contient.
   - Elle appartient à une autre session, et je n'y touche pas.
   - Sans elle, il n'existe aucun moteur « sans retards ni heures supp automatiques » à déployer.
2. **La refonte contredit Q1.** Elle supprime l'heure supplémentaire de la 8e heure. La decision-1 exige au contraire, pour les journées au barème 8 h, l'affichage séparé de 7 h de base et 1 h supplémentaire, sans taux inventé. Il faut réintroduire cette règle avant tout déploiement.
3. **La refonte change de source de planning.** Production lit `v_planning_officiel` (planning publié). La refonte lit directement `planning_shifts`, la table sous-jacente, sans le filtre `publie`. C'est une régression possible, non mesurée : la paie pourrait compter un planning non publié.
4. **La migration `20261009120000` n'est appliquée nulle part** (request-2).

**Risque de double comptage (Q1).** Les 7 saisies manuelles d'octobre portent déjà 480 ou 420 minutes. Une fois la règle « 7 h + 1 h supp » réintroduite, il faut prouver que la 8e heure n'est pas comptée à la fois dans la saisie manuelle (480 min) et en heure supp calculée.

**Épreuves de non-régression à écrire sur le candidat de code (pas sur ce dossier) :**
- aucun item `retard` produit, même avec `pointages.retard_min > 0` ;
- aucune heure supp produite par la règle des jours [4,5,6] ;
- une journée de 8 h affiche 420 min de base et 60 min supp, sans montant ;
- un service sans `heure_fin` ne produit ni heures payées ni heures supp ;
- une `presence_exceptionnelle` manuelle de 480 min n'est pas recomptée ;
- seul le planning publié est lu.

## 5. Plan d'exécution

### 5.1 Données : plan SQL vide, donc idempotent par construction

Il n'y a aucun `delete` ni `update` à proposer. Le préflight est le contrôle : il échoue si une cible apparaît. Un plan SQL non vide ne serait rédigé qu'après un nouvel inventaire chiffré et un GO d'exécution distinct.

### 5.2 Code (hors de ce dossier, sous GO)

Il faut, dans l'ordre :
1. publier ou intégrer la refonte ;
2. réintroduire Q1 ;
3. trancher la source de planning ;
4. décider du sort de 20261009120000 ;
5. passer les épreuves du §4 ;
6. ouvrir une PR vers `production` (fusion et déploiement par Frédéric).

### 5.3 Clôtures par le manager (par l'écran, jamais en SQL)

- **Les 4 services `en_cours`** doivent être clos avec leur heure de fin réelle. Sans cela, la règle A (plus de 12 h signifie un oubli de pointage) les laisse non payés, sans plafonnement.
- **Les 11 `clos_sans_pointage`** n'ont pas d'heure de fin. Si l'employé a réellement travaillé, le manager saisit la présence. Sinon, rien.

## 6. Préflight et post-contrôle (condition 4)

Fichier : [`2026-10-10-remise-a-zero-paye-octobre-preflight.sql`](2026-10-10-remise-a-zero-paye-octobre-preflight.sql). Il est en lecture seule, `ON_ERROR_STOP` est obligatoire, et il exige un rôle qui lit `nexus_paye_items` : `nexus_prod_readonly` ne le peut pas, mesuré le 10/10.

Il échoue si l'une de ces conditions se produit :
- une ligne retard ou heure supp apparaît en base pour une période postérieure ou égale à octobre ;
- une période est vérifiée ou transmise ;
- un pointage d'octobre apparaît.

Résultat le 10/10 à 12:07:18Z : **vert**. Témoins : 10 lignes, 0 sans auteur, 0 période, 4 services en cours, 15 sans fin.

Le post-contrôle après déploiement du code est le même script, plus une vérification à l'écran : Paye d'octobre sans retard ni heure supp automatique, et les 7 saisies manuelles inchangées.

## 7. Mois clos et rapports (condition 5)

Aucun mois n'est clos : `nexus_paye_periodes` est vide, il n'existe donc aucun instantané PDF figé. Le changement de moteur modifiera l'affichage de **tous** les mois recalculés, septembre compris, puisque rien n'est figé.

Q2 (mois clos) reste ouverte. Si septembre doit rester tel qu'affiché aujourd'hui, il faut le vérifier puis le transmettre (ce qui crée l'instantané) **avant** de déployer le nouveau moteur.

## 8. Décisions attendues (arbitre : Frédéric ou ChatGPT)

1. **Propriétaire de la refonte :** qui pousse `config-par-environnement` (0fce89b) ou la cède à ce lot ?
2. **Source de planning :** faut-il garder `v_planning_officiel` (publié seulement) ?
3. **Septembre (Q2) :** faut-il le figer par transmission avant le nouveau moteur ?
4. **Q4 (cellule de planning vide) et B (`heuresExceptionnelles`) :** toujours ouvertes, elles sont nécessaires pour écrire les épreuves du §4.
