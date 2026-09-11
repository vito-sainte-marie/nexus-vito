# Audit 1 — Carburants Performance / commande

Date : 06/09/2026
Lot : `CARBURANTS-PERFORMANCE-AUDIT-COMMANDE-20260906`
Rail : `config-par-environnement` / Supabase Test uniquement

## Verdict exécutif

Le module Carburants Performance ne présente pas, dans le périmètre audité, de signe de rupture générale du moteur. L'anomalie terrain observée est composée de deux sujets différents :

1. **35 000 L au lieu de 36 000 L : pas d'erreur arithmétique démontrée.** Le moteur vise 36 000 L mais s'arrête avant si les garde-fous de capacité physique / plafond de surstock / incrément de 1 000 L empêchent d'ajouter un compartiment supplémentaire. La capture est cohérente avec ce comportement. Le défaut certain est l'absence d'explication métier visible et le CTA trop affirmatif.
2. **Samedi → livraison lundi : lacune métier confirmée.** Le moteur sait chercher le prochain *jour de livraison autorisé*, mais ne modélise pas séparément les *jours où une commande peut être passée* ni le délai fournisseur en jours ouvrés. Il peut donc présenter lundi comme créneau de livraison alors qu'il n'est plus commandable le samedi.

## Faits confirmés

### A. Paramétrage camion / livraison en Test

`station_config.carburant_commande_config` pour `nexus-station-test` :
- `minimum_camion_litres = 3000`
- `maximum_camion_litres = 36000`
- `jours_livraison_iso = [1,2,3,4,5]`
- `cutoff_heure = 11:00`
- `compartiments_disponibles_litres = [2000,5000,7000]`

Conclusion : **3 000 L est le minimum de commande configuré ; 36 000 L est le maximum / objectif de camion plein, pas un minimum obligatoire.**

### B. Optimisation de la quantité

Le moteur `nexus-carburant-commande-moteur.js` :
- calcule d'abord les volumes nécessaires par carburant ;
- peut compléter vers un camion plein lorsque `viserCamionComplet` est actif ;
- fixe la cible à `min(maximum camion, capacité totale encore disponible)` ;
- ne dépasse jamais les plafonds de chaque carburant ;
- travaille par incréments complets de 1 000 L ;
- applique un plafond anti-surstock / autonomie maximale en plus de la capacité physique.

La recommandation 22 000 L SP95 + 13 000 L GO = 35 000 L est donc **compatible avec le contrat actuel** : 36 000 L est visé, jamais forcé au prix d'un dépassement de sécurité.

### C. Cohérence avec la capture terrain

La capture du 06/09 montre notamment :
- SP95 recommandé : 22 000 L ; capacité disponible affichée ≈ 22 171 L ; il reste donc moins de 1 000 L ajoutable avec le pas camion.
- GO recommandé : 13 000 L ; capacité physique affichée supérieure, mais le moteur peut être borné par son plafond d'autonomie/surstock.

Cela explique fortement pourquoi le total peut s'arrêter à 35 000 L. **La reconstruction exacte du dernier litre à partir du dataset de la capture n'a pas été reproduite en Test : on ne transforme donc pas cette explication forte en preuve numérique exhaustive.**

### D. Calendrier de livraison

Le moteur `prochainJourLivraisonPossible(...)` part de la date de décision et cherche le prochain jour appartenant à `jours_livraison_iso`, jamais le jour même. Il ne porte pas de notion séparée de :
- jours d'ouverture de prise de commande fournisseur ;
- commande impossible le week-end ;
- délai minimum de commande en jours ouvrés ;
- date limite réelle permettant encore d'obtenir le créneau de livraison.

Avec `[lundi..vendredi]`, un samedi conduit naturellement à **lundi comme prochain jour de livraison autorisé**, même si ce créneau n'est plus commandable. C'est la cause racine confirmée de l'anomalie calendrier.

## Ce qui fonctionne correctement et doit être préservé

L'audit du moteur et de la couche données confirme plusieurs protections structurantes :
- site/station explicite dans la chaîne de données ;
- stock/jaugeage fiable recherché avant calcul ;
- absence de valeur inventée lorsqu'un carburant n'est pas évaluable ;
- GNR sans ventes récentes peut rester « non calculable » sans bloquer une décision GO/SP95 calculable ;
- ventes intervenues depuis le jaugeage distinguées de la projection future, pour éviter le double comptage ;
- livraison documentaire / réception et fiabilité restent distinguées ;
- Verify reste un signal informatif et ne devient pas artificiellement la preuve de fiabilité carburant ;
- réserve de sécurité intégrée au scénario avant livraison ;
- capacité physique et plafond anti-surstock prioritaires sur l'objectif de camion plein ;
- volumes recommandés arrondis à des m³ complets (1 000 L), jamais au litre près ;
- quand les données ne permettent pas une décision fiable, le moteur sait suspendre/qualifier au lieu de fabriquer une recommandation.

Ces éléments correspondent au retour terrain selon lequel Carburants Performance est stable depuis plusieurs jours. Ils doivent être considérés comme **zone à préserver**, pas comme terrain de refactorisation opportuniste.

## Écarts produit / UX confirmés

### E1 — Créneau « livrable » présenté comme « commandable »

Le vocabulaire actuel confond deux notions :
- prochain jour où le fournisseur livre ;
- prochain créneau qu'il est encore possible de commander maintenant.

Correction requise : le moteur doit produire une **date de livraison commandable**, à partir de règles de prise de commande explicites.

### E2 — 35 000 L sans explication

Une recommandation inférieure à 36 000 L peut être parfaitement saine, mais l'écran ne dit pas pourquoi. Le manager peut donc croire à une anomalie.

Correction requise : exposer une raison structurée de non-complétion, par exemple :
- capacité SP95 insuffisante pour +1 000 L ;
- plafond anti-surstock atteint sur GO ;
- autre garde-fou nommé par le moteur.

Ne jamais afficher une explication calculée une deuxième fois côté HTML : le moteur doit porter le motif.

### E3 — CTA trop affirmatif

Lorsque :
- le camion n'est pas complété à la cible de 36 000 L, ou
- le créneau affiché n'est pas encore prouvé commandable, ou
- une décision manager reste nécessaire,

`Préparer ma commande` est trop direct.

Règle UX proposée conformément au retour terrain :
- **recommandation pleinement faisable et directement commandable** → `Préparer ma commande` ;
- **quantité à arbitrer / camion non plein / créneau non directement commandable** → `Simuler ma commande` ;
- supprimer le second CTA de simulation lorsqu'il duplique l'action principale.

## Point non prouvé / à ne pas inventer

L'audit ne dispose pas d'un contrat fournisseur généralisable disant que toutes les stations NEXUS interdisent les commandes le samedi. La règle Sainte-Marie constatée ne doit donc **pas** devenir un `if (samedi)` codé en dur.

Le modèle SaaS recommandé est configurable, par exemple :
- `jours_commande_iso`
- `delai_commande_jours_ouvres` ou règle équivalente
- `cutoff_heure`
- `jours_livraison_iso`

Pour Sainte-Marie, le paramétrage devra rendre impossible samedi → lundi et faire ressortir le prochain créneau réellement commandable.

## Risques de régression

Priorité haute : ne pas modifier les calculs de stock, vente depuis jaugeage, réserve, point zéro, réception ou fiabilité pour corriger un problème de calendrier/CTA.

Risques spécifiques :
- forcer 36 000 L casserait la sécurité de capacité/surstock ;
- coder « samedi interdit » en dur casserait le multi-site ;
- recalculer le motif de 35 000 L dans l'UI créerait un second moteur ;
- remplacer partout le CTA par simulation dégraderait les cas où la commande est réellement prête ;
- modifier la définition de `jours_livraison_iso` au lieu d'ajouter la notion de commandabilité casserait les projections existantes.

## Matrice de recette exigée avant clôture corrective

1. Camion 36 000 L atteignable → recommandation 36 000 L, CTA préparation si créneau commandable.
2. 35 000 L maximum sûr à cause capacité SP95 → 35 000 L conservés, raison explicite, CTA simulation.
3. 35 000 L maximum sûr à cause plafond anti-surstock GO → même comportement avec motif GO.
4. Samedi, lundi jour de livraison mais non commandable → lundi jamais présenté comme commande directement préparée ; prochain créneau commandable calculé.
5. Vendredi avant cutoff avec lundi commandable → lundi accepté si le paramétrage fournisseur le permet.
6. Vendredi après cutoff → créneau suivant calculé.
7. Jour férié dans la chaîne → aucun créneau impossible.
8. GNR non évaluable, GO/SP95 fiables → recommandation GO/SP95 maintenue.
9. Donnée carburant non fiable incluse dans la commande → état à confirmer / calcul impossible conforme au contrat existant.
10. Livraison déjà enregistrée → aucune double intégration dans stock/projection.
11. Volume inférieur au minimum camion → règle actuelle de regroupement/minimum non régressée.
12. Capacité physique < besoin → aucun dépassement même pour atteindre 36 000 L.
13. Page mobile/desktop → un seul CTA de simulation dans le cas arbitré.
14. Garde site + suite de non-régression → vertes.

## Recommandation d'architecture

**Corriger le calendrier et l'explicabilité, pas l'algorithme de quantité tant qu'aucune preuve ne montre qu'il calcule faux.**

Le lot correctif doit rester minimal :
1. introduire la notion configurable de créneau encore commandable ;
2. exposer depuis le moteur le motif de non-complétion du camion ;
3. piloter le CTA à partir de ces états structurés ;
4. ajouter les tests de matrice ci-dessus ;
5. ne toucher à aucune autre logique Carburants Performance sans preuve de défaut.
