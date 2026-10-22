<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/JAUGEAGE-SAISIE-DIRECTE-20261022/request-1.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: request
lot_id: JAUGEAGE-SAISIE-DIRECTE-20261022
seq: 1
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: https://github.com/vito-sainte-marie/nexus-vito/issues/28
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=73c88a47 production=ccedfa83
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 160-fichiers
---
# LOT : JAUGEAGE-SAISIE-DIRECTE-20261022 — jaugeage : la saisie des quatre volumes passe devant la lecture automatique

## Origine
Demande de Frédéric (22/10/2026), tirée du parcours pompiste du 21/10 sur l'aperçu Test. Le lot est indépendant de JAUGEAGE-OCR-20261021 (clos en l'état, request-6) et de la future JAUGEAGE-OCR-2, qui sera déposée séparément. Le document « Parcours pompiste : lots pour Claude Code » n'est pas sur le poste de Claude : le périmètre se fonde sur le détail du message de Frédéric.

## Constat (`origin/production` ccedfa83, `NEXUS-Releves-Piste-v1.html`, écran jaugeage)
Après la photo, le message d'état annonce « La lecture automatique est différée : elle peut tarder » (ligne ~254) et le pompiste attend une lecture qui peut ne jamais venir. Les quatre champs existent déjà mais rien ne l'invite à les remplir ; « Actualiser la lecture » est un bouton plein qui laisse croire que la saisie est secondaire.

## Périmètre modifié
`NEXUS-Releves-Piste-v1.html` (et `nexus-releves-piste.js` si la logique y migre), écran jaugeage uniquement :
1. Après l'envoi de la photo, le message devient « Photo enregistrée. Saisissez les quatre volumes affichés sur l'écran du Veeder-Root. » et le curseur se place dans le premier champ vide.
2. Plus de « elle peut tarder » ; le mot « échec » n'est jamais écrit sur cet écran.
3. « Actualiser la lecture » devient un lien discret.
4. Une lecture qui arrive plus tard ne remplit que les champs vides et n'écrase jamais une saisie ; elle décoche la confirmation pour que le pompiste revérifie.
5. Épreuves du rouge au vert, chacune avec une mutation de contrôle qui mord.

## Hors périmètre
Tout OCR (worker, moteur Vision, parseur), SQL, migration, RLS, Supabase Production, autres écrans, lot 3, JAUGEAGE-OCR-2, déploiement.

## Conduite
- Worktree depuis `origin/production` (ccedfa83, mesuré à l'instant de ce dépôt), jamais la branche locale. Un seul push pour le code et la consommation.
- Recette sur l'aperçu Test au format téléphone : de la photo à l'enregistrement en moins d'une minute, chronométrée.
- PR en brouillon vers `production` ; aucune fusion ni déploiement sans le GO de Frédéric (palier PRODUCTION_FUSION_DEPLOIEMENT_PROMOTION). La recette par un pompiste sans aide reste un geste humain.

## À arbitrer
Approuver ce périmètre et cette conduite pour que Claude exécute le lot sur un rail de travail, sans autre geste humain avant la PR.

## Contraintes dites sans fard
- Le lot ne rend pas la lecture automatique plus fiable : il la rend facultative à l'écran. Tant que le worker est en panne (diagnostic du 22/10), la saisie manuelle est le seul chemin.
- Le registre porte encore `lot_actif` = PARCOURS-POMPISTE-LOT2 bien que sa décision soit consommée ; si la règle D3 refuse ce dépôt, je m'arrête et je rapporte.
