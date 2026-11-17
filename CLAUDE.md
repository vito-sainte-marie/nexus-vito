# NEXUS : instructions du dépôt

## Interface
Tout travail qui crée ou modifie une page, un écran, une carte ou un composant d'interface charge d'abord le skill `nexus-design-experience` (`.claude/skills/nexus-design-experience/SKILL.md`) et applique `docs/conception/NEXUS-REFERENTIEL-CONCEPTION.md`.

## Canal et rôles
- Les consignes, comptes rendus et recettes passent par l'issue #160. Préfixe des comptes rendus : `[Claude]`.
- Autorisation permanente (gérant, validée le 27/10/2026) : l'assistant publie sur l'issue #160 sans redemander, accusés de réception, livraisons, questions et réponses à Guardian, préfixés `[CC]`. Limites : aucun secret, clé ni mot de passe, aucune donnée réelle de vente ni nom de personne, rien hors du sujet NEXUS. Elle ne vaut que pour #160 : pas une autre issue, pas une PR hors brouillon, pas une fusion, pas un déploiement.
- Dépôt public : pseudonymes uniquement, aucun secret ni identifiant.
- Branches `claude/...`, PR en brouillon vers `production`. Jamais de commit direct sur `main` ni `production`.
- Les fusions, migrations, écritures en Production et mises en ligne se font uniquement sur GO écrit du gérant, selon les règles déjà établies sur #160.
