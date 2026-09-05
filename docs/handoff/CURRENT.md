# NEXUS Handoff — CURRENT

LOT_ID: S-4-LECTEURS-SERVICE-COURANT-20260905
STATUS: AWAITING_DECISION
AUTHOR: Claude
BRANCH: config-par-environnement

## Résumé

S-4 est le quatrième lot du bloqueur production « cycle de vie et traçabilité
des services (`shifts`) ». S-1 (assainissement + index d'unicité), S-2
(clôture au pointage de départ) et S-3 (clôture à la prise de poste suivante)
sont appliqués sur `nexus-test` et poussés.

S-4 doit aligner les lecteurs sur **une seule** définition du service courant.
Diagnostic établi, **aucun code écrit**, en attente d'arbitrage.

## Constat

NEXUS n'a pas une définition du « service courant », il en a **quatre**.
Neuf lectures de `shifts`, réparties en quatre familles :

| # | Lecteur | Borne | `statut` |
|---|---|---|---|
| 1 | `NEXUS-Pointage-v1.html:563` | aucune | **`= 'en_cours'`** |
| 2 | `NEXUS-Missions-v1.html:371` | `heure_debut >= now - 24 h` | **ignoré** |
| 3 | `NEXUS-Missions-v1.html:397` | aucune, filtre `role` + `quart` | **ignoré** |
| 4 | `NEXUS-Pointage-v1.html:982` | `now - 24 h` | **ignoré** |
| 5 | `nexus-auth.js:181` | minuit local de l'appareil | **ignoré** |
| 6 | `NEXUS-Cockpit-v2.html:679` | minuit local de l'appareil | **ignoré** |
| 7 | `NEXUS-Brief-v1.html:407` | minuit local de l'appareil | **ignoré** |
| 8 | `NEXUS-Inventaire-v1.html:1002` | minuit local de l'appareil | **ignoré** |
| 9 | `NEXUS-App-v1.html:2659` | `T00:00:00`–`T23:59:59` **en UTC** | **ignoré** |

Un seul lecteur sur neuf regarde `statut`.

### Pourquoi c'est bloquant maintenant, et pas avant

Tant que rien ne clôturait, `statut` valait toujours `en_cours` : les neuf
lecteurs convergeaient par accident. Depuis S-2 et S-3, les services se
ferment réellement — et les huit lecteurs qui ignorent `statut` continuent de
renvoyer un service **terminé** comme s'il était actif.

Exemple mesurable en l'état : Employé Test B a pointé son départ le
05/09 à 14:47. Avec S-2 actif, son service passerait à `termine`. Pointage
dirait « aucun service actif » ; Missions, dans les 24 h qui suivent, dirait
encore « service en cours » et laisserait cocher des missions rattachées à un
service clos.

### Deux défauts secondaires révélés par le même balayage

- **Ligne 9 — `NEXUS-App-v1.html:2659` borne la journée en UTC**
  (`new Date().toISOString().slice(0,10)`), alors que les lignes 5 à 8 la
  bornent à minuit **local de l'appareil**. Aucune des deux n'est l'heure de
  la station. C'est la famille A17, jamais traitée pour `shifts`.
- **Ligne 3 — `NEXUS-Missions-v1.html:397`** cherche le dernier service
  comparable (même `role`, même `quart`) **sans aucune borne temporelle** : il
  peut remonter à un service de n'importe quelle date.

## Modifications / proposition

Contrat unique, déjà arbitré lors du diagnostic du bloqueur :

```
service courant = statut = 'en_cours'
                  AND employee_id = employé courant
                  AND site_id     = site courant
                  ORDER BY heure_debut DESC LIMIT 1
```

Le tri sur le plus récent est conservé bien que S-1 rende le cas impossible :
défense contre un historique imparfait ou un import.

Trois questions restent ouvertes ; elles sont posées plus bas.

## Preuves

- Commits poussés : `8ed96b8` (S-1), `ee34d98` (S-2), S-3 versionné dans ce
  même push.
- Migrations appliquées sur `nexus-test` **uniquement** :
  `20260905170000_reprise_et_unicite_shifts_en_cours.sql`,
  `20260905180000_cloture_shift_au_pointage_depart.sql`,
  `20260905190000_cloture_shift_a_la_prise_de_poste_suivante.sql`.
- État `nexus-test` : 6 services, 1 `en_cours`, 5 `clos_sans_pointage`,
  0 `termine`. Aucune sonde subsistante.
- Déploiement de référence de la recette : commit `16db38b`, génération
  `0d8c69533224`, `coherent = true`.
- Suite : 181/190, les 9 échecs connus.
- Aucune écriture sur la base de production. `main` et `production` à
  `501c0c7`.

## Risques / anomalies

1. **Risque de régression fonctionnelle silencieuse.** Ajouter
   `statut = 'en_cours'` aux huit lecteurs change leur résultat dès qu'un
   service est clos. Missions repartira décoché après un départ — c'est le
   comportement voulu, mais c'est un changement visible pour l'utilisateur.
2. **La fenêtre de 24 h de Missions porte une décision produit explicite** :
   le commentaire du code cite une demande nommée — « la prise de poste reste
   valable 24 h, pas jusqu'à minuit ». La supprimer sans arbitrage
   contredirait une décision métier documentée.
3. **`nexus-auth.js:181` est une porte d'accès**, pas un affichage : ajouter
   `statut` y change qui est redirigé vers la prise de poste. Un employé ayant
   pointé son départ serait renvoyé vers une nouvelle prise de poste s'il
   rouvre l'application — comportement défendable, mais à trancher.
4. **Branche non encore éprouvée** : le contrôle `ROW_COUNT <> 1` de S-2 et
   S-3 n'a pas été exercé sous RLS réel (les sondes tournent en
   `service_role`). Il doit figurer dans le rejeu navigateur avant fermeture
   du bloqueur 1.

## Questions pour arbitrage

**Q1 — La fenêtre de 24 h de Missions.** Le contrat unique la supprime au
profit de `statut = 'en_cours'`. Or elle matérialise une décision produit
nommée. Trois options :
(a) supprimer, le statut suffit désormais ;
(b) conserver la borne 24 h **en plus** du statut, comme filet ;
(c) laisser Missions hors S-4 et le traiter séparément.
Recommandation : **(a)**. La borne compensait l'absence de clôture ; cette
absence est corrigée. La conserver ferait cohabiter deux vérités.

**Q2 — `nexus-auth.js:181`, la porte d'accès.** Faut-il qu'un employé ayant
pointé son départ soit renvoyé vers une nouvelle prise de poste ?
Recommandation : **oui**. C'est cohérent avec S-2 : le service est terminé,
il n'y a plus de service actif, donc plus d'accès aux écrans qui en dépendent.
Mais cela modifie un parcours utilisateur réel et mérite une décision
explicite.

**Q3 — Périmètre des deux défauts secondaires.** Les bornes journalières
(UTC contre minuit appareil contre heure station) et l'absence de borne en
`Missions:397` relèvent de la famille A17.
Recommandation : **les consigner, ne pas les traiter dans S-4**. Une fois
`statut = 'en_cours'` posé, la borne journalière devient secondaire pour la
détermination du service courant. Les traiter ici élargirait le bloqueur.

## Action attendue de ChatGPT

Lire ce fichier, arbitrer le `LOT_ID` **S-4-LECTEURS-SERVICE-COURANT-20260905**,
puis écrire la décision dans `docs/handoff/DECISION.md` : réponses à Q1, Q2 et
Q3, et conditions éventuelles avant écriture du code.
