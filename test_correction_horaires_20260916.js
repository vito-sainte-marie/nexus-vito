// ÉPREUVE HORS LIGNE DU CORRECTIF D'HORAIRES — 16/09/2026.
//
// `outils/correction-horaires-production-a-executer-par-frederic.sql` est une
// écriture Production en attente depuis le 09/09/2026. Elle n'avait, jusqu'à
// aujourd'hui, aucun fichier au dépôt : elle ne vivait que sur des worktrees
// locaux, apportée par un commit jamais fusionné.
//
// CE QUE CETTE ÉPREUVE PEUT, ET CE QU'ELLE NE PEUT PAS. Elle n'ouvre aucune
// connexion : elle ne sait pas ce que porte la base, ni si le script a été
// exécuté. Elle vérifie deux choses, et deux seulement :
//   · que l'ARITHMÉTIQUE de l'arbitrage tombe juste — recalculée ici, sans
//     rien emprunter au SQL, de sorte qu'une faute de frappe dans l'une des
//     quatre valeurs écrites ne puisse pas passer ;
//   · que les GARDES promises par l'en-tête du fichier sont réellement dans
//     son corps. Un script Production dont l'en-tête promet plus que le corps
//     ne tient est pire qu'un script sans en-tête, parce qu'on le relit moins.
//
// Les gardes elles-mêmes ont été éprouvées CONTRE UNE VRAIE BASE (nexus-test,
// six cas, transactions annulées) — cette épreuve-là ne pouvait pas se figer
// dans un fichier hors ligne. Les deux sont nécessaires ; aucune ne remplace
// la lecture du fichier.
'use strict';
const fs = require('fs');
const path = require('path');

const CHEMIN = path.join(__dirname, 'outils', 'correction-horaires-production-a-executer-par-frederic.sql');
let ok = 0, ko = 0;
function verifier(libelle, condition) {
  if (condition) { ok++; console.log(`  ✓ ${libelle}`); }
  else { ko++; console.log(`  ✗ ${libelle}`); }
}

console.log('Correctif d’horaires canoniques — épreuve hors ligne\n');

const existe = fs.existsSync(CHEMIN);
verifier('le fichier est au dépôt (il ne l’était pas avant le 16/09/2026)', existe);
if (!existe) { console.log('\nRien d’autre n’est vérifiable.'); process.exit(1); }
const sql = fs.readFileSync(CHEMIN, 'utf8');

// ─── 1. L'ARITHMÉTIQUE, RECALCULÉE ICI ──────────────────────────────────────
// Les valeurs sont relues DANS le SQL, puis les durées recalculées en JS. Rien
// n'est recopié à la main : une faute de frappe dans le SQL fait tomber ce
// bloc, alors qu'une constante dupliquée ici la recopierait fidèlement.
const minutes = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };

// Le CODE seul, commentaires retirés. L'en-tête du fichier contient un bloc de
// retour arrière qui porte les ANCIENNES valeurs, et une fenêtre visant tout
// le fichier les capte en premier — elle jugerait alors l'arbitrage faux
// contre un script pourtant juste. Une garde mal visée est un défaut de la
// garde, pas du code qu'elle vise.
const code = sql.replace(/^\s*--.*$/gm, '');
function valeurEcrite(chemin) {
  const m = code.match(new RegExp(`'\\{${chemin}\\}',\\s*'"(\\d\\d:\\d\\d)"'`));
  return m ? m[1] : null;
}
const ECRIT = {
  q1_fin_normal: valeurEcrite('quart1,fin_normal'),
  q1_fin_etendu: valeurEcrite('quart1,fin_etendu'),
  q2_fin_normal: valeurEcrite('quart2,fin_normal'),
  q2_fin_etendu: valeurEcrite('quart2,fin_etendu'),
};
verifier('les quatre valeurs écrites sont lisibles dans l’`update`',
  Object.values(ECRIT).every(Boolean));

// Les débuts ne sont pas touchés par le script : ils sont ceux de la station.
// Relevés dans station_config le 16/09/2026, et inchangés depuis l'arbitrage —
// c'est ce qui rend le calcul ci-dessous vérifiable sans connexion. S'ils
// changeaient un jour, ces trois constantes seraient à relever de nouveau : ce
// test dirait alors faux, ce qui est le bon sens de l'erreur.
const DEBUTS = { q1: '05:45', q2_normal: '12:40', q2_etendu: '13:40' };

verifier('quart 1, dimanche à mercredi : 05:45 → fin = 7 h 30',
  minutes(ECRIT.q1_fin_normal) - minutes(DEBUTS.q1) === 450);
verifier('quart 1, jeudi à samedi : 05:45 → fin = 8 h 30',
  minutes(ECRIT.q1_fin_etendu) - minutes(DEBUTS.q1) === 510);
verifier('quart 2, dimanche à mercredi : 12:40 → fin = 7 h 30',
  minutes(ECRIT.q2_fin_normal) - minutes(DEBUTS.q2_normal) === 450);
verifier('quart 2, jeudi à samedi : 13:40 → fin = 8 h 30',
  minutes(ECRIT.q2_fin_etendu) - minutes(DEBUTS.q2_etendu) === 510);
verifier('chevauchement quart1/quart2, dimanche à mercredi = 35 min',
  minutes(ECRIT.q1_fin_normal) - minutes(DEBUTS.q2_normal) === 35);
verifier('chevauchement quart1/quart2, jeudi à samedi = 35 min',
  minutes(ECRIT.q1_fin_etendu) - minutes(DEBUTS.q2_etendu) === 35);
// La raison d'être de l'arbitrage, énoncée comme une propriété : les deux
// quarts durent le même temps. La configuration d'avant amputait le quart 1
// de trente minutes — c'est ce que la correction répare, et c'est ce que
// cette vérification empêche de re-casser sans s'en apercevoir.
verifier('les deux quarts durent exactement le même temps, chaque régime',
  minutes(ECRIT.q1_fin_normal) - minutes(DEBUTS.q1) === minutes(ECRIT.q2_fin_normal) - minutes(DEBUTS.q2_normal) &&
  minutes(ECRIT.q1_fin_etendu) - minutes(DEBUTS.q1) === minutes(ECRIT.q2_fin_etendu) - minutes(DEBUTS.q2_etendu));

// ─── 2. LES GARDES PROMISES SONT-ELLES LÀ ? ─────────────────────────────────
verifier('il s’arrête à la première erreur (`ON_ERROR_STOP`)', /\\set\s+ON_ERROR_STOP\s+on/.test(sql));
verifier('l’écriture est en transaction (`begin;`)', /^begin;$/m.test(sql));
verifier('la transaction se referme par un `commit;` final',
  sql.trim().endsWith('commit;'));

// LE point du durcissement : un contrôle après `commit` ne peut rien annuler.
const iControle = sql.indexOf("règle(s) d''horaire fausse(s) APRÈS écriture");
const iCommit = sql.lastIndexOf('\ncommit;');
verifier('le contrôle des durées s’exécute AVANT le `commit`, donc un écart annule l’écriture',
  iControle > 0 && iCommit > iControle);

// Une mutation a survécu au premier jet de cette épreuve : le contrôle dégradé
// de `raise exception` en `raise notice`. Il restait au bon endroit, avant le
// `commit`, et disait toujours la bonne chose — mais il ne l'annulait plus.
// Savoir QUAND une garde parle ne dit pas SI elle mord : il faut lire son verbe.
verifier('un écart d’horaire lève une EXCEPTION, pas un `notice` — sinon le `commit` passe malgré l’écart',
  /if n_faux > 0 then\s*\n\s*raise exception/.test(sql));

verifier('les durées sont CALCULÉES, pas récitées (`extract(epoch …)` puis comparaison)',
  /extract\(epoch from \(b::time - a::time\)\)/.test(sql) && /ecart <> REGLES\[r\]\[4\]::int/.test(sql));
verifier('les six règles d’horaire sont contrôlées', (sql.match(/^\s*\['/gm) || []).length === 6);

verifier('une ligne absente arrête tout (site renommé ou supprimé)',
  /if not found then[\s\S]{0,200}raise exception/.test(sql));
verifier('un `horaires` nul arrête tout, même si la colonne est NOT NULL aujourd’hui',
  /if h is null then[\s\S]{0,200}raise exception/.test(sql));
verifier('les huit chemins lus ou écrits sont vérifiés présents avant l’écriture',
  (sql.match(/'quart[12],(normal|etendu|fin_normal|fin_etendu)'/g) || []).length >= 8 &&
  /raise exception E'Chemin absent de station_config\.horaires/.test(sql));
verifier('`create_if_missing` est à false aux quatre `jsonb_set` — un chemin absent se signale, ne se fabrique pas',
  (code.match(/'"\d\d:\d\d"',\s*false\)/g) || []).length === 4);
verifier('un nombre de lignes autre que 1 annule (`get diagnostics … row_count`)',
  /get diagnostics\s+n_lignes\s*=\s*row_count/.test(sql) && /n_lignes <> 1[\s\S]{0,160}raise exception/.test(sql));
verifier('relancé sur une base déjà corrigée, il ne réécrit rien',
  /if etat = CIBLE then[\s\S]{0,300}raise notice[\s\S]{0,200}return;/.test(sql));
verifier('un état de départ tiers l’arrête — il n’écrase pas une décision plus récente',
  /if etat <> ATTENDU_AVANT then[\s\S]{0,200}raise exception/.test(sql));
verifier('l’état d’avant écriture est affiché en entier, pour que le retour arrière existe hors du commentaire',
  /AVANT ÉCRITURE[\s\S]{0,120}jsonb_pretty\(h\)/.test(sql));

// L'état de départ déclaré doit être celui que l'arbitrage a examiné le 09/09.
verifier('l’état de départ attendu est bien l’ancienne configuration (12:45 / 13:45 / 20:05 / 22:05)',
  /ATTENDU_AVANT[\s\S]{0,260}"12:45"[\s\S]{0,120}"13:45"[\s\S]{0,160}"20:05"[\s\S]{0,120}"22:05"/.test(sql));
verifier('le retour arrière documenté restaure ces mêmes quatre valeurs',
  /RETOUR ARRIÈRE[\s\S]{0,900}'"12:45"'[\s\S]{0,300}'"22:05"'/.test(sql));

// ─── 3. CE QU'IL NE DOIT SURTOUT PAS FAIRE ──────────────────────────────────
verifier('il ne vise que « vito-sainte-marie »',
  (sql.match(/where site = '([a-z-]+)'/g) || []).every((w) => w.includes('vito-sainte-marie')));
verifier('il ne supprime, ne tronque, ni ne modifie aucune structure',
  !/\b(drop|truncate|alter\s+table|delete\s+from)\b/i.test(sql.replace(/^--.*$/gm, '')));
verifier('il n’accorde aucun privilège',
  !/\b(grant|revoke|create\s+role|alter\s+role)\b/i.test(sql.replace(/^--.*$/gm, '')));

// Il est déclenché à la main, par Frédéric. Rien ne doit l'appeler tout seul.
const racine = fs.readdirSync(__dirname);
const appelants = racine
  .filter((f) => /\.(json|ya?ml|sh|js)$/.test(f))
  .concat(fs.readdirSync(path.join(__dirname, '.github', 'workflows')).map((f) => path.join('.github/workflows', f)))
  .filter((f) => {
    try { return fs.readFileSync(path.join(__dirname, f), 'utf8').includes('correction-horaires-production'); }
    catch { return false; }
  })
  .filter((f) => path.basename(f) !== path.basename(__filename));
verifier('aucun script ni workflow ne l’exécute automatiquement — c’est un geste humain',
  appelants.length === 0);

// ─── 4. LES FIXTURES QUI COPIENT LA STATION ─────────────────────────────────
// Deux simulations figent ces horaires en dur. Elles n'ouvrent aucune
// connexion : elles resteraient vertes en simulant une station qui n'existe
// plus. Elles doivent donc copier l'UN des deux états — celui d'avant tant que
// l'écriture n'a pas eu lieu, celui d'après une fois qu'elle a eu lieu — mais
// jamais un troisième, ni un mélange des deux.
const AVANT = { fin_normal: '12:45', fin_etendu: '13:45', q2_fin_normal: '20:05', q2_fin_etendu: '22:05' };
const APRES = { fin_normal: ECRIT.q1_fin_normal, fin_etendu: ECRIT.q1_fin_etendu,
                q2_fin_normal: ECRIT.q2_fin_normal, q2_fin_etendu: ECRIT.q2_fin_etendu };
for (const f of ['simulations/scenarios-carburant.js', 'simulations/executer-ventilation.js']) {
  const src = fs.readFileSync(path.join(__dirname, f), 'utf8');
  const lu = {
    fin_normal: (src.match(/quart1:[^}]*fin_normal: '(\d\d:\d\d)'/) || [])[1],
    fin_etendu: (src.match(/quart1:[^}]*fin_etendu: '(\d\d:\d\d)'/) || [])[1],
    q2_fin_normal: (src.match(/quart2:[^}]*fin_normal: '(\d\d:\d\d)'/) || [])[1],
    q2_fin_etendu: (src.match(/quart2:[^}]*fin_etendu: '(\d\d:\d\d)'/) || [])[1],
  };
  const egal = (ref) => Object.keys(ref).every((k) => lu[k] === ref[k]);
  verifier(`${f} copie un état cohérent de la station (celui d’avant l’écriture, ou celui d’après — pas un mélange)`,
    egal(AVANT) || egal(APRES));
}

console.log(`\n${ok} vérification(s) passée(s), ${ko} en échec.`);
console.log('Rappel : cette épreuve n’ouvre aucune connexion. Elle ne peut pas dire si le');
console.log('correctif a été appliqué en Production — seule une lecture de station_config le peut.');
process.exit(ko === 0 ? 0 : 1);
