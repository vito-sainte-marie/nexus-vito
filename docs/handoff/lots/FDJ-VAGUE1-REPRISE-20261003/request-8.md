---
protocol: nexus-handoff/2
kind: request
lot_id: FDJ-VAGUE1-REPRISE-20261003
seq: 8
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=d6093b7 production=638f3f4
  - id: fusion-73
    classe: VERIFIED
    valeur: 638f3f40885ce1b3c517fc86e6f528eb3a01ead5
  - id: deploiement
    classe: VERIFIED
    valeur: run 37198272159 vert, 174/174 sha256 servis = artefact
  - id: registre-production
    classe: VERIFIED
    valeur: 294 lignes, dernière 20261004120000
---

# request-8 — Gestes 2, 3 et 4 exécutés : dossier FDJ-62 en Production

request-7 demandait le GO de fusion. Frédéric l'a donné en direct, puis le GO de
déploiement et celui de `20261004120000`, un par geste. Cette demande rapporte
les trois et remplace request-7.

## Geste 2 — fusion (GO « go fusionner PR »)

PR #73 fusionnée le 2026-10-04 à 11:18 UTC, verrouillée par
`--match-head-commit f3e128e3e95b848150f43c5415697d3637c9ea64`.
Commit de fusion **638f3f4**. Checks requis verts avant fusion.

## Geste 3 — déploiement Pages (GO « go déployer 638f3f4 »)

- Run 37198272159 approuvé à sa gate `github-pages` ; vert, garde
  anti-obsolescence comprise.
- Contenu : 174/174 fichiers html/js servis par app.nexusconseil.net ont le
  sha256 de l'artefact téléchargé du run.
- Exécution : `NEXUS-FDJ-v1.html` chargé en session réelle, lecture seule,
  aucune erreur console, 10 appels REST à 200, pied de page
  « commit 638f3f4 · construit le 2026-10-04T11:18:23Z ».
- Aucun fichier de l'artefact n'appelle plus `fdj_corriger_caisse_employe`.

## Geste 4 — `20261004120000` (GO « go appliquer 20261004120000 »)

- AVANT (lecture seule) : registre 293, estampille absente ; ACL de
  `fdj_corriger_caisse_employe` ouverte à `anon` ET `authenticated`.
- Méthode identique au geste 1 : `execute_sql`, contrôle md5
  (`2f57a676…`) contre le fichier de 638f3f4, estampille canonique.
- APRÈS (lecture seule) : registre **294**, dernière estampille
  `20261004120000 fdj_fermer_ancienne_correction_caisse_employe` ;
  ACL `{postgres, service_role}` ; `anon` et `authenticated` fermés ;
  `fdj_corriger_caisse_confirmee(...)` exécutable par `authenticated`.

## Ce qui reste hors périmètre

Phase C (arbitrage ouvert), élargissement de `nexus_ci_recette` : non touchés.

## Décision demandée

Clore le lot (`closes: true`) si l'arbitre tient les quatre gestes pour
conformes, ou désigner ce qui manque.
