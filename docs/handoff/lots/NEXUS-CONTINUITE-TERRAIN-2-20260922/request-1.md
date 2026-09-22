---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-CONTINUITE-TERRAIN-2-20260922
seq: 1
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=5b047e0 production=2bc7b39
---
# Lot successeur — B1 à arbitrer, et les deux trous de preuve à combler avant tout GO Production

Ce lot succède à `NEXUS-CONTINUITE-TERRAIN-1-20260920`, fermé par son `decision-13.md`
(`closes: true`) le 22/09/2026. Il reprend, telles quelles, les questions qui y restaient
ouvertes. Il repart à `request-1` et il est contigu par construction : c'est tout l'objet de la
clôture.

**Ce qui est déjà tranché et n'est pas rouvert ici :** `5b047e0` est ratifié ; le transport Git
reste borné à `fdj-vague1-cycle-caisse-20260916` et `reception-regularisation-20260919` ; #62
(`fe4e9a2`) et #65 (`fe36a8e`) portent chacun un **NO GO temporaire** de fusion Production,
motivé par l'insuffisance du dossier de preuve et non par un défaut fonctionnel.

## 1. La seule question qui demande un geste humain — B1, l'accès du remplaçant

Sans réponse depuis le 20/09/2026, et l'absence de Frédéric a commencé le 21/09.

Angélique est `renfort`. `current_employee_role()` lit `employees.role` et non le rôle du jour :
aucune prise de poste ne lui ouvrira Verify ni la validation des audits de caisse. Les trois
comptes qui portent les droits — lydie, audrey, yannick — n'ont plus de connexion depuis
juillet. Deux voies, toutes deux hors de ma portée : **promotion temporaire datée**, ou
**attente du retour**.

Motif d'interruption : décision métier absente, et droits réellement absents. Je ne peux pas
écrire moi-même un fichier accordant des privilèges en base, et c'est un garde-fou à respecter.

**Preuve d'aboutissement exigée :** `auth.users.last_sign_in_at` du compte retenu passe à la
date du jour. Un accès annoncé ne vaut pas un accès établi.

## 2. Ce que je conduis sans demander d'autorisation — les deux trous de preuve

Énoncés par Frédéric le 22/09/2026. Aucun ne demande d'écriture Production.

### 2.1 Isolation Supabase Test pour les candidats web

Mesure établie : `nexus-auth.js`, sur `production`, `fe4e9a2` et `fe36a8e`, est la version de
932 lignes qui code `uzhjpqpctpvxytxpxoqz.supabase.co` — **Supabase Production** — en dur, et
n'interroge jamais `window.NEXUS_CONFIG`. L'indirection d'environnement n'existe que sur la
lignée du rail, et son `nexus-config.js` n'est dans aucun arbre git. Cloudflare Pages
construisant chaque branche poussée, l'alias de branche d'une PR sert donc une page qui parle à
Production : y jouer une recette navigateur y écrirait.

C'est ce qui rend la recette navigateur et la preuve « SHA attendu = SHA servi »
**structurellement indisponibles** pour ces deux candidats — et c'est pourquoi elles ne doivent
pas être lancées plutôt que simplement n'avoir pas été lancées.

Frédéric : « Ce problème doit être corrigé avant que #62 puisse devenir un candidat Production
complet. »

Réserve à lever avant d'agir : `outils/build.sh` et le mode d'artefact `construit` sont hors du
mandat en cours, et l'évolution d'architecture CI — « cette preuve devrait pouvoir être exécutée
sur un candidat PR sans pour autant faire de cette branche un rail » — a été explicitement
renvoyée hors de #62/#65. C'est donc ici, dans ce lot, qu'elle se traite, et l'étude est portée
au dossier avant toute modification.

### 2.2 Preuve de création réelle de la migration de #65

Établi : sur Supabase Test, la migration unique de #65 est un **no-op strict** — 9 NOTICE
« already exists, skipping », 0 objet créé, 0 détruit — parce que le schéma de Test porte déjà
`regularisation_motif` et `mode_saisie`, posés hors du système de migrations. Elle n'a donc
jamais été prouvée créer quoi que ce soit, nulle part.

Protocole demandé par Frédéric : reproduire **exactement** l'état des 276 migrations
`production`, appliquer **uniquement** la 277e — celle de #65 — et vérifier les objets attendus.
Environnement jetable, aucune écriture Production nécessaire. La différence d'objets se mesure
comme au §8 de `dossier-decision-pr-65.md` : instantanés `information_schema.columns`,
`pg_proc`, `pg_policies` avant/après, diffés dans les deux sens. **Zéro objet créé serait un
échec de la preuve, pas un succès.**

## 3. La dette de schéma à ne pas banaliser, et à ne pas mélanger

Supabase Test porte **287 migrations appliquées, dont 11 absentes de tous les arbres Git**
(`20260904175747` … `20260909170000`). Le dépôt `production` en compte 276.

Frédéric : « Ce n'est pas nécessairement une panne immédiate, mais NEXUS ne doit pas continuer
longtemps avec : Git ≠ historique migrations Test ≠ schéma Test. Je traiterais cette
réconciliation après sécurisation du mécanisme Test, sans la mélanger aux fonctionnalités
FDJ/Carburants. »

Inscrit ici comme dette ouverte et datée, séquencée **après** le §2.1, et hors du périmètre de
#62 et #65.

## 4. Ce qui demeure interdit sans un GO distinct

Fusion vers `production`, déploiement, migration Supabase Production, écriture de données
Production, `pointage_actif`, `outils/correction-horaires-production-a-executer-par-frederic.sql`,
Pages/DNS/secrets/variables/règles GitHub, toute action destructive. Rien de ce qui précède n'en
a besoin.

Et une fois les deux candidats réellement prouvés, leur promotion est **séquentielle, jamais
simultanée** : le premier fusionné déplace l'empreinte migrations, le second repart de la
nouvelle Production et recalcule mécaniquement les deux constantes de
`.github/deploiement/test_empreinte_artefact_20260915.js` — 289 migrations une fois les deux
combinés.

## 5. La décision demandée

**Le point 1 seulement : B1.** Promotion temporaire datée, ou attente du retour.

Les §2 et §3 sont déclarés, pas soumis : ils relèvent du travail ordinaire et avancent sans
autorisation intermédiaire. Ils reviendront sous forme de dossiers, pour les GO/NO GO de #62 et
#65, dans des demandes ultérieures de ce lot.
