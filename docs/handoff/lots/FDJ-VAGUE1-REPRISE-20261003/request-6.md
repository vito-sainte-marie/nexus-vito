---
protocol: nexus-handoff/2
kind: request
lot_id: FDJ-VAGUE1-REPRISE-20261003
seq: 6
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=d6093b7 production=2f27e5c
  - id: refs-protegees
    classe: VERIFIED
    valeur: production=2f27e5c
  - id: candidat
    classe: VERIFIED
    valeur: f3e128e rebuild/fdj-62-20260922 FF 34/0
  - id: pr
    classe: VERIFIED
    valeur: vito-sainte-marie/nexus-vito#73 ouverte non fusionnee
  - id: garde-70
    classe: VERIFIED
    valeur: qualifie pour 13 migrations au candidat f3e128e
  - id: catalogue-production
    classe: VERIFIED
    valeur: begin read only 2026-10-04T10:44Z objets des 12 migrations absents
  - id: suite
    classe: VERIFIED
    valeur: 234/241 avant et apres, 7 rouges preexistants
---
# Demande — dossier de fusion et de déploiement du candidat FDJ : quatre gestes, quatre GO séparés

Ce dossier rend compte de l'option A de `decision-5.md`. Il ne contient que de la préparation : rien n'a été écrit en Production, rien n'a été fusionné, rien n'a été déployé, et Test n'a pas été touché.

## 1. Identités exactes — un GO tombe si l'une d'elles bouge

| Ref | SHA |
|---|---|
| Candidat `rebuild/fdj-62-20260922` | `f3e128e3e95b848150f43c5415697d3637c9ea64` |
| `production` | `2f27e5c7c81db78d7847bad6b51e03f707d79825` |
| PR | vito-sainte-marie/nexus-vito#73, ouverte, **non fusionnée**, auto-merge désactivé |

- **Le candidat a changé.** `4c63621`, cité dans `request-5` et `decision-5`, n'est plus le candidat. `f3e128e` lui ajoute un seul commit : la procédure et la qualification, sans aucun changement de code ni de migration.
- **Intégration.** Avance rapide, 34 commits d'avance, 0 de retard, aucun conflit. La procédure dit « 33 » parce qu'elle a été écrite avant son propre commit.
- **Mode de déploiement.** « Construit » : `outils/build.sh` est présent sur `production`.

## 2. Ordre imposé (`docs/deploiement/procedure-fdj-62-production.md`)

1. **Les 12 migrations**, de `20260916220000` à `20260916221100`, dans l'ordre. Une par appel `apply_migration`, et l'on s'arrête à la première erreur. Un AVANT et un APRÈS en lecture seule encadrent la série.
2. **La fusion** de #73.
3. **Le déploiement**, par la gate Pages. Le contenu servi est ensuite constaté par sha256, puis par exécution.
4. **`20261004120000`**, en dernier, une fois que l'écran servi est le nouveau.

Les gestes 2 et 3 ne peuvent pas précéder le geste 1, et le geste 4 ne peut pas précéder le geste 3 :
- l'écran du candidat appelle les 36 fonctions créées par les 12 migrations, et aucune n'existe en Production ;
- l'écran servi aujourd'hui appelle `fdj_corriger_caisse_employe` (`NEXUS-FDJ-v1.html:878` sur `2f27e5c`). Le commentaire de la migration 120000 qui dit « Aucun écran ne l'appelle » est faux pour l'écran servi. Le fichier n'a pas été retouché, car le modifier ferait tomber sa qualification.

## 3. Ce qui a été mesuré

Les lectures ont eu lieu en Production le 04/10/2026, sous `begin read only`, avec deux témoins : le rôle readonly à 10:39:58 UTC, puis le connecteur à 10:44:04 UTC (`postgres`, `transaction_read_only = on`).

- **Objets.** Aucun objet des 12 migrations n'existe : ni les 36 fonctions, ni les 2 tables, ni le trigger, ni les 15 index, ni les colonnes ajoutées.
- **Contrainte de statut.** `fdj_cash_controls_statut_check` porte aujourd'hui 8 valeurs. Les 113 lignes existantes n'en utilisent que 4, qui font toutes partie des 10 valeurs que 220100 autorise : la revalidation passera.
- **Index d'idempotence.** `fdj_stock_movements_idempotency_key_uniq` existe déjà. Le bloc conditionnel de 220400 ne créera donc rien.
- **Colonnes NOT NULL.** Les colonnes NOT NULL ajoutées ont un défaut. Aucune migration n'écrit de ligne au moment de l'application, donc les triggers existants ne se déclenchent pas.
- **Révocations.** Aucune ne touche un objet existant, à la seule exception de 120000.
- **Fenêtre entre les gestes 1 et 3.** L'écran servi continue de fonctionner : la contrainte de statut est élargie, et les cinq fonctions révoquées à `authenticated` sont neuves.
- **Garde #70** au candidat : `Ordre migration → code qualifié pour 13 migration(s)`, avec une `blob_migration` par fichier.
- **Tests.** La suite passe à 234/241, sans changement par rapport à avant. Les 7 rouges existaient déjà (inventaire et réception). Les épreuves `.github/deploiement` passent 3 sur 3.
- **CI de la PR** : 2 checks verts, 1 sauté.

## 4. Risques restants

- **Les 12 migrations ne forment pas une transaction unique.** Chaque appel est atomique. Si l'un échoue, les précédents restent appliqués. Ce sont des objets neufs et vides, que les blocs de retour arrière, commentés en fin de chaque fichier, permettent de défaire à rebours.
- **Entre les gestes 3 et 4,** un onglet non rechargé sert encore l'ancien écran. Après le geste 4, le bouton « Corriger et inscrire sur mon relevé » y échouerait. Il faut constater le contenu servi avant de passer au geste 4.
- **La base peut bouger sans le dépôt.** L'AVANT du geste 1 relit le catalogue et arrête tout au moindre écart avec le §3.

## 5. Hors périmètre, dit explicitement

- **Phase C** (`supabase/phase-c/`). Elle est **écartée** de ce dossier : elle n'est pas dans `supabase/migrations`, aucun geste ne l'applique et aucun n'en dépend. Son arbitrage (`request-3` §5) reste **ouvert** et n'est pas demandé ici.
- **Faux positif de la garde #70.** Elle détecte des DDL destructifs dans 220000, 220200, 220300 et 220400. Ce sont les blocs de retour arrière **commentés** : la regex ne retire pas les commentaires. Ces quatre migrations sont qualifiées `atomique_ou_procedure_speciale`, qui est de toute façon leur état juste. La garde n'est pas corrigée dans ce lot.
- **Restent également ouverts :** le GO de fusion et de déploiement de la PR #72, et le contrôle réseau connecté de l'écran, qui attend une connexion de Frédéric.

## 6. GO demandés — quatre, séparés, chacun valable pour `f3e128e` seulement

1. **GO migration** : appliquer en Production les 12 migrations de `20260916220000` à `20260916221100`, selon le §3 de la procédure.
2. **GO fusion** : de #73 dans `production`, en avance rapide. Ce GO n'est demandé qu'après l'APRÈS du geste 1.
3. **GO déploiement** : par la gate Pages, avec le constat du contenu servi.
4. **GO 120000** : appliquer `20261004120000`, après le constat que l'écran servi est le nouveau.

Un GO ne vaut pas pour le geste suivant. Si le SHA du candidat bouge, tous les GO déjà donnés tombent.

Je n'arbitre pas.
