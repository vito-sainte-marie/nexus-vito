<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/JAUGEAGE-OCR-2-20261022/decision-5.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: JAUGEAGE-OCR-2-20261022
seq: 5
author: Frédéric Bragance
branch: handoff-continuite-20260920
decision: APPROVED
closes: true
in_reply_to: request-5.md
provenance:
  niveau: 1
  mode: declared
  reference: Message de Frédéric Bragance dans la session Claude Code du 22/10/2026 (décision sur request-5 amendée)
---
# DÉCISION HUMAINE SUR REQUEST-5 (amendée, 426c20dc) — JAUGEAGE-OCR-2-20261022

Auteur : Frédéric Bragance. APPROVED, closes:true. Texte reproduit tel que donné dans la session Claude Code du 22/10/2026. Cette décision remplace le verdict `STOP_REQUIRED` de l'arbitre (commentaire de #28 du 22/10/2026 19:33Z, `SECRET_PERMISSION_SURFACE_SECURITE`), qui portait sur la version `a64f4bca` (avec migration de politique) et non sur la version amendée.

* Nom des photos de jaugeage : `AAAA-MM-JJ_<uid>_nexus-jaug_<site>_<HHhMM>[-N].jpg`, à l'heure de la station, avec le suffixe `_qforcee-…` conservé quand la photo est envoyée malgré le contrôle qualité.
* Aucune migration. La politique de stockage reste inchangée.
* Épreuves rouges puis vertes, dont une mutation qui déplace l'identifiant hors de sa place exigée par la politique. Suite rejouée après build, CI verte, PR en brouillon. Aucune fusion ni déploiement sans mon GO.
* Le lot se clôt après cette action. Les étapes restantes passent à un nouveau lot JAUGEAGE-OCR-3, que j'ouvrirai quand je serai à l'iMac : étape B (compilation et essais du lecteur Vision, délai de 4 min 30), validation de la capture sur iPhone réel, quinze photos sans donnée personnelle, calibration des seuils, branchement Python du worker.
* Ensuite, déposer la request du lot d'outillage (refus d'une prise en charge déjà prise par un autre exécutant, et les deux leçons à inscrire dans `RULES.json`).

Fait consigné à la demande de Frédéric : il a approuvé les déploiements de #149 (run 39840942691) et de #150 (run 39858045546). #150 est fusionnée (2c7435bd) ; validation iPhone du cadre et du bouton « Envoyer quand même » faite par Frédéric le 22/10/2026.
