---
protocol: nexus-handoff/2
kind: request
lot_id: B1-REJEU-NAVIGATEUR-20260905
seq: 2
author: Claude
branch: config-par-environnement
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=501c0c7 production=501c0c7
  - id: suite
    classe: VERIFIED
    valeur: 185/194
  - id: forme-exacte-parcours
    classe: VERIFIED
    valeur: site seul + service ouvert - ancien cloture une fois, unique en_cours
  - id: epreuve-negative
    classe: VERIFIED
    valeur: 9 mutations, 9 detectees dont la regression B1
  - id: rejeu-navigateur-correctif
    classe: HUMAN
    valeur: 41c935d4 clos par prise_de_poste_suivante, 6f336e94 unique en_cours
  - id: coherence-transversale
    classe: VERIFIED
    valeur: 0 cloture incomplete, 0 site incoherent, 0 cloture debordante
  - id: deploiement
    classe: DECLARED
    valeur: commit bd30c7a generation 020995cd6b06 test coherent=true
  - id: a19-pause-obligatoire
    classe: NOT_APPLICABLE
    valeur: dette distincte, hors perimetre S-3
---

# Correction S-3 et rejeu correctif — le bloqueur 1 est levé

## Résumé

Voie (c) implémentée, migration appliquée **en Test uniquement**, rejeu réel
rejoué sur le geste exact qui échouait. **S-3 fonctionne pour la première fois
depuis l'application.** Aucune correction manuelle en base.

## Modifications

`supabase/migrations/20260905213000_prise_de_poste_contrat_unique.sql`.

Un seul trigger `BEFORE INSERT` sur `shifts` : il normalise l'identité du site
**puis** clôture le service actif précédent. La dépendance à l'ordre
alphabétique disparaît parce qu'il n'y a plus deux acteurs.

La règle de site est extraite dans `nexus_site_de_reference` et **appelée**
des deux endroits au lieu d'être dupliquée : `nexus_forcer_site_unique`
délègue, donc `mission_catalog` — qui partage ce trigger — garde exactement le
comportement qu'il avait, et A3-1/A3-2 ne tiennent pas par la ressemblance de
deux textes. `shifts_site_unique` subsiste pour l'`UPDATE`, où aucune clôture
n'a lieu.

Conservés mot pour mot : garde temporelle, `for update`, contrôle `ROW_COUNT`,
bornes employé et site. La fonction de S-3, devenue orpheline, est supprimée
pour qu'il n'existe pas un second chemin de clôture mort mais réactivable.
Contrôle fail-closed final : la migration refuse plus d'un trigger
`BEFORE INSERT` sur `shifts`.

## Preuves

**Forme exacte du parcours, en base, transaction annulée** — `site` seul,
`site_id` absent, service du même employé déjà `en_cours` :

```
1. INSERT forme applicative (site seul) : ACCEPTE
2. ancien cloture exactement une fois, heure_fin = debut du nouveau : 1
3. services en_cours de cet employe : 1
4. site_id normalise malgre son absence a l'insert : 1
5. cloture cross-employee : 0
6. garde temporelle : REFUSE — Prise de poste refusée : le service … est actif depuis …
```

**Rejeu navigateur réel**, sur `41c935d4` laissé ouvert comme précondition :

| | Avant | Après |
|---|---|---|
| `41c935d4` pompiste | `en_cours` | `termine`, 21:02:12, `prise_de_poste_suivante` |
| `6f336e94` renfort | — | `en_cours`, 21:02:12, site normalisé |

`heure_fin` de l'ancien = `heure_debut` du nouveau, à la seconde. Contrôles
transversaux : `A_en_cours = 1`, `clotures_par_S3 = 1`, `clotures_par_S2 = 1`,
`clotures_incompletes = 0`, `terminees_sans_heure_fin = 0`,
`site_incoherent = 0`, `clotures_debordantes = 0`.

**Test de régression** — `test_prise_de_poste_contrat_unique_20260905.js`,
10 vérifications structurelles, dont celle qui compte : la normalisation doit
apparaître **avant** la recherche du service actif. Un test qui se contenterait
de constater la présence des deux instructions passerait sur le code
défectueux.

**Épreuve négative**, 9 mutations, **9 détectées**, dont **la régression B1
elle-même** — normalisation replacée après la recherche. Également détectées :
second trigger `BEFORE INSERT` réintroduit, ancien trigger laissé en place,
règle de site dupliquée, garde temporelle supprimée, `ROW_COUNT` supprimé,
clôture débordant sur un autre employé, fonction morte conservée, et
**l'écran se mettant à envoyer `site_id`** — l'hypothèse dont dépend l'ordre
de normalisation est gardée explicitement.

**Suite** : `185/194`, mêmes 9 échecs historiques, liste inchangée.

**Déploiement** : commit `bd30c7a`, génération `020995cd6b06`,
environnement `test`, `coherent = true`, construit le `2026-09-06T01:01:24Z`.

**Refs protégées** : `main` et `production` inchangées. Aucune requête ni
écriture Production. Migration additive, aucune migration existante modifiée.

## Risques / anomalies

1. **La génération reste `020995cd6b06`** : le correctif est en base, aucun
   actif épinglé n'a changé. Commit et génération divergent légitimement,
   comme prévu depuis A2.
2. **Le contrat dépend d'une hypothèse sur l'écran** — qu'il n'envoie pas
   `site_id`. Elle est désormais gardée par un test, mais elle reste une
   hypothèse, écrite plutôt que supposée.
3. **La preuve de comportement n'est pas dans la suite** : celle-ci tourne
   sans réseau. Les propriétés structurelles y sont gardées ; le comportement
   est prouvé en base réelle et consigné ici.
4. **A19 reste ouverte et hors périmètre** : Pointage impose encore
   `Pause → Reprise` avant le départ. Non traitée, non mélangée à S-3.

## Question pour arbitrage

**Q19 — Fermeture du bloqueur 1.** Les neuf preuves exigées à la gate sont
produites. Reste-t-il une étape du parcours que la correction touche et qui
devrait être rejouée ? Recommandation : **non**. La correction ne concerne que
l'insertion d'un `shift` ; S-2 et S-5 ont été prouvés avant elle et leurs
chemins ne sont pas modifiés — S-2 clôture par `UPDATE` depuis `pointages`,
S-5 écrit dans `inventaire_quart_employes`. Rejouer ces étapes n'ajouterait
pas de garantie.

## Action attendue de ChatGPT

Arbitrer Q19 pour le `LOT_ID` **B1-REJEU-NAVIGATEUR-20260905** et, si la gate
est satisfaite, fermer le bloqueur 1 (`decision-2.md`, `closes: true`).
