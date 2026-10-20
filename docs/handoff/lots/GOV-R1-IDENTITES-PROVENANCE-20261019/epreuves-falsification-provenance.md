# Épreuves de falsification : provenance des décisions humaines (lot R1)

**Statut :** validée telle quelle par Frédéric dans `decision-2.md` du lot (`32d128ba`, 19/10/2026), qui valide aussi les trois codes d'arrêt et retient la voie A puis B. Rédigée par Claude Code, lot `GOV-R1-IDENTITES-PROVENANCE-20261019`. Spécification d'épreuves, pas du code : aucune n'est exécutable aujourd'hui, aucun outil n'est modifié. La validation n'autorise aucun code : la voie A fait l'objet d'une décision ultérieure (condition 1 de `decision-2.md`). Elle ne vaut pas GO. Elle suit la condition 2 de `decision-1.md` de R1 : ces épreuves sont écrites et validées avant tout code d'outil.

**Confirmation de Frédéric (consignée par Claude Code).** Le 19/10/2026 à 21:00 (UTC-4, soit 2026-10-20T01:00Z, heure relevée par Claude Code au moment de la consignation), Frédéric a écrit dans la conversation avec Claude Code : « J'ai relu les conditions 1 à 5 de la decision-1 de R1 et je les accepte. » Il a aussi demandé l'ajout de E5 et donné le GO pour la séquence prise en charge, commit de preuve, consommation, `verifier`, push. Niveau de provenance : décision exprimée, rapportée par Claude Code, non vérifiée indépendamment (niveau 1/2 selon le cahier) ; elle n'atteint pas le niveau 3. Les conditions acceptées sont celles rédigées par Claude Code dans `decision-1.md` ; cette confirmation ne les modifie pas et ne vaut pas validation des épreuves au-delà de leur dépôt.

**Principe.** Une garde n'existe que si une épreuve peut la faire rougir. Chaque épreuve décrit une entrée hostile, le résultat attendu de la garde cible (P5 : arrêt explicite, niveau de preuve atteint, jamais de repli silencieux) et l'état de l'outil actuel. Une épreuve qui passerait aussi sur l'outil actuel ne prouverait rien : elle doit y être rouge.

**Vocabulaire.** Niveau 1 : décision exprimée dans la conversation d'origine. Niveau 2 : rapportée, non vérifiée. Niveau 3 : liée à un événement authentifié et vérifiable. Sous P5, le niveau 3 n'est pas atteignable : la garde doit donc s'arrêter plutôt que de qualifier.

**Codes d'arrêt (proposés, à valider).** `PROVENANCE_NON_ETABLIE` (aucune preuve), `PROVENANCE_INVALIDE` (preuve altérée ou d'un autre compte), `PROVENANCE_INSUFFISANTE` (preuve d'un compte partagé seul). Chacun doit nommer le niveau atteint.

## E1. Un nom d'auteur n'est pas une preuve

- **Entrée.** Une décision humaine (palier réservé à Frédéric) déposée avec `--auteur "Frédéric Bragance"`, sans aucune preuve.
- **Attendu.** Refus ou arrêt `PROVENANCE_NON_ETABLIE`, niveau atteint indiqué (au mieux 2). Jamais qualifiée niveau 3, jamais consommée comme vérifiée.
- **Outil actuel : ROUGE, observé.** `handoff.js decision … --auteur "Frédéric Bragance"` produit une enveloppe conforme sans rien vérifier (fait le 19/10/2026 pour `GOV-R0…/decision-1.md` et `GOV-R1…/decision-1.md`). Le seul contrôle est `author` non vide (`validerCommuns`).
- **Ce qui la ferait passer à tort.** Une garde qui compare `author` à une liste de noms.

## E2. Une preuve altérée ou d'un autre compte est rejetée

- **Entrée.** Une décision accompagnée d'une référence de preuve (empreinte d'échange ou événement) dans trois variantes : (a) un octet modifié dans l'objet prouvé ; (b) une preuve valide mais émise par un autre compte ou agent que l'identité attendue ; (c) une référence qui ne désigne rien.
- **Attendu.** Pour (a) et (c) : `PROVENANCE_INVALIDE`. Pour (b) : `PROVENANCE_INVALIDE` avec le compte constaté. Aucune ne passe au niveau 2 « faute de mieux ».
- **Outil actuel : sans objet, donc ROUGE.** Il n'existe pas de champ de preuve (PROTOCOL.md l. 52-55) : la garde ne peut pas s'exécuter. L'épreuve reste rouge tant que ce champ n'existe pas.
- **Précaution.** La variante (a) doit modifier un seul octet, pour qu'une garde qui ne vérifierait que la présence du champ soit démasquée.

## E3. Pas de preuve vérifiable : arrêt explicite, pas silence

- **Entrée.** Une décision à palier humain dont la preuve existe mais ne peut pas être vérifiée (source injoignable ou vérificateur indisponible).
- **Attendu.** L'outil s'arrête avec un code explicite et un message qui nomme le niveau atteint et la raison de l'impossibilité. La décision n'est pas consommée. Aucun avertissement seul : un `AVERTISSEMENT` suivi d'une consommation est un échec de l'épreuve.
- **Outil actuel : ROUGE.** `consommer` accepte la décision sans question de provenance ; les anomalies d'enveloppe produisent des avertissements et des dérogations, pas un arrêt.
- **Ce qui la ferait passer à tort.** Un code d'arrêt émis mais un `exit 0` ; l'épreuve doit contrôler le code de sortie et l'état de `STATE.json` (statut inchangé).

## E4. Le compte partagé seul ne suffit pas

- **Entrée.** Une décision humaine déposée par un commit ou un commentaire sous `vito-sainte-marie`, compte partagé avec des agents, sans second élément distinguant Frédéric (clé, approbation personnelle, ou autre élément vérifiable).
- **Attendu.** `PROVENANCE_INSUFFISANTE` : le compte seul n'atteint pas le niveau 3 et la décision à palier humain n'est pas consommée comme vérifiée. Même résultat si le commit porte `Co-Authored-By` d'un agent ou non : l'attribution du compte n'établit rien.
- **Outil actuel : ROUGE.** Un commit du compte partagé est traité comme une décision conforme (constat C8 : `claude.yml` filtre l'acteur, ce qui ne prouve pas que Frédéric est intervenu).
- **Contre-épreuve.** Un dépôt par un compte qui n'est pas `vito-sainte-marie` ne doit pas non plus passer : l'identité attendue est un élément à prouver, pas un nom de compte exclu.

## E5. `author: ChatGPT` déposé par un agent est refusé

- **Entrée.** Une décision `author: ChatGPT` déposée directement par un agent (Claude Code ou autre, via `handoff.js decision … --auteur ChatGPT` ou un commit), et non matérialisée par la CI à partir d'un commentaire de l'arbitre.
- **Attendu.** Refus ou arrêt `PROVENANCE_NON_ETABLIE` : le nom `ChatGPT` n'est pas plus une preuve que le nom d'un humain. Seule une décision que la CI matérialise à partir d'un commentaire de l'arbitre est admise comme décision d'arbitre.
- **Outil actuel : ROUGE, déduit.** `--auteur` est libre : `--auteur ChatGPT` donne une enveloppe conforme sans que rien ne distingue l'agent de la CI (constat C3).
- **Ce qui la ferait passer à tort.** Une garde qui n'examine que la valeur de `author`. Elle doit examiner l'origine du dépôt (matérialisation CI), dont la forme reste à décider.
- **Contre-épreuve.** La même décision matérialisée par la CI (voir cas de contrôle) passe.
- **Mode de vérification précisé par Frédéric (19/10/2026, 21:26 UTC-4, soit 2026-10-20T01:26Z, heure relevée par Claude Code à la consignation ; rapporté par Claude Code, niveau 2).** E5 se code dans l'outil, par lecture de l'API GitHub : le commentaire désigné doit être posté par `github-actions[bot]`, citer un run de `tests.yml` dont l'étape de relais a réussi, et son contrat doit correspondre à la décision. Si l'API ne répond pas : arrêt explicite, jamais de repli silencieux. `tests.yml` reste hors périmètre : aucun marquage n'est ajouté au workflow.
- **Limite consignée (risque résiduel).** Un job `claude.yml` utilise le même jeton que le relais : il peut poster sous `github-actions[bot]`. Cette vérification ne distingue donc pas la CI de relais d'un job d'agent. Ce risque est renvoyé à R2 et à la voie B ; il n'est pas résolu par la voie A.

## Épreuves communes de la couche de contrôle

- **Cas de contrôle (doit rester vert).** Une décision matérialisée par la CI à partir d'un commentaire de l'arbitre (relais, `author: ChatGPT` posé par le workflow) continue de passer sans preuve de provenance humaine. Ce cas vert ne vaut que pour la matérialisation par la CI : un `author: ChatGPT` déposé par un agent relève de E5. Sans ce cas, une garde qui bloque tout serait jugée correcte.
- **Pas de contournement par dérogation.** Une décision à palier humain sans preuve ne peut pas passer par le mécanisme de dérogation existant (`DEROGATIONS`) sans que celle-ci soit elle-même une décision de Frédéric prouvée. À instruire : la dérogation est aujourd'hui un champ de registre, non une preuve.

## Limites

- Ces épreuves ne qualifient pas un mécanisme de preuve de niveau 3 : P1 à P4 ne sont ni retenues ni écartées, et leurs capacités réelles ne sont pas vérifiées ici.
- E2 présuppose un champ de preuve dont la forme reste à décider (niveau, référence, mode de vérification, cahier §7).
- Les codes d'arrêt ci-dessus sont des propositions de nommage ; leur forme finale relève du lot de code, après validation de ces épreuves.
- Aucune de ces épreuves n'a été exécutée : l'état « ROUGE » de E1 est observé, ceux de E2 à E5 sont déduits de la lecture de l'outil et à confirmer par exécution quand elles seront écrites en code.
