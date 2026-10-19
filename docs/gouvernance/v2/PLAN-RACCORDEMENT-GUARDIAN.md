# GOV-GUARDIAN-RACCORDEMENT-20261019 : plan révisé

Version 2 du 19/10/2026. Elle intègre la revue de Claude Code et son contre-audit. Les passages à la première personne sont ceux de Guardian, auteur du plan.

**Statut :** préparation locale du 19/10/2026, corrigée après contre-audit. Rien n'est appliqué ; rien n'est publié sur le rail à ce stade (le dépôt est l'objet du lot R0, sous réserve du lot actif).

---

## 1. Ce que Guardian est, et ce qu'il n'est pas

**Guardian est un contrôleur sémantique, hors du chemin critique.** La CI transmet. Une vigie déterministe vérifie que chaque étape arrive. Guardian répond à trois questions :
1. **Conformité :** l'exécution correspond-elle à la décision, sans rien de plus ?
2. **Preuve :** les preuves nomment-elles ce qui a été réellement mesuré ?
3. **Exécutant :** l'exécutant est-il celui que la décision désigne, et à quel moment a-t-il agi, sous quel GO ?

**Un constat de Guardian n'est jamais une décision.** Il ne peut ni clore un lot, ni consommer une décision, ni autoriser une exécution, ni publier une demande. Un humain ou Claude Code peut le promouvoir en demande.

**Guardian a une seule voie d'écriture : une issue dédiée** « Constats Guardian », avec des étiquettes par gravité.
- Il ne commente pas #28 : un commentaire là-bas pourrait toucher au réveil et au relais.
- Il ne dépose rien sur le rail : un push lancerait la CI et passerait par la règle « un seul lot actif ».

---

## 2. Ordre révisé

| Ordre | Étape | Contenu | Risque | Qui |
|---|---|---|---|---|
| **R0** | Fondations sur le rail | Dépôt des documents v2 (charte cible, définition du constat, voie d'écriture unique de Guardian) | Faible (documentation) | Lot publié par Claude Code, GO de doctrine de Frédéric |
| **R1** | **Identités** (priorité 1) | Identité Guardian distincte : lecture du dépôt et commentaires sur l'issue des constats, rien d'autre. Identité agents (GOV-01). Une décision « humaine » n'est valable que si elle vient de l'identité de Frédéric | Réglage | **Frédéric**, lot de réglages unique |
| **R2** | Empreinte de décision | La décision déposée porte l'empreinte du texte de l'arbitre et l'identifiant du commentaire source ; `verifier` recompare | Faible | Guardian prépare, arbitre tranche |
| **R3** | Journal des transitions et de provenance | Une ligne par étape : réveil, relais, dépôt, dispatch, reprise, **exécution (qui, quand, sous quel GO, empreinte de ce qui a été exécuté)**, consommation. Clé d'idempotence | Faible | Guardian prépare, arbitre tranche |
| **R4** | Vigie déterministe | Workflow planifié. Il extrait des journaux de runs la preuve utile (étape, code de sortie, empreinte) vers le journal des transitions, puisque Guardian ne lit pas ces journaux. Il alerte sur toute transition manquante. **Il émet un signal de vie quotidien** | Moyen | Guardian prépare, **GO Frédéric** |
| **R5** | Guardian planifié | Tâche planifiée : un résumé quotidien, plus un passage sur alerte quand le déclenchement est prouvé. Guardian vérifie aussi le signal de vie de la vigie. Les deux se surveillent mutuellement | Moyen | **GO Frédéric** (armement) |
| **R6** | Canal vers Claude Code | Une file « actions pour Claude Code » sur le rail et une notification. **« Claude Code relancé tout seul » reste non acquis** tant qu'une recette ne l'a pas prouvé | Moyen | Guardian prépare |
| **R7** | Protection du rail et du mandat | Ruleset du rail ; CODEOWNERS sur `ARBITRE-CHATGPT.md` et les registres d'autorité | Réglage | **Frédéric**, même lot que R1 |

**Ordre de démarrage :** R0, puis R1 et R7 (vos réglages, en un seul lot), puis R2 et R3, puis R4, puis R5 et R6.

---

## 3. Banc de recette (environnement isolé)

**Dépôt d'essai séparé,** sans secret Supabase ni accès Production.
- Une **empreinte de l'arbre des outils et des workflows** prouve qu'ils sont identiques au rail à un SHA donné. Le banc refuse de tourner si elle diffère.
- **Chaque garde est prouvée en la cassant** (mutation) avant d'être vue passer.

| Essai | Scénario | Résultat attendu |
|---|---|---|
| A | Circulation nominale complète | Chaque transition au journal, avec son run ; la vigie reste muette |
| B | Absence de décision | Exécution refusée ; alerte de la vigie après délai |
| C | Guardian indisponible | Aucune perte ; reprise depuis le journal, sans doublon |
| D | Doublon (push rejoué, runs simultanés) | Une seule exécution (clé d'idempotence) |
| E | Décision modifiée après dépôt | Refus par empreinte |
| F | Tentative vers `main`, `production`, déploiement, Supabase hors Test | Tous refusés |
| **G** | Guardian tente de clore, de consommer, de publier ou d'écrire une décision | **Refus** |
| **H** | Décision « humaine » déposée sous une identité d'agent | **Refus** |
| **I** | La vigie s'arrête | Son silence est détecté par Guardian ; alerte « vigie muette » |

Le raccordement n'est déclaré opérationnel qu'avec les essais A à I réussis de bout en bout.

---

## 4. Point nouveau à vérifier avant tout

Claude Code signale que l'exécution SQL de l'étape 5 aurait été faite **par ChatGPT, hors session**, à une heure inconnue, sous un GO invérifiable. Ce fait n'est pas vérifié : exécutant, heure, cible et GO sont inconnus. L'incident reste **ouvert** ; ce plan ne le clôt pas et ne le tient pas pour autorisé.

S'il est confirmé, le ChatGPT conversationnel dispose d'un **accès en écriture à Supabase**. Un arbitre ou un auditeur qui peut exécuter contredit la charte. Cet accès doit être inventorié (connecteurs du projet ChatGPT) et retiré.

---

## 5. Lot unique des réglages de Frédéric

Il regroupe R1 et R7, ainsi que GOV-01 à GOV-03 :
- identité agents et identité Guardian distinctes de la vôtre ;
- approbation obligatoire sur `main` et `production`, plus la validation de l'environnement de déploiement ;
- ruleset du rail ; CODEOWNERS sur le mandat de l'arbitre et les registres d'autorité ;
- connecteurs Supabase cloisonnés (Claude Code limité à Test, Guardian en lecture seule) ;
- connecteurs du ChatGPT conversationnel en lecture seule, Supabase compris.
