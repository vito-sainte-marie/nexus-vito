// invoices.methode_identification admet 'nom_decenium' — 06/10/2026.
// Le worker du dossier surveillé (iMac) écrit cette valeur quand seule la
// raison sociale Decenium exacte désigne un compte unique ; le CHECK de
// 20260807032033 la refusait (23514) et le worker retentait sans fin.
//
// Ce que ce test garde, sans base de données :
//   - la migration 20261006220000 ajoute 'nom_decenium' et garde les 7 valeurs
//     historiques, ni plus ni moins (élargissement seul) ;
//   - elle refuse de s'appliquer si la contrainte en place n'est pas
//     exactement celle de 20260807032033 (base dérivée ou rejeu) ;
//   - elle ne touche ni donnée ni privilège, et tient dans une transaction ;
//   - la migration d'origine 20260807032033 n'a pas été réécrite.
//
// Les scénarios exécutés contre PostgreSQL vivent dans
// outils/epreuve-invoices-nom-decenium-20261006/ (conteneur jetable).
//
// Preuve que chaque garde mord : chaque contrôle est rejoué sur une copie
// mutée en mémoire de la source qu'il protège (ancre exigée unique avant
// mutation) et doit alors échouer. Aucun fichier n'est modifié.

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const FICHIERS = {
  migration: 'supabase/migrations/20261006220000_invoices_methode_identification_nom_decenium.sql',
  origine: 'supabase/migrations/20260807032033_creer_module_comptes_clients.sql',
};
const SOURCES = {};
for (const [cle, f] of Object.entries(FICHIERS)) SOURCES[cle] = fs.readFileSync(path.join(__dirname, f), 'utf8');

const HISTORIQUES = ['code_client', 'raison_sociale', 'siret', 'contenu', 'email', 'historique', 'manuel'];

function sansCommentaires(texte) {
  return texte.split('\n').map(l => { const i = l.indexOf('--'); return i >= 0 ? l.slice(0, i) : l; }).join('\n');
}

// Valeurs du `add constraint … check (… any (array[…]))` de la migration.
function valeursAjoutees(sql) {
  const code = sansCommentaires(sql);
  const blocs = code.split('add constraint invoices_methode_identification_check');
  assert.strictEqual(blocs.length, 2, 'un seul add constraint attendu');
  const m = blocs[1].match(/^\s*check \(methode_identification = any \(array\[([^\]]*)\]\)\);/);
  assert.ok(m, 'forme du CHECK ajouté inattendue');
  return m[1].split(',').map(v => { const x = v.trim().match(/^'([a-z_]+)'::text$/); assert.ok(x, `valeur illisible : ${v}`); return x[1]; });
}

const CONTROLES = {
  elargissement_seul: S => {
    assert.deepStrictEqual(valeursAjoutees(S.migration), [...HISTORIQUES, 'nom_decenium'],
      'les 7 valeurs historiques, dans leur ordre, puis nom_decenium');
  },
  garde_contrainte_attendue: S => {
    const code = sansCommentaires(S.migration);
    const attendue = "'CHECK ((methode_identification = ANY (ARRAY[" +
      HISTORIQUES.map(v => `''${v}''::text`).join(', ') + "])))'";
    const i = code.indexOf(attendue);
    assert.ok(i > 0, 'la garde doit comparer à la définition exacte de 20260807032033');
    assert.ok(code.indexOf('if v_def is distinct from') < i, 'comparaison par is distinct from (NULL = absente)');
    assert.match(code, /raise exception 'invoices_methode_identification_check inattendue/);
    assert.ok(i < code.indexOf('drop constraint invoices_methode_identification_check'), 'la garde précède le drop');
  },
  aucune_donnee_ni_privilege: S => {
    const code = sansCommentaires(S.migration);
    assert.ok(!/\b(grant|revoke|insert|update|delete|truncate|owner to|policy|trigger|function)\b/i.test(code),
      'aucune donnée, aucun privilège, aucun autre objet');
    assert.strictEqual(code.match(/\balter table\b/gi).length, 2, 'un drop et un add, rien d\'autre');
    assert.match(code.trim(), /^begin;[\s\S]*\ncommit;$/, 'tout dans une transaction');
  },
  origine_inchangee: S => {
    assert.ok(S.origine.includes("  methode_identification text check (methode_identification in ('code_client','raison_sociale','siret','contenu','email','historique','manuel')),"),
      'la migration 20260807032033 ne doit pas être réécrite');
  },
};

const MUTATIONS = [
  ['elargissement_seul', 'migration', "'contenu'::text, 'email'::text, 'historique'::text, 'manuel'::text, 'nom_decenium'::text]));",
    "'email'::text, 'historique'::text, 'manuel'::text, 'nom_decenium'::text]));"],
  ['elargissement_seul', 'migration', ", 'nom_decenium'::text]));", ']));'],
  ['garde_contrainte_attendue', 'migration', "''historique''::text, ''manuel''::text])))'", "''historique''::text, ''manuel''::text, ''nom_decenium''::text])))'"],
  ['garde_contrainte_attendue', 'migration', "    raise exception 'invoices_methode_identification_check inattendue : %', coalesce(v_def, '(absente)');",
    "    raise notice 'invoices_methode_identification_check : %', v_def;"],
  ['aucune_donnee_ni_privilege', 'migration', '\ncommit;\n', "\nupdate public.invoices set methode_identification = 'nom_decenium' where methode_identification = 'manuel';\ncommit;\n"],
  ['aucune_donnee_ni_privilege', 'migration', '\nbegin;\n', '\n'],
  ['origine_inchangee', 'origine', "'historique','manuel')),", "'historique','manuel','nom_decenium')),"],
];

let reussis = 0;
const echecs = [];

console.log('=== Contrôles sur les sources réelles ===');
for (const [nom, controle] of Object.entries(CONTROLES)) {
  try { controle(SOURCES); reussis++; console.log(`  ok   ${nom}`); }
  catch (e) { echecs.push(`${nom} : ${e.message}`); console.log(`  ÉCHEC ${nom} : ${e.message}`); }
}

console.log('\n=== Mutations — chaque contrôle visé doit rougir ===');
const vises = new Set();
for (const [nom, cle, ancre, remplacement] of MUTATIONS) {
  const n = SOURCES[cle].split(ancre).length - 1;
  if (n !== 1) { echecs.push(`mutation ${nom}/${cle} : ancre trouvée ${n} fois (1 exigée)`); console.log(`  ÉCHEC ancre ${nom}/${cle} ×${n}`); continue; }
  const mutees = Object.assign({}, SOURCES, { [cle]: SOURCES[cle].replace(ancre, () => remplacement) });
  let rouge = false;
  try { CONTROLES[nom](mutees); } catch (_) { rouge = true; }
  if (rouge) { reussis++; vises.add(nom); console.log(`  ok   ${nom} rougit (${cle})`); }
  else { echecs.push(`${nom} reste vert sous mutation de ${cle}`); console.log(`  ÉCHEC ${nom} reste vert sous mutation (${cle})`); }
}
for (const nom of Object.keys(CONTROLES)) {
  if (!vises.has(nom)) echecs.push(`${nom} : aucune mutation ne le fait rougir`);
}

console.log(`\n${reussis} vérification(s) réussie(s), ${echecs.length} échec(s).`);
if (echecs.length) {
  echecs.forEach(e => console.error(`  - ${e}`));
  process.exit(1);
}
console.log('Tous les tests "invoices nom_decenium" passent.');
