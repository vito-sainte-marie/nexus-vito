// ÉPREUVE DE L'ÉCRAN PARAMÈTRES STATION — LES HORAIRES NE SONT PAS UNE
// DÉPENDANCE DES AUTRES RÉGLAGES. 16/09/2026, révisée le 03/10/2026.
//
// HISTOIRE. `station_config.horaires` était NOT NULL, et `station_config` n'a
// qu'une ligne par site. De là un réflexe : tout upsert de cet écran
// fournissait `horaires`, sans quoi la création de la ligne échouait (23502).
// La valeur venait d'abord d'un instantané mémoire pris UNE FOIS au chargement
// de la page : un onglet ouvert avant une correction d'horaires la défaisait
// au premier réglage touché (un prix, un identifiant Sheet), sans erreur. Le
// 16/09/2026, un relecteur `horairesPourEcriture` a remplacé l'instantané par
// une relecture juste avant chaque écriture — onze écritures.
//
// RÉVISION DU 03/10/2026. `20261003120000_station_config_horaires_nullable`
// a relâché la contrainte, sur Test (292) puis en Production (280), AVANT que
// le code cesse de fournir la colonne. `ON CONFLICT DO UPDATE` ne touche que
// les colonnes citées : une écriture qui ne cite pas `horaires` le laisse
// intact. La relecture n'avait plus d'objet — elle ne faisait que réécrire à
// l'identique une valeur lue un instant plus tôt, avec la même fenêtre de
// course qu'elle prétendait fermer. Le relecteur est retiré, et les onze
// écritures ne citent plus `horaires`. Les anciennes assertions « toute
// écriture fournit horaires » et « passe par le relecteur » encodaient la
// contrainte NOT NULL ; elles sont INVERSÉES, pas supprimées : le défaut
// d'origine (un réglage qui réécrit des horaires qu'il ne possède pas) reste
// exactement ce que cette épreuve refuse.
//
// CE QUE CETTE ÉPREUVE PEUT, ET CE QU'ELLE NE PEUT PAS. Elle n'ouvre aucune
// connexion et ne rend aucun DOM : elle lit le source. C'est une garde de
// forme, posée délibérément : le défaut EST une forme, et il reviendra par la
// même porte le jour où l'on ajoutera un réglage à cet écran.
'use strict';
const fs = require('fs');
const path = require('path');

const CHEMIN = path.join(__dirname, 'NEXUS-Parametres-Station-v1.html');
let ok = 0, ko = 0;
function verifier(libelle, condition) {
  if (condition) { ok++; console.log(`  ✓ ${libelle}`); }
  else { ko++; console.log(`  ✗ ${libelle}`); }
}

console.log('Paramètres Station — les horaires ne sont pas une dépendance des autres réglages\n');

const brut = fs.readFileSync(CHEMIN, 'utf8');

// Les commentaires de ce fichier CITENT les anciennes valeurs et le nom du
// cache, pour expliquer précisément ce qui a été corrigé. Une garde qui
// balaierait le fichier entier se déclencherait donc sur son propre récit.
// On ne lit ici que les lignes de code.
const src = brut.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');

// ─── 1. LE RELECTEUR A DISPARU ──────────────────────────────────────────────
verifier('plus aucun relecteur `horairesPourEcriture` n’est défini ni appelé',
  !/horairesPourEcriture\s*\(/.test(src));
verifier('plus aucune écriture ne se conditionne à une erreur de relecture d’horaires',
  !/errHoraires/.test(src));

// ─── 2. AUCUNE ÉCRITURE DE RÉGLAGE NE CITE `horaires` ───────────────────────
// On isole d'abord les objets réellement ÉCRITS dans station_config : la
// destructuration `const { horaires: x } = ...` a la même forme textuelle que
// le littéral qu'elle alimentait, et une garde qui cherche une forme trouve
// tout ce qui a cette forme.
const lignes = src.split('\n');
const ecrits = lignes
  .map((l, i) => ({ l, i }))
  .filter(({ l, i }) => /^\s*\{ site: /.test(l)
    && /from\('station_config'\)\.upsert\($/.test((lignes[i - 1] || '').trim()));

// Onze réglages, plus l'écran Horaires et « Réinitialiser » (section 3).
verifier('les écritures de réglages sont bien là où on les cherche', ecrits.length >= 13);

verifier('aucune écriture ne fournit `horaires: CONFIG_HORAIRES_ACTUEL` — la forme fautive a disparu',
  ecrits.every(({ l }) => !/horaires: CONFIG_HORAIRES_ACTUEL\b/.test(l)));

// Les seules écritures autorisées à citer `horaires` sont celles dont c'est
// l'objet : la saisie du formulaire et la réinitialisation (section 3).
const porteurs = ecrits.filter(({ l }) => /\bhoraires\s*:/.test(l));
verifier('seules les deux écritures propriétaires citent `horaires` (formulaire, réinitialisation)',
  porteurs.length === 2
  && porteurs.every(({ l }) => /\{ site: employee\.site_id, horaires: (config|HORAIRES_DEFAUT), updated_at:/.test(l)));

// Une écriture sur plusieurs lignes échapperait au filtre ci-dessus (qui ne lit
// que la ligne `{ site: ...`). Les deux relectures « cuves » et « rôle de
// réception » avaient précisément cette forme jusqu'au 03/10/2026.
verifier('aucune écriture ne relit un instantané de la ligne pour le réécrire',
  !/existant\s*&&\s*existant\.horaires/.test(src)
  && !/existant\s*\?\s*existant\.(prix|cuves)_carburants/.test(src)
  && !/select\('horaires,/.test(src));

// ─── 3. LES DEUX ÉCRITURES QUI ONT LE DROIT DE TOUCHER AUX HORAIRES ─────────
// L'écran Horaires lui-même, et le bouton « Réinitialiser ». Ceux-là écrivent
// des horaires parce que c'est leur objet — ils ne sont pas concernés.
// Cette assertion a exigé `fuseau_horaire: fuseauSelectionne` dans le même
// upsert jusqu'au 20/09/2026. Elle encodait le défaut : l'écran écrivait une
// colonne dépréciée qu'aucune fonction du jour métier ne lit plus. L'arbitrage
// du 20/09 a retiré cette écriture — le fuseau est désormais un paramètre
// structurel de créateur, lu dans `sites.timezone`. La garde reste donc, mais
// sur ce que cet écran a le droit d'écrire : les horaires, et rien d'autre.
verifier('l’écran Horaires écrit toujours ce que le formulaire porte',
  /\{ site: employee\.site_id, horaires: config, updated_at:/.test(src));
verifier('l’écran Horaires n’écrit plus la colonne dépréciée fuseau_horaire',
  !/fuseau_horaire:/.test(src));
verifier('le bouton « Réinitialiser » écrit toujours les valeurs par défaut',
  /\{ site: employee\.site_id, horaires: HORAIRES_DEFAUT/.test(src));

// ─── 4. CE QUE LE BOUTON « RÉINITIALISER » RESTAURE ─────────────────────────
// HORAIRES_DEFAUT n'est pas une fixture : c'est une valeur que l'écran ÉCRIT.
// Elle portait les fins de quart devinées avant l'arbitrage du 09/09/2026 —
// et, pour le quart 2, ni les valeurs devinées ni celles de Production. Le
// bouton ne restaurait donc pas ce qu'il annonçait restaurer.
const bloc = (src.match(/const HORAIRES_DEFAUT = \{[\s\S]*?\n  \};/) || [])[0] || '';
// `[^}]*` gourmand faisait lire 20:10 (fin_normal) pour `normal` : on exige
// le séparateur qui précède le champ, faute de quoi `normal` matche la fin de
// `fin_normal`.
const lire = (quart, champ) =>
  ((bloc.match(new RegExp(quart + ': \\{(?:[^}]*?,)?\\s*' + champ + ': "(\\d\\d:\\d\\d)"')) || [])[1]) || null;
const CANONIQUES = { q1fn: '13:15', q1fe: '14:15', q2fn: '20:10', q2fe: '22:10' };
const lu = { q1fn: lire('quart1', 'fin_normal'), q1fe: lire('quart1', 'fin_etendu'),
             q2fn: lire('quart2', 'fin_normal'), q2fe: lire('quart2', 'fin_etendu') };
verifier('les quatre fins de quart par défaut sont celles de l’arbitrage du 09/09/2026',
  Object.keys(CANONIQUES).every((k) => lu[k] === CANONIQUES[k]));

// Et elles sont cohérentes entre elles : les deux quarts se chevauchent de
// 35 min, et le quart 2 dure 7h30 en normal comme 8h30 en étendu. Recalculé
// ici plutôt que recopié — une faute de frappe ne peut pas passer deux fois.
const min = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const q2n = lire('quart2', 'normal'), q2e = lire('quart2', 'etendu');
verifier('le chevauchement des deux quarts est de 35 min, en normal comme en étendu',
  q2n && q2e && min(lu.q1fn) - min(q2n) === 35 && min(lu.q1fe) - min(q2e) === 35);
verifier('le quart 2 dure 7h30 en normal et 8h30 en étendu',
  q2n && q2e && min(lu.q2fn) - min(q2n) === 450 && min(lu.q2fe) - min(q2e) === 510);

console.log(`\n${ok} vérification(s) passée(s), ${ko} en échec.`);
console.log('Rappel : cette épreuve lit le source. Elle ne dit pas ce que porte la base,');
console.log('ni si le correctif d’horaires du 09/09/2026 a été appliqué en Production.');
process.exit(ko === 0 ? 0 : 1);
