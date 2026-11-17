# NEXUS Scanner, cahier des charges des écrans T3

17/11/2026

## Objet, périmètre et principes

T3 donne au gérant et au manager sept écrans pour lire et tenir les registres tarifaires T2 déjà installés et validés sur Test (recette d'accès 16/16, recette fonctionnelle 440/440 conforme à T1 v2). Aucun écran ne crée de table : tout passe par les dix registres `tarif_*` et leurs vues `v_tarif_*`.

Principes non négociables :

- **Test d'abord.** T3 est développé et recetté sur le projet Supabase Test uniquement. Aucune lecture ni écriture en Production sans GO écrit.
- **Aucun prix n'est appliqué par NEXUS.** Les écrans enregistrent des décisions ; le changement de prix reste un geste manuel dans Decenium, déclaré ensuite dans NEXUS. Aucune écriture dans Decenium.
- **Deux sources distinctes, toujours affichées comme telles.** Les chiffres de vente et de coût viennent des exports Decenium T1 ; les règles et décisions viennent des registres relus dans Test. Un écran ne mélange jamais les deux sans l'étiqueter.
- **Historique intact.** Rien ne s'efface : une correction crée une nouvelle version, une erreur s'annule avec un motif.
- **Le moteur reste celui de T2.** Les écrans affichent ce que calcule la politique tarifaire T2 ; ils ne recalculent rien de leur côté.

Hors périmètre : promotion des 130 lignes de Test vers la Production, fusion sur main, déploiement, modification des prix Decenium.

## Utilisateurs et droits

Les écrans reprennent exactement les droits que la RLS T2 applique déjà : un bouton n'apparaît que si la base acceptera le geste, et la base refuse de toute façon ce que l'écran n'aurait pas dû proposer.

| Profil | Lit | Saisit | Annule |
| --- | --- | --- | --- |
| Gérant du site | Tous les registres de son site | Tout : familles, rattachements, seuils, réglages, décisions d'exception, prix décidés, régimes, contrôles qualifiés, journal | Toute ligne active de son site |
| Manager du site | Tous les registres de son site | Candidatures d'exception, contrôles ouverts ou à compléter, déclarations d'application dans Decenium | Seulement ses propres candidatures, contrôles ouverts et déclarations |
| Créateur | Les sites qui l'autorisent (`acces_createur_autorise`) | Rien | Rien |
| Employé, anonyme | Rien | Rien | Rien |
| Compte désactivé | Rien, même avec une session encore valide | Rien | Rien |

Règles d'affichage qui en découlent :

- Le site est celui du compte connecté. Aucun sélecteur de site pour le gérant ou le manager ; le créateur choisit parmi les sites autorisés.
- Un manager ne voit jamais de bouton « Valider » ou « Refuser » sur une exception, ni de saisie de prix décidé.
- Une lecture vide ne veut jamais dire « compte désactivé ». L'écran lit d'abord la ligne `employees` de la personne connectée (sa propre ligne, que la politique `select_employees` lui ouvre) : `actif` faux donne « Compte inactif, contactez votre gérant » ; `actif` vrai et registres vides donne « Aucune donnée tarifaire pour ce site » ; ligne illisible ou erreur donne « Impossible de vérifier votre compte », sans conclure.

## Écran 1, tableau de politique tarifaire

L'onglet « Politique tarifaire » du Scanner ouvre sur quatre cartes, un Conseiller, puis les huit alertes ; un clic sur une référence ouvre sa fiche tarifaire. C'est un espace d'analyse : aucune saisie directe, chaque action renvoie vers l'écran de travail concerné.

**Sources affichées.** Ventes, coûts, quantités et PV moyens : dernier export Decenium importé, avec sa période. Seuils, exceptions, prix décidés, contrôles : registres T2 du site. Chaque carte porte la mention de sa source et de sa période.

| Bloc | Contenu | Registres et vues lus |
| --- | --- | --- |
| Carte 1 | Propositions à valider, gain des références fiables ; gain « à confirmer » à côté, plus petit et étiqueté | `v_tarif_seuils_actifs`, `v_tarif_familles_actifs`, `v_tarif_rattachements_actifs` |
| Carte 2 | Références à vérifier (fiabilité insuffisante ou contrôle ouvert) | `v_tarif_controles_reglementaires_actifs` |
| Carte 3 | Prix décidés non constatés en caisse | `v_tarif_prix_decides_actifs`, `v_tarif_prix_application_actifs` |
| Carte 4 | Contrôles réglementaires ouverts | `v_tarif_controles_reglementaires_actifs` |
| Alertes 1 à 8 | Une carte par alerte : cause, données utilisées, fiabilité, action « Vérifier », « Décider » ou « Surveiller » | Toutes les vues actives, `v_tarif_exceptions_effectives` |
| Bandeau d'intégrité | Affiché seulement si `v_tarif_incoherences` renvoie au moins une ligne, réservé au gérant | `v_tarif_incoherences` |

**Statuts.** Les cinq statuts de T2 sont repris tels quels, avec leur badge `nexus-badge-etat.js` : À vérifier, Proposition à valider, À surveiller, Conforme, Sans seuil validé. « Conforme » n'apparaît jamais sans seuil validé ou prix décidé vérifié.

**Gains.** Rangés par scénario (prix décidés, minimum, cible) et par fiabilité ; minimum et cible ne s'additionnent jamais. Les repères indicatifs et les références insuffisantes restent derrière le chevron de preuve.

**Liste complète.** Recherche, filtres cumulables (famille, rayon, statut, fiabilité, exception, alerte), dix premières lignes triées par gravité puis montant.

**Fiche tarifaire d'une référence.** Nom, famille et origine du rattachement (référence ou rayon), taux actuel, seuil applicable avec sa version, PV TTC moyen, marge unitaire, fiabilité et ses raisons, exception effective, historique des décisions. Boutons selon le profil : « Proposer une exception » (manager, gérant), « Décider du prix » (gérant).

**Budget d'affichage.** Premier écran vérifié à 375 × 812 et 1280 × 800, en Sombre et en Jour.

## Écran 2, familles et rattachements

Le gérant y tient la liste des familles tarifaires et dit quelle référence ou quel rayon appartient à quelle famille. Le manager le consulte en lecture seule. Jeu de référence sur Test : 24 familles, 51 rattachements dont 34 par référence.

**Vue principale.** Une ligne par famille active (`v_tarif_familles_actifs`) : code, libellé, nombre de références rattachées, seuil actif s'il existe, date et auteur de la version. Un clic déplie ses rattachements (`v_tarif_rattachements_actifs`), avec la mention « par référence » ou « par rayon ».

**Gestes du gérant.**

1. Créer une famille.
2. Modifier une famille : l'écran insère une nouvelle version avec `remplace_id` sur la version active ; l'ancienne reste dans l'historique.
3. Rattacher une référence ou un rayon à une famille active, ou changer ce rattachement par nouvelle version.
4. Annuler une ligne active, motif obligatoire.

**Refus de la base à traduire.**

| Code renvoyé | Message affiché |
| --- | --- |
| `tarif_famille_inconnue` | Cette famille n'existe pas ou n'est plus active sur votre site. |
| `tarif_version_active_existante` | Cette référence a déjà un rattachement actif : modifiez-le plutôt que d'en créer un second. |
| `tarif_version_inactive` | Quelqu'un vient de modifier cette ligne. Rechargez avant de recommencer. |

**Point d'attention.** Annuler une famille encore visée par des rattachements ou un seuil est possible en base ; ces lignes apparaissent ensuite dans `v_tarif_incoherences`. Avant toute annulation, l'écran affiche les conséquences : nombre et liste des rattachements et seuils actifs qui visent la famille, références qui changeraient de statut (calcul du moteur T2), puis demande une confirmation explicite. Sans réponse lisible de la base, l'annulation n'est pas proposée.

## Écran 3, seuils et réglages

C'est l'écran « Paramètres tarifaires » du gérant : il fixe les seuils de marge et les réglages du moteur, toujours par nouvelle version. Jeu de référence sur Test : 13 seuils et 4 réglages.

**Seuils** (`v_tarif_seuils_actifs`). Une ligne par seuil actif : niveau (famille ou autre niveau prévu par T2), cible, minimum, cible de taux, statut, version et date. Le statut est affiché en clair, car il change tout :

- **Validé** : produit des propositions et peut donner « Conforme ». Aujourd'hui : sodas 2 L, confiserie, vapotage.
- **Indicatif** : repère seulement. Sous ce seuil, la référence est « à surveiller », jamais « proposition à valider ».
- **À l'étude** : visible du gérant, sans effet sur les statuts.

Un encart rappelle l'ordre de priorité des seuils tel que la proposition fonctionnelle le fixe (section « Quel seuil »), pour que le gérant voie quel seuil s'appliquera avant de valider.

**Réglages** (`v_tarif_reglages_actifs`). Liste courte de valeurs nommées, chacune avec son unité, sa valeur par défaut et son effet en une phrase : tolérance de constat (2 centimes TTC), seuils de dégradation d'un produit d'appel (2 points, 0,02 € et 5 %, 5 € de marge perdue), arrondi, période de référence.

**Gestes du gérant.** Créer une nouvelle version d'un seuil ou d'un réglage, en voyant avant validation combien de références changeraient de statut (aperçu calculé par le moteur T2, sans écriture). Annuler une version, motif obligatoire.

**Garde-fous.** Un seuil de famille vise une famille active (`tarif_famille_inconnue` sinon). Un seuil ne passe jamais de « indicatif » à « validé » sans geste explicite du gérant, inscrit au journal.

## Écran 4, exceptions commerciales

Le manager propose une exception, le gérant la valide, la refuse ou la lève ; l'écran affiche pour chaque référence l'exception qui fait foi selon `v_tarif_exceptions_effectives`. Jeu de référence sur Test : 13 exceptions.

**Ce qui fait foi** (priorité de la vue, reprise à l'identique) :

1. Décision du gérant dans le registre (validée ou levée).
2. Sinon, produit d'appel déjà enregistré dans `produits_appel` : affiché « validé, source produits d'appel », avec la candidature ou le refus en attente signalé à côté, sans effet.
3. Sinon, candidature ou refus, sans effet sur le moteur.

**Cycle de vie.**

| Statut | Qui le saisit | Effet sur le moteur | Suite possible |
| --- | --- | --- | --- |
| Candidate | Manager ou gérant | Aucun | Le gérant valide ou refuse ; l'auteur peut la corriger ou l'annuler |
| Validée | Gérant | Statut « à surveiller », alertes 6 et 7 actives | Le gérant la lève ou modifie ses conditions |
| Refusée | Gérant, motif obligatoire | Aucun | Nouvelle candidature possible |
| Levée | Gérant | Fin de l'exception, la référence revient aux seuils | Aucune |

**Saisie d'une candidature.** Référence (code-barres ou libellé), type, motif, conditions proposées par défaut : prix TTC déclaré, tolérance de coût ± 10 %, coût de référence. Le gérant peut modifier ces conditions au moment de décider.

**Contrôle à chaque import.** À côté de chaque exception validée : prix constaté, coût constaté, dernier contrôle, et alerte 7 si une condition n'est plus tenue.

**Refus de la base à traduire.**

| Code renvoyé | Message affiché |
| --- | --- |
| `tarif_retrogradation_refusee` | Seul le gérant peut modifier une exception déjà décidée. |
| `tarif_version_active_existante` | Une exception existe déjà pour cette référence : modifiez-la. |
| Refus RLS (ligne non insérée) | Vous ne pouvez proposer qu'une candidature. |

## Écran 5, prix décidés et suivi d'application

Le gérant y décide un prix ; le manager y déclare qu'il l'a saisi dans Decenium ; l'import suivant dit si la caisse le confirme. NEXUS n'écrit jamais dans Decenium. Jeu de référence sur Test : 21 prix décidés, aucune déclaration d'application.

**Tableau.** Une ligne par prix décidé actif (`v_tarif_prix_decides_actifs`) : référence, nature, prix TTC décidé, date et auteur de la décision, dernière déclaration de saisie (`v_tarif_prix_application_actifs`), PV moyen constaté sur le dernier export, écart, taux au prix décidé, état.

**États affichés.**

| État | Condition | Ce que l'état ne dit pas |
| --- | --- | --- |
| Décidé | Prix décidé actif, aucun événement d'application | Que le prix soit en caisse |
| Saisie déclarée | Événement `saisie_declaree` : une personne dit l'avoir saisi dans Decenium | Que la saisie ait eu lieu |
| Période partielle | L'export couvre la date de saisie déclarée | Rien sur la cohérence |
| Cohérence du prix moyen | PV moyen à 2 centimes TTC du prix décidé, sur une période postérieure à la saisie | Que chaque vente soit au bon prix |
| Justificatif déclaré | Événement `preuve_application` avec une référence textuelle (ticket, relevé, autre) | Que la pièce ait été contrôlée : affiché « non vérifié » |
| Application vérifiée | Prix lu par le moteur T2 dans un export de prix Decenium importé dans NEXUS, daté après la saisie | (état le plus fort) |
| Écart constaté | PV moyen hors tolérance après la saisie, ou export de prix contraire ; l'alerte reste ouverte |  |
| Maintenu | Décision de garder le prix actuel ; aucune saisie attendue |  |

Les états ne se confondent jamais : une saisie déclarée n'est pas une cohérence, une cohérence n'est pas une application vérifiée, un justificatif textuel n'est pas une preuve. Une référence textuelle reste affichée telle que saisie, avec son auteur et sa date.

**Prix décidé hors journal** (contre-audit du 17/11, condition 2). T2 laisse encore le gérant insérer un prix décidé directement, sans ligne de journal. L'écran le signale par un badge « Décidé hors journal », à vérifier. Il le repère par un prix décidé actif, de nature « changement », saisi après la migration décision-journal, qu'aucune ligne de `tarif_decisions` ne vise. Un filtre de la liste les regroupe. Les prix décidés antérieurs à la migration portent la mention « antérieur au journal », sans alerte.

**Gestes.**

- Gérant : décider un prix depuis une proposition ou la fiche, valider par lot une famille (une ligne par référence au journal), annuler une décision avec motif.
- Manager et gérant : « Déclarer la saisie dans Decenium » avec sa date, et « Ajouter un justificatif » sous forme de référence textuelle (pas de fichier en T3). Le manager ne peut annuler que ses propres déclarations.
- Aucun bouton « Appliquer » nulle part.

**Refus de la base à traduire.** `tarif_application_invalide` : « Ce prix décidé n'est plus actif, ou il s'agit d'un prix maintenu : rien à saisir. »

## Écran 6, contrôles réglementaires et régimes de prix

Une référence en contrôle réglementaire ouvert reste « à vérifier » et ne produit aucune proposition tant que le gérant ne l'a pas qualifiée. Jeu de référence sur Test : 3 contrôles et 1 régime de prix ; en exploitation, 24 références de vapotage sont concernées à Sainte-Marie.

**Contrôles** (`v_tarif_controles_reglementaires_actifs`). Une ligne par référence : type de produit, pièce attendue (fiche technique), état, CA HT concerné, date d'ouverture, auteur.

| État | Saisi par | Effet |
| --- | --- | --- |
| Contrôle ouvert | Manager ou gérant | Référence bloquée en « à vérifier », alerte 8 |
| À compléter | Manager ou gérant | Idem, pièce manquante signalée |
| Qualifié (états définis par T2) | Gérant seul | Levée du blocage ou maintien selon la qualification |

Le manager peut ouvrir un contrôle, le compléter, et corriger ou annuler les siens tant qu'ils ne sont pas qualifiés. Une fois qualifié, seul le gérant le remplace (`tarif_retrogradation_refusee` sinon).

**Régimes de prix** (`v_tarif_regimes_prix_actifs`). Liste courte, tenue par le gérant : régime applicable, portée, texte de référence, version. Affichée en tête de l'écran, car elle conditionne la qualification des contrôles.

**Pièces jointes.** La fiche technique est attendue mais T2 ne stocke pas de fichier. À trancher (voir dernière section) : stockage Supabase Test dédié ou simple référence textuelle.

## Écran 7, journal des décisions

Chaque décision de prix du gérant (validée, refusée, autre prix) laisse une ligne dans `tarif_decisions` avec la photo des chiffres qui l'ont justifiée ; le journal se lit, ne se modifie pas, et une erreur s'annule avec un motif. Le schéma T2 limite ce journal aux décisions de prix : les exceptions, seuils et contrôles gardent leur propre historique de versions, affiché sur leur écran. Jeu de référence sur Test : aucune ligne.

**Lecture.** Directement sur `tarif_decisions` (pas de vue « actifs » : toutes les lignes comptent, annulées comprises, barrées et suivies du motif). Tri du plus récent au plus ancien. Filtres : période, référence, famille, type de décision, auteur.

**Contenu d'une ligne.**

| Champ | Colonne T2 | Exemple de lecture |
| --- | --- | --- |
| Date et heure, fuseau du site | `saisi_le` | 17/11/2026 10 h 14 |
| Auteur | `saisi_par` | Nom du gérant |
| Décision | `decision`, `prix_ttc_retenu` | Autre prix, 3,85 € TTC |
| Seuil appliqué | `seuil_id` | Confiserie, minimum validé, version du 12/11 |
| Photo des chiffres | `photo`, `periode_debut`, `periode_fin`, `moteur_version` | Taux, coût, PV HT, quantité, fiabilité vus au moment de décider |
| Motif | `motif` | Obligatoire pour un refus ou un autre prix |
| Prix décidé créé | Lien à ajouter (dossier technique de la fonction décision-journal) | Vers la ligne de `tarif_prix_decides` |

**Qui écrit.** Le gérant seul, uniquement par la fonction transactionnelle décision-journal appelée depuis l'écran 1 ou 5 : le prix décidé et sa ligne de journal sont enregistrés ensemble, ou pas du tout. Le journal n'a pas de saisie libre.

**Photo déclarée, non authentifiée** (contre-audit du 17/11, condition 1). La photo des chiffres est calculée par le moteur T2 dans le navigateur, puis transmise par l'écran. La base contrôle sa forme et la version déclarée, pas son origine. Le détail d'une ligne affiche donc « Photo déclarée par l'écran (moteur T2, version …) », jamais « certifiée ».

**Export.** CSV du journal filtré, pour le gérant, sans donnée d'un autre site.

## Règles transverses

Les sept écrans partagent les mêmes règles d'écriture, d'affichage et de sécurité, déjà imposées par la base T2.

**Versions et annulations.**

- Jamais de DELETE ni de mise à jour d'une valeur : une modification insère une nouvelle ligne avec `remplace_id`.
- Une annulation ne touche que `annule_le`, `annule_par` et `motif_annulation` ; le motif est obligatoire dans l'écran.
- L'historique d'une ligne (versions successives, annulations) s'ouvre par un chevron, sur chaque écran.

**Erreurs remontées par la base.** Toute erreur `P0001` commençant par `tarif_` est traduite par un message français propre à l'écran (tables des écrans 2, 4 et 5). Un refus RLS (ligne non insérée ou 0 ligne mise à jour) donne « Vous n'avez pas les droits pour ce geste ». Aucun message technique brut n'est montré.

**Concurrence.** Deux saisies simultanées sur la même clé sont sérialisées par la base ; la seconde reçoit `tarif_version_active_existante` ou `tarif_version_inactive`, et l'écran propose de recharger.

**Multisite.** Aucun filtre de site côté client ne remplace la RLS : l'écran ne passe jamais de paramètre de site pour lire, et n'envoie que le site du compte pour écrire. Les tests de recette incluent un compte d'un autre site.

**Comptes désactivés.** La politique `compte_actif_obligatoire` vide toutes les lectures et refuse toutes les écritures. L'écran ne déduit jamais l'inactivité d'une lecture vide : il vérifie employees.actif comme décrit à la section des droits.

**Dates.** Stockées en UTC, affichées dans le fuseau du site (`sites.timezone`), au format JJ/MM/AAAA.

**Vocabulaire et apparence.** Libellés tirés de `nexus-vocabulaire.js`, badges de `nexus-badge-etat.js`, canevas du référentiel de conception, thèmes Sombre et Jour. Deux icônes à demander sur #160 : exceptions, contrôle réglementaire.

**Accès.** Aucune clé `service_role` dans le navigateur ; seule la clé publique et la session de la personne connectée sont utilisées.

## Recette T3 sur Test

La recette T3 se joue sur Test, sur le jeu des 130 lignes de Sainte-Marie, et n'est acceptée que si les écrans affichent exactement ce que T2 a déjà prouvé (440/440 conforme à T1 v2).

**Jeu de données.**

- Les 130 lignes actives restent le jeu de référence de Test pour T3, et rien d'autre : aucune promotion, automatique ou manuelle, vers la Production.
- Les gestes de recette ajoutent des lignes (versions, annulations, journal) ; un export avant et après permet de distinguer le jeu de référence des lignes de recette.
- Les exports Decenium T1 restent la source des chiffres de vente ; les registres relus dans Test restent la source des règles. Le compte rendu garde ces deux colonnes séparées.

**Comptes.** Les cinq comptes de recette T2 restent désactivés et bannis, historique conservé, sans réactivation. Le nombre de nouvelles identités T3 est réexaminé avant la recette : le minimum visé est trois (gérant SM, manager SM, gérant d'un autre site), le cas « compte désactivé » étant joué en fin de recette en désactivant le manager SM. Aucune création sans GO écrit.

**Critères d'acceptation.**

- [ ] Écran 1 : statuts, alertes et gains identiques à la comparaison 440/440 pour les 440 références.
- [ ] Chaque geste autorisé de la section des droits réussit avec le bon profil ; chaque geste interdit est absent de l'écran et refusé par la base si on le force.
- [ ] Le compte de l'autre site ne voit aucune ligne de Sainte-Marie ; le compte désactivé voit le message prévu et aucune donnée.
- [ ] Chaque code `tarif_*` déclenché au moins une fois affiche son message français.
- [ ] Une décision du gérant crée sa ligne de registre et sa ligne de journal, ou aucune des deux.
- [ ] Un prix décidé suit ses états jusqu'à « cohérence constatée » sur un export de Test, sans aucune écriture dans Decenium.
- [ ] Premier écran conforme au budget d'affichage, 375 × 812 et 1280 × 800, Sombre et Jour.
- [ ] Aucune erreur dans la console, aucune clé `service_role` côté navigateur.

**Livrables.** Compte rendu de recette, preuves horodatées, empreintes SHA-256, sur le modèle de la recette fonctionnelle T2.

## Hors périmètre et décisions à prendre

Cinq points sont à trancher avant le développement ; les deux premiers demanderaient une migration T3, donc un GO écrit.

| N° | Question | Options | Recommandation |
| --- | --- | --- | --- |
| 1 | Enregistrer décision et journal en une seule transaction | Fonction SQL `security invoker` appelée par l'écran, ou deux insertions successives | Fonction `security invoker` : pas d'élévation de droits, atomicité garantie. Migration à préparer |
| 2 | Le manager « confirme une donnée » (coût, TVA) : aucun registre T2 ne le permet | Nouveau registre de confirmations, ou commentaire dans une candidature | Commentaire en T3, registre dédié plus tard si l'usage le justifie |
| 3 | Fiches techniques et preuves datées d'application | Stockage Supabase Test par site, ou référence textuelle | Référence textuelle en T3 |
| 4 | Aperçu d'impact d'un nouveau seuil (écran 3) | Calcul par le moteur T2 dans le navigateur, ou côté base | Moteur T2 dans le navigateur, sans écriture |
| 5 | Accès du créateur | Lecture seule sur les sites autorisés, ou aucun écran | Lecture seule, comme la RLS le permet déjà |

**Arbitrage du 17/11/2026 : approuvé avec conditions.** Les sept écrans et les cinq recommandations sont retenus. Conditions reportées dans ce cahier :

1. Fonction `security invoker` décision-journal : RLS, atomicité et isolation multisite prouvées avant toute migration (dossier technique séparé).
2. Prix décidé, saisie déclarée, cohérence du prix moyen et application vérifiée restent quatre états distincts (écran 5).
3. Une lecture vide n'est jamais prise pour un compte désactivé sans vérification de `employees.actif` (section des droits).
4. Les conséquences de l'annulation d'une famille encore utilisée sont affichées avant confirmation (écran 2).
5. Les confirmations de données par le manager sont des commentaires non décisionnels.
6. Les justificatifs sont des références textuelles, affichées « non vérifié ».
7. Aperçus et calculs : moteur T2 exclusivement.
8. Créateur : lecture seule des sites autorisés.
9. Nombre de comptes temporaires de recette réexaminé avant la recette T3.

**Hors périmètre T3.**

- Toute lecture ou écriture en Production, toute promotion des 130 lignes de Test.
- Toute écriture dans Decenium et tout changement de prix Decenium.
- La fusion de la PR #331 sur main et tout déploiement : la PR reste en brouillon.
- Le défaut transverse des comptes désactivés sur les autres tables NEXUS (379 politiques, 152 tables) : dossier séparé. T3 n'en dépend pas, sauf `produits_appel`, déjà filtrée dans `v_tarif_exceptions_effectives`.
- L'employé : il ne voit pas l'espace tarifaire.
