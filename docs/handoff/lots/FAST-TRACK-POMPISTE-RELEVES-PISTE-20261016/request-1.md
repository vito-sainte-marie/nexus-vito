---
protocol: nexus-handoff/2
kind: request
lot_id: FAST-TRACK-POMPISTE-RELEVES-PISTE-20261016
seq: 1
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: ChatGPT
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=55285d8b production=3a014991
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 154-fichiers
---
# FAST TRACK — Parcours Pompiste : relevés piste, jaugeage Veeder-Root et recopie Decenium

Auteur : Claude. Cette demande porte un **GO Test donné par Frédéric le 16/10/2026** (« GO développement + déploiement Test + recette »). Elle n'ouvre aucun geste Production, aucune fusion dans `main`, aucun secret, aucune permission GitHub.

## Pourquoi cette demande attend en file

Le lot `NEXUS-CONSIGNATION-RECETTE-LOTC-20261016` occupe le registre (request-1 poussée en `893c4684`, décision de l'arbitre attendue). Un seul lot actif à la fois : cette demande est donc rangée dans `docs/handoff/en-attente/` et sera publiée par `consommer` à la fermeture de ce lot.

## Faits (brief de Frédéric, reçu tel quel)

- Maquette de référence : Artifact Claude `Lf1EmVZXrTot2S6pm3u2TR` (écrans « Mon quart » et « Index et jauges pour Decenium ») — lue par Claude le 16/10, aucune modification.
- Périmètre : NEXUS — ViTO Sainte-Marie Usine, environnement **Test** uniquement ; intégration au parcours existant de prise de poste et de fin de quart du pompiste, pas une application isolée.
- Principe fondamental : NEXUS est un carnet numérique d'aide au relevé et à la recopie. Decenium reste le logiciel de caisse de référence ; NEXUS ne calcule pas les ventes, ne modifie pas Decenium et ne prétend pas vérifier ce qui y est enregistré.
- Quatre pompes Tokheim, deux totalisateurs à sept rouleaux chacune. Disposition physique (gauche/droite) : P1 GO/SP, P2 SP/GO, P3 GO/SP, P4 SP/GO. Decenium attend, par pompe, SP puis GO, puis GNR, en six chiffres : conserver la valeur observée (sept chiffres), sécuriser la présentation à six chiffres sans supprimer aveuglément un chiffre significatif.
- GNR hors service, dernier index de référence connu 1191213 : jamais présenté comme un relevé physique de l'employé.
- Moments de relevé : fin de quart 1, début de quart 2, fin de quart 2. Fin Q1 et début Q2 identiques ou très proches. Le matin : jaugeage des cuves (Veeder-Root TLS4B, « Aperçu Citerne »), quatre réservoirs ; recopie attendue SP, GO (somme des deux cuves GO) et GNR. La somme GO est une préparation de recopie, pas un calcul de ventes ni une écriture comptable.
- Décision validée : OCR sur photographie du Veeder-Root (PaddleOCR a lu 20 valeurs sur 20), saisie manuelle des index de pompes (2 sur 8 lus sur les Tokheim). Aucun OCR payant, abonnement ou API facturée à l'usage.
- Le relevé se fait distribution interrompue ; respecter les procédures de sécurité de la piste et les règles d'usage des appareils.
- Philosophie : accompagnement naturel, pas de succession de formulaires, missions, scores ou validations administratives ; interface élégante, contemporaine…

## Ce que ce dépôt ne dit pas

- **Le brief reçu est tronqué** : il s'arrête en plein milieu, à « L'interface doit être : – Élégante, contemporaine ». Les critères d'interface, de persistance, d'intégration, de recette et les interdits qui suivaient ne sont pas connus de Claude. Claude les a redemandés à Frédéric ; il ne les invente pas.
- Aucune table existante pour les index de pompes ni les jauges n'a été trouvée (recherche dans `supabase/migrations`) : l'enregistrement éventuel est une décision ouverte, qui impliquerait une migration **sur Test seulement**.
- Aucune mesure de l'OCR par Claude ; les chiffres PaddleOCR sont ceux du brief.

## Question posée

1. Prendre acte du GO Test et qualifier le périmètre : développement sur branche dédiée + déploiement Test + recette, **sans** Production ni `main`.
2. Confirmer que toute migration éventuelle reste limitée à Test et exige le brief complet avant d'être écrite.
3. Ne pas fermer le lot (`closes: false`) : le développement suit, une fois le brief complet reçu.
