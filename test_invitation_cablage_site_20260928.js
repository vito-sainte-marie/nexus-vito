// CE QUE CE BANC MESURE : que l'accueil passe à l'invitation un site qui a
// une valeur AU MOMENT DE L'APPEL. Pas qu'il passe la bonne variable — qu'il
// passe une variable déjà affectée.
//
// POURQUOI IL EXISTE (28/09/2026). La carte d'invitation à l'inventaire est
// éprouvée deux fois : son moteur est pur et testé, sa fonction d'affichage
// est testée pièce à pièce. Les deux bancs sont verts. Et sur le rail, la
// carte n'a jamais rien affiché à personne : le site d'appel lui passait
// `SITE_HOME`, qui vaut `null` à cet instant — affecté uniquement dans
// `initPosteManager()`, appelée plus bas, et seulement pour un manager. Pour
// un employé, jamais. `afficherParticipationInventaire` se rangeait donc sur
// `indisponible` dès sa deuxième ligne, la recette rapportait « NON JUGÉE »,
// et rien ne rougissait.
//
// Prouver la fonction n'est pas prouver le câblage. Ce banc-ci ne teste pas
// ce que fait la carte : il teste qu'on l'a branchée.

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const HTML = fs.readFileSync(path.join(__dirname, 'NEXUS-App-v1.html'), 'utf8');
const SCRIPT = HTML.match(/<script>([\s\S]*)<\/script>/)[1];

// Le corps du bloc qui reçoit l'employé, et le nom sous lequel il le reçoit.
function blocAuth(src) {
  const m = src.match(/nexusRequireAuth\(\)\.then\(\s*(?:async\s*)?\(?([A-Za-z_$][\w$]*)\)?\s*=>\s*\{/);
  assert.ok(m, 'bloc nexusRequireAuth().then(...) introuvable');
  const debut = src.indexOf('{', m.index + m[0].length - 1);
  let prof = 1, j = debut + 1;
  while (prof > 0 && j < src.length) { if (src[j] === '{') prof++; else if (src[j] === '}') prof--; j++; }
  return { param: m[1], corps: src.slice(debut + 1, j - 1) };
}

// Le premier argument d'un appel, tel qu'il est écrit.
function premierArgument(corps, appel) {
  const i = corps.indexOf(appel + '(');
  if (i === -1) return { absent: true };
  const debut = i + appel.length + 1;
  let prof = 0, j = debut;
  while (j < corps.length) {
    const c = corps[j];
    if (c === '(') prof++;
    else if (c === ')') { if (prof === 0) break; prof--; }
    else if (c === ',' && prof === 0) break;
    j++;
  }
  return { texte: corps.slice(debut, j).trim(), position: i };
}

// LA MESURE. Une variable passée ici tient debout si elle est le paramètre du
// bloc (ou l'une de ses propriétés), ou si le bloc lui-même l'a affectée plus
// haut, à son niveau supérieur — pas dans une fonction déclarée ailleurs, pas
// dans une branche qui peut ne pas s'exécuter.
function siteTientDebout(src, appel) {
  const { param, corps } = blocAuth(src);
  const arg = premierArgument(corps, appel);
  if (arg.absent) return { ok: false, motif: `${appel} n'est pas appelée dans le bloc` };
  const racine = arg.texte.split(/[.\[\s(]/)[0];
  if (racine === param) return { ok: true, motif: `${arg.texte} — vient du bloc lui-même` };

  const re = new RegExp('^[ ]{4}' + racine + '\\s*=[^=]', 'm');
  const m = corps.match(re);
  if (!m) return { ok: false, motif: `${arg.texte} n'est jamais affectée dans le bloc avant l'appel` };
  if (m.index > arg.position) return { ok: false, motif: `${arg.texte} n'est affectée qu'APRÈS l'appel` };
  return { ok: true, motif: `${arg.texte} — affectée plus haut dans le bloc` };
}

let ok = 0;
const v = (nom, f) => { f(); console.log('  ✓ ' + nom); ok++; };

console.log('\nCÂBLAGE DE L\'INVITATION À L\'INVENTAIRE\n');

v('le site passé à la carte a une valeur au moment de l\'appel', () => {
  const r = siteTientDebout(SCRIPT, 'afficherParticipationInventaire');
  assert.ok(r.ok, 'site non défini à l\'appel : ' + r.motif);
});

v('le site passé au fuseau a une valeur au moment de l\'appel', () => {
  const r = siteTientDebout(SCRIPT, 'NexusStation.fuseauDeLaStation');
  assert.ok(r.ok, 'site non défini à l\'appel : ' + r.motif);
});

v('MUTATION : repasser SITE_HOME rend le banc ROUGE', () => {
  // Exactement l'état du rail au 28/09/2026. Si ce banc reste vert dessus, il
  // ne mesure rien et il faut le jeter.
  const mute = SCRIPT.split('employee.site_id)').join('SITE_HOME)')
                     .split('employee.site_id,').join('SITE_HOME,');
  assert.notStrictEqual(mute, SCRIPT, 'la mutation n\'a rien changé : elle ne prouve rien');
  const r = siteTientDebout(mute, 'afficherParticipationInventaire');
  assert.strictEqual(r.ok, false, 'le banc accepte SITE_HOME nul — il ne mesure pas le câblage');
});

v('CONTRE-TÉMOIN : SITE_HOME affectée plus haut serait ACCEPTÉE', () => {
  // Le banc ne récuse pas un nom, il récuse une variable sans valeur. Sans
  // cette vérification-ci, un banc qui refuserait tout ce qui s'appelle
  // SITE_HOME passerait pour une mesure.
  let mute = SCRIPT.split('employee.site_id)').join('SITE_HOME)')
                   .split('employee.site_id,').join('SITE_HOME,');
  mute = mute.replace('  nexusRequireAuth().then(async employee => {',
                      '  nexusRequireAuth().then(async employee => {\n    SITE_HOME = employee.site_id;');
  const r = siteTientDebout(mute, 'afficherParticipationInventaire');
  assert.strictEqual(r.ok, true, 'le banc refuse une variable pourtant affectée : ' + r.motif);
});

v('l\'invitation n\'est pas attendue — l\'accueil ne ralentit pas pour elle', () => {
  const { corps } = blocAuth(SCRIPT);
  const i = corps.indexOf('afficherParticipationInventaire(');
  const ligne = corps.lastIndexOf('\n', corps.lastIndexOf('NexusStation.fuseauDeLaStation', i));
  const extrait = corps.slice(ligne, i);
  assert.ok(!/await\s+NexusStation\.fuseauDeLaStation/.test(extrait),
    'la carte est attendue : une lecture lente retarderait tout l\'accueil');
});

console.log(`\n${ok}/${ok} vérifications passées — la carte est branchée sur un site qui existe.\n`);
