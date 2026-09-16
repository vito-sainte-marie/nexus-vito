---
protocol: nexus-handoff/2
kind: decision
lot_id: CARBURANTS-PERFORMANCE-CORRECTION-COMMANDE-20260906
seq: 4
author: ChatGPT
branch: config-par-environnement
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-3.md
---

# Décision — calendrier/CTA validés, optimisation camion à finaliser avant clôture

Le retour `request-3.md` est accepté pour ce qu'il prouve réellement : la correction calendrier/CTA est validée au niveau moteur/configuration Test, les tests ciblés sont verts, aucune heure de livraison fixe n'est inventée, le GNR non inclus ne bloque pas GO/SP95 et la non-double-intégration d'une livraison reste couverte.

Le lot n'est cependant pas clos.

## Motif de maintien ouvert

Deux éléments empêchent une clôture complète de Carburants Performance :

1. la preuve UI/navigateur runtime annoncée dans `request-3.md` n'a pas été apportée ;
2. le besoin canonique `CARB-004` du Backlog reste à terminer : une recommandation inférieure à la capacité camion maximale ne doit pas être conservée mécaniquement lorsqu'un complément est réellement sûr et absorbable.

La protection existante contre le surstock doit rester une garde métier, pas devenir un plafond artificiel à 35 000 L.

## Règle métier à implémenter

`maximum_camion_litres` est une **cible d'optimisation**, jamais un volume obligatoire.

Après calcul du besoin principal :

- si la commande proposée laisse une capacité camion résiduelle, le moteur tente un complément marginal sur les carburants éligibles ;
- le complément n'est autorisé que s'il respecte les gardes NEXUS existantes : capacité physique/réception sûre des cuves au moment de la livraison, stock prévisionnel pertinent, livraison déjà enregistrée, contraintes de compartiments/incréments configurées, stock de sécurité et mécanismes anti-surstock ;
- le complément doit en plus être **absorbable par la rotation prévisionnelle** selon les données et horizons métier déjà disponibles dans NEXUS ;
- si les données nécessaires à cette absorption sont insuffisantes, le moteur n'invente pas de ventes futures : il reste prudent et expose l'arbitrage ;
- aucune règle Sainte-Marie ne doit être codée en dur : la logique reste déterministe, configurable et multi-site.

### Cas de référence obligatoire

Si le moteur obtient `21 000 L SP + 14 000 L GO = 35 000 L`, et que `1 000 L GO` supplémentaire :

- rentre physiquement en sécurité à la livraison ;
- respecte les bornes existantes ;
- est absorbable par la rotation prévisionnelle disponible ;

alors la recommandation attendue devient `21 000 L SP + 15 000 L GO = 36 000 L`.

À l'inverse :

- complément physiquement impossible → rester à 35 000 L avec motif exact ;
- complément physiquement possible mais non absorbable → rester à 35 000 L avec motif exact ;
- données de rotation insuffisantes → ne rien inventer, rester prudent et expliciter l'incertitude.

## Travail d'exécution exigé

Avant modification, identifier précisément la fonction/règle qui limite aujourd'hui le complément de 1 000 L dans le cas de référence.

Puis modifier le minimum de code nécessaire dans le moteur propriétaire de la vérité métier, sans recréer de calcul parallèle dans l'UI.

Tests minimums à produire :

1. `21k SP + 14k GO`, +1k sûr et absorbable → `21k + 15k` ;
2. +1k physiquement impossible → 35k ;
3. +1k physiquement possible mais non absorbable → 35k ;
4. rotation insuffisamment prouvée → comportement prudent explicite ;
5. 36k réellement atteignable + créneau commandable + aucun arbitrage → CTA cohérent ;
6. aucune régression calendrier/cutoff/fériés ;
7. aucune régression GNR ;
8. aucune double intégration de livraison ;
9. validation UI/navigateur Test de la carte « Prochaine commande » après correction.

## Guardians

- **Architecture** : le moteur de commande reste propriétaire unique de la recommandation ; aucun calcul métier parallèle dans l'UI.
- **Security & Isolation** : aucune écriture Production ; aucune dépendance à un site implicite ; aucune exposition de secret.
- **Business Rules** : 36 000 L est recherché seulement lorsqu'il est sûr et absorbable ; jamais forcé.
- **QA/Regression** : tout nouvel échec imputable au lot bloque la clôture.
- **Bible/Philosophie** : ne jamais inventer une consommation future pour remplir le camion ; une limite réelle doit être expliquée, pas masquée.

## Interdictions

- Aucun changement `main`.
- Aucun changement `production`.
- Aucun Supabase Production.
- Aucune promotion NEXUS Production.
- Aucun secret/service_role.
- Aucun refactor large hors périmètre.

Verdict : **CORRECTION CALENDRIER/CTA VALIDÉE EN TEST — OPTIMISATION CAMION 36 000 L À FINALISER AVANT CLÔTURE DU LOT.**
