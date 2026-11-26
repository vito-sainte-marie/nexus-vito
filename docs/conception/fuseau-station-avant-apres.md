# A3 — « aujourd'hui de la station » : avant / après

Jeu fictif : station en Martinique (UTC−4), instant 27/11/2026 00:30 UTC = **26/11/2026 20:30 locales**.
Avant : chaque lieu lisait `new Date().toISOString().slice(0,10)` ou `getDate()` machine → **2026-11-27**.
Après : `nexusAujourdhuiStation(siteId)` (fuseau `sites.timezone`, une seule primitive `nexusJourDansFuseau`) → **2026-11-26**. Fuseau introuvable : « indéterminé », jamais une date UTC.

| # | Lieu | Avant (UTC) | Après (station) |
|---|------|-------------|-----------------|
| 1 | Risques (fenêtres, `nexus-risques-donnees.js`) | fenêtre finissant le 27/11, un jour de trop | fin au 26/11 |
| 2 | Conseiller (rappel échu le 26/11) | « EN RETARD », rang 1 | « RAPPEL », rang 3 (mesuré par l'épreuve) |
| 3 | Tempo (`filtrerJoursClos`, données 25, 26, 27/11) | 26/11 compté « clos » | seul le 25/11 est clos (mesuré) |
| 4 | Projection A4 | jour courant = 27/11 | 26/11 |
| 5 | Rappels | échéance du jour jugée dépassée | échéance du jour = aujourd'hui |
| 6 | Coach FDJ | quart du 27/11 cherché | quart du 26/11 |
| 7 | Carburant et chargeur du Brief | relevé du 26/11 jugé « d'hier » | relevé du jour |
| 8 | Inventaire | alertes datées du 27/11 | alertes du 26/11 |

Épreuves : `test_fuseau_station_bascule_20261126.js` (20 h 30 locales, soir du 31 décembre, dernier jour d'un mois, 29 février, minuit local). Les lignes 2 et 3 sont mesurées ; les autres lieux appellent la même primitive.
