# SITE-EXPLICITE-1 — Phase 2A : harnais de preuve

Exécutée le 05/09/2026 sur `nexus-test`. **Aucune correction.** Aucun défaut
retiré, aucune policy modifiée, aucune écriture applicative corrigée, aucune
migration.

## 1. Profils de test créés — Test uniquement

Trois lignes ajoutées à `public.employees` de `nexus-test`, marquées
`compte_test = true` :

| `id` | `username` | rôle | site | `est_createur` |
|---|---|---|---|:--:|
| `a0000000-…-000000000001` | `test-createur` | `caissier` | `nexus-station-test` | **true** |
| `a0000000-…-000000000002` | `test-pompiste` | `pompiste` | `nexus-station-test` | false |
| `a0000000-…-000000000003` | `test-renfort` | `renfort` | `nexus-station-test` | false |

**Aucun secret, aucun PIN, aucun compte d'authentification.** `employees` n'a
pas de clé étrangère vers `auth.users` : ces lignes sont des **profils de
preuve RLS**, exploitables via `request.jwt.claims`, et non des comptes
capables de se connecter. Créer de vrais comptes aurait exigé de manipuler des
identifiants, ce qui n'entre pas dans mes attributions.

Le créateur porte volontairement le rôle `caissier` et non `manager` : c'est
la seule façon d'isoler la branche créateur, sans qu'une autorisation
manager ne vienne expliquer un accès à sa place.

## 2. Les sept familles — état AVANT correction

Toutes exécutées sous identité employé réelle, en transaction annulée.

| # | Famille | Résultat | Verdict |
|---|---|---|---|
| **F1a** | écriture sans site — `inventaire_comptages` | `REFUSE [42501]` | classe D confirmée |
| **F1b** | écriture sans site — `pointages` | `ACCEPTE`, rattachée à **`vito-sainte-marie`** | **classe E confirmée** |
| **F2** | écriture avec **site erroné** — `pointages` vers `site-fantome-test` | **`ACCEPTE`** | **AUCUN CONTRÔLE** |
| **F3** | lecture inter-site — `shifts`, `employees` par un pompiste | `0` ligne | conforme |
| **F4** | créateur sur site **autorisé** | `AUTORISE` | conforme |
| **F5** | créateur sur site **non autorisé** | `REFUSE [42501]` | conforme |
| **F6** | profils ordinaires confinés — renfort, pompiste | `0` ligne · demande d'un autre site `REFUSE [42501]` | conforme |
| **F7** | fail-closed — site `null`, vide, inexistant | `REFUSE [42501]` ×3 | conforme |

### F2 — découverte de Phase 2A, plus grave que le défaut

La cartographie de Phase 1 décrivait le risque comme « le défaut décide ».
C'est en dessous de la réalité :

```
F2 pointages site errone : ACCEPTE — AUCUN CONTROLE
```

Un pompiste peut écrire un pointage sur **n'importe quel site qu'il nomme**.
Ce n'est plus un rattachement implicite subi, c'est une **écriture inter-site
explicite acceptée**. La politique `insert_own_pointage` ne contrôle que
`employee_id = auth.uid()` ; le site n'est vérifié à aucun moment.

Conséquence : le risque de `pointages` ne se corrige pas en fournissant le
site côté client. Tant que la policy ne contrôle pas le site, un client
modifié — ou un appel direct à l'API — écrit où il veut.

### F5 — fixture nécessaire, et pourquoi

Les trois sites de Test ont `acces_createur_autorise = true` : le contraste
« créateur refusé » était donc **inobservable**. Plutôt que de basculer le
réglage d'un site existant — une configuration structurante — un site
`site-refuse-createur` a été créé **à l'intérieur de la transaction annulée**
et n'existe plus. Aucune configuration existante n'a été touchée.

### F4b — portée du créateur : NON CONCLUANT

Mesurée, mais non probante :

```
createur : shifts 10 (1 site) · pointages 10 (1 site) · employees 6
pompiste : shifts 0 · pointages 0
```

Le créateur voit tout, mais **toutes les données de Test sont sur un seul
site**. Sa capacité de lecture transverse n'est donc **pas démontrée** — elle
n'est pas non plus infirmée. Le confinement du pompiste, lui, est net.

Pour prouver la lecture transverse, il faudrait des données sur un second
site — c'est-à-dire écrire sur `site-fantome-test`. Je ne l'ai pas fait :
peupler un second site est une modification de données de recette qui dépasse
le harnais de preuve.

## 3. Détecteur éprouvé par mutation

Le détecteur est désormais versionné : `outils/auditer-site-explicite.js`,
gardé par `test_site_explicite_detecteur_20260905.js` — **9 vérifications**.

Il ne vérifie pas seulement que le détecteur trouve : il vérifie qu'il ne se
trompe **ni dans un sens ni dans l'autre**. Une écriture avec site explicite
ne doit pas être signalée, sinon un détecteur qui signale tout satisferait la
première épreuve et ferait viser des fichiers sains.

**Six mutations, six détectées :**

| Mutation | Détectée |
|---|:--:|
| le raccourci ES6 `{ site, … }` n'est plus reconnu — **la faute d'origine** | ✅ |
| `site_id` n'est plus reconnu | ✅ |
| `upsert` n'est plus audité | ✅ |
| les lectures sont comptées comme des écritures | ✅ |
| la fenêtre déborde sur l'appel suivant | ✅ |
| le détecteur ne signale plus rien | ✅ |

Le chiffre **48 écritures / 37 tables** est désormais une assertion de test :
il bougera le jour où le code bougera, au lieu de rester figé dans un
document.

## 4. Ce qui reste non couvert

- **Edge Functions** : zéro en Test. Impossible de vérifier que les écritures
  serveur fournissent le site. Angle mort déclaré, inchangé.
- **Lecture transverse du créateur** : non démontrée faute de données
  multi-site.
- **`mission_progress`** : classé E en Phase 1 par sa policy, mais aucune
  écriture applicative sans site ne le vise — non éprouvé en Phase 2A.
- **Écriture avec site erroné sur les 41 tables de classe RLS** : F2 n'a été
  jouée que sur `pointages`. Les autres devraient refuser, ce n'est pas
  prouvé table par table.
