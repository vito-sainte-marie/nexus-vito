// ÉPREUVE DE L'ÉCRAN PARAMÈTRES STATION — LES HORAIRES NE SONT PAS UNE
// DÉPENDANCE DES AUTRES RÉGLAGES. 16/09/2026.
//
// `station_config.horaires` est NOT NULL, et `station_config` n'a qu'une
// ligne par site. De ces deux faits est né un réflexe : tout upsert de cet
// écran fournissait `horaires`, sans quoi la création de la ligne échouait
// (23502). Le réflexe était juste ; sa mise en œuvre ne l'était pas. La
// valeur fournie venait d'un instantané mémoire pris UNE FOIS au chargement
// de la page, et huit réglages sans rapport la réécrivaient.
//
// LE DÉFAUT N'EST PAS VISIBLE TANT QUE PERSONNE NE MODIFIE LES HORAIRES
// AILLEURS. Il le devient le jour où quelqu'un le fait — depuis un autre
// appareil, ou par une écriture appliquée directement en base. Un onglet
// Paramètres ouvert AVANT ce changement rétablit alors l'ancienne valeur au
// premier réglage touché : un prix de carburant, un identifiant Google
// Sheet. Aucune erreur, aucun message, et un geste sans le moindre rapport
// visible avec les horaires.
//
// CE QUE CETTE ÉPREUVE PEUT, ET CE QU'ELLE NE PEUT PAS. Elle n'ouvre aucune
// connexion et ne rend aucun DOM : elle lit le source. Elle ne dit donc pas
// que l'écran fonctionne — elle dit qu'aucune écriture de réglage ne prend
// `horaires` dans un cache. C'est une garde de forme, et elle est posée
// ainsi délibérément : le défaut EST une forme, et il reviendra par la même
// porte, le jour où l'on ajoutera un neuvième réglage à cet écran.
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
// C'est une erreur déjà commise deux fois sur ce dépôt : on ne lit ici que
// les lignes de code.
const src = brut.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');

// ─── 1. LE RELECTEUR EXISTE, ET IL RELIT VRAIMENT LA BASE ───────────────────
const corps = (src.match(/async function horairesPourEcriture\(site\) \{[\s\S]*?\n  \}/) || [])[0] || '';
verifier('un relecteur `horairesPourEcriture(site)` est défini', corps.length > 0);
verifier('il lit `horaires` dans station_config pour CE site — il n’invente pas la valeur',
  /from\('station_config'\)\.select\('horaires'\)\.eq\('site', site\)/.test(corps));

// Le verbe, pas la place. Une première version de cette épreuve n'aurait
// vérifié que la présence du `if (error)`. Or c'est précisément le repli
// silencieux sur le cache qui EST le défaut : un relecteur qui, ne pouvant
// pas lire, écrirait quand même l'instantané mémoire ne corrigerait rien du
// tout — il déplacerait le défaut d'une ligne.
const brancheErreur = (corps.match(/if \(error\)[^\n]*/) || [])[0] || '';
verifier('lecture impossible ⇒ le relecteur rend l’erreur et n’écrit rien',
  /return \{ error \}/.test(brancheErreur));
verifier('lecture impossible ⇒ il ne se rabat PAS sur le cache mémoire',
  brancheErreur.length > 0 && !/CONFIG_HORAIRES_ACTUEL/.test(brancheErreur));

// Le repli sur le cache subsiste — mais seulement là où il est légitime :
// la ligne station_config n'existe pas encore pour ce site, cas qui a motivé
// ce champ. `data` absent, pas `error`.
verifier('le repli sur le cache ne sert plus qu’à la création de la ligne (aucune ligne lue)',
  /return \{ horaires: \(data && data\.horaires\) \|\| CONFIG_HORAIRES_ACTUEL \}/.test(corps));

// ─── 2. PLUS AUCUNE ÉCRITURE DE RÉGLAGE NE PUISE DANS LE CACHE ──────────────
// On isole d'abord les objets réellement ÉCRITS dans station_config. Une
// première version de cette épreuve balayait le fichier entier et comptait
// seize écritures là où il y en a huit : en JavaScript, la destructuration
// `const { horaires: horairesFrais } = ...` a exactement la même forme
// textuelle que le littéral `{ ..., horaires: horairesFrais, ... }` qu'elle
// alimente. Une garde qui cherche une forme trouve tout ce qui a cette
// forme, y compris ce qui ne l'écrit pas.
const lignes = src.split('\n');
const ecrits = lignes
  .map((l, i) => ({ l, i }))
  .filter(({ l, i }) => /^\s*\{ site: /.test(l)
    && /from\('station_config'\)\.upsert\($/.test((lignes[i - 1] || '').trim()));

verifier('les onze écritures de réglages sont bien là où on les cherche', ecrits.length >= 11);

// La garde qui compte, et la seule qui tiendra dans le temps : elle vise la
// forme fautive elle-même, pas les huit endroits où elle se trouvait. Un
// neuvième réglage ajouté demain avec le même réflexe la fera tomber.
verifier('aucune écriture ne fournit `horaires: CONFIG_HORAIRES_ACTUEL` — la forme fautive a disparu',
  ecrits.every(({ l }) => !/horaires: CONFIG_HORAIRES_ACTUEL\b/.test(l)));

// La colonne est NOT NULL et la ligne peut ne pas exister : une écriture qui
// omettrait `horaires` échouerait en 23502 sur un site neuf. C'est le réflexe
// d'origine, et il reste juste — c'est sa source qui était fausse.
//
// Cette garde-ci a mordu la première fois qu'elle a été posée : TROIS
// écritures de l'onglet Réception (config, consignes, contact manager)
// n'avaient jamais fourni `horaires`. C'est le défaut symétrique de celui
// qui a motivé cette épreuve — là où huit écritures livraient une valeur
// périmée, trois n'en livraient aucune — et il ne se serait vu que sur un
// site neuf, c'est-à-dire le jour où NEXUS en aurait eu un second.
verifier('toute écriture fournit `horaires` — la colonne est NOT NULL, le réflexe d’origine était juste',
  ecrits.every(({ l }) => /horaires: /.test(l)));

const appels = (src.match(/await horairesPourEcriture\(/g) || []).length;
const frais = ecrits.filter(({ l }) => /horaires: horairesFrais\b/.test(l)).length;
verifier('les onze écritures de réglages passent par le relecteur', appels === 11 && frais === 11);

// Chaque écriture doit être précédée de SON appel, et non d'un appel lointain :
// la valeur doit être fraîche à l'instant de l'écriture, sinon on a recréé un
// cache, simplement plus court.
const orphelins = ecrits.filter(({ l, i }) =>
  /horaires: horairesFrais\b/.test(l)
  && !/await horairesPourEcriture\(/.test(lignes.slice(Math.max(0, i - 3), i).join('\n'))).length;
verifier('la relecture précède immédiatement l’écriture qui l’utilise', orphelins === 0);

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
