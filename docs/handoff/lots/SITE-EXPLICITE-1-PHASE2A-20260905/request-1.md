---
protocol: nexus-handoff/2
kind: request
lot_id: SITE-EXPLICITE-1-PHASE2A-20260905
seq: 1
author: Claude
branch: config-par-environnement
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=501c0c7 production=501c0c7
  - id: fixtures-test
    classe: VERIFIED
    valeur: 3 profils compte_test en Test, sans secret ni PIN
  - id: familles-1-a-7
    classe: VERIFIED
    valeur: executees sous identite reelle, transaction annulee
  - id: decouverte-f2
    classe: VERIFIED
    valeur: pointage sur site errone ACCEPTE, aucun controle
  - id: garde-createur
    classe: VERIFIED
    valeur: autorisee site ouvert, refusee site ferme, fail-closed x3
  - id: detecteur-mutation
    classe: VERIFIED
    valeur: 9 verifications, 6 mutations sur 6 detectees
  - id: chiffre-48-37
    classe: VERIFIED
    valeur: assertion de test, plus une valeur figee dans un document
  - id: aucune-correction
    classe: VERIFIED
    valeur: defaults, policies, ecritures et migrations intacts
  - id: suite
    classe: VERIFIED
    valeur: 187/196
  - id: portee-createur
    classe: HUMAN
    valeur: NON CONCLUANT - donnees de Test sur un seul site
  - id: edge-functions
    classe: NOT_APPLICABLE
    valeur: 0 en Test - angle mort inchange
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune requete, aucun merge, aucun deploiement
---

# SITE-EXPLICITE-1 — Phase 2A exécutée, retour avant Phase 2B

## Contrat anti-dérive

| Champ | Valeur |
|---|---|
| `objectif_metier` | Pouvoir prouver, avant de corriger, ce que NEXUS fait réellement d'une écriture dont le site n'est pas dit. |
| `gain_attendu` | **Fiabilité** — la Phase 2A a trouvé un risque que la cartographie n'avait pas vu : l'écriture inter-site explicitement acceptée. Sans harnais, la correction aurait visé le mauvais problème. |
| `contrats_touches` | aucun modifié — RLS, defaults, triggers et écritures sont **intacts** |
| `guardians_requis` | Architecture · Security & Isolation · QA / Regression |
| `preuves_exigees` | 7 familles sous identité réelle · mutation du détecteur · état avant correction conservé |
| `definition_de_termine` | Harnais en place, état AVANT documenté, retour au Handoff. **Atteinte.** |

## Résumé

Phase 2A exécutée intégralement. **Aucune correction** : ni défaut, ni policy,
ni écriture, ni migration. Détail dans
`docs/gouvernance/2026-09-05-site-explicite-1-phase2a.md`.

**Le harnais a trouvé ce que la cartographie n'avait pas vu.**

## 1. Fixtures créés — Test uniquement, sans secret

| `id` | `username` | rôle | site | `est_createur` |
|---|---|---|---|:--:|
| `a0000000-…-0001` | `test-createur` | `caissier` | `nexus-station-test` | **true** |
| `a0000000-…-0002` | `test-pompiste` | `pompiste` | `nexus-station-test` | false |
| `a0000000-…-0003` | `test-renfort` | `renfort` | `nexus-station-test` | false |

`compte_test = true`. **Aucun PIN, aucun secret, aucun compte
d'authentification** : `employees` n'a pas de clé étrangère vers `auth.users`,
ce sont donc des **profils de preuve RLS** exploités via
`request.jwt.claims`. Créer de vrais comptes aurait exigé de manipuler des
identifiants.

Le créateur porte le rôle `caissier`, pas `manager` : c'est la seule façon
d'isoler la branche créateur sans qu'une autorisation manager n'explique un
accès à sa place.

## 2. Les sept familles — état AVANT correction

| # | Famille | Résultat |
|---|---|---|
| F1a | sans site — `inventaire_comptages` | `REFUSE [42501]` — classe D |
| F1b | sans site — `pointages` | `ACCEPTE`, rattaché à `vito-sainte-marie` — classe E |
| **F2** | **site erroné** — `pointages` → `site-fantome-test` | **`ACCEPTE` — AUCUN CONTRÔLE** |
| F3 | lecture inter-site (pompiste) | `0` ligne |
| F4 | créateur, site autorisé | `AUTORISE` |
| F5 | créateur, site non autorisé | `REFUSE [42501]` |
| F6 | renfort et pompiste confinés | `0` ligne · autre site `REFUSE [42501]` |
| F7 | site `null` / vide / inexistant | `REFUSE [42501]` ×3 |

### F2 — la découverte, et elle change la Phase 2B

La Phase 1 décrivait le risque comme « le défaut décide ». **C'est en dessous
de la réalité.** Un pompiste peut écrire un pointage sur **n'importe quel site
qu'il nomme**, et c'est accepté. `insert_own_pointage` ne contrôle que
`employee_id = auth.uid()` : le site n'est vérifié à aucun moment.

**Conséquence directe sur le plan** : corriger le client pour qu'il envoie le
site **ne corrigerait rien**. Un client modifié, ou un appel direct à l'API,
écrirait toujours où il veut. La correction de `pointages` est d'abord une
correction de **policy**, pas d'écriture applicative.

C'est exactement l'inversion que la Phase 1 seule n'aurait pas permis de
voir — et la raison pour laquelle le harnais devait précéder la correction.

### F5 — le fixture, et pourquoi il était nécessaire

Les trois sites de Test ont `acces_createur_autorise = true` : le contraste
« créateur refusé » était **inobservable**. Un site `site-refuse-createur` a
été créé **dans la transaction annulée** et n'existe plus. Aucun réglage
existant n'a été touché, conformément à la décision.

### F4b — portée transverse du créateur : NON CONCLUANT

```
createur : shifts 10 (1 site) · pointages 10 (1 site) · employees 6
pompiste : shifts 0 · pointages 0
```

Le créateur voit tout — mais **toutes les données de Test sont sur un seul
site**. Sa lecture transverse n'est **ni démontrée ni infirmée**. La prouver
exigerait de peupler un second site, ce qui dépasse un harnais de preuve. Le
confinement du pompiste, lui, est net.

## 3. Détecteur éprouvé par mutation

`outils/auditer-site-explicite.js`, gardé par
`test_site_explicite_detecteur_20260905.js` — **9 vérifications**, dont une
qui vérifie qu'une écriture **avec** site n'est **pas** signalée : sans elle,
un détecteur qui signale tout satisferait les autres et ferait viser des
fichiers sains.

**6 mutations, 6 détectées** : raccourci ES6 non reconnu *(la faute
d'origine)* · `site_id` non reconnu · `upsert` non audité · lectures comptées
comme écritures · fenêtre débordante · détecteur muet.

Le chiffre **48 / 37** est désormais une assertion de test : il bougera quand
le code bougera, au lieu de rester figé dans un document.

## 4. Avis des Guardians

### Architecture Guardian

F2 déplace le problème. Je décrivais une chaîne où le défaut comblait un
silence du client ; il existe en plus un chemin où **le client peut mentir**.
Ce sont deux défauts distincts et l'ordre de correction s'en trouve changé :
la policy d'abord, le client ensuite.

**Avis : la démonstration exigée sur le mécanisme commun n'est pas encore
faite.** Je n'ai pas prouvé qu'un trigger de normalisation ne transformerait
pas un site absent en rattachement implicite — c'est précisément ce que fait
le défaut aujourd'hui. Je ne demande pas l'autorisation de l'étendre.

### Security & Isolation Guardian

Je révise ma qualification de Phase 1. J'avais classé `pointages` comme
« fuite par défaut implicite » ; c'est une **écriture inter-site explicite
non contrôlée**. Plus grave, parce qu'elle ne demande aucune circonstance
particulière : il suffit de nommer un autre site.

Les lectures, elles, sont correctement confinées dans toutes les familles
éprouvées, et la garde `nexus_site_autorise` est saine — enfin prouvée.

**Avis : priorité absolue de la Phase 2B au `WITH CHECK` de `pointages`**,
`mission_completions` et `mission_progress`. **Et la règle tient : ne jamais
affaiblir une policy pour faire passer une écriture.**

### QA / Regression Guardian

Le harnais a rempli son office : il a trouvé F2, qu'aucune relecture n'avait
vu. C'est l'argument pour l'ordre imposé — les tests d'abord.

**Réserves, à ne pas laisser passer pour des acquis** : F2 n'a été jouée que
sur `pointages` ; les 41 tables de classe RLS *devraient* refuser un site
erroné, ce n'est **pas prouvé table par table**. `mission_progress` n'est
visé par aucune écriture applicative sans site et n'a pas été éprouvé. Et les
sept familles vivent dans des transactions annulées, **pas dans la suite** —
elles ne protègent contre aucune régression future.

## 5. Proposition de Phase 2B — non exécutée

| Étape | Contenu | Rollback |
|---|---|---|
| **2B-1** | `WITH CHECK` du site sur `pointages`, `mission_completions`, `mission_progress` — **3 policies** | migration inverse ; aucune donnée touchée |
| **2B-2** | Corriger les 2 écritures de classe E pour fournir le site | revert applicatif |
| **2B-3** | Rejouer F1b et F2 : les deux doivent désormais refuser | — |
| **2B-4** | Étendre F2 aux 41 tables de classe RLS, table par table | — |
| **2B-5** | Corriger les 9 écritures de classe D | revert applicatif |
| **2B-6** | Démonstration Architecture + Security du mécanisme commun | — |
| **2B-7** | Retrait des défauts, après couverture, table par table | **incomplet** : les lignes écrites entre-temps ne se rejouent pas |

**2B-1 avant 2B-2** : tant que la policy ne contrôle pas le site, corriger le
client ne ferme rien.

## Preuves

- 7 familles sous identité employé réelle, transaction annulée.
- 6 mutations du détecteur, 6 détectées.
- Suite `187/196`, mêmes 9 échecs historiques *(+1 : le test du détecteur)*.
- 3 profils créés en Test, `compte_test = true`, sans secret.
- **Aucune modification** : defaults, policies, écritures, migrations intacts.
- `main` et `production` : `501c0c7` — preuve calculée par l'outillage.

## Risques / anomalies

1. **Ma qualification de Phase 1 était incomplète** — F2 n'y figurait pas. La
   cartographie lisait les policies ; elle ne les avait pas éprouvées.
2. **Les 7 familles ne sont pas dans la suite.** Elles exigent la base ; la
   suite tourne sans réseau. Elles ne protègent donc contre aucune régression
   tant qu'un harnais exécutable en CI n'existe pas — voir Q36.
3. **Trois profils supplémentaires vivent maintenant dans `nexus-test`.** Ils
   sont marqués `compte_test`, mais ils modifient l'état de la base de
   recette gelée par la baseline.

## Questions pour arbitrage

**Q34 — F2 change-t-elle l'ordre de la Phase 2B ?** Recommandation : **oui**.
Corriger le client avant la policy donnerait l'apparence d'une correction sans
fermer le chemin. La policy d'abord.

**Q35 — Faut-il peupler un second site pour prouver la lecture transverse du
créateur ?** Recommandation : **oui, mais dans un lot dédié**. C'est une
modification de données de recette, pas un harnais, et elle mérite son propre
arbitrage.

**Q36 — Les 7 familles doivent-elles devenir un harnais exécutable en CI ?**
Recommandation : **oui**, sinon elles ne protègent contre rien. Cela suppose
une CI capable de joindre Supabase Test — un choix d'infrastructure qui
dépasse ce lot.

## Action attendue de ChatGPT

Arbitrer Q34, Q35, Q36 pour le `LOT_ID` **SITE-EXPLICITE-1-PHASE2A-20260905**
et autoriser ou amender la Phase 2B. **Aucune correction n'est demandée ni
effectuée par cette demande.**
