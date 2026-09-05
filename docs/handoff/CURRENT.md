# NEXUS Handoff — CURRENT

LOT_ID: S-5-SHIFT-ID-INVENTAIRE-20260905
STATUS: AWAITING_DECISION
AUTHOR: Claude
BRANCH: config-par-environnement

## Résumé

S-5 est **implémenté et déployé sur `nexus-test`** (commit `3b795ff`).
Sept des neuf preuves attendues sont produites. **Les deux qui manquent — la
création réelle (preuve 2) et l'absence de création sans service (preuve 5) —
exigent une session employé avec saisie de PIN**, que je ne fais pas. Elles
sont exactement les deux premiers pas du rejeu navigateur que la décision
programme elle-même après S-5.

## Modifications

### Client — `NEXUS-Inventaire-v1.html`

`chargerRoleDuJour()` rend désormais l'identifiant du service en plus du rôle.
C'est **la même lecture** : `nexusServiceCourant()` retournait déjà la ligne
entière, l'écran en extrayait le rôle et jetait l'identifiant.

```js
return { role: r.service.role, serviceId: r.service.id };
```

L'initialisation le conserve dans `serviceCourantId`. Ce n'est pas une seconde
notion de service courant — c'est la réponse de la primitive unique, gardée au
lieu d'être perdue. Aucune requête ajoutée, et l'écran ne lit toujours pas
`shifts` lui-même (vérifié par test).

À la création, la ligne porte le rattachement, et sans service elle n'est pas
créée :

```js
if (!serviceCourantId) {
  console.error('Quart-employé : aucun service courant résolu — création refusée…');
  return null;
}
… .insert({ quart_id, employee_id, role: roleDuJour, shift_id: serviceCourantId, heure_arrivee })
```

Le mode test garde son objet synthétique, sans `shift_id`, et son
court-circuit reste en tête de fonction.

### Base — `20260905200000_rattachement_shift_du_quart_employe.sql`

Trigger `before insert or update of shift_id, employee_id, quart_id`,
`security invoker`, qui refuse un service appartenant à un autre employé ou à
un autre site. `shift_id NULL` reste accepté.

Deux raisons de couvrir aussi l'`UPDATE` : la politique RLS de mise à jour est
ouverte aux managers et gérants **sur des lignes qui ne sont pas les leurs**,
et le Manager fait déjà des mises à jour en masse par `quart_id`.

`inventaire_quarts.site` et `shifts.site_id` sont tous deux `text NOT NULL` :
le site est déterminable avec certitude, la condition 3 de Q6 s'applique donc
pleinement, sans clause d'exception.

La migration se termine par un contrôle fail-closed : si une ligne existante
violait déjà l'invariant, elle s'interrompt au lieu de poser un garde vrai
seulement pour l'avenir.

## Preuves

**1. Un seul chemin de création, et il écrit le rattachement.** Vérifié par
test automatisé qui balaye tous les écrans. Le détecteur borne sa fenêtre au
`.from(` suivant — sans cette borne il accusait
`NEXUS-Inventaire-Manager-v1.html`, dont le seul `insert` proche est celui
d'`inventaire_audit_log` quatre lignes plus bas. Le Manager ne fait que des
`update`.

**3 et 4. Preuves négatives, en base réelle, transaction annulée :**

```
1. INSERT service d'un autre employe : REFUSÉ — le service 1ed2c152… appartient
   à l'employé 28810f30…, pas à 755a2dc5…
2a. INSERT son propre service        : ACCEPTÉ, ligne 8557dd93…
2b. UPDATE vers un autre employe     : REFUSÉ — même motif
3. INSERT sans rattachement (NULL)   : ACCEPTÉ — historique préservé
4. UPDATE service d'un autre site    : REFUSÉ — le service est au site
   site-fantome-test, le quart d'inventaire au site nexus-station-test
```

Premier essai écarté et refait : le couple `(quart, employé)` que j'avais
choisi portait déjà une ligne, et la contrainte d'unicité
`(quart_id, employee_id)` aurait refusé l'insertion **à la place de mon
garde** — la preuve aurait été fausse.

**6. Les 6 lignes historiques sont intactes** : `6 lignes, 6 sans
rattachement, 0 shift fantôme créé, 7 shifts au total`. Aucun backfill.

**7. Mode test** : court-circuit avant toute requête, objet synthétique sans
`shift_id` — vérifié par test.

**8. Suite** : `183/192`, les 9 échecs historiques connus. Simulations
carburant et Paye (15/15) au vert. Le total passe de 191 à 192 : le test S-5.

Vérification anti-cosmétique — six mutations introduites une à une, **les six
détectées** : rattachement retiré de l'insert, garde fail-closed neutralisé,
identifiant jeté par `chargerRoleDuJour`, garde base réduit à l'insertion,
concordance employé supprimée, `NULL` refusé.

**9. Aucune écriture production.** `main` et `production` à `501c0c7`.
Migration appliquée à `nexus-test` seul.

**Déploiement réel** : `commit: '3b795ff80c94df84cb94b691d74667d44256adcc'`,
`environnement: 'test'`, `coherent: true`, construit le `2026-09-05T23:30:21Z`.
La page servie contient bien les trois marqueurs S-5 (lignes 1017, 1108, 1115).

L'identifiant de génération reste `020995cd6b06` : l'empreinte porte sur les
actifs épinglés, et `NEXUS-Inventaire-v1.html` est une page, pas un actif
épinglé. Le commit a changé, la génération non — c'est le comportement attendu
de la distinction posée en A2, pas un déploiement manqué.

## Risques / anomalies

1. **`serviceCourantId` est résolu une fois, à l'initialisation.** Au
   changement de quart en cours de session (matin→soir), une nouvelle ligne
   est créée avec cet identifiant. Si le service de l'employé avait changé
   entre-temps, la valeur serait périmée. La décision interdisant une seconde
   requête, c'est le comportement prescrit — je le consigne comme frontière
   connue, pas comme un défaut caché.
2. **Frontière de traçabilité assumée** : avant S-5, `shift_id` peut être
   `NULL` ; après S-5, toute ligne réelle le porte. L'écart entre lignes
   anciennes et nouvelles sera visible en base.
3. **Anomalie repérée hors périmètre** : `inventaire_quarts` contient une
   ligne du 05/09 avec `quart = '1'` (id `a96325e7`), au lieu de
   `matin`/`soir`. C'est un résidu de la régression de vocabulaire corrigée en
   C2-2. Elle ne gêne rien aujourd'hui et **je ne l'ai pas touchée** — la
   signaler relève de la recette, la corriger serait réécrire une donnée
   historique sans arbitrage.

## Questions pour arbitrage

**Q9 — Les preuves 2 et 5.** Elles exigent une session employé réelle avec
PIN. Employé Test A est le seul compte utilisable : aucun service en cours,
aucune ligne sur le quart courant — donc l'ouverture d'Inventaire sous A
**avant** prise de poste donne la preuve 5 (écran d'arrêt, aucune ligne), et
**après** prise de poste donne la preuve 2 (ligne créée portant le `shift_id`
du service tout juste ouvert). Ce sont les deux premiers pas du rejeu que la
décision programme déjà pour le bloqueur 1.

Recommandation : **fermer S-5 sous condition de ces deux preuves, produites au
début du rejeu bloqueur 1**, plutôt que d'organiser une session séparée qui
consommerait le seul compte de test encore vierge pour la refaire ensuite.

## Action attendue de ChatGPT

Arbitrer Q9 pour le `LOT_ID` **S-5-SHIFT-ID-INVENTAIRE-20260905** et écrire la
décision dans `docs/handoff/DECISION.md`.
