# Dossier de la Vague 1 — refonte du cycle de caisse FDJ

**Date de clôture du dossier : 17/09/2026.**
**État : préparé, non appliqué, non fusionné, non déployé.**

Ce document est le livrable exigé avant arrêt par le §13 du mandat. Il est
organisé dans l'ordre des 25 points demandés. Chaque affirmation renvoie soit
à un fichier du dépôt, soit à une mesure datée prise sur une base réelle.

> Rappel du cadre, valable pour tout ce qui suit : **rien de ce qui est décrit
> ici n'a été appliqué à la Production.** Aucune migration n'a été exécutée de
> façon persistante nulle part — ni sur Test, ni sur Production. Toutes les
> lectures de Production faites pour ce dossier sont des `SELECT` (point 25).

---

## 1. La branche créée

`fdj-vague1-cycle-caisse-20260916`

Elle ne contient que la Vague 1 : aucun autre travail, aucune reprise d'une
branche antérieure. Ses commits se lisent par leur rôle, dans l'ordre :

1. **Phase A — étendre** : les neuf migrations additives.
2. **Phase B — basculer** : le front qui n'appelle plus que les commandes
   serveur.
3. **Phase C — fermer** : les RLS définitives et le retrait des écritures
   directes devenues inutiles, écrites mais **non appliquées**.
4. **Les défauts que seule l'exécution a montrés** (point 5.7) et la garde
   `test_fdj_vague1_invariants_ecriture.js` qui les retient.
5. **Les preuves des livrets et des données existantes** (§10.5 et §10.6), le
   compteur de migrations de l'épreuve d'empreinte porté de 267 à 276, et ce
   dossier.

Le décompte n'est pas figé ici, pour la même raison que le SHA ne l'est pas au
point 2 : l'ouverture de la PR, puis tout correctif que la CI demanderait,
ajoutent des commits à une branche que ce fichier habite. `git log --oneline
da38b67a9e106ea495d03484ed2e3064b0a3eadb..` sur la branche donne la liste
exacte au moment où on la lit — et c'est cette commande qui fait foi, pas ce
paragraphe.

## 2. Son SHA de tête

**Le SHA n'est pas écrit dans ce fichier, et c'est volontaire.** Un fichier qui
nomme son propre commit ne peut pas dire la vérité : l'écrire modifie l'arbre,
donc change le SHA qu'il vient d'annoncer. La valeur exacte est donnée hors du
dépôt — dans le corps de la pull request et dans le message de restitution qui
accompagne ce dossier.

La règle vérifiable, elle, est écrite ici : la tête de la branche est son
dernier commit, celui que `git log --oneline -1` rend sur
`fdj-vague1-cycle-caisse-20260916`, et tous ses commits portent un titre
commençant par `FDJ Vague 1 —`. Aucun commit d'une autre origine n'y figure :
`git log --oneline da38b67a9e106ea495d03484ed2e3064b0a3eadb..` ne doit
retourner que ceux-là.

(Une version antérieure de ce point annonçait le commit de Phase C comme tête.
C'était vrai à l'heure où la ligne a été écrite, et faux une heure plus tard :
c'est exactement la raison pour laquelle un SHA ne s'écrit pas dans le fichier
qu'il désigne.)

## 3. Le lien de la pull request

Renseigné au moment de l'ouverture de la PR, dans le commit qui suit la
rédaction de ce dossier. La PR vise `production`, en mode ouverture seule :
**elle ne doit pas être fusionnée** (§12).

## 4. La base exacte utilisée pour la branche

`origin/production` = **`da38b67a9e106ea495d03484ed2e3064b0a3eadb`**, tête
réelle relevée après actualisation des références distantes.

Ce point mérite une phrase, parce qu'il a déjà coûté cher : la branche est
partie de `origin/production`, **jamais de la branche locale du même nom**.
La branche locale peut être en retard de plusieurs PR sans qu'aucun signal ne
l'indique — un diff calculé contre elle décrirait un travail qui n'existe pas.

## 5. Le diff, classé par règle métier

**25 fichiers, +8 392 / −594**, mesuré par

```
git diff --stat da38b67a9e106ea495d03484ed2e3064b0a3eadb -- . \
  ':(exclude)DOSSIER-FDJ-VAGUE1-20260917.md'
```

Le présent dossier est exclu du compte **à dessein** : il vit dans l'arbre
qu'il décrit, donc le chiffre qui l'inclurait changerait à chaque fois qu'on
l'écrit — c'est le même piège qu'au point 2 avec le SHA. Avec lui, la commande
sans exclusion annonce 26 fichiers.

Les commits suivent les phases du §9 — un par phase —, plus celui des défauts
du point 5.7 et celui des preuves §10.5/§10.6 ; le point 1 en donne la lecture
par rôle.

### 5.1 — Règle §2 : ce qui ouvre un quart FDJ, et ce qui ne l'ouvre pas

| Fichier | Ce qu'il fait |
|---|---|
| `supabase/migrations/20260916220000_fdj_quart_relie_a_la_prise_de_poste.sql` | Relie le quart à son **événement de prise de poste source** (`prise_de_poste_id`), distingue l'auteur technique (`created_by`) du responsable opérationnel (`employee_id`), pose l'idempotence forte et le vocabulaire du transfert explicite. |
| `supabase/migrations/20260916220500_fdj_commande_ouverture_quart.sql` | `fdj_ouvrir_quart_depuis_prise_de_poste()` — la **seule** porte d'ouverture. Elle exige un événement de prise de poste existant ; elle ne peut être déclenchée ni par une authentification, ni par l'arrivée sur un écran. |
| `NEXUS-Prise-De-Poste-v1.html` | L'ouverture suit la prise de poste employé. **Aucun second bouton « Commencer mon quart FDJ » n'a été ajouté** (§2.2). |

### 5.2 — Règle §3 : le cycle de vie de la caisse

| Fichier | Ce qu'il fait |
|---|---|
| `…220100_fdj_caisse_cycle_de_vie_colonnes.sql` | Les états, les auteurs (`saisi_par`, `confirme_par`, `controle_par`), le numéro de version, et la contrainte qui interdit une validation incomplète. |
| `…220200_fdj_caisse_journal_evenements.sql` | `fdj_caisse_evenements` — journal **immuable** ; un index unique garantit qu'il n'existe qu'une seule confirmation initiale par caisse, et un trigger interdit de la réécrire (§3.2). |
| `…220600_fdj_commandes_caisse_employe.sql` | `fdj_enregistrer_brouillon_caisse()`, `fdj_confirmer_caisse()`, `fdj_corriger_caisse_confirmee()`, `fdj_signaler_erreur_apres_validation()`. |
| `…220700_fdj_commandes_caisse_manager.sql` | `fdj_ouvrir_controle_caisse()`, `fdj_valider_caisse()`, `fdj_rouvrir_caisse()`, `fdj_corriger_caisse_manager()`, `fdj_traiter_demande_correction()`, `fdj_chronologie_caisse()`, `fdj_alertes_caisse()`. |
| `…220300_fdj_demandes_correction_apres_validation.sql` | La demande horodatée du §3.7 : elle ne modifie **aucune** valeur validée. |
| `NEXUS-FDJ-v1.html` | « CLÔTURER MA CAISSE » devient « **CONFIRMER MA CAISSE ET LA TRANSMETTRE** ». |

### 5.3 — Règle §3.3 et §4 : ce que l'employé voit, et ce qu'il reçoit

| Fichier | Ce qu'il fait |
|---|---|
| `…220800_fdj_projection_employe.sql` | `fdj_ma_caisse()` et les projections voisines. Avant confirmation : `ecart_etabli: false`, `ecart_provisoire: null`. Après : `ecart_provisoire` puis, après validation, `ecart_retenu`. **Aucun champ manager n'est jamais envoyé.** |
| `NEXUS-FDJ-v1.html` | Suppression de `renderCarteEcart()`, `phraseEcartCaisse()` et `LIBELLES_STATUT_CAISSE`. Ces fonctions recevaient la ligne `fdj_cash_controls` entière — donc le motif interne du manager — et **recomposaient** le vocabulaire côté écran. Les libellés sont désormais fixés par le serveur (`fdj_libelle_ecart_employe`) et recopiés tels quels. |

### 5.4 — Règle §6 : les mouvements de livrets

`…220400_fdj_mouvements_auteur_et_date_effet.sql` — sépare `created_by`
(auteur de saisie) de `employee_id` (responsable), sépare `effective_at`
(effet réel) de `created_at` (enregistrement), et pose une **clé
d'idempotence** sur les nouvelles écritures.
**Aucune activation ni aucun mouvement réel n'a été créé** (§6, dernière phrase).

### 5.5 — Règle §5 : la fermeture des écritures directes

`supabase/phase-c/20260916230000_fdj_rls_definitives_phase_c.sql` — écrite,
prouvée, **délibérément placée hors de `supabase/migrations/`** (voir point 22).

### 5.6 — Règle §10 : les tests

`test_fdj_carte_ecart_visuelle.js`, `test_fdj_masquage_ecart_cloture_v2266.js`,
`test_fdj_permissions_ecart_caisse.js`,
`test_fdj_vague1_invariants_ecriture.js` (5.7), et
`supabase/phase-c/20260916230000_mutations_de_validation.sql`.

### 5.7 — Les trois défauts que seule l'exécution a montrés

Les trois commits de phase passaient la suite complète du dépôt. La recette
jouée sur `nexus-test` les a pourtant arrêtés net, trois fois. Les deux
correctifs, la garde qui les retient désormais, et la recette elle-même
forment le quatrième commit.

**Défaut 1 — un refus qui détruisait.** `fdj_ecrire_saisies_caisse` écrasait
les deux lignes `fdj_reports` sans condition. Or cette procédure est appelée
**avant** le contrôle de complétude de `fdj_confirmer_caisse`, qui refuse par
un `return` — sans annuler la transaction. Résultat : une confirmation
incomplète, donc refusée, **effaçait les montants déjà saisis au brouillon**.
L'employé voyait un message d'erreur poli et son travail disparaissait.
Correctif : `if p_… is not null then … end if;` autour de chaque upsert, et la
sémantique devient « NULL = non fourni, donc inchangé ».

**Défaut 2 — bloquant.** La contrainte
`fdj_caisse_evenements_versions_check` refusait le couple `(null, 1)` que
`fdj_confirmer_caisse` écrit à la première confirmation : erreur `23514`, la
confirmation était **impossible**. Correctif : une troisième branche réservée
à `confirmation_initiale` — et non `version_avant = 0`, qui aurait inventé une
version zéro n'ayant jamais existé (§8).

**Défaut 3 — un index unique créé en double.** La migration 220400 posait
l'unicité de `fdj_stock_movements.idempotency_key` avec un
`create unique index if not exists fdj_stock_movements_idempotency_unique`, et
son commentaire affirmait : « `idempotency_key` est présente mais n'est unique
nulle part ». C'était faux. Test **et** Production portent déjà
`fdj_stock_movements_idempotency_key_uniq`, dont la définition est identique au
nom près :

```
CREATE UNIQUE INDEX fdj_stock_movements_idempotency_key_uniq
  ON public.fdj_stock_movements USING btree (idempotency_key)
  WHERE (idempotency_key IS NOT NULL)
```

Et `if not exists` compare le **nom** de l'objet, jamais sa définition : la
migration aurait donc bel et bien créé un second index, identique au premier,
sur une table de mouvements de Production — coût d'écriture doublé, aucune
garantie supplémentaire, et un objet que personne n'aurait su interpréter dans
six mois. Correctif : un bloc `do $$` qui interroge `pg_index` sur la
**définition** — un index unique, à une seule colonne clé, portant sur
l'attribut `idempotency_key` — et ne crée que si la base ne l'a pas déjà. Sur
Test comme sur Production au 17/09, ce bloc ne fait donc rien, et c'est le
résultat attendu : la recette le vérifie (preuve P21.4b, un seul index).

Le retour arrière de cette migration a été amendé en conséquence : il ne doit
**jamais** supprimer `fdj_stock_movements_idempotency_key_uniq`, qui est
antérieur à la vague et porte réellement l'unicité.

**Ce que les défauts 1 et 3 ont en commun, et la règle qui en sort.** Le défaut
n°3 répète exactement l'erreur déjà corrigée au point 21 de ce dossier, où le
dossier affirmait que la vague ajoutait l'unicité `(site, date, quart)` alors
que `fdj_shifts_site_date_quart_key` préexistait. Dans les deux cas, *une
affirmation sur l'état de la base a été écrite dans un commentaire de migration
sans avoir été mesurée*, et dans les deux cas elle était fausse. La règle qui
en sort, et qui vaut au-delà de cette vague : **une migration ne doit jamais
affirmer ce qu'elle n'a pas interrogé**. Quand elle dépend d'un état
préexistant, elle le teste au moment de s'appliquer — sur la définition, pas
sur un nom — plutôt que de faire confiance à un commentaire écrit la veille.

**Pourquoi corriger les migrations en place plutôt qu'empiler une migration de
rattrapage.** C'est le seul arbitrage de cette vague qui mérite une
justification écrite. La règle habituelle — ne jamais réécrire une migration —
protège les bases où elle a déjà tourné : la réécrire produirait deux schémas
différents portant le même numéro. Ici, **aucune des neuf migrations n'a
jamais été appliquée nulle part** : ni sur Production, ni sur Test (la recette
s'est terminée par `rollback`), ni sur une branche Supabase. Le registre
`schema_migrations` ne les connaît pas. Il n'existe donc aucune base à
protéger, et une migration de rattrapage ferait l'inverse de ce qu'elle
promet : elle graverait dans l'ordre d'application un état intermédiaire
cassé — une contrainte qui refuse la confirmation, puis un correctif —, que
tout lecteur futur devrait reconstituer pour comprendre le schéma réel.

La condition de validité de cet arbitrage est **vérifiable avant d'appliquer** :
si `select * from supabase_migrations.schema_migrations where version like
'2026091622%'` rend la moindre ligne sur Production ou sur Test, alors la
prémisse est fausse et il faut repasser par une migration de rattrapage. Le
contrôle est à faire au début de la Phase A (point 22) — c'est exactement la
preuve **P22.0** de la recette `20260917_preuves_livrets_et_historique.sql`,
qui refuse de continuer si le registre en connaît une seule. Elle valait 0 le
17/09 sur Test, et les cinq objets de la vague y étaient absents.

**Pourquoi la suite de tests n'avait rien vu**, et ce qui le retient
désormais : les tests FDJ existants sont **statiques** — ils lisent le texte
du SQL et du HTML. `test_fdj_masquage_ecart_cloture_v2266.js` le dit
lui-même, l. 93-96 : « Limite assumée : ce contrôle lit du texte, il n'exécute
pas la fonction. Il constate une intention, pas un refus. » Et la CI ne peut
pas faire mieux : elle est hors-réseau **par conception** — aucun test n'ouvre
de connexion, ce qui est une garantie de sécurité qu'il n'est pas question
d'échanger contre du confort de test.

`test_fdj_vague1_invariants_ecriture.js` répond sous cette contrainte : au lieu
de *lire* le SQL, il l'**interprète**. Il extrait la contrainte de versions,
la traduit mécaniquement en prédicat, extrait les sept `insert` réels du
journal, apparie colonnes et valeurs par position, value chaque expression, et
vérifie que les sept passent. Puis il rejoue tout cela sur la contrainte
**d'avant correction** et exige de la voir échouer — nommément sur
`confirmation_initiale`. Même chose pour les gardes de
`fdj_ecrire_saisies_caisse`, avec un scanner à pile qui repère toute écriture
non gardée. Une garde qui n'a jamais rougi n'est pas une garde (point 18).

## 6. Les états de caisse, avant et après

**Avant** — un seul axe, et un mot qui ment. `fdj_shifts.statut ∈ {brouillon,
valide}`, où **`valide` signifie « transmis par l'employé »**, jamais « validé
par le manager ». Le code front lisait ce `valide` comme une validation
managériale : c'est le contresens que la Vague 1 corrige. En parallèle,
`fdj_cash_controls.statut` portait huit valeurs héritées (`provisoire`,
`a_controler`, `en_attente`, `expliquee`, `regularise`, `valide_avec_ecart`,
`conforme`, `a_regulariser`) sans transition définie entre elles.

**Après** — quatre étapes nommées, une seule source de vérité
(`etapeCaisseFdj()` dans `nexus-fdj-moteur.js`), et la traduction explicite de
la forme historique :

| Étape | Ce que l'employé peut | Écart |
|---|---|---|
| `saisie_a_commencer` | saisir | rien d'établi |
| `brouillon` | saisir, modifier, enregistrer sans transmettre | rien d'établi |
| `en_attente_controle_manager` | **corriger sa saisie** (§3.4) | **écart provisoire visible** (§3.3) |
| `validee` | signaler une erreur, rien d'autre (§3.7) | écart **retenu** |

Les huit valeurs historiques de `fdj_cash_controls.statut` ne sont **pas
supprimées** : la contrainte CHECK est étendue, jamais rétrécie. Aucune ligne
existante ne devient invalide.

## 7. Les politiques RLS, avant et après

**Avant (mesuré sur la Production le 17/09/2026, en lecture seule).** Sur les
sept tables du périmètre, les politiques sont attribuées au rôle `public` et
n'expriment qu'un rattachement au site — aucune ne distingue le manager de
l'employé, ni le titulaire du quart d'un collègue :

| Table | SELECT | INSERT | UPDATE |
|---|---|---|---|
| `fdj_cash_controls` | site | site | **site** |
| `fdj_reports` | site | site | **site** |
| `fdj_releves_cloture` | site | site | — |
| `fdj_corrections` | site | **site** | — |
| `fdj_audit_log` | site | site | — |
| `fdj_shifts` | site | site | **site** |
| `fdj_shift_counts` | site | site | **site** |

Conséquence factuelle : **aujourd'hui, en Production, n'importe quel employé
rattaché au site peut modifier la caisse d'un collègue, et écrire directement
`statut = 'valide'` sans passer par aucune commande.** C'est ce que la Phase C
referme.

**Après (Phase C, écrite et prouvée, non appliquée)** — 11 politiques
remplacées, périmètre table par table :

| Table | SELECT | INSERT / UPDATE |
|---|---|---|
| `fdj_cash_controls` | manager **ou** titulaire du quart | manager seul |
| `fdj_reports` | manager | manager |
| `fdj_releves_cloture` | manager | INSERT manager, **pas d'UPDATE** |
| `fdj_corrections` | manager | **supprimés** (la table n'est plus écrite en direct) |
| `fdj_audit_log` | manager | INSERT site + trigger qui garde `acteur_id` |
| `fdj_shifts` | site (inchangé) | conservés + trigger qui garde les colonnes sensibles |
| `fdj_shift_counts` | site (inchangé) | conservés — **dette assumée, voir point 23** |

L'employé continue d'écrire sa caisse : non plus par une politique large, mais
par les commandes serveur `SECURITY DEFINER`, qui vérifient à chaque appel
l'identité, le rôle, le site, le titulaire, l'état courant et la transition.

## 8. Les fonctions et commandes serveur créées

**30 fonctions**, réparties en cinq familles. Toutes fixent explicitement leur
`search_path`, révoquent `EXECUTE` à `anon` et à `PUBLIC`, et ne l'accordent
qu'aux rôles nécessaires (§4).

**Ouverture et responsabilité du quart (§2)**
`fdj_ouvrir_quart_depuis_prise_de_poste()` · `fdj_transferer_responsabilite_quart()` ·
`fdj_numero_quart_depuis_prise_de_poste()` · `fdj_date_metier()` · `fdj_quart_de_l_employe()`

**Commandes employé (§5.1, §5.3)**
`fdj_enregistrer_brouillon_caisse()` · `fdj_confirmer_caisse()` ·
`fdj_corriger_caisse_confirmee()` · `fdj_signaler_erreur_apres_validation()` ·
`fdj_ecrire_saisies_caisse()`

**Commandes manager (§3.6)**
`fdj_ouvrir_controle_caisse()` · `fdj_valider_caisse()` · `fdj_rouvrir_caisse()` ·
`fdj_corriger_caisse_manager()` · `fdj_traiter_demande_correction()` ·
`fdj_quart_du_manager()` · `fdj_chronologie_caisse()` · `fdj_alertes_caisse()` ·
`fdj_libelle_ecart_manager()`

**Projections employé (§4)**
`fdj_ma_caisse()` · `fdj_mes_quarts_fdj()` · `fdj_mes_comptages_caisse()` ·
`fdj_mes_corrections_caisse()` · `fdj_mes_demandes_correction()` ·
`fdj_libelle_ecart_employe()`

**Calcul et intégrité**
`fdj_calculer_caisse()` · `fdj_ventes_jeu()` · `fdj_chaine_continuite()` ·
`fdj_caisse_evenements_immuable()` (trigger) · `mes_ecarts_caisse()` (ajustée)

Chaque commande d'écriture vérifie, dans cet ordre : **identité** (`auth.uid()`,
jamais un identifiant fourni par le navigateur) → **rôle enregistré en base**
(jamais une métadonnée modifiable côté client, §5.2) → **rattachement au
site** → **titulaire du quart** → **état courant** → **transition demandée** →
**idempotence** → **conflits de concurrence**.

## 9. La projection employé et ses droits

`public.fdj_ma_caisse(p_shift_id uuid)` — `SECURITY DEFINER`, `search_path`
fixé, `EXECUTE` révoqué à `anon` et `PUBLIC`, accordé à `authenticated` seul.

Elle prend le `shift_id` mais **ne fait aucune confiance à l'appelant sur
l'identité** : le titulaire est relu en base et comparé à `auth.uid()`. Un
employé qui passerait le `shift_id` d'un collègue n'obtient rien.

Ce qu'elle rend, par étape :

- **Avant confirmation** — `ecart_etabli: false`, `ecart_provisoire: null`,
  `libelle_ecart: null`, et un objet `aide_a_la_saisie` contenant
  `total_attendu` et `difference_de_comptage`. Ces montants sont nécessaires
  pour compter ; ils ne sont **pas** nommés « écart », parce qu'un écart
  n'existe pas encore. C'est l'arbitrage de la contradiction n° 4 (point 23).
- **Après confirmation, avant validation** — `ecart_provisoire`, le libellé
  exact du §3.3 (`Écart provisoire en plus : +X €` / `… en moins : −X €` /
  `Aucun écart provisoire`), le message « Cette caisse reste en attente du
  contrôle du manager. », l'objet `confirmation_initiale` (preuve non
  écrasable) et l'historique des corrections de l'employé lui-même.
- **Après validation** — `ecart_retenu`, libellé `Écart en plus : +X €` /
  `Écart en moins : −X €` / `Aucun écart retenu`.

Ce qu'elle ne rend **jamais**, à aucune étape : `motif_ecart_texte`,
`valide_par`, `valide_le`, `controle_par`, `resultat_controle`,
`commentaire_interne`, et toute donnée d'un collègue ou d'un autre site.
Ce n'est pas un masquage d'écran : **ces champs ne transitent pas sur le
réseau** (§4).

---

# Les preuves (points 10 à 18)

Toutes les preuves qui suivent ont été jouées le 17/09/2026 sur **`nexus-test`**,
dans **une seule transaction terminée par `rollback;`** — les neuf migrations de
la Phase A, puis le jeu d'essai, puis les preuves. Code de sortie 0. Rien n'a
subsisté : les quatre dernières vérifications du script constatent que les
tables créées n'existent plus (`to_regclass(…) is null`) et qu'aucune fonction
de la Vague 1 ne reste sur Test.

Le script et sa sortie intégrale sont versés au dépôt :
`supabase/recette-vague1/`, avec la commande exacte pour les rejouer.

Le jeu d'essai : le site `nexus-station-test`, quatre employés de test
(`compte_test = true`), la date métier du 16/09/2026, deux numéros de quart.
Les identifiants sont ceux des employés de test, jamais de personnes réelles.

## 10. La prise de poste ouvre **un seul** quart FDJ

Onze sous-preuves, toutes vertes.

| | Ce qui est éprouvé | Résultat |
|---|---|---|
| 10.1 | une prise de poste employé sur le quart 1 ouvre le quart FDJ 1 | `ouverture_naturelle`, quart 1, responsable = employé A |
| 10.2 | **le même événement rejoué** | `idempotence_prise_de_poste`, `meme_quart = t` |
| 10.3 | une **nouvelle** prise de poste sur le même quart | `quart_existant_meme_responsable`, même quart |
| 10.4 | unicité `(site, date, quart)` — contrainte préexistante | **1** quart FDJ |
| 10.5 | traçabilité | `prise_de_poste_id` renseigné, source `prise_de_poste`, `ouvert_le` réel, statut `brouillon` |
| 10.6 | rien n'est fabriqué | 0 caisse, 0 validation, 0 mouvement de livret, 0 activation |
| 10.7 | prise de poste **manageriale** | **refus** — « Une prise de poste en mode manager n'ouvre pas de quart FDJ. » |
| 10.8 | quart déjà tenu par **un autre** | **refus**, `conflit = true`, le responsable **reste** l'employé A |
| 10.9 | prise de poste appartenant à un tiers | refus : « Cette prise de poste appartient à un autre employé » |
| 10.10 | après les neuf appels | **1** quart, pas deux |
| 10.11 | l'employé B ouvre le quart **2** | `ouverture_naturelle`, quart 2, responsable = B |

10.2 et 10.3 sont deux idempotences distinctes, et c'est voulu : rejouer le
**même** événement, et présenter un **nouvel** événement sur un quart déjà
ouvert. Les deux rendent le quart existant, par deux chemins différents.

10.8 est le cœur du §2.3 : le conflit est **signalé**, jamais résolu en
silence. Le message rendu à l'employé : « Ce quart FDJ est déjà ouvert au nom
d'une autre personne. Une reprise doit être décidée et motivée par un
manager. » Aucune réattribution silencieuse n'est possible — la seule voie est
`fdj_transferer_responsabilite_quart`, réservée au manager, avec motif
obligatoire (preuve 16.4).

## 11. Une simple consultation ne crée rien

Deux mesures, aux deux bouts du scénario.

- **Consultation employé**, base vierge : `fdj_mes_quarts_fdj()` et
  `fdj_mes_demandes_correction()` rendent 0 ligne, et le compteur d'après
  consultation donne `0 | 0 | 0 | 0 | 0` — aucun quart, aucune caisse, aucun
  événement, aucun mouvement, aucune activation.
- **Consultation manager**, sur un scénario complet : `fdj_chronologie_caisse()`
  rend ses 5 lignes, `fdj_alertes_caisse()` rend ses indicateurs — et le même
  compteur rend de nouveau `0 | 0 | 0 | 0 | 0` de **variation**.

Preuve structurelle en complément : les sept fonctions de lecture sont
déclarées `stable`, ce que la sortie note `stable (ecriture impossible)`.
PostgreSQL refuse toute écriture dans une fonction `stable` — ce n'est pas une
convention de nommage, c'est le moteur qui l'empêche.

## 12. L'écart provisoire apparaît **après** la confirmation

| | État | Ce que l'employé reçoit |
|---|---|---|
| 12.1 | avant toute saisie | `saisie_a_commencer`, `ecart_etabli: false`, `ecart_provisoire: null` — « Rien n'a encore été transmis au manager. » |
| 12.2 | brouillon enregistré | « Votre saisie est enregistrée en brouillon. Elle n'a pas encore été transmise au manager. » |
| 12.3 | après le brouillon | `ecart_etabli: false`, et **`cle_ecart_presente = f`** : aucune clé nommée « écart » ne circule, alors même que les montants de travail (310,00 / −18,00) sont présents sous `aide_a_la_saisie` |
| 12.4 | confirmation | `confirme: true`, version **1**, écart provisoire **−18,00**, `en_attente: true` |
| 12.5 | après confirmation | `en_attente_controle_manager`, `ecart_etabli: true`, **« Écart provisoire en moins : −18.00 € »**, `ecart_retenu: null`, `correction_possible: true`, `signalement_possible: false` |
| 12.6 | confirmation **rejouée** | `idempotent: true`, toujours version 1 — pas de seconde confirmation |
| 12.7 | état en base | `confirmee`, version 1, `nb_corrections 0`, `saisie_par_a = t` |

12.3 est la preuve la plus fine du §4 : le serveur n'envoie pas une valeur que
l'écran masquerait ensuite. La différence entre 12.3 et 12.5 n'est pas une
différence d'affichage, c'est une différence de **charge utile**.

Le signe moins des libellés est le vrai signe mathématique U+2212, composé
côté serveur : l'écran recopie, il ne compose pas.

## 13. Une correction **avant validation** est tracée

| | |
|---|---|
| 13.1 | la correction passe : version **1 → 2**, `nb_corrections 1`, écart **−18,00 → 0,00** |
| 13.2 | **la première confirmation survit** : `premiere_caisse_reelle 292`, `premier_ecart −18,00`, à côté de la valeur courante |
| 13.3 | l'historique rendu à l'employé contient les deux événements, avec leurs valeurs complètes |
| 13.4 | le journal enregistre auteur, rôle, responsable, statuts avant/après |
| 13.5 | invariant `version = nb_corrections + 1` vérifié : `2 = 1 + 1` |

L'historique du 13.3, tel qu'il est rendu :

```
confirmation_initiale | « Caisse confirmée et transmise au manager » | (null) → 1 | écart −18,00
correction_employe    | « Saisie corrigée » | 1 → 2 | −18,00 → 0,00 | « Aucun écart provisoire »
     motif : « Erreur de comptage sur le jeu a 5 euros »
     commentaire : « Stock final recompte »
```

Les valeurs des deux versions sont conservées **entières** (`valeurs_apres` :
les huit montants), pas seulement le delta. Le §3.4 demande « anciennes
valeurs » et « nouvelles valeurs » : un delta ne permettrait pas de les
reconstituer si une version intermédiaire venait à manquer.

Le journal `fdj_caisse_evenements` porte un trigger qui refuse tout `update` et
tout `delete` : la preuve de la première confirmation n'est pas seulement
« conservée par convention », elle est **inécrasable**. La lecture du 13.4 se
fait sous `postgres` parce que la table est fermée à `authenticated` — c'est
volontaire : l'employé lit son historique par `fdj_mes_corrections_caisse()`,
jamais la table.

## 14. Une correction **après validation** est refusée

| | |
|---|---|
| 14.1 | correction refusée : `caisse_validee` — « Cette caisse a été validée par le manager. Utilisez « Signaler une erreur après validation ». » |
| 14.2 | le brouillon est refusé lui aussi : `caisse_deja_confirmee` (la porte de derrière est fermée) |
| 14.3 | le seul recours fonctionne : « Votre signalement est transmis au manager. **Aucune valeur validée n'a été modifiée.** » |
| 14.4 | signalement rejoué → `idempotent: true` |
| 14.5 | message trop court refusé : « Merci de décrire l'erreur en au moins 5 caractères. » |
| 14.6 | l'employé ne rouvre pas : « Seul un manager habilité peut effectuer cette opération. » |
| 14.7 | **`colonnes_modifiees = 0`** — mesuré, pas supposé |
| 14.8 | la demande est enregistrée : `ouverte`, message conservé mot pour mot, demandeur = A |

14.2 mérite d'être souligné : refuser `fdj_corriger_caisse_confirmee` sans
refuser aussi l'enregistrement de brouillon laisserait un contournement
évident. Les deux portes sont fermées.

14.7 est la preuve du §3.7 au sens strict — « ne modifie aucune valeur
validée » : on compare colonne par colonne l'état avant et après le
signalement.

## 15. **Seul le manager valide**

Cinq refus, puis quatre confirmations.

| | |
|---|---|
| 15.1 | l'employé ne valide pas sa caisse — « Seul un manager habilité peut effectuer cette opération. » |
| 15.2 | l'employé n'ouvre pas le contrôle — même refus |
| 15.3 | **un collègue** ne valide pas — même refus |
| 15.4 | un collègue ne corrige pas — « Ce quart FDJ est sous la responsabilité d'un autre employé. » |
| 15.5 | un collègue **ne lit pas** la caisse d'un autre — « Ce quart FDJ n'est pas sous votre responsabilité. » |
| 15.6 | le manager ouvre le contrôle : `0,00`, résultat « Conforme » |
| 15.7 | le manager valide : `conforme` |
| 15.8 | validation rejouée → `idempotent: true` |
| 15.9 | en base : `valide_par_le_manager = t`, `controle_par_le_manager = t`, et **`saisie_toujours_imputee_a_a = t`** |

15.3 et 15.1 ne font pas double emploi : le premier vérifie qu'un rôle
insuffisant est refusé, le second qu'un employé ne devient pas manager en
visant la caisse d'un autre.

15.9 est la charnière du point 16 : valider **n'a pas déplacé** l'imputation de
la saisie. Le manager a validé ; l'employé A reste celui qui a compté.

## 16. L'auteur de saisie reste distinct de l'employé opérationnel

Le journal rend, pour chaque événement, **trois** identités : qui a agi, avec
quel rôle, et pour le compte de quel employé responsable.

```
correction_employe    | employe | employé A | employé A
ouverture_controle    | manager | manager   | employé A   ← deux personnes distinctes
demande_correction    | employe | employé A | employé A
validation            | manager | manager   | employé A   ← deux personnes distinctes
confirmation_initiale | employe | employé A | employé A
```

- **16.2** — sur la caisse, `saisi_par` et `valide_par` sont deux colonnes
  distinctes, et elles portent deux valeurs distinctes.
- **16.3** — sur le quart, `created_by` (auteur technique) et `employee_id`
  (responsable opérationnel) peuvent diverger, et le sont.
- **16.4 / 16.5** — le transfert explicite : le manager transfère la
  responsabilité de A vers B, avec motif obligatoire (« Reprise du quart :
  l'employé A a quitté le site avant la fin du service. »), horodaté, et
  **`auteur_de_creation_inchange = t`** — transférer la responsabilité ne
  réécrit pas l'histoire de la création.
- **16.6** — le transfert est journalisé sous son propre événement
  `fdj_quart_responsabilite_transferee`, avec le motif et l'acteur.

C'est le §2.4 appliqué : « L'identité de la personne qui saisit une information
et celle de l'employé opérationnel concerné doivent être deux notions
distinctes. » Elles le sont dans le schéma, pas seulement dans l'usage.

## 16 bis. Livrets et mouvements — les preuves du §10.5

Recette : `supabase/recette-vague1/20260917_preuves_livrets_et_historique.sql`,
sortie conservée à côté, code de sortie 0, transaction annulée.

| Preuve | Ce qu'elle établit | Résultat |
|---|---|---|
| **P21.1** | les trois notions sont distinctes **sur la même ligne** : `employee_id` = employé A (responsable opérationnel), `created_by` = le manager (auteur de la saisie), `effective_at` (16/09 17 h 00) ≠ `created_at` (17/09 03 h 00) | `t` / `t` |
| **P21.2** | les 5 mouvements historiques reçoivent `created_by = NULL` et `effective_at = NULL` — « auteur historique inconnu », pas une date inventée (§8) | 5/5 à `NULL` |
| **P21.3** | la clé d'idempotence **mord** : rejouer le même mouvement avec la même clé lève `23505` et n'écrit rien | 3 clés, 1 ligne chacune |
| **P21.4** | l'absence de clé reste permise : 3 mouvements sans clé cohabitent (l'index est partiel) | 3 sans / 3 avec |
| **P21.4b** | après les neuf migrations, il n'existe **qu'un seul** index unique sur `idempotency_key` — la non-duplication annoncée au 5.7 | 1, `fdj_stock_movements_idempotency_key_uniq` |
| **P21.5** | une date d'effet absurde (postérieure à l'enregistrement) est refusée par `fdj_stock_movements_effective_at_check` : `23514` | refus |
| **P21.6 (a)** | **aucune activation, aucun mouvement réel** n'a été créé : 0 livret, les 5 mouvements historiques sont ceux que la recette a elle-même posés, +1 pour la démonstration d'idempotence | 0 livret |
| **P21.6 (b)** | l'argument **structurel** : sur les **29 fonctions** ajoutées par la vague, **0** mentionne `fdj_stock_movements`, **0** mentionne `fdj_booklets` | 0 / 0 |

P21.6 (b) est la preuve qui compte vraiment pour le §6. Les autres disent
« nous n'avons rien activé pendant la mission » ; celle-ci dit que **le code
livré ne le peut pas** : aucune des commandes serveur de la Vague 1 ne touche
aux livrets ni aux mouvements. La vague *prépare* les colonnes du §6
(`created_by`, `effective_at`, la clé d'idempotence, la contrainte de date) et
s'arrête là. L'écriture des activations reste où elle est — dans le front,
listée à l'annexe B — et sa reprise est une dette de la Vague 2.

## 16 ter. Les données existantes — les preuves du §10.6

Même recette. Son parti pris est ce qui la rend probante : elle **fabrique
l'historique avant de charger les migrations**, dans la même transaction —
9 quarts (3 transmis sans date, 5 avec, 1 brouillon), 8 caisses couvrant les
**huit** statuts réellement présents en Production, 5 mouvements — puis
applique les neuf migrations par-dessus, puis mesure. On ne peut pas prouver
qu'une migration respecte l'existant si l'existant naît après elle.

| Preuve | Ce qu'elle établit | Résultat |
|---|---|---|
| **P22.0** | la condition de validité de l'arbitrage du 5.7 : `schema_migrations` ne connaît **aucune** migration `2026091622%`, et les 5 objets de la vague sont absents | 0 / 5 absents |
| **P22.1** | **aucune des 15 colonnes ajoutées** n'est remplie sur les lignes historiques (7 sur `fdj_shifts`, 2 sur `fdj_stock_movements`, 6 sur `fdj_cash_controls`) | 0 partout |
| **P22.1** (suite) | les deux seules colonnes backfillées le sont par une valeur **neutre et vérifiable** : `version = 1`, `nb_corrections = 0`, invariant `version = nb_corrections + 1` respecté sur les 8 lignes | 0 violation |
| **P22.2** | **aucune valeur existante n'a bougé** : 22 empreintes avant, 22 après, 0 modifiée, 0 disparue, 0 apparue | 22 = 22 |
| **P22.3** | les **huit** statuts historiques survivent, un par un ; `statut_check` est validée, `version_check` et `validation_complete_check` sont posées `NOT VALID` | 8/8 |
| **P22.3b (1)** | ce que `NOT VALID` épargne : la ligne incohérente (`valide_le` renseigné **sans** `valide_par`) survit à la migration, non corrigée et non supprimée (§8) | survit |
| **P22.3b (2)** | ce qu'il n'épargne pas : une ligne **neuve** de la même forme est refusée, `23514` | refus |
| **P22.3b (3)** | `alter table … validate constraint` **échoue** (`23514`) — le `NOT VALID` était nécessaire, c'est démontré et non plus supposé | refus |
| **P22.4** | les quarts transmis sans date de transmission **restent sans date** ; le brouillon est préservé, aucune date inventée | 3 / 5 / 1 / 0 |
| **P22.5** | les écarts `a_regulariser` sont intacts — montants, dates métier et quarts inchangés, aucun déclaré réglé (§7) | −37,00 et −1,00 |
| **P22.6** | condition d'arrêt : si deux lignes historiques partageaient une clé d'idempotence, la Phase A **s'arrêterait** sur `23505` sans rien modifier — l'index est rétabli et la donnée intacte après retour arrière | arrêt propre |
| **POST-ROLLBACK** | `nexus-test` est revenu à son état initial : 0 quart, 0 caisse, 0 mouvement, 0 livret, journal disparu, colonne disparue, 0 migration enregistrée | 0 partout |

P22.3b est la preuve la plus utile des douze, parce qu'elle sépare trois choses
qu'on confond facilement. Une contrainte `NOT VALID` ne « désactive » rien :
elle s'applique intégralement aux écritures futures et se contente de ne pas
relire le passé. La preuve le montre dans les deux sens — la vieille ligne
vit, la nouvelle est refusée — puis elle tente la validation complète et la
voit échouer. C'est cette troisième étape qui transforme « nous avons mis
`NOT VALID` par prudence » en « sans `NOT VALID`, la migration échouait ».

Deux réserves, énoncées franchement :

* la recette pose **9 quarts et 8 caisses**, pas les 85 quarts et les 110
  mouvements de Production. Elle prouve que les migrations respectent des
  lignes **de chaque forme connue**, pas qu'aucune ligne de Production n'a une
  forme imprévue. Le filet de sécurité est ailleurs : les conditions d'arrêt
  du point 23 et le fait que chaque migration est transactionnelle.
* elle tourne sur `nexus-test`, dont les tables FDJ sont **vides** — d'où
  l'historique fabriqué. Les mesures de Production des points 19 à 21 viennent,
  elles, de lectures directes en Production, jamais d'une extrapolation depuis
  Test.

## 17. Résultats complets des tests

**Suite du dépôt : 203/210.** Les sept échecs sont **exactement** ceux qui
existaient déjà sur la base `da38b67a`, et exactement la liste `CONNUS` de
`.github/workflows/tests.yml` :

```
test_inventaire_categorie_mixte_deux_lieux.js    ReferenceError: estComptageDeuxLieuxEmploye is not defined
test_inventaire_production_journaliere_q1.js     ReferenceError: modeTestInventaireActif is not defined
test_inventaire_sprint4_ux_flash.js              ReferenceError: estComptageDeuxLieuxEmploye is not defined
test_inventaire_sprint4bis_ecriture_immediate.js ReferenceError: modeTestInventaireActif is not defined
test_pilotage_qualite_receptions.js              TypeError: document.addEventListener is not a function
test_reception_moteur.js                         TypeError: Mod.calculerReceptionCorrigee is not a function
test_reception_v1_dom.js                         ReferenceError: demarrerReception is not defined
```

Aucun n'est FDJ ; aucun n'est touché par cette vague. La CI échoue **dans les
deux sens** — un nouveau test rouge la fait échouer, un test réparé mais laissé
dans la liste aussi. 203 et non 202 : un test a été ajouté, il passe.

Le reste de la chaîne CI, mesuré le 17/09/2026 sur la tête de la branche :

| Contrôle | Résultat |
|---|---|
| `node outils/poser-build-id.js --verifier` | 754 ressources, toutes sur la même génération |
| `npm run simulations` | « Tous les scénarios passent » + NEXUS PAYE 15/15 |
| `test_empreinte_artefact_20260915.js` | **32/32** |
| `test_verifier_artefact_pages_20260915.js` | **39/39** |
| `test_garde_deployer_20260915.js` | **20/20** |
| `test_fdj_vague1_invariants_ecriture.js` | vert, **mutations comprises** |

Ces trois épreuves d'infrastructure sont **bloquantes** en CI — contrairement à
la suite métier, qui tourne en `continue-on-error` et se compare ensuite à la
liste `CONNUS`. L'une d'elles vérifie qu'aucun déploiement ne peut partir d'une
PR.

Une seule a dû être touchée, et il faut dire pourquoi. L'épreuve d'empreinte
porte deux constantes **mesurées** — le nombre de migrations canoniques et leur
empreinte cumulée — et son propre commentaire prévient qu'« une mise à jour de
ces constantes sans ajout correspondant dans `supabase/migrations/` serait un
aveu ». Les neuf migrations de la Phase A sont précisément cet ajout
correspondant : 267 → **276**, et l'empreinte cumulée
`ce9156a9…` → `29224d98…`. Les deux valeurs ont été **relevées** par
`node .github/deploiement/empreinte-artefact.js --arbre-source=.`, jamais
déduites par addition ; l'arithmétique du lot est écrite dans le fichier à côté
des précédentes, comme le veut sa convention. Le libellé du cas citait « 267 »
en dur : il lit désormais la constante, pour qu'une mise à jour ne puisse plus
laisser derrière elle un titre qui ment.

Le plan daté `docs/plans/2026-09-16-plan-migrations-production-acces-hors-service.md`
cite la même empreinte `ce9156a9…`. Il n'a **pas** été modifié : c'est
l'enregistrement d'une mesure faite le 16/09 pour un autre lot, et une mesure
datée ne se réécrit pas parce qu'un lot postérieur l'a rendue caduque.

Les tests FDJ réécrits pour cette vague :
`test_fdj_carte_ecart_visuelle.js` (le rendu employé, exécuté en `vm`),
`test_fdj_masquage_ecart_cloture_v2266.js` (la non-révélation avant
confirmation),
`test_fdj_permissions_ecart_caisse.js`,
et le nouveau `test_fdj_vague1_invariants_ecriture.js`.

## 18. Les mutations utilisées

Une garde qui n'a jamais rougi n'est pas une garde. Chaque famille de
vérifications porte donc ses propres mutations, et **échoue si la mutation
passe**.

**a) Les 12 mutations de la Phase C** —
`supabase/phase-c/20260916230000_mutations_de_validation.sql`, jouées sous le
rôle `authenticated` dans la transaction annulée : dix tentatives qui doivent
échouer (se réattribuer le quart d'un collègue, écrire `valide_par`, modifier
une caisse validée, lire les commentaires du manager, écrire dans
`fdj_audit_log` au nom d'un autre…) et cinq contre-épreuves (M2 bis, M4, M7,
M8 bis, M9) qui vérifient l'inverse — car une garde qui refuse **tout**
casserait l'écran FDJ, et serait verte elle aussi.

Ce jeu a déjà servi : les deux fonctions de garde avaient d'abord été écrites
en `security definer`, ce qui plaçait `current_user` à `postgres` et faisait
sortir leur première ligne (`if current_user <> 'authenticated' then return
new`) — **la garde se désactivait elle-même**. Les cinq contrôles internes
passaient. Seule la mutation l'a montré.

**b) Les 4 mutations des tests FDJ réécrits** — quatre altérations ciblées du
front et du SQL de projection ; quatre détections.

**c) Les 2 mutations auto-portées du nouveau test** —
`test_fdj_vague1_invariants_ecriture.js` rejoue chacune de ses vérifications
sur le texte **d'avant correction** :

- la contrainte de versions à deux branches — le test exige qu'au moins un
  insert réel devienne invalide, et **nommément** `confirmation_initiale` ;
- `fdj_ecrire_saisies_caisse` privée de ses deux `if p_… is not null then` —
  le test exige de voir réapparaître les écritures nues.

Si l'une de ces deux mutations passait, le test échouerait en disant pourquoi :
« MUTATION NON DÉTECTÉE : […] Ce contrôle ne mord donc rien — il faut le
réécrire, pas s'en réjouir. »

**d) Les refus, distingués par forme.** Trois formes qu'il ne faut jamais
confondre, sous peine d'écrire un test vert qui ne prouve rien :

| Forme | Signature | Exemple |
|---|---|---|
| trigger | exception `42501` | écrire `valide_par` en tant qu'employé |
| RLS | **0 ligne, aucune erreur** | lire la caisse d'un collègue |
| commande serveur | `{ok: false, motif: '…'}`, sans exception | 14.1, 15.1, 10.7 |

---

# L'état réel des données (points 19 à 21)

Mesuré en **lecture seule** sur Production (`uzhjpqpctpvxytxpxoqz`) le
17/09/2026, par `SELECT` uniquement. Aucune ligne n'a été écrite, aucune
migration appliquée.

## 19. Les brouillons existants

`fdj_shifts` : **3 en `brouillon`**, **82 en `valide`**.

Les trois brouillons appartiennent **tous** au site `site-fantome-test` — le
site que Frédéric a créé pour ses propres essais. Aucun brouillon réel de
`vito-sainte-marie` n'est en attente. La Vague 1 ne les touche pas : les
migrations n'écrivent dans `fdj_shifts` que des colonnes **nouvelles**, toutes
nullables, sans valeur par défaut rétroactive.

Point de vocabulaire qui compte pour lire ce chiffre : dans
`fdj_shifts.statut`, **`'valide'` a toujours signifié « transmis par
l'employé »**, jamais « validé par le manager ». C'est précisément l'ambiguïté
que le cycle du §3 lève, en séparant `confirmee` de `validee`. Les 82 lignes
historiques conservent leur valeur `'valide'` : aucune migration ne les
réinterprète (§8).

## 20. Les six écarts `a_regulariser`

`fdj_cash_controls` : `conforme` 55 · `valide_avec_ecart` 18 ·
**`a_regulariser` 6** · `regularise` 3.

Les six, tous sur `vito-sainte-marie`, **intacts** :

| contrôle | écart |
|---|---|
| `160559c5…` | **+14** |
| `ce8c7ebd…` | −1 |
| `1c3b12b0…` | −1 |
| `806a27b2…` | −3 |
| `4b8b987f…` | −37 |
| `2e79513a…` | −2 |

Ils restent identifiables et accessibles au manager : le statut
`a_regulariser` est conservé dans la contrainte de statut, les politiques RLS
de Phase C laissent le manager du site les lire et les écrire, et aucune
fonction de la vague ne les déclare réglés. **Aucun n'a été modifié, aucun n'a
été soldé** (§7, §12).

La régularisation elle-même n'est **pas** implémentée en Vague 1, comme le §7
l'autorise : le vocabulaire est fixé (objet « Régularisation d'un écart
antérieur », action « Enregistrer un versement de régularisation », et jamais
« remboursement » employé génériquement), mais la commande serveur
correspondante n'est pas écrite. Ses dépendances — le rattachement d'un
versement à un contrôle antérieur, et l'articulation avec la paie, hors
périmètre — ne sont pas prêtes.

## 21. Les lignes historiques qui demandent un arbitrage humain

Inventaire, **sans correction automatique** (§8) :

| Vérification | Résultat |
|---|---|
| doublons `(site, date métier, numéro de quart)` | **0** |
| `fdj_shifts.employee_id` nul | **0** |
| `fdj_cash_controls` orphelines | **0** |
| **`fdj_shifts` en `statut='valide'` sans `valide_le`** | **14** |

Une seule anomalie, et elle n'est pas corrigeable par une machine : **14 quarts
déclarés transmis sans date de transmission**. On ne sait pas *quand* ils l'ont
été, et il n'y a aucune source pour le reconstituer. Le §8 tranche :
`NULL` signifie « inconnu », et aucune migration n'invente une date.

Conséquences concrètes portées par les migrations :

- L'unicité `(site, date, quart)` exigée par le §2.3 **existait déjà** :
  `fdj_shifts_site_date_quart_key`, index unique **total**, antérieur à cette
  vague — c'est d'ailleurs pourquoi le comptage de doublons rend 0, et il ne
  pouvait rien rendre d'autre. La Vague 1 n'y touche pas et n'avait pas à le
  faire. Ce qu'elle ajoute est l'idempotence qui manquait, d'un autre ordre :
  `fdj_shifts_prise_de_poste_unique`, index **partiel** sur
  `prise_de_poste_id`, qui empêche qu'un même événement de prise de poste
  ouvre deux quarts. Partiel, donc les quarts historiques — dont l'événement
  source est inconnu, et le restera — n'y participent pas et ne peuvent pas
  être mis en défaut.
- Toutes les autres contraintes ajoutées sur des tables peuplées le sont
  `not valid` : elles régissent l'avenir sans juger le passé (§8).
- Les colonnes d'auteur ajoutées (`created_by`, `confirme_par`,
  `controle_par`) restent **`NULL` sur l'historique** : « auteur historique
  inconnu ». Aucun backfill, aucun défaut.
- Les 14 lignes sans `valide_le` ne sont ni corrigées, ni supprimées, ni
  exclues. Elles sont **signalées ici**, et c'est un manager qui décidera —
  ou qui décidera de ne rien décider, ce qui est une décision valable pour des
  faits de plus d'un mois.

---

# Le plan de Production (points 22 à 25)

## 22. Le plan exact : étendre → basculer → fermer

**Aucune de ces migrations n'est appliquée par la fusion Git ni par le
déploiement Pages.** Production est servie brute par GitHub Pages, sans build ;
Supabase ne regarde pas le dépôt. Chaque phase ci-dessous est une action
**manuelle et explicite**, à faire dans l'ordre, chacune après la
vérification qui la précède.

### Phase A — ÉTENDRE (9 migrations)

Aucune ne casse le front actuellement servi : elles ajoutent des colonnes
nullables, des tables neuves, des fonctions neuves. Ordre impératif — chacune
dépend des précédentes.

| # | Migration | Ce qu'elle ajoute |
|---|---|---|
| 1 | `20260916220000_fdj_quart_relie_a_la_prise_de_poste.sql` | le lien quart ↔ événement de prise de poste, son unicité partielle, l'auteur technique, le transfert |
| 2 | `20260916220100_fdj_caisse_cycle_de_vie_colonnes.sql` | `statut`, `version`, `nb_corrections`, les colonnes d'auteur |
| 3 | `20260916220200_fdj_caisse_journal_evenements.sql` | `fdj_caisse_evenements` + le trigger d'inécrasabilité |
| 4 | `20260916220300_fdj_demandes_correction_apres_validation.sql` | `fdj_demandes_correction` |
| 5 | `20260916220400_fdj_mouvements_auteur_et_date_effet.sql` | `created_by`, `effective_at`, la clé d'idempotence |
| 6 | `20260916220500_fdj_commande_ouverture_quart.sql` | l'ouverture naturelle depuis la prise de poste |
| 7 | `20260916220600_fdj_commandes_caisse_employe.sql` | brouillon, confirmation, correction, signalement |
| 8 | `20260916220700_fdj_commandes_caisse_manager.sql` | contrôle, validation, réouverture, transfert |
| 9 | `20260916220800_fdj_projection_employe.sql` | `fdj_ma_caisse()` et les six lectures employé |

**Vérification avant de passer à B** — quatre contrôles en lecture seule :

1. les 9 migrations figurent au registre `supabase_migrations.schema_migrations` ;
2. `fdj_ma_caisse()` rend un objet cohérent sur un quart réel **sans rien y
   écrire** (la fonction est `stable`, le moteur le garantit) ;
3. les compteurs du point 19 et du point 20 sont **inchangés** — 3 brouillons,
   6 `a_regulariser`, mêmes montants ;
4. l'écran FDJ actuellement servi fonctionne toujours : il n'utilise aucune des
   nouvelles fonctions, et rien de ce qu'il utilise n'a été retiré.

**Condition d'arrêt de la phase A :** si l'un des quatre contrôles diverge,
on s'arrête. Le retour arrière est décrit au point 24.

### Phase B — BASCULER (aucune migration)

C'est la fusion de la PR, puis le déploiement Pages. Le nouveau
`NEXUS-FDJ-v1.html` n'appelle plus que les commandes serveur ; il n'écrit plus
directement dans `fdj_cash_controls`, `fdj_reports` ni `fdj_caisse_evenements`.

**L'écran manager `NEXUS-FDJ-Manager-v1.html` n'est volontairement PAS
basculé** : le mandat porte sur le parcours employé. Il continue d'écrire en
direct. C'est la raison pour laquelle la Phase C ne peut pas tout fermer.

**Vérification avant de passer à C** — et c'est la plus importante du plan,
parce que fermer trop tôt casse l'écran servi :

1. le `build-id` servi par Pages est bien celui de la fusion ;
2. dans les journaux Supabase (`query_logs`), sur une fenêtre d'observation
   réelle — au moins un quart complet, employé et manager —, les appels
   `fdj_*` apparaissent, et **plus aucun `insert`/`update` direct** sur
   `fdj_cash_controls` et `fdj_reports` en provenance d'un rôle
   `authenticated` **employé** ;
3. un parcours employé complet passe en conditions réelles : ouverture depuis
   la prise de poste, brouillon, confirmation, écart provisoire visible,
   correction, validation manager.

Tant que le point 2 n'est pas **observé** — pas supposé —, la Phase C ne part
pas. « Ne jamais supposer qu'une migration est appliquée » a un corollaire :
ne jamais supposer qu'un front est basculé.

### Phase C — FERMER (1 migration)

`supabase/phase-c/20260916230000_fdj_rls_definitives_phase_c.sql` — non estampillée
volontairement, donc **invisible de la CI** et non applicable par mégarde. Elle
ne sera renommée dans `supabase/migrations/` qu'au moment où la vérification
de la Phase B est acquise.

| Table | SELECT | INSERT / UPDATE |
|---|---|---|
| `fdj_cash_controls` | manager **ou** titulaire du quart | manager seul |
| `fdj_reports` | manager | manager |
| `fdj_releves_cloture` | manager | INSERT manager |
| `fdj_corrections` | manager | **supprimés** |
| `fdj_audit_log` | manager | INSERT site + trigger gardant `acteur_id` |
| `fdj_shifts` | site (inchangé) | conservés + trigger gardant les colonnes sensibles |
| `fdj_shift_counts` | site (inchangé) | **conservés** — dette de Vague 2 |

Les deux dernières lignes sont des concessions assumées, pas des oublis :
l'écran manager non basculé a besoin de ces écritures. Les triggers réduisent
la surface (un employé ne peut plus écrire `valide_par`, ni se réattribuer un
quart) sans couper l'écran qui reste en place.

**Vérification après C :** rejouer
`supabase/phase-c/20260916230000_mutations_de_validation.sql` — les dix refus
et les cinq contre-épreuves — dans une transaction annulée, sur Production
si et seulement si un GO explicite le permet ; sinon sur Test.

## 23. Les conditions d'arrêt

Arrêt **immédiat**, à n'importe quelle phase :

- une migration échoue, ou le registre ne la reflète pas ;
- les compteurs du point 19 ou du point 20 changent sans action humaine —
  en particulier si l'un des six écarts `a_regulariser` disparaît, change de
  statut ou change de montant ;
- l'écran FDJ servi rend une erreur après la Phase A (elle ne devait rien
  changer pour lui) ;
- après la Phase B, une écriture directe employé subsiste dans les journaux ;
- après la Phase C, une seule des quinze mutations ne se comporte pas comme
  attendu ;
- un quart réel se retrouve avec deux lignes FDJ actives ;
- une caisse validée est modifiée par autre chose qu'une réouverture
  managériale journalisée.

Et la condition d'arrêt qui précède tout le reste : **ce dossier s'arrête
avant la Phase A.** Rien de ce qui est décrit ci-dessus n'a été fait.

## 24. Le retour arrière

| Phase | Retour arrière | Coût |
|---|---|---|
| **A** | `drop function` des 30 fonctions, `drop table` des 2 tables neuves, `drop index` de `fdj_shifts_prise_de_poste_unique`, `alter table … drop column` des colonnes ajoutées | **nul tant que le front n'est pas basculé** — rien ne les utilise. Aucune donnée existante n'est touchée : les colonnes ajoutées sont neuves, les données historiques n'y sont pas. |
| **B** | revert du commit de fusion, redéploiement Pages | l'ancien front revient. Les caisses confirmées **par le nouveau front** entre-temps gardent leur `statut`/`version` : l'ancien écran les lit comme avant (il ignore ces colonnes). Les données ne sont pas perdues — elles deviennent invisibles. |
| **C** | réappliquer les politiques d'origine, conservées **intégralement** en commentaire d'en-tête de la migration de Phase C | immédiat, mais **ne rend pas** ce qui aurait été écrit pendant la fenêtre. |

Le retour arrière de A doit se faire **dans l'ordre inverse** des 9 migrations,
les fonctions avant les tables.

Un point à savoir avant de commencer : **le retour arrière de A après B est
coûteux**, parce que le front basculé n'appelle plus que des fonctions qui
n'existeraient plus. L'ordre A → B n'est donc pas réversible à la légère ; c'est
la raison d'être de la vérification entre A et B.

## 25. Ce qui n'a pas été fait

**Aucune donnée de Production n'a été modifiée. Aucune configuration de
Production n'a été modifiée.**

Précisément :

- **aucune migration appliquée**, ni sur Production ni sur Test — la recette
  sur Test s'est terminée par `rollback;`, vérifié par quatre contrôles
  post-rollback ;
- **aucune écriture** sur Production : les seules requêtes ont été des
  `SELECT`, par le connecteur Supabase en lecture ;
- **les six écarts `a_regulariser` sont intacts** — mêmes identifiants, mêmes
  montants, même statut ;
- **aucun quart réel** clos, ouvert ou réattribué ; **aucune caisse réelle**
  validée ou corrigée ; **aucun livret** activé ; **aucun mouvement** réel
  enregistré ; **aucune régularisation** enregistrée ;
- **rien n'a été fusionné** ; aucune gate approuvée ; aucun déploiement lancé ;
- **`pointage_actif` n'a pas été touché** ; ni Pages, ni le DNS, ni un secret,
  ni une variable ;
- les deux migrations qui exigent le code d'abord
  (`20260911180600_pointage_exige_service_et_evenement.sql`,
  `20260904175747_login_non_enumerable`) **n'ont pas été appliquées** ;
- les PR #54 et #55 **n'ont pas été fermées** ;
- aucun privilège n'a été accordé à quiconque ; aucun identifiant n'a été
  affiché ni journalisé.

Le seul état modifié est **une branche Git** et **une PR ouverte**. Tout le
reste attend un GO.

---

# Annexe A — Les contradictions métier rencontrées

Le mandat demande de documenter précisément toute contradiction impossible à
trancher à partir de ses règles, et de poursuivre le reste. Il y en a sept.
Aucune n'a empêché de produire la vague ; six ont été tranchées et la septième
est une dette assumée.

**A1 — Deux caisses, deux doctrines opposées sur l'écart.** Le §3.3 impose que
l'employé voie son écart provisoire **après** confirmation. Mais la fonction
`mes_ecarts_caisse()` — qui sert la caisse **station**, pas la caisse FDJ — le
masque tant que `valide_le` est nul, et c'est délibéré : c'est la règle posée
le 14/09 pour la clôture station. *Tranché :* les deux objets sont distincts et
les deux doctrines coexistent sans se contredire. La caisse FDJ suit le §3.3 ;
la caisse station garde sa règle. Ce qu'il ne faut surtout pas faire, c'est
aligner l'une sur l'autre « par cohérence » — ce serait revenir sur une
décision produit prise ailleurs, pour un autre écran.

**A2 — L'employé modifie l'écart en saisissant ses régularisations.** Le champ
`regularisations`, saisi par l'employé, entre dans le calcul de l'écart. Un
employé peut donc, sans rien falsifier, faire varier son propre écart
provisoire. Le §5.1 ne l'interdit pas (c'est une donnée de sa saisie), mais le
§3.6 réserve au manager le résultat définitif. *Tranché :* la valeur est
conservée — la supprimer casserait la caisse réelle — mais chaque changement
est tracé dans `fdj_caisse_evenements.metadata`, avec l'ancienne et la nouvelle
valeur. Le manager voit donc la variation et son auteur, au lieu de subir un
écart qui bouge sans explication.

**A3 — Une tentative refusée n'écrit rien, donc ne s'alerte pas.** Le §3.5
demande une alerte managériale sur « tentative de modification après
validation ». Or une commande serveur qui refuse ne laisse, par construction,
aucune trace en base : il n'y a rien à compter. *Tranché par substitution :*
l'alerte compte les `fdj_demandes_correction` déposées après validation, qui
sont le canal légitime prévu au §3.7. Un employé qui insiste produit des
demandes, pas des écritures refusées et invisibles. La différence est notée
ici parce qu'elle change ce que l'alerte signifie : elle mesure l'insistance
*déclarée*, pas les tentatives *silencieuses*.

**A4 — Ne rien montrer avant confirmation rendrait la saisie inutilisable.**
Le §3.3 interdit de présenter un résultat comme un écart établi avant la
première confirmation. Mais un employé qui compte sa caisse a besoin de voir ce
qu'il saisit. *Tranché :* la projection rend les montants sous la clé
`aide_a_la_saisie`, accompagnée de `ecart_etabli: false`. Le nom de la clé et
le drapeau disent tous deux ce que c'est — un total de contrôle, pas un
verdict — et le rendu employé n'emploie le mot « écart » qu'après
confirmation.

**A5 — L'écran manager réattribue encore un quart sans motif.** Le §2.3
interdit toute réattribution silencieuse, et la commande
`fdj_transferer_responsabilite_quart` exige un motif, l'horodate et la
journalise. Mais l'écran manager, **non basculé en Vague 1**, écrit toujours
`employee_id` en direct : `NEXUS-FDJ-Manager-v1.html:5511`, `:5525` et `:5531`.
*Non tranché — dette de Vague 2.* C'est la seule contradiction qui reste
ouverte. Elle ne bloque pas la vague : le chemin employé, lui, passe
exclusivement par les commandes serveur. Mais tant que cet écran n'est pas
basculé, la Phase C ne peut pas retirer les droits d'`update` sur
`fdj_shifts` — c'est écrit noir sur blanc au point 22, et c'est la raison pour
laquelle la Phase C garde un trigger de garde sur les colonnes plutôt qu'une
fermeture complète.

**A6 — Deux définitions du manager habilité.** Le prédicat RLS managérial
n'exige pas `actif = true`, alors que `fdj_quart_du_manager` écrit
`e.actif is not false`. Un manager désactivé pourrait donc, au niveau RLS
seul, continuer de lire. *Tranché dans le sens le plus strict pour les
écritures :* toutes les commandes serveur passent par le prédicat qui teste
l'activité. La divergence subsiste sur la lecture RLS et est signalée ici
plutôt que corrigée dans la même vague : resserrer un prédicat de lecture
partagé par d'autres écrans est un changement de portée qui mérite sa propre
mesure (la leçon du 14/09 sur `audits_caisse` : « qui ne figure nulle part ne
lit plus rien »).

**A7 — « NULL = inchangé » empêche de vider un champ.** Le correctif du
défaut 1 donne aux paramètres de saisie la sémantique « NULL = non fourni,
donc inchangé ». Conséquence directe : un employé ne peut plus *vider* un
champ qu'il avait rempli par erreur, seulement le remplacer par une autre
valeur. *Tranché :* c'est le prix de la cohérence avec
`fdj_corriger_caisse_confirmee`, qui emploie la même convention, et l'Article
11 interdit deux sémantiques différentes pour le même geste. Le contournement
existe (saisir `0`) et le cas est rare ; une valeur sentinelle explicite
serait la vraie réponse, en Vague 2.

# Annexe B — Les écritures directes qui subsistent

Le §5.3 demande que « les écritures directes trop larges soient supprimées une
fois le nouveau front basculé ». La Phase C ferme ce qui peut l'être **sans
casser un écran encore servi** ; le reste est listé ici, parce qu'un inventaire
incomplet vaut moins que pas d'inventaire du tout.

Le fichier `NEXUS-FDJ-v1.html` contient **24** accès directs aux tables `fdj_*`,
dont **11 en écriture**. La Vague 1 a basculé tout le cycle de caisse sur les
commandes serveur ; ce qui suit ne l'est pas encore.

| Emplacement | Écriture | Pourquoi elle subsiste |
|---|---|---|
| `NEXUS-FDJ-v1.html:717` | `update fdj_shifts` (lien de continuité avec le quart précédent) | appartient à la chaîne de stock, hors périmètre du cycle de caisse |
| `:1417` | `upsert fdj_shift_counts` | les comptages d'ouverture ; aucune commande serveur ne les couvre encore — dette de Vague 2, et la raison pour laquelle la Phase C laisse les droits d'écriture sur cette table |
| `:1421` | `update fdj_shifts` (`ouverture_validee`) | validation d'ouverture de stock, distincte de l'ouverture du quart FDJ |
| `:1431`, `:1435`, `:1652`, `:1835` | `insert fdj_alertes` | alertes de stock, hors périmètre |
| `:1452` | `insert fdj_employee_shift_locks` | le verrou d'écran, hors périmètre |
| `:1460`, `:1660` | `insert fdj_audit_log` | conservés, mais **encadrés** : la Phase C ajoute un trigger qui refuse un `acteur_id` différent de `auth.uid()` |
| `:1638`, `:1809` | `insert fdj_stock_movements` (activation implicite et activation de carnet) | **le §6 en dépend directement.** La Vague 1 ajoute les colonnes (`created_by`, `effective_at`, clé d'idempotence) mais ne bascule pas ces deux appels : aucune activation réelle ne devait être créée pendant la mission, et écrire la commande serveur sans pouvoir l'exécuter une seule fois contre une donnée réelle aurait produit exactement le genre de code que la recette a pris en défaut trois fois. |
| `NEXUS-FDJ-Manager-v1.html:5511`, `:5525`, `:5531` | `update` / `insert fdj_shifts` avec `employee_id` | l'écran manager, non basculé — voir A5 |

Une lecture mérite aussi d'être signalée : le champ `motif_ecart_texte` reste
accessible via l'écran **Ma Progression**, qui ne passe pas par la projection
`fdj_ma_caisse`. Le §4 interdit qu'un champ sensible transite par le réseau
pour être masqué ensuite dans l'interface ; cet écran n'est pas dans le
périmètre de la vague, mais il l'enfreint aujourd'hui. À traiter en Vague 2, en
même temps que l'écran manager.

**La règle qui en découle pour la Phase C :** elle ne retire que les droits
dont on a la preuve qu'aucun écran servi ne se sert. Partout ailleurs elle
substitue un **trigger de garde** — qui laisse l'écriture passer mais refuse
les colonnes interdites — à une fermeture qui provoquerait une panne. C'est
moins satisfaisant qu'un `revoke`, et c'est la seule option compatible avec le
§9 : on ne ferme qu'après avoir prouvé que plus personne ne passe par la porte.
