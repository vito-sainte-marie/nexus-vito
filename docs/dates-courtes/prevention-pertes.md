# Prévention des pertes : complément au CDC v4

Statut : documentation et conception. Aucun code, aucune migration, aucun changement de droits. Rien sur Test ni en Production. Aucune lecture de Production n'a été faite pour ce dossier.

Demande du pilote du 21/11 (relayée par Guardian, #160, 7071446874). Complément autonome du CDC v4 : il n'en change aucune règle de relevé, d'ancienneté ou de certification.

## 1. Objet et profils

Une lecture « Prévention des pertes » dans Produits, Mes dates courtes, pour le manager, le gérant et le créateur. Le renfort garde son parcours de relevé simplifié. Caissier, pompiste et vacataire : aucun accès à cette lecture.

Entrées prévues dans Produits : Contrôler (créer ou poursuivre une tournée), Suivi des relevés, Prévention des pertes, Historique.

## 2. Placement par lot

| Étape | Contenu | Lot | Dépendance |
|---|---|---|---|
| 1 | Valeur à risque, pertes constatées | 5 | Lot 1 seulement (quantité courante, âge, prix d'achat HT de `products`). Pourrait précéder les exports du lot 4 si le pilote le souhaite ; l'ordre demandé est conservé. |
| 2 | Actions commerciales et résultats | 6 | Lot 5 (une action vise un produit et une date à risque) |
| 3 | Pertes évitées estimées | 7 | Lots 5 et 6, et un rapprochement fiable démontré (voir §6). Après les exports du lot 4. |

Fiches : `fiche-lot-5.md`, `fiche-lot-6.md`, `fiche-lot-7.md`.

## 3. Ce que le lot 1 enregistre déjà pour l'étape 1

| Besoin | Lot 1 | Verdict |
|---|---|---|
| Quantité courante par produit et date, avec âge | Oui : dernier relevé effectif, tournée qui fait foi | Utilisable sans reprise d'historique |
| Version certifiée | Oui : états de tournée, certifications, versions de clôture | Utilisable |
| Retrait physique distinct | Oui : retrait distinct du relevé | Utilisable |
| Démarque comptabilisée avec quantité, date, auteur | Oui : `quantite`, `heure_geste`, `recu_le`, `saisi_par`, motif facultatif, retrait et tournée liés, annulation tracée (confirmé par Guardian, #160 7080550017) | Utilisable |
| Prix d'achat au moment du retrait | Non figé au lot 1, aucune valeur en euros | Figé au lot 5 (arbitrage du pilote du 22/11) : voir §5 B |

Arbitrage du pilote (22/11) : le prix d'achat est figé à la comptabilisation, dans une table du lot 5 en ajout seul, sans toucher aux tables du lot 1.

## 4. Inventaire des données Produits (dépôt et Test seulement)

| Source | Provenance | Mise à jour | HT ou TTC | Granularité |
|---|---|---|---|---|
| `products` | Import Decenium par période (`periode_debut`, `periode_fin`) : `quantite`, `prix_achat`, `prix_vente`, `tva`, `ca`, `marge` | À chaque import manuel d'un fichier | HT : `prix_achat`, `prix_vente` et `ca` (contrôle du 22/11 en lecture seule, trois articles, deux taux de TVA, écart inférieur à 0,3 %, preuve élevée, dernière période seulement) | Une ligne par article et par période, jamais par jour ni par date limite |
| `inventaire_ventes_import` | Import des ventes Decenium par quart | À chaque import de quart | `prix_achat_ht` et `prix_vente_ht` : HT par construction | Par quart et par article, sans date limite |
| `normalized_products` | Couche issue du pipeline d'import | Vide en Production pour tous les sites (constat Guardian) | Sans objet | Sans objet : aucune clé ne peut s'y appuyer |

Conséquences : le prix d'achat HT vient de `products` (à confirmer HT) ou de `inventaire_ventes_import.prix_achat_ht`, avec la période de la source affichée. Aucune vente n'est rattachée à une date limite.

Contrôle HT fait le 22/11 par Guardian (lecture seule). Le lot 5 refait un contrôle de cohérence à chaque nouvel import ; s'il échoue, la carte affiche « Nature fiscale non déterminée » et aucun montant.

## 5. Les quatre montants

Jamais additionnés, jamais convertis l'un en l'autre. Une carte par montant. Prix d'achat HT par défaut. Le chiffre d'affaires est présenté à part.

### A. Valeur à risque

- Calcul : somme, sur les lignes (produit, date limite) dont la quantité courante a été relevée il y a 7 jours ou moins, de la quantité courante par le prix d'achat unitaire HT.
- Montré à part, marqué « indicative » et jamais ajouté au montant principal : quantités relevées il y a 8 à 14 jours.
- Exclues, gardées en historique « À recontrôler » : plus de 14 jours.
- Une ligne sans prix d'achat n'entre pas dans le montant : elle est comptée dans « n produits sans prix d'achat » sur la carte. Si aucune ligne n'a de prix : « Calcul indisponible ».
- Affiché avec la date du dernier relevé de chaque ligne la plus ancienne retenue, la fraîcheur, et la mention « non certifiées » sur la carte : les quantités non certifiées sont incluses (arbitrage du 22/11).

### B. Pertes constatées

- Calcul : somme des quantités des démarques comptabilisées sur la période, par le prix d'achat unitaire HT applicable à la date de la pose.
- Un retrait physique n'est pas une perte : il reste dans la liste « à comptabiliser ».
- Prix d'achat HT unitaire figé à la comptabilisation, dans une table du lot 5 en ajout seul : prix, source (`products` et sa période, ou `inventaire_ventes_import`) et heure. La carte affiche la période et l'origine du prix utilisé. Aucune modification des tables du lot 1.
- Sans prix trouvé : quantité affichée, montant non, « Prix d'achat absent ». Une ligne sans prix ne compte jamais pour zéro.
- Démarques posées avant le lot 5 : prix de la période de la pose, marqué « prix reconstitué ». Description seulement, aucun code.

### C. Valeur d'achat des unités écoulées avant échéance

- Seulement si un rapprochement fiable entre relevés et ventes est démontré. Les ventes par EAN ne portent pas la date limite des unités vendues : aucune correspondance n'est inventée.
- Par défaut : « Calcul indisponible ».

### D. Pertes évitées estimées

- Hypothèse de référence écrite et affichée avec la méthode et ses limites ; bouton (i) sur le sens de « pertes évitées estimées ».
- Une vente n'est jamais assimilée d'office à une perte évitée.
- Par défaut : « Calcul indisponible ». Quand une estimation existe, libellé « Estimation », jamais « Constaté ».

### Libellés d'indisponibilité

| Situation | Libellé |
|---|---|
| Aucun prix d'achat | Calcul indisponible |
| Rapprochement non démontré (C, D) | Calcul indisponible |
| Estimation sous hypothèse | Estimation |
| Donnée de plus de 14 jours | À recontrôler |
| Prix d'achat partiel | n produits sans prix d'achat |

## 6. Rapprochement relevés et ventes (étape 3)

Prérequis non remplis aujourd'hui : ventes par période et par EAN seulement ; `normalized_products` vide ; pas de date limite à la vente. L'étape 3 reste donc conditionnée à une preuve sur données réelles de test. Si la preuve n'est pas faite, C et D restent « Calcul indisponible » et rien d'autre n'est livré.

## 7. Recommandations (moteur de règles explicites)

Chaque recommandation affiche la règle qui la déclenche. Le manager décide ; aucune remise appliquée, aucun prix modifié.

| Recommandation | Règle déclenchante |
|---|---|
| Surveiller | Date limite à 31 à 60 jours, quantité relevée il y a 7 jours ou moins |
| Vérifier la rotation | Date limite à 8 à 30 jours et quantité courante supérieure à la quantité vendue sur la fenêtre de ventes (fenêtre de 30 jours, arbitrage du 22/11, moyenne seulement) |
| Envisager une remise | Date limite à 0 à 7 jours, quantité courante relevée il y a 7 jours ou moins |
| Mettre en évidence | Idem, produit à rotation lente selon la fenêtre retenue |
| Organiser un nouveau contrôle | Dernier relevé de 8 jours ou plus |
| Retirer si la vente n'est plus autorisée | Date dépassée et dernier relevé de 7 jours ou moins |

Une quantité relevée il y a plus de 7 jours ne déclenche jamais « retirer ». Le Conseiller présente ces règles avec l'avatar officiel, le lexique `nexus-vocabulaire.js` et la Constitution article 12 : aucune tendance, urgence ou causalité inventée.

## 8. Journal des actions (lot 6)

Produit et date limite, date et auteur de la décision, nature, remise éventuelle, quantité concernée au départ, résultats observés, quantités retirées, pertes comptabilisées, commentaire. Clôture avec un résultat mesuré ou « Résultat non mesurable ». Append-only. Aucune remise n'est appliquée par NEXUS.

## 9. Droits et multisite

État lu dans le dépôt : le rattachement d'un employé à une station passe par `current_employee_site_id()`, une seule station ; les politiques de `inventaire_ventes_import` limitent la lecture à manager et gérant de cette station ; le créateur n'a de portée que sur les stations où `acces_createur_autorise` est vrai (garde posée par `20260906100000_garde_createur_sites.sql`). Aucune table de stations autorisées multiples n'a été lue.

- Manager : sa station.
- Gérant : sa station. Aucune comparaison multisite aux lots 5 et 6 (arbitrage du 22/11). L'ouvrir exigerait une fonction de lecture sur une liste de stations autorisées. **Arbitrage de sécurité** avant toute conception de ce droit.
- Créateur : dans les limites de ses droits effectifs ; jamais d'accès illimité supposé.
- Aucun contournement de `site_id` ni des RLS ; aucun privilège nouveau sans arbitrage de sécurité.

## 10. Exports (lot 5 pour le premier, lot 6 pour le suivi d'actions)

PDF « Prévention des pertes » ; Excel produits à risque et actions ; synthèse par période ; lecture par station ; comparaison multisite pour les profils autorisés (sous arbitrage). Constaté et estimé toujours séparés. Bibliothèque décrite dans la fiche du lot 4 avant tout code.

## 11. Recette (dix cas du pilote)

| # | Cas | Critère mesurable |
|---|---|---|
| P1 | Valeur à risque avec coût connu | 5 relevés de 7 jours ou moins à prix connu : somme exacte à l'euro près, hors 8 à 14 jours |
| P2 | Aucun prix d'achat | Carte « Calcul indisponible » ; n produits sans prix d'achat affiché ; aucun zéro affiché |
| P3 | Anciennes quantités | Ligne de plus de 7 jours : aucune demande de retrait ; plus de 14 jours : absente du montant |
| P4 | Tournées simultanées | Deux tournées avec la même date : la quantité n'est comptée qu'une fois (6+4−2=8 dans une seule tournée) |
| P5 | Retrait et perte | 3 retirés physiquement : 0 dans B tant que la démarque n'est pas comptabilisée |
| P6 | Ventes par EAN | Aucune perte évitée certaine : C et D « Calcul indisponible » |
| P7 | Traçabilité | Chaque action du journal porte auteur, date, nature, quantité |
| P8 | Accès | Manager sa station ; renfort, caissier, pompiste, vacataire refusés ; autre station refusée |
| P9 | Exports | PDF et Excel : constaté et estimé dans des blocs séparés, mêmes chiffres qu'à l'écran |
| P10 | Cohérence | Les chiffres des indicateurs égalent ceux des relevés certifiés d'une tournée de test |

## 12. Questions au pilote

Ajoutées à `questions-metier.md` avec options et recommandation. Résolue : les quantités du montant principal (7 jours, 8 à 14 jours à part, plus de 14 jours exclus), arbitrage du 21/11.
