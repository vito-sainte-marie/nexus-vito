# Modèle de données et règles de consolidation (v4)

Propositions en prose et en tables. Aucun SQL exécutable. Aucun nom n'est figé avant validation. Rien n'est appliqué sur Test ni en Production. La v4 remplace le modèle de tournée hebdomadaire de la v3 (conservée dans `CDC-v3.md`).

Modèle de référence dans le dépôt : tables append-only à annulation tracée (`produits_justifications_marge`, `produits_tva_confirmations`) : auteur égal à l'utilisateur connecté, site obligatoire, politique par site, mise à jour limitée aux colonnes d'annulation, pas de suppression.

Une seule date par relevé, la « date limite », sans type : DLC et DDM sont traitées de la même façon (même clé, mêmes seuils, même règle).

## 1. `dates_courtes_releves` (append-only)

| Colonne | Rôle |
|---|---|
| id | identifiant du relevé |
| site | station, obligatoire |
| ean | EAN normalisé, nul si produit sans EAN |
| libelle_normalise | libellé normalisé (date en tête retirée, casse et espaces unifiés), clé des produits sans EAN, nul si EAN |
| libelle_vu | nom affiché au moment du relevé, pour mémoire |
| nom_libre | nom saisi à la main, facultatif, pour une entrée provisoire |
| date_limite | date exacte (jour calendaire, fuseau Martinique) |
| quantite | entier strictement positif |
| provisoire | vrai si EAN inconnu du catalogue au moment du relevé |
| tournee_id | tournée à laquelle appartient le relevé (voir section 3) |
| photo_ref | référence de photo facultative |
| cle_idempotence | fabriquée sur l'appareil au geste |
| auteur | employé connecté |
| heure_geste | heure du geste relevée sur l'appareil |
| recu_le | heure de réception par le serveur |
| recu_apres_cloture | vrai si reçu après la clôture de sa tournée alors que le geste l'a précédée |
| annule_le, annule_par, motif_annulation | annulation tracée |

Contraintes : site obligatoire ; ean ou libelle_normalise renseigné, jamais les deux vides ; quantité positive ; unicité (site, cle_idempotence).

## 2. `dates_courtes_corrections` (append-only)

| Colonne | Rôle |
|---|---|
| id, site | identifiant, station |
| releve_id ou groupe | cible : relevé précis ou groupe (clé de groupe) |
| tournee_id | tournée de la correction |
| delta | entier signé non nul |
| motif | facultatif ; obligatoire pour une annulation |
| lien_changement_date | rattache les deux lignes d'un changement de date |
| cle_idempotence, auteur, heure_geste, recu_le | comme ci-dessus |
| annule_le, annule_par, motif_annulation | annulation tracée |

Contrainte : l'application d'un delta ne peut pas rendre la quantité du groupe négative dans sa tournée, vérifié sous verrou de ligne.

## 3. Tournées individuelles, clé de groupe et quantité courante

Tournée :

- Chaque employé autorisé crée et mène sa propre tournée. Plusieurs tournées peuvent être ouvertes en même temps dans une station. Pas de tournée hebdomadaire, pas de remise à zéro du lundi, pas d'ouverture réservée au manager, pas de tournée automatique.
- Nom facultatif. Il ne limite pas les produits relevés.
- États : `EN_COURS`, `TERMINEE_A_CERTIFIER`, `CERTIFIEE`, avec une demande possible `CORRECTION_DEMANDEE`.
- Terminer : enregistre l'auteur, l'heure, l'empreinte des relevés consolidés de la tournée et l'identifiant de la dernière opération. Terminer deux fois sans changement donne la même version. Le blocage du bouton tant que le téléphone a des saisies en attente est un contrôle côté appareil (lot 2).
- Une saisie reçue après la clôture mais faite avant (heure du geste) est rattachée à sa tournée et marquée « reçue après clôture ». Si la tournée était certifiée, elle repasse à certifier ; l'ancienne certification reste tracée.

Clé de groupe :

- Avec EAN : site + EAN normalisé + date limite.
- Sans EAN : site + libellé normalisé + date limite. Une table de correspondance (section 3 bis) permet au manager de dire « même produit que… » quand un libellé change.
- `normalized_products` est vide en Production : `external_product_id` ne peut pas servir de clé (constat de Guardian, voir `questions-metier.md`).

Quantité d'un groupe dans une tournée :

1. Somme des relevés non annulés de la tournée, plus les corrections non annulées, plancher à zéro par tournée. Les retraits n'y entrent pas.
2. Un relevé et une correction appartiennent à la tournée de leur geste. Un retrait n'est pas un relevé : il ne désigne aucune tournée de référence et ne rajeunit aucune ligne.

Quantité courante d'un article (EAN, ou libellé normalisé) :

1. Une tournée qui relève un article l'a relevé en entier : pas de relevé partiel.
2. La tournée qui porte le dernier relevé effectif de l'article, à l'heure du geste, l'emporte, que les tournées soient simultanées ou non. Ses quantités par date sont les quantités courantes de l'article.
3. Les autres tournées passent en historique. Aucune addition entre tournées. Mention seule : « relevé aussi dans la tournée X (M1, 10:15), en historique ». Ni écran ni table de résolution de conflit.
4. Une date non retrouvée dans la tournée gagnante n'a aucune quantité courante : elle reste en historique. Son absence n'est ni une vente, ni une destruction, ni une démarque.
5. Calculée par vue ou fonction, jamais stockée comme vérité.

Âge et étiquettes, calculés par ligne de date limite à partir du dernier relevé effectif :

- Jamais depuis la certification ou la clôture. Une correction, une annulation, une certification ou un rattachement administratif ne rajeunit pas la ligne.
- 7 jours et moins : courante. 8 à 14 jours : « à vérifier ». Plus de 14 jours : « À recontrôler ».
- Une quantité de plus de 7 jours ne déclenche aucune demande de retrait.
- Date limite dépassée : toujours signalée. Relevé de plus de 7 jours : « DLC dépassée, présence à vérifier », sans demande de retrait. Relevé de 7 jours ou moins : « à retirer ».

### 3 bis. Tables annexes

- `dates_courtes_tournees` : id, site, nom (facultatif), auteur, creee_le, etat, terminee_par, terminee_le, version_empreinte, version_derniere_operation. Mise à jour limitée à l'état et aux colonnes de clôture, par fonction serveur. Pas de colonne `origine`.
- `dates_courtes_certifications` : id, site, tournee_id, manager, certifiee_le, version_certifiee, observations, statut, mention d'identité (réalisateur et certificateur identiques). Append-only ; une nouvelle certification s'ajoute, l'ancienne reste tracée.
- `dates_courtes_demandes_correction` : id, site, tournee_id, manager, motif, releves_vises, demandee_le, reponse, repondue_par, repondue_le. Append-only hors réponse. La réponse du renfort remet la tournée à certifier.
- `dates_courtes_correspondances` : id, site, libelle_normalise_ancien, libelle_normalise_nouveau, auteur, cree_le, annule_le, annule_par, motif_annulation. Geste manager « même produit que… ». Append-only. Ne rajeunit pas l'âge d'une ligne.
- Rattachement d'un produit provisoire à un produit existant sous un autre code : même mécanique (ligne tracée, annulable), réservé au manager, gérant, créateur.
- Produit provisoire dont l'EAN apparaît ensuite dans un import : le groupe rejoint la fiche du catalogue de lui-même, sans geste et sans création de référence ; l'historique est intact.

La certification ne déclenche aucune démarque et ne bloque ni la clôture ni l'usage des quantités, affichées « non certifiées » jusque-là.

## 4. Retraits : `dates_courtes_retraits` (append-only)

| Colonne | Rôle |
|---|---|
| id, site, groupe (clé), tournee_id | identité |
| etat | signalé, retiré physiquement, démarque comptabilisée |
| quantite | unités concernées |
| auteur, cree_le, heure_geste, commentaire | trace |
| annule_le, annule_par, motif_annulation | annulation tracée |

- Addition seulement entre les saisies d'un même auteur dans une même tournée ; un auteur peut mener plusieurs tournées, qui ne s'additionnent pas entre elles (la tournée du dernier relevé fait foi). Aucune colonne ni contrainte ne lie une tournée au quart ou limite le nombre de tournées ouvertes par auteur.
- Le retrait physique diminue la quantité courante de la ligne (article, date), quelle que soit la tournée où il est saisi, s'il est postérieur ou égal au dernier relevé effectif de cette ligne (et non de l'article). Plancher vérifié sous verrou sur cette quantité courante (`plancher_zero`). Exemple : M1 relève X à 10:00, D1 = 5, D2 = 4 ; R1 retire 2 de D1 à 11:00 ; D1 = 3, D2 = 4, tournée de référence M1, âge depuis 10:00.
- Geste « trouvé et retiré » : un seul retrait marqué `trouve`, sans relevé. Il n'est jamais refusé par le plancher, ne crée aucune quantité sur un article jamais relevé et ne désigne aucune tournée. Autorisé au renfort.
- La quantité courante se calcule sur toutes les tournées de la station (fonction serveur, site lu depuis le compte, opérateurs et caissier habilité). Le détail des autres tournées n'est rendu qu'à la gestion ; renfort et manager obtiennent la même quantité, la même tournée de référence et la même échéance.
- `provisoire` est l'état à la saisie ; l'affichage relit `dates_courtes_est_provisoire`. Les clés d'idempotence client contenant « : » sont refusées. `dates_courtes_version_tournee` est réservée à la gestion et à l'auteur.
- Les unités retirées alimentent la liste « à comptabiliser » du manager. L'état « démarque comptabilisée » exige manager, gérant ou créateur ; le renfort ne peut pas le poser. Aucune écriture comptable.
- `inventaire_mouvements` n'est pas utilisée (`quart_id` obligatoire).

## 5. Réglage de station

Un réglage booléen « accès caissier », fermé par défaut, modifiable par manager, gérant ou créateur seulement, propre à la station. Peut se loger dans `station_config` ou dans une table dédiée (à arbitrer au lot 1). Hypothèse de travail : le caissier autorisé ne voit que ses propres tournées.

## 6. Synchronisation

- États côté appareil : Enregistré, En attente, Refusé.
- Une opération rejouée porte la même clé d'idempotence : le serveur renvoie le résultat de la première.
- Refus du serveur (plancher, droits) : visible, jamais silencieux.
- Chaque geste (relevé, correction, retrait) porte l'heure du geste relevée sur l'appareil, en plus de la clé d'idempotence. L'heure du geste sert au rattachement et au calcul du « dernier relevé effectif » ; l'heure de réception est conservée pour la trace et pour la mention « reçue après clôture ».

## 7. Droits sur les tables

- Politique de ligne : site égal au site de l'employé ; rôles selon `matrice-permissions.md`. Un renfort ou un caissier ne lit que ses propres tournées ; manager, gérant et créateur lisent toutes celles de la station.
- Retrait des accès `anon` et `public` ; pas de suppression, de troncature ni de références pour `authenticated` ; mise à jour limitée aux colonnes d'annulation et d'état de tournée, par fonction serveur.

## 8. Points non vérifiés

- Noms exacts des rôles du serveur : `renfort`, `manager`, `gerant`, `caissier`, `pompiste`, `vacataire` ; créateur par drapeau.
- Rôle `vacataire` : aucun accès (arbitrage du pilote du 21/11).
- Emplacement du réglage de station.
- Couverture du libellé normalisé au delà des deux périodes mesurées (voir `questions-metier.md`).
