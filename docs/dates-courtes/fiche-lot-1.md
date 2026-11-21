# Fiche lot 1 : socle métier et données (v4)

Statut : documentation et migration de banc. Rien sur Test ni en Production.

## 1. Objectif

Poser le modèle de relevé et de consolidation : relevés, corrections, retraits, tournées individuelles, certifications, demandes de correction, groupes station + EAN + date limite, historique, anti-doublon, droits, isolation multisite.

Une seule date est saisie, la « Date limite », sans type : DLC et DDM sont traitées de la même façon (même clé, mêmes seuils, même règle).

## 2. Ce que le lot livre

- Tables append-only : relevés, corrections, retraits, certifications, demandes de correction, correspondances. Table de tournées (mise à jour limitée à l'état et à la clôture, par fonction serveur).
- Vues ou fonctions : quantité d'un groupe dans une tournée, quantité courante d'un article, âge et étiquettes par ligne de date limite.
- Droits portés par le serveur (voir `matrice-permissions.md`).
- Réglage de station « accès caissier ».
- Détail des tables et clés : `modele-donnees.md`.
- Le lot ne crée ni ne modifie aucune page.

## 3. Règles de consolidation

- Clé de groupe : station + EAN normalisé + date limite exacte. Sans EAN : station + libellé normalisé + date limite exacte (section 5).
- Deux dates limites pour un même EAN : deux groupes. Jamais de fusion sur le nom commercial seul.
- Normalisation de l'EAN : chiffres seuls, EAN-8 et EAN-13 avec contrôle de la clé ; un UPC ou un code interne n'est pas converti de force en EAN.

Tournées individuelles :

- Chaque employé autorisé crée et mène sa propre tournée. Plusieurs tournées peuvent être ouvertes en même temps dans une station. Ni tournée hebdomadaire, ni remise à zéro du lundi, ni ouverture réservée au manager, ni tournée automatique.
- Nom facultatif, sans effet sur les produits relevés.
- États : `EN_COURS`, `TERMINEE_A_CERTIFIER`, `CERTIFIEE`, avec une demande possible `CORRECTION_DEMANDEE`.
- Terminer : enregistre auteur, heure, empreinte des relevés consolidés et identifiant de la dernière opération. Deux fois sans changement : même version. Le blocage tant que le téléphone a des saisies en attente relève du lot 2.
- Saisie reçue après la clôture mais faite avant (heure du geste) : rattachée à sa tournée, marquée « reçue après clôture ». Une tournée certifiée repasse à certifier ; l'ancienne certification reste tracée.

Quantités :

- Dans une tournée, un même article et une même date s'additionnent, corrections comprises : 6 + 4 − 2 = 8. Plancher à zéro par tournée.
- Un relevé, une correction ou un retrait appartient à la tournée de son geste et ne compte que dans celle-ci. Un geste hors ligne compte à l'heure du geste, jamais à l'heure de réception.
- Entre tournées, jamais d'addition. Une tournée qui relève un article l'a relevé en entier.
- La tournée qui porte le dernier relevé effectif de l'article (heure du geste) l'emporte, que les tournées soient simultanées ou non. Ses quantités par date sont les quantités courantes. Les autres passent en historique, avec la seule mention « relevé aussi dans la tournée X (M1, 10:15), en historique ». Ni écran ni table de résolution de conflit.
- Une date non retrouvée dans la tournée gagnante n'a aucune quantité courante, elle reste en historique. Son absence n'est ni une vente, ni une destruction, ni une démarque : aucun mouvement n'est écrit.
- Quantité courante calculée par vue ou fonction, jamais stockée comme vérité.

Âge et étiquettes (par ligne de date limite, depuis le dernier relevé effectif) :

- Jamais depuis la certification ou la clôture. Correction, annulation, certification et rattachement administratif ne rajeunissent pas la ligne.
- 7 jours et moins : courante. 8 à 14 jours : « à vérifier ». Plus de 14 jours : « À recontrôler ».
- Plus de 7 jours : aucune demande de retrait.
- Date limite dépassée : toujours signalée. Relevé de plus de 7 jours : « DLC dépassée, présence à vérifier », sans demande de retrait. Relevé de 7 jours ou moins : « à retirer ».

Certification :

- Manager, gérant ou créateur certifie une tournée (tournée, manager, heure, version certifiée, observations, statut) ou demande une correction (relevés visés, motif). La réponse du renfort remet la tournée à certifier.
- Le manager peut certifier sa propre tournée, avec la mention « réalisateur et certificateur identiques ». Renfort et caissier ne certifient jamais.
- Une rectification après certification est tracée et appelle une nouvelle certification.
- La certification ne déclenche aucune démarque et ne bloque ni la clôture ni l'usage des quantités, affichées « non certifiées » jusque-là.

Geste « trouvé et retiré » : le premier jour d'une tournée, un renfort trouve 3 articles périmés d'un produit pas encore relevé. La quantité est zéro et le plancher refuserait un retrait seul. Un geste unique écrit un relevé de 3 et un retrait de 3 : quantité zéro dans la tournée, 3 dans « à comptabiliser », aucun refus de plancher. Renfort autorisé : le geste combine deux droits déjà donnés (relever, confirmer un retrait physique) et aucun droit comptable.

## 4. Corrections

- « Ajouter des unités » : ajoute un relevé au groupe, sans toucher à l'existant.
- « Corriger le relevé » : écrit une correction signée liée à un relevé ou à un groupe, avec produit, date limite, quantité, auteur, heure, motif facultatif, cible.
- Changement de date : moins n sur l'ancien groupe, plus n sur le nouveau, liés.
- Annulation : trace conservée, motif obligatoire.
- Plancher à zéro : vérifié côté serveur sous verrou de ligne, par tournée. Refus visible.
- Une correction n'est ni une vente ni une démarque.

## 5. Produit sans EAN et EAN inconnu

Cas : pain, viennoiserie ou produit sans code-barres, identifié par le nom.

Clé : station + libellé normalisé + date limite exacte. Libellé normalisé : date en tête retirée, casse et espaces unifiés. `libelle_vu` reste une mémoire d'affichage.

Constat de Guardian, Production, lecture seule, filtrée sur la station, sur GO du pilote (21/11) :

- `normalized_products` est vide en Production : `external_product_id` ne peut pas servir de clé.
- Deux dernières périodes d'import : 64 articles sans EAN dans la dernière, 56 dans la précédente. 48 retrouvés avec un libellé identique, 49 avec un libellé normalisé, 0 doublon de libellé normalisé dans une période.
- Les 15 autres sont surtout hors périmètre ou de vraies nouveautés. Un seul renommage alimentaire.
- Avec EAN : aucun EAN porté par deux fiches dans une même période. 6 EAN changent de libellé d'une période à l'autre ; la clé EAN les garde dans un seul groupe.

Renommage : geste manager tracé « même produit que… » (table de correspondances, annulable). Le renfort ne peut pas le poser. Tant que rien n'est fait, deux libellés donnent deux groupes.

EAN inconnu du catalogue : entrée provisoire (EAN lu, nom libre facultatif), aucune référence créée. Quand l'EAN apparaît dans un import, le groupe rejoint la fiche de lui-même, historique intact. Le manager peut rattacher à la main à un produit sous un autre code (tracé, renfort refusé).

## 6. Anti-doublon

- Clé d'idempotence fabriquée sur l'appareil au geste. Une opération renvoyée compte une fois et renvoie le résultat de la première.
- Corrections simultanées : verrou de ligne sur le groupe, ordre d'arrivée serveur, plancher revérifié.

## 7. Droits et isolation

- `site_id` obligatoire ; politique par ligne limitée au site de l'employé ; aucun accès `anon`.
- Pas de suppression. Mise à jour limitée aux colonnes d'annulation et d'état de tournée, par fonction serveur.
- Renfort et caissier ne lisent que leurs propres tournées ; manager, gérant et créateur lisent toute la station.
- Accès caissier : fermé par défaut, activé par manager, gérant ou créateur, pour la station concernée seulement.
- Certification, demande de correction, rattachement, « même produit que… », démarque comptabilisée : manager, gérant, créateur.
- Pompiste : aucun accès. Vacataire : aucun accès par défaut, en attente d'arbitrage du pilote.

## 8. Recettes du lot

Voir `plan-recette.md` : cas 1 à 5, 6b, 6c, 7 à 10, 12 à 17, 16b, 21 à 31, 33 à 37, 39 à 44, et 6, 15, 26 à 30, 38 pour la part lot 1.

## 9. Limites

- Aucun nom de colonne n'est figé avant validation.
- Couverture du libellé normalisé mesurée sur deux périodes seulement.
- Noms de rôles du serveur à vérifier contre la base.
- Rien n'a été joué sur Test.
