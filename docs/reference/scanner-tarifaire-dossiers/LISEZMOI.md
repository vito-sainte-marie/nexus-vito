# Dossiers Scanner tarifaire : matériau d'étude (Guardian)

Branche de référence, **jamais fusionnée**. Elle rassemble, dans leur dernière version, les dossiers élaborés hors dépôt (Guardian et contre-audit) pour les lots T1, T2 et T3 du Scanner tarifaire. But : donner une vue d'ensemble avant de continuer #331 et #332.

Ce n'est pas du code à copier. Le code produit reste écrit par Claude Code dans #331 et #332. Les migrations et scripts ci-dessous sont les versions déjà exécutées sur Test ou rejouées en local, conservées comme preuve.

Les noms de personnes ont été masqués (« le pilote ») dans quelques preuves et dans un nom de dossier : les empreintes SHA-256 de ces fichiers ne correspondent donc plus aux listes `EMPREINTES-*.txt`. Fichiers concernés : COMPTE-RENDU-RECETTE-AUTHENTIFIEE-T2.md, quatre JSON de `04-T2-recette-authentifiee/t2/recette_http/preuves/`, `02_etape6_et_controle_final.json` de la recette fonctionnelle, et les deux documents 00.

## Ordre de lecture conseillé

| Ordre | Dossier | Contenu | État |
| --- | --- | --- | --- |
| 1 | `00-proposition-fonctionnelle-tarifaire.md` | Règles métier : sept principes, fiabilité, seuils, cinq statuts, huit alertes, workflow, registres, lots T1 à T5 | Référence fonctionnelle, 16/11 |
| 2 | `00-cahier-des-charges-ecrans-T3.md` | Sept écrans T3, droits par profil, codes d'erreur à traduire, règles transverses, critères de recette, arbitrage du 17/11 (neuf conditions) | rev 21, approuvé avec conditions |
| 3 | `01-T1-moteur/t1/` | Moteur T1 v2 en lecture seule, 47 tests, passage sur les 440 références de Sainte-Marie, divergences avec la matrice, comparaison v1/v2 | Accepté |
| 4 | `02-T2-registres/t2/` | Dix registres `tarif_*`, vues `v_tarif_*`, RLS dont `compte_actif_obligatoire`, adaptateur `contexteDepuisRegistres`, non-régression T1/T2, répétition locale | Appliqué sur Test |
| 5 | `03-T2-execution-test/t2/` | Procédure et preuves de l'exécution des quatre migrations T2 sur Test | Fait le 16/11 |
| 6 | `04-T2-recette-authentifiee/t2/recette_http/` | Recette d'accès authentifiés (16/16), incident de phase 1, bannissement | Approuvée |
| 7 | `05-T2-recette-fonctionnelle/t2/recette_fonctionnelle/` | Chargement des 130 lignes de Sainte-Marie, comparaison 440/440 avec T1 v2 | Approuvée |
| 8 | `06-T3-decision-journal/decision_journal/` | Fonction `tarif_enregistrer_decisions` (SECURITY INVOKER), déclencheur de lien, 94 preuves locales | Appliquée sur Test (version `20261117161325`) |
| 9 | `07-T3-recette-test/recette_test/` | Scripts 70 à 82, programme de recette, 45 cas, répétition locale, preuves Test (`preuves_test/`), compte rendu | 45/45, approuvée |

## Points à relier pour la vue d'ensemble

- **Chaîne de données.** Exports Decenium (ventes, stock) et registres Produits (`produits_nature_reference`, `produits_justifications_marge`, `produits_tva_confirmations`, `produits_appel`) alimentent le moteur ; T2 ajoute les registres tarifaires. Le contexte complet attendu par le moteur figure dans `02-T2-registres/t2/adaptateur/` et dans les tests T1.
- **Règles de la proposition qui doivent survivre dans l'écran** : opérations de caisse et Périmés/Casse hors ventes commerciales ; justification qui n'efface pas la perte ; trois niveaux de fiabilité jamais additionnés ; minimum et cible jamais additionnés ; pas de « Conforme » sans seuil validé ; aucun prix pour un régime réglementé ou contractuel.
- **Droits.** Le gérant décide ; le manager propose et déclare ; le créateur lit ; l'employé ne voit rien. La base refuse ce que l'écran ne propose pas.
- **Ce qui reste hors périmètre** : Production, Decenium, fusion, déploiement, changement de prix.
