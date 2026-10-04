// Test — Vague 1 FDJ : les deux invariants d'écriture que la suite statique
// n'avait pas su voir (17/09/2026).
//
// POURQUOI CE FICHIER EXISTE
//
// Les trois tests FDJ existants lisent du TEXTE. L'un d'eux le dit lui-même :
// « ce contrôle lit du texte, il n'exécute pas la fonction. Il constate une
// intention, pas un refus. » La suite complète était verte — 202/209, les
// sept échecs connus — alors que deux défauts rendaient le cycle de caisse
// inutilisable, l'un d'eux bloquant :
//
//   n°1 — un refus qui détruit. fdj_ecrire_saisies_caisse écrasait sans
//         condition les deux lignes fdj_reports. Comme elle est appelée AVANT
//         le contrôle de complétude de fdj_confirmer_caisse, et que ce
//         contrôle refuse par un `return` (sans annuler la transaction), une
//         confirmation incomplète effaçait les montants du brouillon puis
//         rendait un refus : un refus qui détruisait la saisie qu'il
//         reprochait d'être incomplète.
//   n°2 — une contrainte qui interdit la naissance. La CHECK sur
//         (version_avant, version_apres) n'admettait que (null, null) et
//         (n, m). Or la confirmation initiale insère (null, 1) : il n'existe
//         aucune version antérieure. Toute confirmation levait 23514.
//
// Les deux ont été trouvés en EXÉCUTANT le cycle sur nexus-test, jamais en le
// lisant. La CI, elle, n'a pas de base : elle ne référence aucun secret et
// aucun test n'ouvre de connexion réseau (c'est écrit dans tests.yml, et c'est
// une propriété à préserver). Une garde utilisable ici ne peut donc pas parler
// à Supabase.
//
// Elle peut en revanche cesser de LIRE le SQL pour l'INTERPRÉTER : traduire la
// contrainte CHECK réellement écrite dans la migration en un prédicat, en
// extraire les couples de versions réellement insérés par les commandes, et
// confronter les uns aux autres. C'est ce que fait la partie A. La partie B
// fait l'équivalent pour la règle « NULL = non fourni, jamais efface ».
//
// ET SURTOUT — chaque partie porte SA PROPRE MUTATION. Une garde verte ne
// prouve rien tant qu'on n'a pas vu ce qui la fait rougir : les deux
// vérifications sont donc rejouées ici sur le texte muté (la contrainte
// d'avant correction, la fonction d'avant correction), et le test échoue si
// cette version fautive passait. C'est la leçon des quatre gardes vertes et
// inutiles du 08/09 : la détection statique se contente de trop peu.
//
// La preuve EXÉCUTÉE, elle, vit dans supabase/recette-vague1/, jouée à la main
// sur nexus-test en transaction annulée. Ce fichier ne la remplace pas : il
// garantit que les deux défauts précis qu'elle a révélés ne peuvent pas
// revenir sans que la CI le dise.

const fs = require('fs');
const assert = require('assert');

const M = __dirname + '/supabase/migrations/';
const sqlJournal = fs.readFileSync(M + '20260916220200_fdj_caisse_journal_evenements.sql', 'utf8');
const FICHIERS_COMMANDES = [
  '20260916220600_fdj_commandes_caisse_employe.sql',
  '20260916220700_fdj_commandes_caisse_manager.sql',
];

// Un commentaire qui décrit la règle ne doit jamais faire passer le test à la
// place du code qui l'applique.
const sansCommentaires = (s) => s.split('\n').map(l => {
  const i = l.indexOf('--');
  return i === -1 ? l : l.slice(0, i);
}).join('\n');

// ════════════════════════════════════════════════════════════════════
// A) La contrainte de versions accepte-t-elle ce que les commandes
//    insèrent RÉELLEMENT ?
// ════════════════════════════════════════════════════════════════════

// A1. La contrainte, traduite en prédicat.
//
// Traduction mécanique et volontairement étroite : tout ce qui n'entre pas
// dans ce vocabulaire fait échouer le test plutôt que de produire un prédicat
// approximatif. Une contrainte devenue intraduisible est une contrainte qu'il
// faut relire à la main, pas une contrainte à ignorer.
function contrainteVersions(sql) {
  const debut = sql.indexOf('constraint fdj_caisse_evenements_versions_check check (');
  assert.ok(debut !== -1, 'La contrainte fdj_caisse_evenements_versions_check doit exister');
  let i = sql.indexOf('(', sql.indexOf('check (', debut) + 6);
  let profondeur = 1, j = i + 1;
  while (profondeur > 0) {
    if (sql[j] === '(') profondeur++;
    else if (sql[j] === ')') profondeur--;
    j++;
  }
  return sansCommentaires(sql.slice(i + 1, j - 1)).replace(/\s+/g, ' ').trim();
}

function traduire(expr) {
  let js = expr
    .replace(/\bversion_avant is not null\b/g, '(version_avant !== null)')
    .replace(/\bversion_apres is not null\b/g, '(version_apres !== null)')
    .replace(/\bversion_avant is null\b/g, '(version_avant === null)')
    .replace(/\bversion_apres is null\b/g, '(version_apres === null)')
    .replace(/\bevenement = '([a-z_]+)'/g, "(evenement === '$1')")
    .replace(/\band\b/g, '&&')
    .replace(/\bor\b/g, '||');
  assert.ok(/^[\s()!&|=<>'a-z_0-9.]+$/.test(js),
    'La contrainte de versions contient une construction que ce test ne sait pas traduire :\n  '
    + expr + '\n→ relire la contrainte à la main et étendre la traduction, ne pas la contourner.');
  assert.ok(!/\bis\b|\bnot\b|\bnull\b(?!\))/.test(js.replace(/=== null|!== null/g, '')),
    'Un « is / not / null » non traduit subsiste : ' + js);
  // eslint-disable-next-line no-new-func
  return new Function('version_avant', 'version_apres', 'evenement', 'return (' + js + ');');
}

// A2. Ce que les commandes insèrent réellement.
//
// On apparie colonnes et valeurs par position, en découpant au seul niveau 0
// de parenthèses : un jsonb_build_object(...) ou un case ... end compte pour
// une valeur, pas pour dix.
function decouper(liste) {
  const parts = [];
  let profondeur = 0, courant = '', enChaine = false;
  for (let k = 0; k < liste.length; k++) {
    const c = liste[k];
    if (enChaine) { courant += c; if (c === "'") enChaine = false; continue; }
    if (c === "'") { enChaine = true; courant += c; continue; }
    if (c === '(') profondeur++;
    if (c === ')') profondeur--;
    if (c === ',' && profondeur === 0) { parts.push(courant.trim()); courant = ''; continue; }
    courant += c;
  }
  if (courant.trim()) parts.push(courant.trim());
  return parts;
}

function insertsJournal(sql, fichier) {
  const res = [];
  const marqueur = 'insert into public.fdj_caisse_evenements (';
  let pos = 0;
  while ((pos = sql.indexOf(marqueur, pos)) !== -1) {
    const ouvre = pos + marqueur.length - 1;
    let profondeur = 1, j = ouvre + 1;
    while (profondeur > 0) { if (sql[j] === '(') profondeur++; else if (sql[j] === ')') profondeur--; j++; }
    const colonnes = decouper(sql.slice(ouvre + 1, j - 1)).map(c => c.trim());

    const iValues = sql.indexOf('values (', j);
    assert.ok(iValues !== -1, `insert sans values dans ${fichier}`);
    const ouvreV = iValues + 'values '.length;
    profondeur = 1; let k = ouvreV + 1;
    let enChaine = false;
    while (profondeur > 0) {
      const c = sql[k];
      if (enChaine) { if (c === "'") enChaine = false; }
      else if (c === "'") enChaine = true;
      else if (c === '(') profondeur++;
      else if (c === ')') profondeur--;
      k++;
    }
    const valeurs = decouper(sql.slice(ouvreV + 1, k - 1));
    assert.strictEqual(valeurs.length, colonnes.length,
      `${fichier} : ${colonnes.length} colonnes pour ${valeurs.length} valeurs — appariement impossible`);

    const par = {};
    colonnes.forEach((c, n) => { par[c] = valeurs[n]; });
    // La ligne du fichier, pour que l'échec dise où regarder.
    const ligne = sql.slice(0, pos).split('\n').length;
    res.push({ fichier, ligne, par });
    pos = k;
  }
  return res;
}

// A3. Valuation symbolique des expressions de version.
//    `null` est null ; un littéral vaut ce qu'il dit ; une expression de
//    version courante vaut une même valeur arbitraire ; « + 1 » l'incrémente.
//    Aucune des trois formes réellement utilisées n'échappe à ce modèle.
const VERSION_COURANTE = 7;
function valuer(expr, fichier, ligne) {
  const e = expr.trim();
  if (/^null$/i.test(e)) return null;
  if (/^\d+$/.test(e)) return Number(e);
  const m = e.match(/^([a-z_]+\.[a-z_]+)\s*\+\s*(\d+)$/i);
  if (m) return VERSION_COURANTE + Number(m[2]);
  if (/^[a-z_]+\.[a-z_]+$/i.test(e)) return VERSION_COURANTE;
  assert.fail(`${fichier}:${ligne} — expression de version non modélisée : « ${e} ». `
    + 'Étendre la valuation plutôt que d\'élargir la contrainte au hasard.');
}

const predicat = traduire(contrainteVersions(sqlJournal));

const inserts = [];
for (const f of FICHIERS_COMMANDES) {
  inserts.push(...insertsJournal(sansCommentaires(fs.readFileSync(M + f, 'utf8')), f));
}
assert.ok(inserts.length >= 7,
  `Seulement ${inserts.length} écritures du journal trouvées : la Vague 1 en compte sept. `
  + 'Un événement du cycle a disparu, ou l\'extraction ne le reconnaît plus.');

const echantillons = [];
for (const ins of inserts) {
  const ev = (ins.par.evenement || '').replace(/'/g, '').trim();
  assert.ok(ev, `${ins.fichier}:${ins.ligne} — insert du journal sans événement littéral`);
  const avant = valuer(ins.par.version_avant, ins.fichier, ins.ligne);
  const apres = valuer(ins.par.version_apres, ins.fichier, ins.ligne);
  echantillons.push({ ev, avant, apres, ou: `${ins.fichier}:${ins.ligne}` });
  assert.ok(predicat(avant, apres, ev),
    `${ins.ou || ins.fichier + ':' + ins.ligne} — l'événement « ${ev} » insère `
    + `(version_avant=${avant}, version_apres=${apres}), que la contrainte `
    + 'fdj_caisse_evenements_versions_check REFUSE. La base lèverait 23514 à l\'exécution. '
    + 'C\'est exactement le défaut n°2 du 17/09/2026.');
}
console.log(`OK — les ${inserts.length} écritures du journal satisfont la contrainte de versions.`);

// A4. La mutation — sans elle, tout ce qui précède pourrait être vide de sens.
//     On rejoue la contrainte telle qu'elle était AVANT correction : deux
//     branches, pas trois. Au moins un insert réel doit alors être refusé.
const contrainteFautive = '(version_avant is null and version_apres is null)'
  + ' or (version_avant is not null and version_apres is not null and version_apres >= version_avant)';
const predicatFautif = traduire(contrainteFautive);
const refuses = echantillons.filter(e => !predicatFautif(e.avant, e.apres, e.ev));
assert.ok(refuses.length > 0,
  'MUTATION NON DÉTECTÉE : la contrainte d\'avant correction accepte tout ce que les commandes '
  + 'insèrent. Ce contrôle ne mord donc rien — il faut le réécrire, pas s\'en réjouir.');
assert.ok(refuses.some(e => e.ev === 'confirmation_initiale'),
  'La mutation doit se faire prendre sur confirmation_initiale, l\'unique naissance d\'une caisse');
console.log(`OK — mutation détectée : la contrainte d'avant correction refusait ${refuses.length} écriture(s), `
  + `dont « ${refuses[0].ev} ».`);

// A5. Le vocabulaire déclaré et le vocabulaire écrit sont le même.
//     Un événement déclaré que personne n'écrit est une intention morte ;
//     un événement écrit qui n'est pas déclaré ne s'insérerait jamais.
const iVoc = sqlJournal.indexOf('constraint fdj_caisse_evenements_evenement_check check (evenement in (');
assert.ok(iVoc !== -1, 'La contrainte de vocabulaire des événements doit exister');
const declares = new Set(
  sqlJournal.slice(iVoc, sqlJournal.indexOf('))', iVoc)).match(/'[a-z_]+'/g).map(s => s.replace(/'/g, '')));
const ecrits = new Set(echantillons.map(e => e.ev));
for (const ev of ecrits) {
  assert.ok(declares.has(ev), `L'événement « ${ev} » est écrit mais absent du vocabulaire déclaré`);
}
for (const ev of declares) {
  assert.ok(ecrits.has(ev), `L'événement « ${ev} » est déclaré mais aucune commande ne l'écrit`);
}
console.log(`OK — ${declares.size} événements déclarés, ${ecrits.size} écrits, aucun orphelin des deux côtés.`);

// ════════════════════════════════════════════════════════════════════
// B) « NULL veut dire non fourni, jamais efface ce qui est enregistré »
// ════════════════════════════════════════════════════════════════════
//
// La règle n'est pas décorative : fdj_ecrire_saisies_caisse s'exécute avant le
// contrôle de complétude de la confirmation, et ce contrôle refuse SANS
// annuler la transaction. Une écriture non gardée y devient donc une
// destruction sur le chemin du refus.

const sqlEmploye = sansCommentaires(fs.readFileSync(M + FICHIERS_COMMANDES[0], 'utf8'));

function corps(sql, nom) {
  const debut = sql.indexOf(`create or replace function public.${nom}`);
  assert.ok(debut !== -1, `Fonction ${nom} introuvable`);
  const fin = sql.indexOf('\n$$;', debut);
  assert.ok(fin !== -1, `Fin de ${nom} introuvable`);
  return sql.slice(debut, fin);
}

// Écritures non gardées : on empile les conditions des `if ... then` ouverts et
// on regarde, à chaque écriture, ce qui la protège.
function ecrituresNonGardees(source) {
  const lignes = source.split('\n');
  const pile = [];
  const nues = [];
  lignes.forEach((l, n) => {
    const t = l.trim();
    if (/^(if|elsif)\b.*\bthen$/.test(t)) { pile.push(t); return; }
    if (/^end if;/.test(t)) { pile.pop(); return; }
    if (/^else$/.test(t)) { if (pile.length) pile[pile.length - 1] = 'else'; return; }
    if (/^(insert into|update)\s+public\./.test(t)) {
      const garde = pile.some(c => /\bp_[a-z_]+ is not null\b/.test(c));
      if (!garde) nues.push({ ligne: n + 1, texte: t.slice(0, 70), pile: pile.slice() });
    }
  });
  return nues;
}

const srcEcrire = corps(sqlEmploye, 'fdj_ecrire_saisies_caisse');
const nues = ecrituresNonGardees(srcEcrire);
assert.deepStrictEqual(nues.map(x => x.texte), [],
  'fdj_ecrire_saisies_caisse écrit sans vérifier que le paramètre a été fourni :\n'
  + nues.map(x => `  ligne ${x.ligne} — ${x.texte}`).join('\n')
  + '\nUn paramètre NULL signifie « non fourni », jamais « efface ce qui est enregistré » — '
  + 'c\'est déjà la règle de fdj_corriger_caisse_confirmee, et deux commandes sœurs ne peuvent '
  + 'pas donner deux sens opposés au même NULL (Article 11). C\'est le défaut n°1 du 17/09/2026.');

// Chaque écriture de fdj_reports est gardée par LE paramètre qu'elle écrit —
// une garde portant sur un autre champ serait verte et inutile.
for (const [param, colonne] of [['p_lots_payes_grattage', 'lots_payes_grattage'],
                                ['p_caisse_tirages', 'caisse_tirages']]) {
  const re = new RegExp(`if ${param} is not null then[\\s\\S]{0,600}?${colonne}\\s*=\\s*excluded\\.${colonne}`);
  assert.ok(re.test(srcEcrire),
    `L'écriture de ${colonne} doit être gardée par « if ${param} is not null then » — `
    + 'et par celui-là, pas par un autre paramètre.');
}
console.log('OK — fdj_ecrire_saisies_caisse : aucune écriture non gardée, chaque garde porte sur son propre paramètre.');

// B2. La mutation, là encore. On retire les deux gardes du texte et on vérifie
//     que le contrôle les réclame.
const srcMute = srcEcrire
  .replace(/^\s*if p_lots_payes_grattage is not null then$/m, '')
  .replace(/^\s*if p_caisse_tirages is not null then$/m, '');
const nuesMutees = ecrituresNonGardees(srcMute);
assert.ok(nuesMutees.length >= 2,
  'MUTATION NON DÉTECTÉE : la version d\'avant correction — celle qui effaçait les montants du '
  + 'brouillon sur le chemin du refus — passerait ce contrôle. Le contrôle est donc inutile.');
console.log(`OK — mutation détectée : sans ses gardes, la fonction exposerait ${nuesMutees.length} écritures nues.`);

// B3. La règle a une conséquence assumée, écrite ici pour qu'on ne la
//     redécouvre pas comme un bug : un employé ne peut plus VIDER un champ
//     déjà enregistré, seulement le remplacer. Le front n'offre pas ce geste
//     — il envoie toujours les six clés (chargeUtileCaisse).
const htmlFront = fs.readFileSync(__dirname + '/NEXUS-FDJ-v1.html', 'utf8');
const iCharge = htmlFront.indexOf('function chargeUtileCaisse(');
assert.ok(iCharge !== -1, 'chargeUtileCaisse() doit exister dans NEXUS-FDJ-v1.html');
const charge = htmlFront.slice(iCharge, htmlFront.indexOf('}', htmlFront.indexOf('return {', iCharge)));
for (const cle of ['p_shift_id', 'p_comptages', 'p_lots_payes_grattage', 'p_caisse_tirages',
                   'p_caisse_reelle', 'p_regularisations']) {
  assert.ok(charge.includes(cle),
    `chargeUtileCaisse() doit envoyer ${cle} : avec « NULL = non fourni », une clé omise `
    + 'ne serait pas une valeur vide mais une valeur inchangée.');
}
console.log('OK — le front envoie les six clés : la sémantique « NULL = non fourni » ne lui coûte rien.');

console.log('Tous les invariants d\'écriture de la Vague 1 FDJ passent, mutations comprises.');
