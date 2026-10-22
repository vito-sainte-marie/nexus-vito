# Amendement de la request-5 — nom d'envoi du jaugeage (JAUGEAGE-OCR-2-20261022)

Demande de Frédéric, 22/10/2026. Le texte de `request-5.md` n'est pas réécrit ; cet amendement le **remplace là où il le contredit**.

## Ce qui change
- **Plus de migration de politique.** Les points 7 et 8 de la request-5 (remplacement de `documents_a_traiter_jaugeage_pompiste`) sont **retirés**. La politique de stockage de `20261017120000` reste inchangée. Le « BLOQUANT » du constat est levé par ce choix, pas par une modification de la base.
- **L'identifiant reste dans le nom.** Le point 1 (« aucun identifiant d'employé dans le nom ») est abandonné. Le nom garde `emp.id` (égal à `auth.uid()` pour le pompiste, comme dans l'envoi actuel). Le gain de la request-5 est donc la **lisibilité** (site, date, heure de station, repère `nexus-jaug`) et l'unicité lisible, **non** l'anonymat du nom.

## Contrainte de la politique : le nom doit COMMENCER par la date et l'identifiant
La politique exige `storage.filename(name) like '____-__-__\_' || auth.uid()::text || '\_%'` : dix caractères de date, `_`, l'identifiant, `_`, puis n'importe quoi. Un nom `nexus-jaug_<site>_<date>_<HHhMM>_<uid>.jpg` (identifiant en fin) serait **refusé** par cette politique. Forme retenue, compatible :

`<AAAA-MM-JJ>_<uid>_nexus-jaug_<site>_<HHhMM>[-N].<ext>`
exemple : `2026-10-22_<uid>_nexus-jaug_vito-sainte-marie_15h22.jpg`

Le dossier `<site>/jaugeage_veeder_root/` et les extensions autorisées (jpg, jpeg, png, webp, heic) sont inchangés ; la date en tête garde le tri chronologique.

## Épreuve (remplace le point 5)
Motif : `^\d{4}-\d{2}-\d{2}_[0-9a-f-]{36}_nexus-jaug_[a-z0-9-]+_\d{2}h\d{2}(-\d+)?\.(jpg|png|webp|heic)$`, **et** vérification que le nom satisfait le prédicat `like` de la politique (reproduit dans l'épreuve) pour l'identifiant donné. Le reste est inchangé (heure de station, refus sans fuseau, suffixe `-2`, `-3`, extension réelle, dossier). Mutations : heure UTC, `emp.id` retiré ou déplacé en fin de nom (doit rougir le prédicat de politique), suffixe supprimé, extension forcée.

## Limites
Aucun code écrit ; aucune migration ; aucune écriture Production. Le changement reste soumis à l'arbitrage de la request-5 amendée.
