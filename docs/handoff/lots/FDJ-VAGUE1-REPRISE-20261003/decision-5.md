---
protocol: nexus-handoff/2
kind: decision
lot_id: FDJ-VAGUE1-REPRISE-20261003
seq: 5
author: Frédéric Bragance
branch: handoff-continuite-20260920
decision: APPROVED
closes: false
in_reply_to: request-5.md
---
# Décision — `request-5.md` : option A approuvée

## Verdict

`APPROVED`, `closes: false`.

Frédéric Bragance a rendu cet arbitrage en session, le 04/10/2026. Verbatim :

> GO decision-5 : option A

## Ce que l'option A autorise (`request-5.md` §5)

Fermer l'ancienne porte par le candidat, ce qui veut dire **préparer** la fusion et le déploiement du candidat `rebuild/fdj-62-20260922` (`4c63621`). Concrètement :

1. Mesurer l'intégration du candidat dans `production` (`2f27e5c`) : base commune, conflits, fichiers touchés, mode de déploiement.
2. Qualifier ses migrations au sens de la garde ordre migration → code (#70), par des lectures seules de Production (`begin read only`) et par Test.
3. Écrire l'ordre d'application imposé au §3 de `request-5` :
   - les migrations hors `20261004120000` ;
   - puis l'écran ;
   - puis `20261004120000`.
4. Ouvrir, si l'intégration le permet, une PR vers `production`, **sans la fusionner**.
5. Rapporter le tout dans un dossier de décision, via `request-6.md`.

Le dossier dira explicitement où se trouve la Phase C par rapport à ce geste. Son arbitrage (constat §5 de `request-3.md`) n'est pas rendu par cette décision.

## Ce qu'elle n'autorise pas

- Aucune écriture, aucune migration, aucun grant ni revoke en Production.
- Aucune fusion vers `production`, aucun déploiement. Chacun de ces gestes exigera son GO, et un GO tombe si le SHA bouge.
- Aucune écriture sur Test hors transaction annulée.
- Aucune application ni modification de la Phase C.
- Aucun élargissement de `nexus_ci_recette`.

## Suite

Le résultat sera rapporté par `request-6.md`.
