// Test — l'inventaire des migrations, et ce qu'une épreuve hors ligne peut
// honnêtement en dire (16/09/2026, lot 4)
//
// CONSTAT D'ORIGINE. Le 16/09/2026, 22 migrations étaient inscrites dans
// `supabase_migrations.schema_migrations` de Production sans qu'AUCUN fichier
// ne les porte dans le dépôt. Le dépôt ne reconstruisait donc pas le schéma
// réel, et rien ne le disait : la suite de non-régression n'ouvre aucune
// connexion, et l'empreinte d'artefact ne mesure que le dossier.
//
// CE QUE CE TEST NE PEUT PAS PROUVER — et il faut le lire avant le reste.
// Il n'ouvre aucune connexion. Il est donc INCAPABLE de détecter qu'une 23e
// migration a été appliquée hors bande. Prétendre le contraire serait une
// garde verte et inutile de plus. La comparaison dépôt ↔ base ne peut venir
// que de `outils/verifier-inventaire-migrations.sql`, lancé contre une vraie
// base.
//
// CE QU'IL PROUVE, ET QUI MORD. Deux choses, hors ligne :
//   1. la cohérence interne du dossier — un nom mal formé ou une version en
//      double produit une migration qui ne s'applique jamais, ou qui en
//      masque une autre ;
//   2. que l'outil de rapprochement reste capable de conclure. C'est là que
//      se joue le vrai risque : une liste d'absences assumées qui grossit en
//      silence, ou qui garde une entrée devenue fausse, transforme l'outil en
//      garde muette. Le cas « bidirectionnel » ci-dessous échoue donc AUSSI
//      quand une absence assumée retrouve son fichier sans être retirée de la
//      liste — exactement la symétrie du garde-fou de `tests.yml`. Une dette
//      se retire ; elle ne se périme pas toute seule.
//
// ─── CAMPAGNE DE MUTATION DU 16/09/2026 ────────────────────────────────────
// Défaut remis dans l'outil ou dans le dossier, épreuve rejouée. Sept
// mutations, sept mordues, aucune survivante :
//   fichier d'une absence assumée rapatrié sans nettoyer la liste → bidirectionnel
//   deux fichiers portant la même version                          → doublons
//   garde « dossier non lu » retirée de l'outil                    → conclure à vide
//   dette dégradée de `raise exception` en `raise notice`          → échoue vraiment
//   rapprochement fait sur le nom entier au lieu de la version     → renommage
//   `rollback` remplacé par `commit`                               → lecture seule
//   absence ajoutée à la liste sans motif                          → motif en clair
//
// Une huitième tentative a échoué AVANT d'être une mutation : la première
// écriture du cas « fichier non encore appliqué » visait à distance fixe et
// débordait sur le `raise exception` du bloc suivant, donc elle refusait un
// outil correct. Corrigée en visant le bloc `if … end if;` réel. Une garde mal
// visée est un défaut de la garde, pas du code qu'elle vise.

const fs = require('fs');
const path = require('path');

const RACINE = __dirname;
const DOSSIER = path.join(RACINE, 'supabase', 'migrations');
const OUTIL = path.join(RACINE, 'outils', 'verifier-inventaire-migrations.sql');

let ok = 0;
const echecs = [];
function verifier(libelle, condition) {
  if (condition) { ok++; console.log(`  ✓ ${libelle}`); }
  else { echecs.push(libelle); console.log(`  ✗ ${libelle}`); }
}

console.log('\nInventaire des migrations — cohérence du dossier\n');

const fichiers = fs.readdirSync(DOSSIER).filter(f => f.endsWith('.sql')).sort();
verifier(`le dossier contient des migrations (${fichiers.length})`, fichiers.length > 0);

// ── 1. Cohérence interne du dossier ────────────────────────────────────────
const FORME = /^(\d{14})_[a-z0-9_]+\.sql$/;
const malFormes = fichiers.filter(f => !FORME.test(f));
verifier('tous les noms suivent `<14 chiffres>_<libellé>.sql`',
  malFormes.length === 0 || (console.log(`      → ${malFormes.join(', ')}`), false));

const versions = fichiers.map(f => (f.match(FORME) || [])[1]).filter(Boolean);
const doublons = versions.filter((v, i) => versions.indexOf(v) !== i);
verifier('aucune version n’apparaît deux fois (une migration en masquerait une autre)',
  doublons.length === 0 || (console.log(`      → ${[...new Set(doublons)].join(', ')}`), false));

verifier('les versions sont strictement croissantes dans l’ordre alphabétique',
  versions.every((v, i) => i === 0 || v > versions[i - 1]));

// ── 2. L'outil de rapprochement reste capable de conclure ──────────────────
console.log('\nOutil de rapprochement dépôt ↔ base\n');

verifier('outils/verifier-inventaire-migrations.sql existe', fs.existsSync(OUTIL));
const sql = fs.existsSync(OUTIL) ? fs.readFileSync(OUTIL, 'utf8') : '';

verifier('il rapproche sur la VERSION, pas sur le nom entier (renommer un libellé ne doit pas se lire comme une absence)',
  /m\.version \|\| '\\_%'/.test(sql));

verifier('il refuse de conclure quand le dossier n’a pas été lu (lancé hors de la racine, un dossier vide se lirait comme une base sans dette)',
  /n_depot = 0 then[\s\S]{0,400}raise exception/.test(sql));

verifier('il échoue — et ne se contente pas d’un avertissement — quand une migration appliquée n’a aucun fichier',
  /if n_manque > 0 then[\s\S]{0,200}raise exception/.test(sql));

// Fenêtre resserrée au bloc `if … end if;` réel : une fenêtre à distance fixe
// débordait sur le `raise exception` du bloc SUIVANT et faisait échouer ce cas
// contre un outil pourtant correct. Une garde mal visée est un défaut de la
// garde, pas du code qu'elle vise.
const blocAttente = (sql.match(/if n_attente > 0 then([\s\S]*?)end if;/) || [])[1] || '';
verifier('il n’échoue PAS sur un fichier non encore appliqué (une migration peut légitimement attendre son déploiement)',
  /raise notice/.test(blocAttente) && !/raise exception/.test(blocAttente));

// Lecture seule. La séparation Test/Production ne tient que si un outil
// d'audit ne peut rien écrire, même lancé par erreur sur la mauvaise base.
verifier('il se termine par un ROLLBACK', /\nrollback;\s*$/.test(sql));
verifier('il ne contient aucun COMMIT', !sql.split('\n').some(l => l.trim() === 'commit;'));
const ecritures = [/\binsert\s+into\s+public\./i, /\bupdate\s+public\./i, /\bdelete\s+from\s+/i,
                   /\balter\s+table\s+public\./i, /\bgrant\s+/i, /\bdrop\s+table\s+public\./i];
verifier('il n’écrit rien et n’accorde aucun privilège',
  !ecritures.some(re => re.test(sql)));

// ── 3. La garde bidirectionnelle sur les absences assumées ─────────────────
console.log('\nAbsences assumées — la liste doit rester vraie\n');

const bloc = (sql.match(/ABSENCES_ASSUMEES text\[\] := array\[([^\]]*)\]/) || [])[1] || '';
const assumees = [...bloc.matchAll(/'(\d{14})'/g)].map(m => m[1]);
verifier(`la liste des absences assumées est lisible et bien formée (${assumees.length} entrée(s))`,
  bloc.trim().length === 0 || assumees.length > 0);

// Chaque entrée porte son motif, en clair, au-dessus de la liste. Une version
// nue n'apprend rien à qui la relira dans six mois.
const enTete = sql.slice(0, sql.indexOf('ABSENCES_ASSUMEES'));
for (const v of assumees) {
  const ligne = enTete.split('\n').find(l => l.includes(v) && l.trim().startsWith('--'));
  verifier(`${v} — l’absence porte son motif en clair`,
    !!ligne && ligne.replace(/[^a-zA-Zàâçéèêëîïôûùüÿœ]/g, '').length > 20);
}

// Le cas qui mord. Rapatrier le fichier d'une absence assumée sans retirer la
// version d'ici laisserait l'outil masquer, demain, une VRAIE absence portant
// ce numéro. La garde est donc stricte dans les deux sens, comme celle de
// `tests.yml` : réparer sans mettre la liste à jour est aussi une régression.
for (const v of assumees) {
  const trouve = fichiers.filter(f => f.startsWith(v + '_'));
  verifier(`${v} — toujours sans fichier au dépôt, l’exception reste justifiée${trouve.length ? ` (trouvé : ${trouve.join(', ')} — retirez la version d’ABSENCES_ASSUMEES)` : ''}`,
    trouve.length === 0);
}

console.log(`\nInventaire des migrations : ${ok}/${ok + echecs.length} vérifications passent.`);
console.log('Rappel : cette épreuve n’ouvre aucune connexion. Elle ne peut pas voir une migration appliquée hors bande —\nseul outils/verifier-inventaire-migrations.sql, lancé contre une vraie base, le peut.');
if (echecs.length) { console.error(`\n${echecs.length} échec(s) :\n  · ${echecs.join('\n  · ')}`); process.exit(1); }
