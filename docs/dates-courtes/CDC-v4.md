# Cahier des charges v4 : Dates courtes

Statut : brouillon de documentation. Rien sur Test ni en Production.
La v4 remplace la v3 là où elles divergent (arbitrages du pilote du 21/11, complément de tournées individuelles). La v3 est conservée telle quelle dans `CDC-v3.md` pour l'historique. La v4 se lit sans la v3.

## 1. Objet

Permettre à une station de relever les produits à date limite en circulant librement dans le magasin, et de savoir à tout moment, produit par produit et date par date, combien d'unités ont été relevées, par qui, dans quelle tournée et quand. Le module n'est pas un inventaire. Il alimente un suivi par le manager : alertes à moins de 60 jours, signalements, retraits physiques, certification des tournées.

Vocabulaire imposé : « quantité relevée », jamais « stock ». Toute quantité affichée porte sa date de relevé ou son âge.

## 2. Principes (changements de la v4 en gras)

1. Pas un inventaire. Circulation libre : on scanne ou on cherche, on saisit la date limite et la quantité, on enregistre, on continue.
2. Pas de zones.
3. Identification d'un produit : scan caméra iPhone Safari, recherche par nom ou EAN, saisie manuelle de l'EAN, photo facultative, EAN inconnu en entrée provisoire marquée (aucune référence créée), produit sans EAN par libellé normalisé, geste manager « même produit que… ». Inchangé depuis la v3.
4. Une seule « Date limite », sans type.
5. Clé de consolidation : station + EAN normalisé (sans EAN : libellé normalisé) + date limite exacte.
6. **Tournées individuelles.**
   - Chaque employé autorisé crée et mène sa propre tournée. Plusieurs tournées peuvent être ouvertes en même temps dans une station. Il n'y a ni tournée hebdomadaire unique, ni tournée automatique du lundi, ni ouverture réservée au manager.
   - Nom facultatif (par exemple « Rayon frais »). Le nom ne limite pas les produits relevés.
   - États : `EN_COURS`, `TERMINEE_A_CERTIFIER`, `CERTIFIEE`, avec une demande possible `CORRECTION_DEMANDEE`.
   - « Terminer ma tournée » enregistre l'auteur, l'heure et une version identifiable des relevés consolidés (empreinte et identifiant de la dernière opération). Le bouton est bloqué tant que le téléphone a des saisies en attente (contrôle côté appareil).
   - Une saisie reçue après la clôture mais faite avant elle est rattachée à sa tournée et marquée « reçue après clôture ». Une tournée déjà certifiée repasse alors à certifier.
7. **Quantités.**
   - Dans une tournée, un même EAN (ou libellé normalisé) et une même date s'additionnent, corrections comprises : 6 + 4 − 2 = 8. Plancher à zéro, par tournée.
   - Entre tournées, jamais d'addition automatique.
   - Une tournée qui relève un article l'a relevé en entier : pas de relevé partiel d'un article.
   - La tournée qui porte le dernier relevé effectif d'un article, à l'heure du geste, l'emporte, que les tournées soient simultanées ou non. Ses quantités par date sont les quantités courantes de l'article. Les autres passent en historique.
   - Pas d'écran ni de table de résolution de conflit : seulement la mention « relevé aussi dans la tournée X (M1, 10:15), en historique ».
   - Exemple : A relève 6 à 10:00 puis 4 à 10:30 (10), B relève 5 à 10:15. A porte le dernier relevé : 10 est courant, B passe en historique.
   - Une date non retrouvée dans la tournée gagnante n'a aucune quantité courante (elle reste en historique).
8. Corrections positives et négatives (« Ajouter des unités », « Corriger le relevé »), changement de date, annulation motivée. Une correction n'est ni une vente ni une démarque. Inchangé.
9. **Âge de la quantité.**
   - Calculé ligne par date limite, à partir du dernier relevé effectif, jamais à partir de la certification ou de la clôture.
   - Une correction, une annulation, une certification ou un rattachement administratif ne rajeunit jamais une ligne.
   - 7 jours et moins : courante, alertes normales.
   - 8 à 14 jours : « à vérifier ».
   - Plus de 14 jours : « À recontrôler ».
   - Une quantité de plus de 7 jours ne déclenche jamais de demande de retrait.
   - Date limite dépassée : toujours signalée. Relevé de plus de 7 jours : « DLC dépassée, présence à vérifier », sans demande de retrait. Relevé de 7 jours ou moins : « à retirer ».
10. **Certification.**
    - Le manager certifie chaque tournée (identifiant de tournée, manager, heure, version certifiée, observations, statut) ou demande une correction (relevés visés et motif).
    - Le renfort ne certifie jamais. Le manager peut certifier sa propre tournée, avec la mention « réalisateur et certificateur identiques ». La caissière ne certifie pas.
    - Une rectification après certification est tracée et appelle une nouvelle certification.
    - La certification ne déclenche aucune démarque et ne bloque ni la clôture ni l'usage des quantités, qui s'affichent « non certifiées » jusque-là.
11. Retraits en trois états : signalé, retiré physiquement, démarque comptabilisée. Geste « trouvé et retiré ». Inchangé depuis la v3 (le plancher à zéro se calcule par tournée).
12. **Droits** (détail dans `matrice-permissions.md`) : renfort : créer, terminer, répondre aux demandes de correction, voir ses tournées. Manager, gérant, créateur : tout, plus voir toutes les tournées de la station, demander une correction, certifier, exporter. Caissier : accès par station, ne certifie pas. Pompiste : aucun. Vacataire : en attente d'arbitrage du pilote ; aucun accès par défaut, comme le pompiste.
13. États de synchronisation : Enregistré, En attente, Refusé. Une opération renvoyée compte une fois.
14. Parcours libre, sans zones.

## 3. Règles conservées de la v2 et de la v3

- Chaque quantité porte sa date ou son âge.
- Changement de date (moins n sur l'ancienne, plus n sur la nouvelle, liés) et annulation (motif obligatoire).
- Plancher à zéro vérifié côté serveur, sous verrou.
- Hors ligne : contrôle local, recontrôle serveur, refus visible, clé d'idempotence fabriquée au moment du geste.
- `inventaire_mouvements` est mis de côté.
- Bandes d'alerte à moins de 60 jours : expiré, 0 à 7, 8 à 30, 31 à 60. Ordre : expiré, jours croissants, quantité décroissante.
- Jours calendaires, fuseau de la Martinique. EAN-13 et EAN-8 avec contrôle de la clé.
- Lecteur : détecteur natif sinon ZXing figé en version.
- `seuilPeremptionJours` retiré.

## 4. Découpage en lots

| Lot | Contenu |
|---|---|
| 1 | Données et droits : tournées individuelles et leurs états, certifications, demandes de correction, versions de clôture, calcul de la quantité courante et de l'âge, isolation par station |
| 2 | Page employé : relevé, tournées, réponse aux demandes de correction |
| 3 | Suivi manager dans Produits : tournées à certifier, relevés consolidés, historique, correction, certification |
| 4 | Exports : PDF par tournée, Excel (au moins deux feuilles), export global ; la bibliothèque sera décrite dans la fiche avant tout code |

Fiches : `fiche-lot-1.md` à `fiche-lot-3.md` (le lot 4 est fiché dans la branche de conception). Annexes : `matrice-permissions.md`, `modele-donnees.md`, `plan-recette.md`, `questions-metier.md`, `modifications-vs-v2.md`.

## 5. Emplacement

- Côté employé : une page de relevé dédiée, ouverte depuis l'accueil employé. Ni dans Inventaire, ni dans Produits. Accessible au renfort, au manager, au gérant, au créateur, et au caissier si l'accès de la station est ouvert. Refusée au pompiste. Classée écran opérationnel dans `nexus-auth.js`.
- Côté manager : suivi dans `NEXUS-Produits-v1.html` (section réservée au manager et au gérant, comme la page actuelle). Le manager garde un lien direct vers la page de relevé.
- Lot 2 : fiche de la page employé. Lot 3 : fiche de la section Produits.
- Le lot 1 ne crée ni ne modifie aucune page. Aucune règle d'accès ne change avant le lot 2.
- Icône `mod-dates-courtes` : issue d'une archive que l'assistant n'a pas reçue. Tuile neutre « icône à venir » en attendant (lot 2 seulement). L'assistant ne dessine aucune icône.

## 6. Contraintes transverses

- Écrans soumis à `docs/conception/NEXUS-REFERENTIEL-CONCEPTION.md` v1.0 : fiche de la section 7 remplie aux lots 2, 3 et 4.
- Dépôt public : pseudonymes (R1, R2, M1), produits fictifs, aucune vente réelle. Seule exception : l'EAN de recette 3168930171683.
- Aucun tiret dans les textes affichés à l'écran.

## 7. Qualification de la migration

La migration du lot 1 est soumise à la garde ORDRE-MIGRATION-CODE. Une qualification est planifiée dans `docs/deploiement/qualification-ordre-migration-code.json` pour qu'un passage futur en Production ne soit pas bloqué. Elle n'est pas déposée tant que la migration n'a pas été relue par Guardian, et rien n'est déployé.

## 8. Hors périmètre

Promotion, destruction, démarque automatique ; intégration comptable ; zones ; inventaire ; création automatique de référence ; écran ou table de résolution de conflit entre tournées.

## 9. Limites de ce document

- La v2 n'est pas dans le dépôt : ses règles sont reprises des messages d'arbitrage.
- Les noms de tables et de colonnes sont des propositions, vérifiées seulement sur un banc local jetable.
- Le rôle `vacataire` n'est pas arbitré : défaut sans accès, à confirmer par le pilote.
- Rien n'est mesuré sur Test ni en Production.
