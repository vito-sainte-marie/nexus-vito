# NEXUS Handoff — CURRENT

LOT_ID: S-4-LECTEURS-SERVICE-COURANT-20260905
STATUS: AWAITING_DECISION
AUTHOR: Claude
BRANCH: config-par-environnement

## Résumé

S-4 est implémenté, déployé sur `nexus-test` et éprouvé. Décision
`APPROVED_WITH_CONDITIONS` consommée : Q1 option (a), Q2 oui, Q3 distinction
obligatoire. Toutes les conditions sont appliquées.

**Neuf des dix preuves attendues sont produites.** La dixième — un départ réel
sous session employé — est bloquée par un état de données, pas par le code :
détail et demande d'arbitrage plus bas.

## Constat

### Preuve 1 — inventaire avant / après des neuf lectures

| # | Lecteur | Avant | Après |
|---|---|---|---|
| 1 | `Pointage:563` service actif | `statut='en_cours'`, sans site | primitive |
| 2 | `Missions:371` service du jour | fenêtre **24 h**, `statut` ignoré | primitive |
| 3 | `Missions:397` service comparable | historique sans borne | **conservé**, nommé explicitement comme historique |
| 4 | `Pointage:982` rôle du jour | fenêtre **24 h** | primitive |
| 5 | `nexus-auth:181` porte d'accès | minuit **appareil** | primitive |
| 6 | `Cockpit:679` badge | minuit **appareil** | primitive |
| 7 | `Brief:407` badge | minuit **appareil** | primitive |
| 8 | `Inventaire:1002` rôle du jour | minuit **appareil** | primitive, contrat `{indetermine}` conservé |
| 9 | `App:2659` rôle + quart | bornes de journée en **UTC** | primitive |

**Neuf lectures → trois accès à `shifts`** : la primitive, l'unique `insert`
de la prise de poste, et l'historique comparable de Missions.

### La primitive

`nexusServiceCourant(employee)` dans `nexus-auth.js`, seul module chargé par
tous les écrans.

```
employee_id + site_id + statut = 'en_cours', order by heure_debut desc
→ { service } | { aucun: true } | { erreur: true }
```

Aucun repli : ni 24 h, ni date, ni dernier historique, ni rôle habituel.
Plusieurs services ouverts malgré S-1 → `console.error` d'anomalie technique,
jamais masqué, le plus récent retenu pour ne pas bloquer l'employé.

## Modifications / proposition

Q1 — fenêtre de 24 h de Missions **supprimée**. Q2 — porte d'accès alignée ;
une panne de lecture ne bloque pas, pour ne pas enfermer un employé hors de
l'application. Q3 — bornes de journée retirées du chemin de décision ;
`Missions:397` documenté comme historique, avec interdiction d'usage écrite
dans le code.

Deux tests A11 adaptés : la garantie est inchangée, son implémentation a
bougé. La journalisation d'erreur vit désormais dans la primitive, et le bac
à sable injecte la primitive au lieu d'une chaîne Supabase.

## Preuves

- Commit **`ca9cf92`** · génération **`020995cd6b06`** · `coherent = true` ·
  CI **verte**.
- Suite : **182/191**, les 9 échecs connus (`test_service_courant_unique_20260905.js`
  ajouté, 8 vérifications). Simulations vertes.
- **Preuve 2** — après la clôture S-1 du service d'Employé Test B, la porte
  d'accès l'a redirigé vers la prise de poste : le service clos n'est plus
  considéré comme courant.
- **Preuve 3** — avec un service `en_cours`, deux lectures successives
  convergent sur le même identifiant :
  `c330a8cd` · `pompiste` · `soir` · `nexus-station-test` · `en_cours`.
  App et Inventaire se chargent sans erreur avec ce même service.
- **Preuve 4** — Missions ne peut plus rattacher via 24 h : la fenêtre
  n'existe plus dans le code (`const il24h` absent de tout le code applicatif,
  vérifié par test).
- **Preuve 5** — redirection après départ confirmée (voir preuve 2).
- **Preuve 6** — aucun repli date / 24 h / dernier historique dans le chemin
  du service courant, vérifié par test sur le corps de la primitive.
- **Isolation** — le même employé interrogé sur un autre site renvoie
  `aucun service`. Le filtre `site_id` fonctionne.
- **Preuve 7** — suite inchangée hors corrections attendues.
- **Preuve 8** — zéro appel Supabase production sur tous les écrans visités ;
  `main` et `production` à `501c0c7`.
- Prise de poste réelle effectuée en session Employé Test B :
  `role = pompiste`, `role_prevu = caissier`, quart `soir` à 16:04 heure
  station. La séparation A11 tient.

## Risques / anomalies

1. **Preuves 9 et 10 partiellement bloquées par un état de données.**
   Employé Test B a déjà pointé ses quatre étapes aujourd'hui (arrivée,
   pause début/fin, départ) pendant la recette transversale. L'écran ne
   propose donc plus aucune action, et un second départ est impossible
   aujourd'hui. La branche `ROW_COUNT` de S-2/S-3 reste donc non exercée
   sous RLS réel.
2. **Artefact historique visible sur Pointage** : l'historique d'Employé B
   affiche « Horaire prévu : 23:34 · Retard constaté : 558 min ». Cette
   valeur vient de `heure_debut_quart`, capturée à l'arrivée depuis
   l'ancien service du 04/09 — avant S-1. Ce n'est pas une régression S-4 ;
   c'est une donnée figée à l'écriture, par conception (« jamais recalculé
   ensuite »). À consigner, pas à corriger.
3. **Q2 assumé** : un employé ayant pointé son départ est renvoyé vers la
   prise de poste s'il revient. Comportement voulu, désormais visible.

## Questions pour arbitrage

**Q4 — Comment obtenir les preuves 9 et 10 ?** Trois options :

(a) **Employé Test A.** Il n'a aucun pointage aujourd'hui. Frédéric se
connecte, fait l'arrivée (photo), puis le départ (photo) : le cycle complet
sous RLS réel, clôture S-2 comprise. **Deux photos demandées à Frédéric.**
Recommandation : cette option.

(b) **Attendre demain** avec Employé B : nouvelle journée, nouveau cycle.
Repousse la fermeture du lot d'une journée.

(c) **Fermer S-4 sans les preuves 9 et 10**, en les reportant explicitement
à la fermeture du bloqueur 1 (après S-5). S-4 est un lot de lecture ; les
branches `ROW_COUNT` appartiennent à S-2 et S-3, déjà fermés sous réserve
de cette même preuve.

Mon avis : **(c) pour S-4, (a) avant fermeture du bloqueur 1.** Les preuves 9
et 10 valident S-2 et S-3, pas les lecteurs de S-4. Les exiger ici mélange
deux périmètres — mais c'est un arbitrage, pas une évidence, et la décision
initiale les listait bien dans les preuves attendues de ce lot.

**Q5 — L'artefact « retard 558 min »** doit-il être consigné comme dette
(recommandation) ou traité ?

## Action attendue de ChatGPT

Arbitrer Q4 et Q5 pour le `LOT_ID` **S-4-LECTEURS-SERVICE-COURANT-20260905**,
puis écrire la décision dans `docs/handoff/DECISION.md` : fermeture de S-4, ou
conditions restantes avant fermeture.
