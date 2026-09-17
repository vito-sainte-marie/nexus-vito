# Dossier de la Vague 1 — refonte du cycle de caisse FDJ

**Date de clôture du dossier : 17/09/2026.**
**État : préparé, non appliqué, non fusionné, non déployé.**

Ce document est le livrable exigé avant arrêt par le §13 du mandat. Il est
organisé dans l'ordre des 25 points demandés, suivis d'un **point 26** qui rend
compte de la relecture finale de la PR #62 et corrige, en les nommant, trois
chiffres faux de la première version. Chaque affirmation renvoie soit à un
fichier du dépôt, soit à une mesure datée prise sur une base réelle.

> Rappel du cadre, valable pour tout ce qui suit : **rien de ce qui est décrit
> ici n'a été appliqué à la Production.** Aucune migration n'a été exécutée de
> façon persistante nulle part — ni sur Test, ni sur Production. Toutes les
> lectures de Production faites pour ce dossier sont des `SELECT` (point 25).

---

## 1. La branche créée

`fdj-vague1-cycle-caisse-20260916`

Elle ne contient que la Vague 1 : aucun autre travail, aucune reprise d'une
branche antérieure. Ses commits se lisent par leur rôle, dans l'ordre :

1. **Phase A — étendre** : les douze migrations additives.
2. **Phase B — basculer** : le front qui n'appelle plus que les commandes
   serveur.
3. **Phase C — fermer** : les RLS définitives et le retrait des écritures
   directes devenues inutiles, écrites mais **non appliquées**.
4. **Les défauts que seule l'exécution a montrés** (point 5.7) et la garde
   `test_fdj_vague1_invariants_ecriture.js` qui les retient.
5. **Les preuves des livrets et des données existantes** (§10.5 et §10.6), le
   compteur de migrations de l'épreuve d'empreinte porté de 267 à 276, et ce
   dossier.
6. **La relecture finale de la PR #62** (point 26) : la confidentialité de « Ma
   Progression », l'attribution serveur des activations et des mouvements, la
   bascule de l'écran manager, la Phase C rendue exécutable et rejouée sur
   Test, l'empreinte portée de 276 à 279, et la mise à jour de ce dossier.

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
`fdj-vague1-cycle-caisse-20260916`. Aucun commit d'une autre origine n'y
figure : `git log --oneline da38b67a9e106ea495d03484ed2e3064b0a3eadb..` ne doit
retourner que ceux de la vague.

(Le préfixe de titre n'est plus un critère. Les commits de la première passe
portent tous `FDJ Vague 1 —` ; ceux nés de la relecture finale, non — ils
disent ce qu'ils corrigent plutôt que le lot auquel ils appartiennent. Un
critère qui aurait cessé d'être vrai sans que personne ne le note valait moins
que pas de critère du tout.)

(Une version antérieure de ce point annonçait le commit de Phase C comme tête.
C'était vrai à l'heure où la ligne a été écrite, et faux une heure plus tard :
c'est exactement la raison pour laquelle un SHA ne s'écrit pas dans le fichier
qu'il désigne.)

## 3. Le lien de la pull request

**https://github.com/vito-sainte-marie/nexus-vito/pull/62**

Elle vise `production`, en mode ouverture seule : **elle ne doit pas être
fusionnée** (§12). Son corps porte le SHA de tête au moment de l'ouverture,
que ce fichier n'écrit pas (point 2), et un tableau d'entrées pour se repérer
dans les 25 points ci-dessous.

Un lien, contrairement à un SHA, ne bouge pas quand on l'écrit : il peut donc
vivre ici sans se contredire.

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

**36 fonctions**, réparties en six familles (29 à l'ouverture de la vague, plus
les 7 de la relecture finale — point 26). Toutes fixent explicitement leur
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
`fdj_caisse_evenements_immuable()` (trigger)

**Attribution serveur des mouvements et des saisies (point 26)**
`fdj_ma_progression_caisse()` · `fdj_demandes_correction_du_quart()` ·
`fdj_activer_carnet()` · `fdj_enregistrer_mouvement_stock()` ·
`fdj_saisir_caisse_manager()` · `fdj_cle_idempotence()` ·
`fdj_emplacement_du_site()`

Une correction de décompte au passage : `mes_ecarts_caisse()` figurait dans la
première version de cette liste comme « ajustée ». Elle ne l'est pas — elle
date du `20260914210000` et cette vague n'y touche pas. Elle est seulement
**citée** par `20260916220900` comme le précédent dont la nouvelle projection
reprend la règle : aucun paramètre d'identité, filtrage sur `auth.uid()` seul.

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

**Suite du dépôt : 205/212.** Les sept échecs sont **exactement** ceux qui
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
dans la liste aussi. 212 fichiers et non 210 : la relecture finale en ajoute
deux (`test_progression_projection_fdj_20260917.js` et
`test_phase_c_analysable_20260917.js`), tous deux verts. Le lanceur compte des
**fichiers**, pas des assertions : les deux tests ajoutés *à l'intérieur* de
`test_fdj_fiabilisation_etape5_idempotence.js` (points 26.5 et 26.6) ne font
donc pas bouger ce total, et c'est normal.

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

### Sur la PR elle-même

Le workflow `non-regression` est passé **vert dès le premier run**, les trois
épreuves d'infrastructure comprises, et l'est resté sur chaque commit poussé
depuis. `Supabase Preview` est annoncé `skipping` : **aucune branche Supabase
n'est créée**, donc aucune migration n'est appliquée par l'ouverture de cette
PR.

Le workflow « Déploiement Production (GitHub Pages) » se déclenche aussi sur
`pull_request`, et c'est voulu : il **construit et éprouve** l'artefact, puis
son job « Déployer sur GitHub Pages » reste *skipped*, 0 seconde. C'est
exactement ce que `test_garde_deployer_20260915.js` exige, et la preuve qu'un
déploiement ne peut pas partir d'une PR. Un artefact `github-pages` figure donc
bien dans le run — il a été **fabriqué, pas publié**, et il ne faut pas lire sa
présence comme une mise en ligne.

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

**a) Les 13 mutations de la Phase C** —
`supabase/phase-c/20260916230000_mutations_de_validation.sql`, jouées sous le
rôle `authenticated` dans la transaction annulée. Treize mutations numérotées,
dix-sept vérifications : **onze tentatives qui doivent échouer** (M1, M2, M3,
M4, M5, M6, M8, M10, M11, M12, M13 — insérer ou modifier une caisse en direct,
se réattribuer le quart d'un collègue, écrire `valide_par`, lire les
commentaires du manager, écrire dans `fdj_audit_log` au nom d'un autre,
écrire un mouvement de stock en direct…) et **six contre-épreuves** (M2 bis,
M4 bis, M7, M8 bis, M9, M11 bis) qui vérifient l'inverse — car une garde qui
refuse **tout** casserait l'écran FDJ, et serait verte elle aussi.

Les trois dernières sont nées de la relecture finale : **M4 bis** (« Ma
Progression » continue de rendre l'écart après confirmation, sans un seul champ
manager), **M11 bis** (`employee_id` vient du quart et `created_by` de
`auth.uid()`, y compris quand c'est le manager qui saisit) et **M13** (le
manager non plus n'écrit dans `fdj_cash_controls` en direct : 0 ligne, aucune
erreur). Le détail de leur écriture — et du piège de sous-transaction qu'elles
ont révélé — est au point 26.9.

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

### Phase A — ÉTENDRE (12 migrations)

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
| 10 | `20260916220900_fdj_projection_progression.sql` | `fdj_ma_progression_caisse()` et `fdj_demandes_correction_du_quart()` — l'écran « Ma Progression » cesse de recevoir les colonnes du manager |
| 11 | `20260916221000_fdj_commandes_activations_et_mouvements.sql` | `fdj_activer_carnet()`, `fdj_enregistrer_mouvement_stock()`, `fdj_cle_idempotence()`, `fdj_emplacement_du_site()` — auteur, employé, site, quart et date d'effet déduits côté serveur |
| 12 | `20260916221100_fdj_commande_saisie_caisse_manager.sql` | `fdj_saisir_caisse_manager()` — la saisie de la feuille par le manager, sans laquelle refermer les politiques aurait cassé un usage réel |

**Vérification avant de passer à B** — quatre contrôles en lecture seule :

1. les 12 migrations figurent au registre `supabase_migrations.schema_migrations` ;
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

**L'écran manager `NEXUS-FDJ-Manager-v1.html` est basculé lui aussi** — c'était
la quatrième correction bloquante de la relecture finale (point 26.4). Ses six
gestes du cycle de caisse passent désormais par les commandes serveur :
`fdj_ouvrir_controle_caisse`, `fdj_valider_caisse`, `fdj_rouvrir_caisse`,
`fdj_corriger_caisse_manager`, `fdj_traiter_demande_correction` et
`fdj_transferer_responsabilite_quart`, auxquels s'ajoutent
`fdj_saisir_caisse_manager`, `fdj_activer_carnet` et
`fdj_enregistrer_mouvement_stock`. Il ne reste **aucune écriture directe sur
`fdj_cash_controls`** dans cet écran — ses trois accès à cette table sont des
`.select`, et un test le vérifie sur le texte du fichier.

Ce qu'il écrit encore en direct — `fdj_reports`, `fdj_shift_counts`, la date /
le quart / le statut d'un `fdj_shifts` — reste réservé au manager par la
Phase C, et le titulaire du quart est sorti de cet `update`. La vérification 2
ci-dessous porte donc sur les **deux** écrans, employé et manager.

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
- après la Phase C, une seule des treize mutations ne se comporte pas comme
  attendu ;
- un quart réel se retrouve avec deux lignes FDJ actives ;
- une caisse validée est modifiée par autre chose qu'une réouverture
  managériale journalisée.

Et la condition d'arrêt qui précède tout le reste : **ce dossier s'arrête
avant la Phase A.** Rien de ce qui est décrit ci-dessus n'a été fait.

## 24. Le retour arrière

| Phase | Retour arrière | Coût |
|---|---|---|
| **A** | `drop function` des 36 fonctions, `drop table` des 2 tables neuves, `drop index` de `fdj_shifts_prise_de_poste_unique`, `alter table … drop column` des colonnes ajoutées | **nul tant que le front n'est pas basculé** — rien ne les utilise. Aucune donnée existante n'est touchée : les colonnes ajoutées sont neuves, les données historiques n'y sont pas. |
| **B** | revert du commit de fusion, redéploiement Pages | l'ancien front revient. Les caisses confirmées **par le nouveau front** entre-temps gardent leur `statut`/`version` : l'ancien écran les lit comme avant (il ignore ces colonnes). Les données ne sont pas perdues — elles deviennent invisibles. |
| **C** | réappliquer les politiques d'origine, conservées **intégralement** en commentaire d'en-tête de la migration de Phase C | immédiat, mais **ne rend pas** ce qui aurait été écrit pendant la fenêtre. |

Le retour arrière de A doit se faire **dans l'ordre inverse** des 12 migrations,
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

# La relecture finale de la PR #62 (point 26)

## 26. Ce que la relecture a trouvé, et ce qu'elle a changé

La PR #62 a été relue avant fusion. Quatre conditions bloquantes en sont
sorties. Elles ne portaient pas sur des détails : trois d'entre elles
concernaient des garanties que le dossier affirmait déjà tenir. Cette section
dit ce qui a été corrigé, ce que la mesure a démenti, et ce qui reste assumé.

Cinq commits, tous sur la même branche `fdj-vague1-cycle-caisse-20260916` —
**aucune nouvelle PR, aucune fusion** :

| SHA | Ce qu'il corrige |
|---|---|
| `771adca` | « Ma progression » ne doit pas recevoir les colonnes du manager (point 2) |
| `c0eb507` | Activations et mouvements : que le serveur décide qui a écrit, et pour qui (point 3) |
| `8d8f499` | L'écran manager n'écrit plus dans les tables du cycle de caisse (point 4) |
| `6341485` | Phase C : refermer ce que la bascule rend inutile, et le prouver sur Test (point 1) |
| `2858da8` | Empreinte des migrations : 276 → 279, et le contenu a bougé aussi |

---

### 26.1 — La Phase C était inexécutable, et personne ne pouvait le savoir

Le bloc de contrôles du corps de la Phase C portait un `end if;` surnuméraire.
Le fichier ne compilait pas. Aucun garde-fou ne l'avait vu, pour une raison
structurelle : **la Phase C ne vit pas dans `supabase/migrations/`.** Elle
s'applique à la main, après la bascule du front (voir le §22 et
`supabase/phase-c/LISEZ-MOI.md`). Rien ne l'exécute jamais — ni la CI, qui n'a
pas de base, ni le déploiement. Et une sortie de recette datée de la veille ne
prouve rien du fichier du jour.

Deux choses ont donc été faites, et non une :

1. **La syntaxe est corrigée**, et le fichier **exact de la tête courante** a
   été rejoué sur Test, en transaction annulée, par
   `supabase/phase-c/recette-test.sh`. Ce script n'est pas un raccourci : il
   vérifie l'ancrage `begin;` / `commit;` **avant** toute substitution, refuse
   de tourner si le corps contient déjà un `rollback;`, refuse une cible qui
   ressemble à la Production, imprime le `diff` entre le fichier du dépôt et ce
   qui sera joué et **exige qu'il fasse exactement quatre lignes**. Autrement
   dit : si quoi que ce soit d'autre que les deux lignes de transaction avait
   bougé, la recette s'arrêterait plutôt que de jouer autre chose que le
   fichier du dépôt.

2. **Une garde CI a été ajoutée** — `test_phase_c_analysable_20260917.js`. Elle
   **analyse** et n'exécute pas, parce que la CI est volontairement hors
   réseau. C'est une limite qu'il faut nommer clairement : une analyse
   syntaxique aurait attrapé cet `end if;`, elle n'attrapera pas une faute de
   logique. La preuve d'exécution reste le rejeu sur Test, qui est un geste
   humain — mais il est désormais **scripté, reproductible et sûr**, ce qu'il
   n'était pas.

La sortie du rejeu du 17/09/2026 figure au 26.10.

---

### 26.2 — « Ma Progression » : la fuite était plus large que la relecture ne le disait

La relecture pointait `motif_ecart_texte`, `resultat_controle` et `valide_par`.
La mesure en a trouvé davantage. `NEXUS-Progression-v1.html` chargeait ses
quarts par `from('fdj_shifts').select('*, fdj_cash_controls(*)')` : **l'étoile
imbriquée envoyait toutes les colonnes du contrôle**, dont aussi `controle_par`,
`controle_le`, `saisi_par`, `confirme_par`, `nb_corrections`,
`derniere_correction_le`, `version`, et l'historique des corrections qui
l'accompagnait. L'écran n'en affichait rien. **La réponse réseau les portait, et
c'est la réponse qui compte** — un onglet Réseau suffit.

Deux fermetures ont été examinées et écartées :

- **La RLS ne pouvait rien.** Elle filtre des **lignes**, jamais des colonnes ;
  et ces lignes-là sont légitimement celles de l'employé.
- **Un `grant select (colonnes)` non plus.** Le privilège porte sur le rôle
  `authenticated`, commun aux employés **et** aux managers. Le restreindre
  casserait l'écran Écarts, qui lit précisément `motif_ecart_texte`.

La seule fermeture possible est une **projection serveur** :
`fdj_ma_progression_caisse()` (migration `20260916220900`). Elle ne prend
**aucun paramètre d'identité** — ni employé, ni site : elle ne filtre que sur
`auth.uid()`, de sorte que modifier l'appel dans la console du navigateur ne
donne accès à rien de plus. Elle renvoie **exactement les douze champs** que
`NexusProgression.construireServicesCaisseFdjDepuisProjection` consomme, pas un de plus — pas
même `site`, que l'écran connaît déjà.

`motif_ecart` **reste** renvoyé, et c'est délibéré : c'est un **code énuméré**
que l'employé choisit lui-même en corrigeant sa caisse, affiché depuis toujours
sous « Motif ». Il ne faut pas le confondre avec `motif_ecart_texte`, qui est le
**commentaire interne** du manager. Le premier appartient à l'employé ; le
second ne lui a jamais été destiné.

Un point mérite d'être dit sans le sous-entendre : **« Ma Progression » lit
encore les lignes brutes — mais seulement dans son chemin manager**, celui où un
responsable consulte la progression de quelqu'un d'autre. Ce chemin ne passe
évidemment pas par une projection filtrée sur `auth.uid()`. Il a été traité
autrement : la liste des colonnes y est **écrite en clair, une seule fois**
(`SELECT_FDJ_SHIFTS_BRUT`, dans `nexus-caisse-source.js`), à la place du
`select('*')` d'origine. Le commentaire qui l'accompagne dit pourquoi :
« `select('*')` sur une table de montants finit toujours par transporter la
colonne de trop ». C'est ce chemin-là, et lui seul, que la RLS de la Phase C
garde — elle ne l'ouvre qu'au manager du site.

Les quatre garanties demandées sont tenues : la lecture brute de
`fdj_cash_controls` redevient l'affaire du manager et des fonctions serveur ;
l'employé ne reçoit plus ni commentaire interne ni identité du contrôleur ;
**l'écart provisoire reste visible après confirmation** ; **le résultat destiné
à l'employé reste visible après validation**.

**La mutation exigée existe.** `test_progression_projection_fdj_20260917.js`
contient une mutation qui ajoute un champ manager à la projection employé —
elle **doit** faire échouer les tests, et elle les fait échouer. C'est la seule
façon de savoir que la liste des douze champs est une garantie et non un
commentaire : toute tentative future de l'élargir rougira.

---

### 26.3 — Deux colonnes vides ne prouvent rien

`created_by` et `effective_at` avaient été ajoutées à `fdj_stock_movements`.
Rien ne les renseignait. Le front écrivait toujours ses mouvements en direct et
choisissait lui-même `site`, `employee_id` et `shift_id`. Un `insert` où
l'appelant **nomme l'employé concerné** n'est pas une trace : c'est une
déclaration.

Deux commandes serveur ont été créées — `fdj_activer_carnet` et
`fdj_enregistrer_mouvement_stock` (migration `20260916221000`). Elles déduisent,
côté serveur et **sans jamais croire l'appelant** :

| Champ | D'où il vient, désormais |
|---|---|
| `created_by` | `auth.uid()` |
| `employee_id` | le **responsable opérationnel du quart**, jamais l'appelant |
| `site` | le quart |
| `shift_id` | le quart, après vérification qu'il est celui de l'employé ou un quart dont l'appelant est le manager |
| `effective_at` | la **date d'effet du quart**, jamais l'horloge du poste |
| `idempotency_key` | `fdj_cle_idempotence(jeton, contexte)` |
| `booklet_id` | le livret, lorsqu'il est identifié |

La clé d'idempotence est le point qui demandait le plus d'attention, et il
n'était pas dans la relecture. L'écran envoyait jusqu'ici **la clé elle-même**.
Une clé fournie par l'appelant est une clé qu'un appelant peut fabriquer : il
suffisait de rejouer celle d'un collègue pour que sa propre écriture soit avalée
comme un doublon et **disparaisse sans erreur**. La clé dérive maintenant de
`auth.uid()`, du jeton et du contexte. Personne ne peut viser la clé d'un
autre ; son propre rejeu retombe sur la même clé. **L'écran n'envoie plus qu'un
jeton**, et le rejeu ne remonte plus un `23505` déguisé en succès : la commande
répond `{ enregistre: true, idempotent: true }`.

Effet de bord bienvenu : le jeton de repli, utilisé quand `crypto.randomUUID`
n'existe pas, n'est pas un UUID valide. Il cassait l'écriture, puisque la
colonne est de type `uuid`. Il ne la casse plus.

Les deux `insert` directs correspondants sont fermés
(ex-`NEXUS-FDJ-v1.html:1638` et `:1809`), ainsi que l'`insert fdj_audit_log` qui
suivait l'un d'eux : la commande journalise elle-même, **sous la même action et
dans la même transaction**. Le laisser en doublait les lignes — et il pouvait
auparavant échouer seul, laissant un mouvement sans trace.

**La preuve du cas manager est explicite**, comme demandé : lorsqu'un manager
saisit la feuille d'un quart qui n'est pas le sien, `employee_id` reste
**l'employé opérationnel** et `created_by` devient **le manager**. C'est la
mutation **M11 bis**, et c'est exactement la distinction que ces deux colonnes
ont été ajoutées pour porter — distinction jusqu'ici invérifiable.

---

### 26.4 — L'écran manager reposait sur la bonne volonté d'un fichier HTML

Les commandes serveur existaient depuis le début de la vague. L'écran manager,
lui, continuait d'écrire en direct. Toute la garantie de la Vague 1 tenait donc
à ce qu'un fichier HTML veuille bien passer par la bonne porte.

Les six gestes demandés basculent : **prise en contrôle**, **validation**,
**réouverture**, **correction managériale**, **décision sur une demande de
correction**, **transfert de responsabilité**. L'écran appelle aujourd'hui dix
commandes serveur, et **n'écrit plus une seule fois dans `fdj_cash_controls`** —
ses trois accès restants à cette table sont des `select`.

Le transfert **exige un motif** et **produit un événement de journal** ; il
n'existe plus de chemin pour le faire sans l'un ni l'autre. Le détail du second
chemin, plus discret, est au **A5**.

**Une commande manquait à la liste de la relecture**, et sans elle la fermeture
aurait cassé un usage réel plutôt qu'une faille :
`fdj_saisir_caisse_manager` (migration `20260916221100`). Un manager qui remplit
la feuille d'un employé absent n'avait, jusqu'ici, d'autre moyen que l'écriture
directe. Fermer les politiques sans lui donner de porte aurait été une panne, pas
une garantie.

**Deux différences de comportement sont assumées ici plutôt que contournées :**

- **Une caisse non confirmée n'est pas corrigeable.** La commande répond
  `caisse_non_confirmee` au lieu d'écrire ; l'ancien `update` direct écrivait
  quand même. On n'insiste pas et on ne contourne pas : une caisse dont
  l'employé n'a pas encore signé le comptage n'a pas d'écart à corriger.
- **La trace du recalcul automatique** n'est plus posée par l'écran sous un nom
  à lui avec `acteur_id: null` : c'est la commande qui journalise, sous son
  action et sous l'identité réelle de l'appelant.

Le test de continuité est porté à cette architecture, avec une garde qui
manquait : **chaque accès de l'écran à `fdj_cash_controls` doit être suivi d'un
`.select`**. C'est ainsi que la dernière écriture directe avait survécu à la
première passe — une seule, isolée, « juste pour ce cas-là ». Elle ne peut plus
revenir sans rougir.

---

### 26.5 — `motif_ecart`, la colonne qu'aucune commande n'écrivait

En basculant l'écran manager, une colonne du cycle de caisse s'est révélée
orpheline : `motif_ecart` — le **code** choisi dans le menu déroulant de
l'écran manager, à ne pas confondre avec `motif_ecart_texte`. C'était **la seule
colonne du cycle qu'aucune commande serveur n'écrivait**. La bascule l'aurait
donc silencieusement perdue : l'écran aurait cessé d'écrire, et rien n'aurait
pris le relais.

`fdj_valider_caisse` reçoit donc un quatrième paramètre, `p_motif_ecart`,
contrôlé contre une liste blanche de dix codes, avec une sémantique à trois cas
choisie pour **ne pas casser les appelants existants** :

- `null` → la colonne n'est pas touchée (les appels à trois arguments
  continuent de fonctionner à l'identique) ;
- `''` → le motif est **effacé** (il n'y a plus rien à expliquer) ;
- un code → contrôlé, puis retenu ; un code inconnu lève
  `invalid_parameter_value`.

C'est le genre de détail qu'une bascule perd sans bruit, et qu'on ne retrouve
que des semaines plus tard, en se demandant pourquoi la colonne est vide depuis
une date précise.

---

### 26.6 — Ce que la Phase C peut désormais fermer

Trois dettes nommées « Vague 2 » dans la première version de ce dossier sont
**levées** par les points 2, 3 et 4 ci-dessus. La Phase C n'a donc plus besoin
de les ménager :

- la clause `fdj_est_mon_quart` de `select_fdj_cash_controls` **disparaît** —
  l'employé ne lit plus la table, il appelle la projection ;
- les politiques d'écriture directe sur `fdj_stock_movements` pour l'employé
  **disparaissent** — il passe par les commandes ;
- l'`update` de `fdj_shifts` portant `employee_id` **est fermé** — le titulaire
  se transfère, il ne se réécrit pas.

**Le décompte : 20 politiques directes deviennent 16.** Là où un trigger de
garde subsiste — `fdj_audit_log`, les colonnes de `fdj_shifts` — c'est parce que
**l'écriture reste légitime et que seule la colonne est interdite**. La RLS ne
sait pas faire cela ; un trigger, si. Ce n'est pas une dette : c'est le bon
outil pour la bonne granularité.

**La dette qui reste ouverte est hors du cycle sécurisé**, comme le mandat
l'exige : `fdj_reports`, `fdj_shift_counts` et les colonnes `date` / `quart` /
`statut` de `fdj_shifts`, que l'écran manager écrit encore en direct et que la
Phase C **réserve au manager**. La mutation **M9** le vérifie en sens
positif — « le manager contrôle, valide, saisit une feuille et dépose un
rapport » — et aucune garantie de cette vague n'en dépend : ni l'attribution de
la responsabilité, ni la confidentialité de l'employé, ni la traçabilité des
mouvements.

---

### 26.7 — Les gestes sans point d'entrée dans l'écran

Sur les 36 fonctions de la vague, **trois n'ont aucun appelant front** à ce
stade — vérifié en cherchant leur nom, et pas seulement la forme
`rpc('nom')`, dans l'ensemble des écrans et des scripts servis :

| Fonction | Ce qu'elle attend |
|---|---|
| `fdj_chronologie_caisse()` | la chronologie manager d'une caisse (mandat §3.4) — l'écran ne l'affiche pas encore |
| `fdj_alertes_caisse()` | les indicateurs d'aide au contrôle (mandat §3.5) — **les seuils par défaut attendent un arbitrage humain** |
| `fdj_mes_quarts_fdj()` | la projection employé générique, supplantée pour « Ma Progression » par `fdj_ma_progression_caisse()` (26.2) |

Aucune n'est « morte » : les trois sont couvertes par les mutations et par les
privilèges de la Phase C. Les nommer ici évite qu'on les prenne plus tard pour
du code oublié — et, pour `fdj_alertes_caisse()`, rappelle qu'il reste une
décision produit à prendre avant de l'afficher.

La recherche par nom importe : `fdj_confirmer_caisse` et
`fdj_enregistrer_brouillon_caisse` **sont** appelées, mais par une variable
(`NEXUS-FDJ-v1.html:2329` choisit l'une ou l'autre selon le geste). Un
inventaire qui n'aurait cherché que `rpc('fdj_confirmer_caisse'` les aurait
déclarées orphelines — et aurait pu conduire à les supprimer.

Dans le même ordre d'idée : `fdj_valider_caisse` est **idempotente**. Valider
deux fois ne produit pas deux validations. La conséquence est qu'une caisse
validée **ne se rectifie pas en revalidant** : il faut passer par la
réouverture, qui est un geste distinct, tracé, et réservé au manager. C'est plus
contraignant qu'un second clic, et c'est le but.

---

### 26.8 — Ce que la relecture a démenti dans ce dossier

Trois chiffres de la première version étaient faux. Ils sont corrigés dans le
corps du document ; ils sont listés ici pour que la correction soit visible et
non silencieuse.

| Où | Ce qui était écrit | Ce qui est vrai |
|---|---|---|
| §8 | 30 fonctions, cinq familles | **36 fonctions**, six familles (29 à l'ouverture + 7 à la relecture) |
| §18, §23 | 12 puis « quinze » mutations | **13 mutations**, 17 vérifications |
| §22, §24 | 9 migrations en Phase A | **12 migrations** |

Le premier mérite une explication, parce que l'erreur est instructive :
`mes_ecarts_caisse()` figurait dans la liste comme « ajustée ». **Elle ne l'est
pas.** Elle date du `20260914210000`, et cette vague n'y touche pas — elle est
seulement *citée en commentaire* par `20260916220900` comme précédent de la
règle « aucun paramètre d'identité ». Une fonction mentionnée dans un
commentaire avait été comptée comme une fonction modifiée. Le décompte réel
était donc 29, et non 30.

Le deuxième est un piège de comptage à l'envers : `grep '^-- M'` rend **seize**
en-têtes dans le fichier de mutations, ce qui aurait conduit à écrire « seize
mutations ». Le script, lui, annonce « LES TREIZE MUTATIONS » — parce que
**M2 bis vit à l'intérieur du bloc M2** et n'a pas d'en-tête propre. Le chiffre
retenu vient de **l'exécution**, pas du `grep`.

Une erreur d'outillage, du même genre, a été commise et corrigée pendant la
relecture : `outils/analyser-sql-plpgsql.js` est un **module**, et
`analyserFichier(sql)` prend le **texte** du fichier, pas son chemin. Appelée
avec un chemin, elle analysait une chaîne de quarante caractères et la trouvait
parfaitement valide. Une garde qui reçoit le mauvais argument ne se plaint pas :
elle passe au vert.

---

### 26.9 — De dix à treize mutations, et le piège du rollback de sous-transaction

Les mutations passent de dix à treize. Les trois nouvelles portent exactement
sur les garanties nées de cette relecture :

- **M4 bis** — la projection employé rend bien un quart, l'écart provisoire puis
  l'écart définitif, **et aucun champ manager** ;
- **M11 bis** — `employee_id` vient du quart, `created_by` de `auth.uid()`,
  **y compris en saisie manager** ;
- **M13** — l'`update` direct du manager sur une table basculée **reste sans
  effet**.

M13 a demandé deux essais. La première version attendait une exception ; or une
RLS qui refuse une **mise à jour** ne lève rien : elle ne trouve simplement
aucune ligne à mettre à jour. La forme du refus n'est pas la même selon
l'endroit où il a lieu, et confondre les trois rend une garde muette :

| Où le refus a lieu | Ce qu'on observe |
|---|---|
| Trigger | erreur `42501`, message métier |
| RLS en lecture ou en `update` | **0 ligne, aucune erreur** |
| Commande serveur | exception, ou retour `jsonb` explicite |

L'autre piège, plus coûteux, mérite d'être écrit une fois pour toutes : **un
sous-bloc `begin … exception` qui rattrape une erreur annule aussi le
`set local role` et le `set_config(..., true)` posés à l'intérieur.** Une
mutation qui prend l'identité d'un employé, provoque le refus attendu, attrape
l'erreur et enchaîne, **reprend l'identité du superutilisateur sans le dire**.
Les vérifications suivantes passent alors au vert pour la pire des raisons : ce
n'est plus l'employé qui les subit. Le rôle et la configuration sont désormais
**rétablis explicitement après chaque rattrapage**.

---

### 26.10 — La Phase C exacte, rejouée sur Test le 17/09/2026

Cette section a longtemps porté un extrait de la sortie, recopié ici à la
main. Il est retiré. Il avait deux défauts, et le second est le plus grave :
il n'avait aucune contrepartie vérifiable — il affirmait une exécution que
rien ne conservait — et **il n'était pas fidèle**. La ligne M8 y perdait
silencieusement l'identifiant qu'elle cite, sans qu'aucune marque de coupure
ne le signale. Un extrait choisi, retranscrit et abrégé par la partie qu'il
sert ne dit ni ce qu'il a coupé, ni ce qu'il a retouché ; le relecteur ne peut
pas distinguer l'élision de l'erreur, et rien ne le prévient qu'il y a quelque
chose à distinguer.

La sortie du serveur n'est donc plus reproduite ici. Elle l'est **intégralement
et par le script lui-même** dans le fichier de preuve, avec le pilote
réellement soumis à psql, la commande expurgée, le `diff`, les empreintes et le
code de retour :

```
supabase/phase-c/preuves/20260917T162213Z_recette-phase-c_udljdqxerrbbbajxubfn.md
```

Cette preuve est celle du rejeu du 17/09/2026 à 16:22 UTC, depuis le commit
`a9d26db`, dépôt propre. Elle remplace celle de 16:05 UTC, retirée : cette
première preuve portait l'empreinte d'un script qui a depuis changé, et son
dernier paragraphe affirmait un résultat — « aucune migration de la Phase A
persistante, aucune RPC installée » — que le script imprimait sans l'avoir
mesuré. On ne corrige pas à la main un fichier dont toute la valeur tient à ce
que personne ne l'a écrit ; on le rejoue. Elle reste lisible dans l'historique
git, au commit `f309ef4`.

#### Trois affirmations distinctes, trois preuves distinctes

**1 — Que la recette a bien été exécutée.** Établi par le fichier de preuve, et
par lui seul. Il porte la date UTC, le commit testé, l'état propre du dépôt à
cet instant, la référence du projet Test (`udljdqxerrbbbajxubfn`), les
empreintes SHA-256 des trois fichiers joués, celles des douze prérequis, le
pilote intégral réellement soumis à psql, la commande expurgée, le `diff` de
quatre lignes, la sortie intégrale du serveur et le code de retour. Aucune de
ces pièces n'existerait si la recette n'avait pas tourné.

**2 — Que la transaction a été annulée.** Établi par la dernière instruction
rendue par le serveur — `ROLLBACK` — extraite de la sortie et contrôlée par le
script lui-même : une sortie qui se terminerait par `COMMIT` fait sortir la
recette en 1. Cette garde a été éprouvée **par mutation**, avec un faux `psql`,
pas par lecture.

**3 — Qu'il ne subsiste rien sur Test.** **Ce n'est établi ni par la sortie, ni
par le fichier de preuve.** Cela se vérifie hors d'eux, en interrogeant
`nexus-test` après coup. Les cinq mêmes mesures, relevées juste avant puis
juste après le rejeu de 16:22 UTC, par la même requête :

| mesure | avant | après |
|---|---|---|
| migrations `2026091622%` | 0 | 0 |
| table `fdj_caisse_evenements` | ABSENTE | ABSENTE |
| fonctions `fdj_%` | 6 | 6 |
| politiques sur tables `fdj_%` | 50 | 50 |
| triggers sur tables `fdj_%` | 3 | 3 |

Le `diff` des deux relevés ne rend aucune différence. Les six fonctions `fdj_%`
sont toutes antérieures à la Vague 1 — `fdj_cash_controls_proteger_origine`,
`fdj_corriger_caisse_employe`, `fdj_incrementer_appro_shift_count`,
`fdj_sync_releve_apres_cash_control`, `fdj_synchroniser_releves_courants`,
`fdj_tracer_correction_stock_initial` — et aucune des six RPC de la Vague 1
n'est installée sur Test.

L'ordre de ces trois points n'est pas décoratif. **Le raisonnement inverse —
conclure de l'absence de trace que la recette a tourné — affirmerait le
conséquent** : une recette jamais lancée laisserait exactement le même état.
C'est la raison d'être du fichier de preuve.

Enfin, puisque la base de Test n'avait pas la Phase A, les migrations
prérequises ont été chargées **dans la même transaction annulée** : le corps a
donc été joué sur le schéma qu'il attend, et pas sur un schéma approchant.
Cette phrase-là aussi a d'abord été écrite sans être établie. Le script disait
avoir tout chargé, mais seules les deux migrations ayant émis un `NOTICE`
laissaient une trace dans la sortie : les dix autres n'étaient attestées que
par l'affirmation du script sur son propre travail. **Chaque prérequis
s'annonce désormais lui-même** — le pilote émet un `\echo '>> prerequis NN/12 :
<fichier>'` avant chaque `\ir`, de sorte que c'est le serveur, et non le
script, qui énumère ce qu'il a lu. Le fichier de preuve donne en outre la liste
nominative des prérequis retenus avec leur SHA-256 (§3) ; la sortie du serveur
la recoupe ligne à ligne (§7). Si le glob venait à en manquer un, la preuve le
montrerait au lieu de le taire.

Un détail du script mérite d'être noté, parce qu'il a failli coûter la preuve :
le glob des prérequis est `2026091622*.sql` et non `20260916220*.sql`. Les deux
dernières migrations de la relecture (`…221000`, `…221100`) sortaient de la
seconde forme. **Un glob trop étroit ne se plaint pas — il charge moins**, et la
recette aurait tourné au vert sur un schéma incomplet.

---

### 26.11 — Les tests et l'empreinte

Deux fichiers de test sont ajoutés :
`test_progression_projection_fdj_20260917.js` et
`test_phase_c_analysable_20260917.js`. Deux tests sont ajoutés **à l'intérieur**
de `test_fdj_fiabilisation_etape5_idempotence.js`, et deux fichiers existants
(`test_fdj_continuite_auto_recalcul.js`, `test_fdj_fiabilisation_etape5_idempotence.js`)
sont portés à la nouvelle architecture.

La suite passe donc de **203/210 à 205/212** : le lanceur compte des
**fichiers**, pas des assertions, ce qui explique que les deux tests internes ne
bougent pas le total. Les **sept échecs `CONNUS` sont inchangés**, aux mêmes
noms, et aucun ne touche au périmètre FDJ.

L'épreuve d'empreinte a rougi, comme elle rougit à **tout** lot de migrations :
c'est son travail. Les deux constantes sont re-mesurées sur un worktree propre
par `node .github/deploiement/empreinte-artefact.js --arbre-source=.` —
**276 → 279 migrations**, et l'empreinte de contenu a bougé aussi, puisque
`20260916220700` a été modifiée en place (26.5). La garde `vague1.length >= 9`
est durcie à **`>= 12`**.

---

### 26.12 — Ce qui reste assumé

- **Les estampilles de cache `?v=20260904-0104` ne sont pas incrémentées** par
  cette branche. C'est une décision, pas un oubli : ces estampilles sont posées
  à l'échelle du site et les bumper depuis une branche de fonctionnalité crée
  un conflit sur chaque PR concurrente. Le geste appartient au déploiement.
  **À reprendre au moment de servir la vague** — un navigateur qui garde
  `nexus-progression.js` en cache continuerait de lire `fdj_cash_controls(*)`.
- **Aucune action Production.** Aucun déploiement. Aucune migration Production.
  Aucune fusion. La relecture n'a produit que des commits sur la branche
  existante, et un rejeu annulé sur Test.

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

**A5 — L'écran manager réattribuait encore un quart sans motif.** Le §2.3
interdit toute réattribution silencieuse, et la commande
`fdj_transferer_responsabilite_quart` exige un motif, l'horodate et la
journalise. L'écran manager écrivait pourtant `employee_id` en direct.
*Tranché à la relecture finale (point 26.4) — la dette est levée.*
`employee_id` est **sorti** de l'`update` du quart ; le changement de titulaire
passe par la commande, avec un champ « motif du transfert » et un refus côté
écran avant l'appel réseau si le motif fait moins de cinq caractères.

Un second chemin, plus discret, a été trouvé en même temps : « je crée un
quart, il en existait déjà un à cette date » réattribuait silencieusement le
quart d'un collègue, par un `update` de rattrapage, sur un écran de création
qui n'a pas de champ motif — il n'a rien à transférer, en principe. Plutôt que
d'inventer un motif par défaut, NEXUS refuse et renvoie le manager sur le quart
concerné, là où le geste existe et où le motif sera écrit par un humain. La
mutation **M12** rejoue les deux formes du refus, et vérifie qu'un transfert
motivé passe et se journalise.

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

Le fichier `NEXUS-FDJ-v1.html` contient **21** accès directs aux tables `fdj_*`,
dont **9 en écriture** — c'était 24 et 11 avant la relecture finale. La Vague 1
a basculé tout le cycle de caisse, les activations et les mouvements de stock
sur les commandes serveur ; ce qui suit ne l'est pas encore.

| Emplacement | Écriture | Pourquoi elle subsiste |
|---|---|---|
| `NEXUS-FDJ-v1.html:717` | `update fdj_shifts` (lien de continuité avec le quart précédent) | appartient à la chaîne de stock, hors périmètre du cycle de caisse |
| `:1417` | `upsert fdj_shift_counts` | les comptages d'ouverture ; aucune commande serveur ne les couvre encore — dette de Vague 2, et la raison pour laquelle la Phase C laisse les droits d'écriture sur cette table |
| `:1421` | `update fdj_shifts` (`ouverture_validee`) | validation d'ouverture de stock, distincte de l'ouverture du quart FDJ |
| `:1431`, `:1435`, `:1652`, `:1835` | `insert fdj_alertes` | alertes de stock, hors périmètre |
| `:1452` | `insert fdj_employee_shift_locks` | le verrou d'écran, hors périmètre |
| `:1460`, `:1660` | `insert fdj_audit_log` | conservés, mais **encadrés** : la Phase C ajoute un trigger qui refuse un `acteur_id` différent de `auth.uid()` |
| ~~`:1638`, `:1809`~~ | ~~`insert fdj_stock_movements`~~ | **levé à la relecture finale (26.3).** Les deux appels passent par `fdj_activer_carnet` et `fdj_enregistrer_mouvement_stock` ; l'écran ne fournit plus ni site, ni employé, ni auteur, ni date d'effet, ni clé d'idempotence. Il ne reste aucun `from('fdj_stock_movements')` en écriture dans cet écran. |
| ~~`NEXUS-FDJ-Manager-v1.html:5511`, `:5525`, `:5531`~~ | ~~`update` / `insert fdj_shifts` avec `employee_id`~~ | **levé à la relecture finale (26.4).** `employee_id` est sorti de l'`update` ; le titulaire change par `fdj_transferer_responsabilite_quart`, avec motif et journal — voir A5. |

Ce qui subsiste dans `NEXUS-FDJ-Manager-v1.html` est d'une autre nature : cet
écran écrit encore en direct `fdj_reports`, `fdj_shift_counts` et les colonnes
`date` / `quart` / `statut` d'un `fdj_shifts`. La Phase C **réserve ces
écritures au manager** — c'est exactement ce que la mutation **M9** vérifie en
sens inverse : « le manager contrôle, valide, saisit une feuille et dépose un
rapport ». Ce ne sont donc pas des trous : ce sont les gestes que le rôle a le
droit de faire, et le seul geste que l'écran ne pouvait plus faire sans
commande — la saisie de la feuille de caisse — en a reçu une
(`fdj_saisir_caisse_manager`).

La lecture signalée dans la première version de cette annexe — `motif_ecart_texte`
servi à l'employé par l'écran **Ma Progression** — **est levée** (26.2). Cet
écran, **dans son chemin employé**, ne lit plus `fdj_cash_controls` : il
appelle `fdj_ma_progression_caisse()`, qui ne rend que des colonnes autorisées.
Son chemin **manager** lit encore les lignes brutes — c'est son objet — mais par
une liste de colonnes explicite au lieu d'un `select('*')`, et gardé par la RLS.
La fuite était d'ailleurs plus large que ce paragraphe ne le disait : voir 26.2.

**La règle qui en découle pour la Phase C :** elle ne retire que les droits
dont on a la preuve qu'aucun écran servi ne se sert — mais, cette preuve ayant
été faite pour les trois dettes ci-dessus, elle retire nettement plus qu'à
l'ouverture de la vague : **20 politiques directes deviennent 16**, et la
lecture de `fdj_cash_controls` par l'employé est **fermée**, pas gardée. Là où
un trigger de garde subsiste — `fdj_audit_log`, les colonnes de `fdj_shifts` —
c'est parce que l'écriture reste légitime et que seule la **colonne** est
interdite ; la RLS filtre des lignes, jamais des colonnes, et un trigger est le
seul outil qui ait la bonne granularité. Le principe du §9 est inchangé : on ne
ferme qu'après avoir prouvé que plus personne ne passe par la porte. Ce qui a
changé, c'est qu'on a fait la preuve.
