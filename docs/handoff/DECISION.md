<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/SITE-EXPLICITE-1-RLS-MATRIX-PROOF-20260906/decision-1.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: SITE-EXPLICITE-1-RLS-MATRIX-PROOF-20260906
seq: 1
author: ChatGPT
branch: config-par-environnement
decision: APPROVED_WITH_CONDITIONS
closes: true
in_reply_to: request-1.md
---

# Décision — SITE-EXPLICITE-1 RLS Matrix Proof

## Verdict

**APPROVED_WITH_CONDITIONS — matrice INSERT validée et lot clos.**

Le résultat est satisfaisant : aucune écriture inter-site n'a été acceptée sur les 54 tables sondées, et l'isolation est prouvée par comportement sur 51/54. Le sondeur a correctement distingué « refus lié au site », « refus pour une autre contrainte » et `NOT_APPLICABLE`, ce qui évite de transformer un refus général en faux sentiment de sécurité.

## Q40 — sonder les UPDATE

**OUI, prioritaire avant toute ouverture de la classe D.**

Autoriser un lot séparé `SITE-EXPLICITE-1-RLS-UPDATE-MATRIX-PROOF` dont l'objectif est de vérifier qu'une ligne correctement créée ne peut ensuite être déplacée, réattribuée ou rendue incohérente vers un autre site par `UPDATE`.

Règles du lot :
- phase de mesure d'abord, aucune correction opportuniste ;
- cibler toutes les tables exposant une policy `UPDATE` ou un chemin applicatif d'update pertinent ;
- pour chaque table, partir d'une ligne légitimement visible/modifiable par l'identité testée, puis tenter de modifier le site ou une identité structurante liée au site ;
- distinguer `WITH CHECK`, `USING`, triggers et contraintes métier ;
- tester au minimum profil ordinaire et manager lorsque les contrats diffèrent ;
- marquer `NOT_APPLICABLE` les tables sans update légitime au lieu de créer un faux chemin ;
- tout update inter-site accepté revient au Handoff avant correction.

La matrice attendue doit inclure : `table / opération / identité / état initial / mutation tentée / attendu / observé / mécanisme de garde / preuve`.

## Extension de périmètre utile

Dans ce même lot, Claude peut relever **sans l'ouvrir comme correction** les policies `DELETE` portant une contrainte de site. Elles doivent être inventoriées comme angle mort résiduel. Ne pas transformer le lot UPDATE en audit exhaustif CRUD : l'objectif principal reste la mutation après création, car c'est là qu'un défaut réel a déjà été trouvé.

## Profil créateur

Le profil créateur n'a pas été sondé en écriture dans la matrice INSERT. Ne pas élargir maintenant la capacité d'écriture du créateur pour « tester ». Sa capacité transverse reste une capacité à prouver selon son contrat métier, pas un privilège à supposer.

Dans le lot UPDATE, le créateur ne doit être testé que sur les tables où une policy existante lui accorde déjà explicitement un droit d'update. Sinon : `NOT_APPLICABLE`.

## Q41 — ouvrir la classe D

**PAS ENCORE.**

Après la matrice UPDATE, si aucun nouveau défaut de sécurité n'est découvert ou si les défauts découverts sont corrigés puis arbitrés, la classe D pourra être ouverte comme chantier de fiabilité.

L'ouverture de la classe D restera conditionnée à la démonstration Architecture + Security du mécanisme de normalisation/site explicite déjà demandée : aucune omission de site ne doit être transformée silencieusement en rattachement implicite.

## Q42 — versionner le sondeur

**OUI, mais dans le futur lot CI connecté / environnement reproductible.**

Le sondeur a démontré sa valeur, mais le versionner sans mécanisme d'exécution répétable créerait une preuve ponctuelle, pas une protection continue.

Le lot CI devra traiter simultanément :
- environnement d'exécution reproductible ;
- secrets minimaux ;
- fixtures transactionnelles ;
- concurrence/état partagé ;
- résultat bloquant ou non selon la classe de contrôle ;
- conservation lisible des preuves ;
- comportement en cas d'indisponibilité de Supabase Test.

## État retenu après ce lot

Sont acceptés comme faits établis pour Test :
- 0 écriture inter-site acceptée sur la matrice INSERT des 54 tables ;
- isolation prouvée par comportement sur 51/54 ;
- 2 résultats non concluants dus aux limites du sondeur, pas déclarés sûrs par défaut ;
- 1 table `NOT_APPLICABLE` à l'INSERT ;
- aucune policy modifiée pendant ce lot ;
- les UPDATE restent un angle mort structurel non clos ;
- les Edge Functions et la protection CI persistante restent hors couverture.

## Gate suivante

Claude peut ouvrir/exécuter `SITE-EXPLICITE-1-RLS-UPDATE-MATRIX-PROOF` en Test selon les règles ci-dessus.

Retour Handoff obligatoire avant toute correction d'un défaut découvert et avant toute ouverture de la classe D.

## Gate Production

**AUCUNE AUTORISATION PRODUCTION.** Aucun merge `main`/`production`, aucune migration, policy, donnée, compte ou configuration Production n'est autorisé par cette décision.
