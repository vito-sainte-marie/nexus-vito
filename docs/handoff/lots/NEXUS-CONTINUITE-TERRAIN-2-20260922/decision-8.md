---
protocol: nexus-handoff/2
kind: decision
lot_id: NEXUS-CONTINUITE-TERRAIN-2-20260922
seq: 8
author: NEXUS Orchestrator
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-9.md
---
# Décision — arbitrage technique de `request-9.md`, sans gate Créateur

## Verdict

`APPROVED_WITH_CONDITIONS`, `closes: false`, en réponse à `request-9.md`.

## Motif

`request-9.md` a trouvé, en revérifiant indépendamment `dbc8f55` contre l'état réel de la
candidate, que le correctif `nexus-auth-corrige-65-20260923.js` est désormais obsolète : le
portage `290a217` a déjà remplacé le `nexus-auth.js` de la candidate par une version plus
complète, qui porte les mêmes gardes que le rail canonique. Transporter le correctif proposé
régresserait la candidate. C'est un fait matériel, pas un choix de fondateur — aucune gate
Créateur n'est due.

## Point 1 — correctif `nexus-auth-corrige-65-20260923.js` : NE PAS TRANSPORTER

Confirmé : `nexus-auth.js` de la candidate est aujourd'hui octet pour octet identique à celui
du rail canonique. Le correctif proposé ne fait que réintroduire la garde `NEXUS_CONFIG` seule,
sans les gardes `NexusBuild`/`NexusPage` déjà apportées par `290a217`. Le transporter
supprimerait ces gardes. Ce fichier reste dans le registre comme preuve historique du
diagnostic initial ; il ne doit être copié nulle part sur la candidate.

## Point 2 — `NEXUS_CONFIG` côté produit : déjà couvert

Le problème initial (garde `NEXUS_CONFIG` absente) est considéré déjà résolu par `290a217`,
plus complètement que ne le proposait le correctif. Ne pas modifier `nexus-auth.js` pour ce
point.

## Point 3 — harnais de test : réparation en zone jetable, APPROVED

Réparer uniquement les deux harnais (`test_regularisation_manager_20260916.js`,
`test_cloture_services_obsoletes_20260916.js`) pour refléter fidèlement les préconditions
runtime actuelles de la candidate. Méthode prescrite : une zone de build/test jetable,
jamais le dépôt réel —
1. générer l'artefact `nexus-build.js` avec l'outillage canonique existant
   (`outils/poser-build-id.js`, inchangé), dans cette zone jetable ;
2. charger le vrai `nexus-page.js` (déjà committé sur la candidate), jamais un stub ;
3. ne stuber aucune garde, ne modifier aucun outil de build partagé ;
4. aucun artefact généré ou périmé ne doit être commité nulle part.

**Condition d'arrêt** : si cette voie exige de modifier un outil partagé, ou révèle une
nouvelle contradiction matérielle, STOP — retour par un nouveau `request-N.md` canonique,
sans exécution silencieuse au-delà.

## Point 4 — exécution réelle, puis suite conditionnelle

Exécuter réellement les deux harnais ainsi réparés dans la zone jetable, et rapporter
uniquement les assertions effectivement mesurées — aucun chiffre de suite globale déduit.

**Si et seulement si** ce point est vert (les deux harnais passent intégralement), poursuivre,
toujours sur la candidate non-Production :
1. CI réelle sur la candidate ;
2. preuve distincte, séparée, que le `nexus-config.js` réellement servi cible exclusivement
   Supabase Test — condition cumulative déjà posée par `decision-3.md`/`decision-4.md`,
   inchangée ici — avant toute recette navigateur.

## Point 5 — Cloudflare / normalisation `.html` : reste BLOQUÉ

Inchangé depuis `decision-7.md` Point 2. Aucune observation réelle du comportement Cloudflare
pour la candidate #65 n'existe encore. Aucun correctif préventif. Le point se débloque
uniquement par une observation réelle (humaine ou Claude avec accès réseau sortant) après un
déploiement Cloudflare Pages réussi de la candidate.

## Rappels maintenus, inchangés

1. Aucun chiffre de suite candidate ne doit être déclaré sans exécution réelle sur l'arbre
   candidate.
2. La gate d'identité `nexus-config.js` réellement servi vers Supabase Test reste une condition
   cumulative, inchangée par cette décision : aucune recette navigateur avant elle.

## Transport — même limite technique que les décisions précédentes

Écriture directe sur `rebuild/carburants-65-20260922` et sur `.github/workflows/*.yml` restent
hors de portée de cet agent dans ce canal. Cette décision autorise le contenu des points
ci-dessus, pas un moyen de les transporter que ce canal n'a pas.

## Interdits absolus

Aucun changement `main`/`production`, aucune migration/écriture Supabase Production, aucun
déploiement/promotion Production, aucune nouvelle règle métier/UX/RLS/rôle, aucun secret
exposé. `NEXUS_BASE_BRANCH=handoff-continuite-20260920` reste le rail de ce lot. La candidate
n'est toujours pas déclarée prête.
