# Dictionnaire de données NEXUS — v1 (brouillon)

Application de l'article 3 de la Constitution NEXUS : "Aucune donnée ne peut exister sans une définition officielle, une formule de calcul, une source identifiée et une fréquence de mise à jour."

**Périmètre de ce premier brouillon** : les données que j'ai directement manipulées lors des sessions de travail récentes (Cockpit, Rayon, Produits, Verify, Import, Debug). Il ne couvre pas encore Planning, Missions, ni Mon Évolution en détail — à compléter dans une v2. Chaque entrée distingue une **donnée brute** (importée ou saisie, jamais recalculée par NEXUS) d'une **donnée dérivée** (calculée par NEXUS à partir de données brutes).

---

## 1. Ventes et marge — table `products`

Une ligne par article, par période d'import, par site.

**ca** (chiffre d'affaires)
- Définition : chiffre d'affaires TTC ou HT généré par un article sur une période d'import donnée (selon ce que l'export fournisseur/caisse indique — non uniformisé à ce jour entre imports).
- Formule : donnée brute, importée telle quelle depuis le fichier de ventes.
- Source : export ventes déposé dans NEXUS-Import-v1.html (origine Decenium ou système de caisse du site).
- Fréquence : à chaque import manuel d'une nouvelle période (pas d'automatisme aujourd'hui).

**marge**
- Définition : marge brute générée par un article sur la période.
- Formule : donnée brute, importée telle quelle (peut être `ca - (prix_achat × quantité)` selon le calcul déjà fait côté export, ou une colonne dédiée du fichier — dépend du format d'import détecté).
- Source : export ventes.
- Fréquence : à chaque import.

**prix_vente / prix_achat**
- Définition : prix de vente HT et prix d'achat moyen d'un article sur la période.
- Formule : donnée brute, importée.
- Source : export ventes (colonne "Prix de vente HT" détectée automatiquement par Import — voir l'incident du 23/07/2026 où cette colonne n'avait pas été détectée pour une période, provoquant un CA=0 pour toutes les catégories).
- Fréquence : à chaque import.

**quantite**
- Définition : nombre d'unités vendues d'un article sur la période.
- Formule : donnée brute, importée.
- Source : export ventes.
- Fréquence : à chaque import.

**periode_debut / periode_fin**
- Définition : bornes de la période couverte par un import (ex. un trimestre, un mois).
- Formule : donnée brute, saisie par le manager lors de l'import.
- Source : saisie manuelle dans NEXUS-Import-v1.html.
- Fréquence : à chaque import.

### Dérivées — évolution / tendance (Rayon, Cockpit)

**Paire de périodes comparables**
- Définition : les deux périodes les plus récentes dont la durée est proche (écart ≤ 20 %) et qui ne se chevauchent pas — seule base légitime pour calculer une évolution.
- Formule : voir `paireValide()` dans NEXUS-Rayon-v1.html et NEXUS-Cockpit-v2.html. Absente si aucune paire ne remplit ces deux conditions.
- Source : dérivée de `products.periode_debut/periode_fin`.
- Fréquence : recalculée à chaque chargement de page.
- **Statut article 11** : ce calcul n'existe aujourd'hui que dans Rayon et Cockpit. Produits calcule une évolution T1→T2 plus simple (deux périodes les plus récentes, sans cette vérification) — à harmoniser.

**Évolution (%)**
- Définition : variation du CA d'un article ou d'un rayon entre les deux périodes de la paire comparable ci-dessus.
- Formule : `(ca_periode_actuelle - ca_periode_precedente) / ca_periode_precedente`. Retourne `null` explicitement si aucune paire comparable n'existe, ou si le CA de la période précédente est nul (voir `raison_indisponible` dans Rayon : `aucune_paire` vs `baseline_nulle`).
- Source : dérivée de `products.ca`.
- Fréquence : recalculée à chaque chargement de page.

---

## 2. Stock — table `stock_releves`

**quantite_theorique / quantite_reelle**
- Définition : stock théorique (calculé) et stock compté physiquement pour un article, à un instant donné.
- Formule : donnée brute, importée via l'écran "Stock instantané" de NEXUS-Import-v1.html.
- Source : relevé manuel effectué en boutique, saisi ou importé.
- Fréquence : irrégulière — au rythme des inventaires effectués, pas automatique.

### Dérivées (NEXUS-Produits-v1.html)

**Rotation estimée (jours de stock)**
- Définition : nombre de jours de stock restant au rythme de vente constaté sur la dernière période importée.
- Formule : `stockQte / venteJour`, où `venteJour = quantite_vendue_derniere_periode / nombre_de_jours_de_cette_periode`.
- Source : dérivée de `stock_releves` (photo à un instant T) et `products.quantite` (rythme de vente sur une période).
- Fréquence : recalculée à chaque consultation de la fiche produit.
- **Limite explicitement affichée** : ce n'est pas une vraie moyenne de rotation (qui demanderait deux relevés de stock encadrant la période de ventes) — c'est une estimation, et NEXUS le dit à l'écran, y compris quand le relevé stock ne recouvre pas la période de ventes.

**Niveau de rotation / niveau de stock (vocabulaire NEXUS)**
- Définition : classification qualitative (très rapide → très lente ; risque de rupture → surstock) dérivée du nombre de jours de stock ci-dessus.
- Formule : seuils documentés dans `chargerStockGap()` de NEXUS-Produits-v1.html (ex. < 3 j = risque de rupture, > 45 j = surstock).
- Source : dérivée de la rotation estimée.
- Fréquence : recalculée à chaque consultation.

---

## 3. Emplacement produit — table `product_locations`

**emplacement**
- Définition : rayon physique où se trouve un article en boutique.
- Formule : donnée brute. Deux origines distinctes, tracées par la colonne `source` :
  - `manuel` : un manager a cliqué/confirmé un emplacement — donnée vérifiée.
  - `auto_categorie` : suggestion déduite de la catégorie de vente de l'article — jamais présentée comme une confirmation humaine.
- Source : saisie manager (NEXUS-Produits-v1.html) ou seed automatique (`seed-product-locations-auto-v1.sql`).
- Fréquence : mise à jour au premier clic d'un manager (bascule alors en `manuel`, de façon définitive).

---

## 4. Photo produit — table `product_photos`

**photo_url**
- Définition : photo de référence d'un article, confirmée par un manager.
- Formule : donnée brute — jamais associée automatiquement sans confirmation humaine, même quand la recherche par code-barres ne trouve qu'un seul résultat.
- Source : Open Food Facts (via l'edge function `clever-endpoint`), confirmée par un manager.
- Fréquence : à la demande, quand un manager consulte une fiche produit sans photo confirmée.

---

## 5. Caisse — table `audits_caisse`

**ecart_piste / ecart_boutique**
- Définition : écart entre le montant compté en caisse et le montant attendu (rapproché de Decenium), pour la piste et pour la boutique.
- Formule : différence déjà calculée à la saisie dans NEXUS-Verify-v1.html — voir `classifierEcart()` pour les seuils de gravité (conforme ≤ 2 €, à surveiller ≤ 5 €, anomalie ≤ 20 €, critique au-delà).
- Source : saisie manager/gérant à la clôture de chaque quart.
- Fréquence : à chaque quart (2 fois par jour typiquement).

**date / quart**
- Définition : jour et quart (1 ou 2) auquel se rapporte l'audit.
- Formule : donnée brute, saisie.
- Source : saisie manager/gérant.
- Fréquence : à chaque audit.

---

## 6. Mémoire des décisions — table `journal_decisions`

**candidate_id / rule_id / recommandation**
- Définition : identifiant et contenu de la recommandation validée par un manager (ex. "Renforcez le facing de X", règles R2/R3/R4).
- Formule : donnée brute, générée par le moteur de règles de NEXUS-Cockpit-v2.html au moment de la validation.
- Source : action manager (bouton "Valider cette recommandation").
- Fréquence : à chaque validation. Table en écriture seule depuis le Cockpit — aucune correction ni suppression possible par un manager (voir migration `migration-journal-decisions-memoire-v1.sql`), conformément à l'article 10 (mémoire, pas un réglage qu'on efface).

**ca_reference / periode_reference_debut / periode_reference_fin**
- Définition : le chiffre d'affaires de l'article et la période sur laquelle la recommandation était fondée, au moment même de la validation.
- Formule : capturé tel quel depuis la donnée qui a servi à générer la recommandation — jamais recalculé après coup (pour ne jamais fabriquer une preuve a posteriori).
- Source : `products.ca` au moment de la validation.
- Fréquence : figé à la validation, ne change plus jamais.

### Dérivée — Bouclage des décisions

**Résultat d'une décision**
- Définition : évolution réelle du CA d'un article entre le moment de la décision et une période ultérieure comparable.
- Formule : `(ca_periode_ulterieure - ca_reference) / ca_reference`, calculée uniquement si une période ultérieure de durée comparable (± 20 %) existe et si l'article y apparaît encore. Sinon : aucun résultat affiché, jamais de résultat inventé.
- Source : dérivée de `journal_decisions.ca_reference` et `products.ca`.
- Fréquence : recalculée à chaque chargement du Cockpit.

---

## 7. Indice NEXUS (Cockpit)

**Marge réelle / Évolution réelle**
- Définition : marge brute et évolution du chiffre d'affaires, à l'échelle du magasin entier (pas d'un seul article).
- Formule : `marge_totale_periode_affichee / ca_total_periode_affichee` pour la marge ; évolution calculée sur la paire de périodes comparables (voir section 1) pour l'évolution.
- Source : dérivée de `products.ca` et `products.marge`.
- Fréquence : recalculée à chaque chargement du Cockpit.

**Score Indice NEXUS (0-100)**
- Définition : indicateur unique visant à donner en un coup d'œil "où en est la station aujourd'hui".
- Formule : `50 + (marge_reelle - 0.25) × 100 + evolution_reelle × 50` (si l'évolution est disponible), plafonné entre 0 et 100. Pondération documentée dans le code (`calculerIndiceNexus()`), explicitement qualifiée de provisoire, non recalibrée statistiquement.
- Source : dérivée des deux facteurs ci-dessus, uniquement.
- Fréquence : recalculé à chaque chargement du Cockpit.
- **Statut article 3/5** : c'est la donnée la plus proche de la limite tolérée par la Constitution — elle combine deux facteurs réels avec une formule simple et documentée, mais reste un choix de pondération, pas une mesure. Elle est présentée comme telle dans le détail dépliable, jamais comme un fait acquis. Voir aussi l'amendement de l'article 9 : le Capital NEXUS ne doit pas suivre le même chemin avec plus de facteurs incommensurables.

---

## Ce qu'il reste à documenter (v2)

Les tables et calculs de Planning (génération de shifts, règles d'effectif, contraintes employés), de Missions (points, complétions), de Mon Évolution, et les règles Qualité/Caisse du Centre d'Intelligence n'ont pas encore d'entrée dans ce dictionnaire — à ajouter progressivement, dans le même format, chaque fois qu'un de ces écrans est retouché.
