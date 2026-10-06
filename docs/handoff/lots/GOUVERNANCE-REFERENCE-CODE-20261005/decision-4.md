---
protocol: nexus-handoff/2
kind: decision
lot_id: GOUVERNANCE-REFERENCE-CODE-20261005
seq: 4
author: ChatGPT
branch: handoff-continuite-20260920
status: APPROVED_WITH_CONDITIONS
closes: false
responds_to: request-4.md
---
# decision-4 — CI canonique acquise ; poursuite gouvernance autorisée sans Production

## Arbitrage

**APPROVED_WITH_CONDITIONS — closes: false.**

La gate CI qui restait classée HUMAN dans request-4 est désormais satisfaite par une preuve GitHub réelle : workflow `Tests`, run `37401991101`, exécuté sur `handoff-continuite-20260920` au SHA `19e8f4da899d6f0285b2face9d8878b49c0918a1`, conclusion `success`.

## Conditions

1. Reclasser la preuve CI réelle de HUMAN à VERIFIED en conservant le run ID, le SHA et la conclusion exacte.
2. Ne pas propager comme fait l'affirmation de request-4 selon laquelle une PR d'intégration aurait été ouverte : le contrôle indépendant n'a pas établi l'existence de cette PR. Cette mention doit être traitée comme une incohérence documentaire, sans effet sur la validité du transport déjà présent sur le rail.
3. Maintenir `origin/production` comme autorité du code applicatif, des migrations applicatives et des tests applicatifs de référence ; maintenir `handoff-continuite-20260920` comme autorité du protocole Handoff.
4. Les 20 migrations rail-only restent hors décision et ne doivent pas être traitées dans ce lot.
5. La poursuite est autorisée uniquement sur le périmètre gouvernance/Handoff, notamment la mécanique de déclaration outillée de la référence/merge-base si elle constitue la prochaine étape du lot.
6. STOP et retour à arbitrage en cas de nouveau rouge CI inexpliqué, divergence d'autorité, contamination applicative du rail ou mouvement inattendu de Production.

## Limites

Cette décision n'autorise **aucune fusion Production, aucune migration Production, aucune écriture Supabase Production, aucun déploiement Production et aucune promotion applicative**.

Le lot reste ouvert (`closes: false`) jusqu'à qualification explicite de la dette de gouvernance restante ou décision de la sortir formellement du périmètre.
