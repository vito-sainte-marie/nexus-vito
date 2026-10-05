// Seule une prise de poste « caissiere » ouvre un quart FDJ — arbitrage de
// Frédéric, 05/10/2026 (une prise de poste « pompiste » avait ouvert le Q1 et
// bloqué la caissière arrivée ensuite).
//
// Ce que ce test garde, sans base de données :
//   - la migration 20261005180000 refuse, AVANT tout calcul de quart et toute
//     écriture, toute prise de poste dont le rôle n'est pas exactement
//     'caissiere' (liste blanche : un rôle NULL ou ajouté plus tard est refusé) ;
//   - le refus managérial garde son motif historique `prise_de_poste_managerial` ;
//   - hors étape 5, le corps est identique à 20260916220500 (celui que
//     Production exécute, md5(prosrc) 1f5cd304… mesuré le 05/10/2026) : la
//     correction ne change rien d'autre ;
//   - la migration ne touche aucun privilège (`create or replace` les garde) ;
//   - l'écran Prise de poste affiche le `message` d'un refus `ouvert: false`.
//
// Les scénarios exécutés contre PostgreSQL vivent dans
// outils/epreuve-fdj-ouverture-caissiere-seule-20261005/ (conteneur jetable).
//
// Preuve que chaque garde mord : chaque contrôle est rejoué sur une copie
// mutée en mémoire de la source qu'il protège (ancre exigée unique avant
// mutation) et doit alors échouer. Aucun fichier n'est modifié.

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const FICHIERS = {
  migration: 'supabase/migrations/20261005180000_fdj_ouverture_quart_caissiere_seule.sql',
  origine: 'supabase/migrations/20260916220500_fdj_commande_ouverture_quart.sql',
  prise: 'NEXUS-Prise-De-Poste-v1.html',
};
const SOURCES = {};
for (const [cle, f] of Object.entries(FICHIERS)) SOURCES[cle] = fs.readFileSync(path.join(__dirname, f), 'utf8');

const RPC = 'fdj_ouvrir_quart_depuis_prise_de_poste';

// Corps d'une fonction SQL : de son `create or replace function` au premier `$$;`.
function corpsFonctionSql(sql, nom) {
  const debut = sql.indexOf(`create or replace function public.${nom}(`);
  assert.ok(debut >= 0, `fonction ${nom} introuvable`);
  assert.strictEqual(sql.indexOf(`create or replace function public.${nom}(`, debut + 1), -1, `${nom} définie deux fois`);
  const fin = sql.indexOf('$$;', debut);
  assert.ok(fin > debut, `fin de ${nom} introuvable`);
  return sql.slice(debut, fin);
}

// Lignes de code seulement (commentaires `--` SQL ou `//` JS retirés).
function sansCommentaires(texte, marque) {
  return texte.split('\n').map(l => {
    const i = l.indexOf(marque);
    return i >= 0 ? l.slice(0, i) : l;
  }).join('\n');
}

// Retire l'étape 5 (de son commentaire « -- 5. » au commentaire « -- 6. »).
function sansEtape5(corps) {
  const d = corps.indexOf('  -- 5. ');
  const f = corps.indexOf('  -- 6. ');
  assert.ok(d > 0 && f > d, 'étapes 5 et 6 introuvables');
  return corps.slice(0, d) + corps.slice(f);
}

const CONTROLES = {
  liste_blanche_caissiere: S => {
    const code = sansCommentaires(corpsFonctionSql(S.migration, RPC), '--');
    const garde = "if v_pdp.role is distinct from 'caissiere' then";
    const i = code.indexOf(garde);
    assert.ok(i > 0, 'la liste blanche caissiere est absente');
    assert.strictEqual(code.split(garde).length, 2, 'une seule liste blanche attendue');
    const bloc = code.slice(i, code.indexOf('end if;', i));
    assert.match(bloc, /'ouvert', false/, 'un rôle hors caisse doit être refusé');
    assert.match(bloc, /'motif', 'prise_de_poste_hors_caisse'/);
    assert.ok(!/insert|update/i.test(bloc), 'le refus n\'écrit rien');
    // Le refus précède le calcul du quart et toute écriture.
    for (const apres of ['public.fdj_numero_quart_depuis_prise_de_poste(', 'insert into public.fdj_shifts', 'update public.fdj_shifts']) {
      const j = code.indexOf(apres);
      assert.ok(j > i, `la liste blanche doit précéder ${apres}`);
    }
    assert.ok(!/v_pdp\.role\s*(<>|!=|not in)/.test(code), 'aucune liste noire de rôles');
  },
  refus_managerial_conserve: S => {
    const code = sansCommentaires(corpsFonctionSql(S.migration, RPC), '--');
    const i = code.indexOf("if v_pdp.role = 'manager' then");
    assert.ok(i > 0, 'le refus managérial a disparu');
    const bloc = code.slice(i, code.indexOf('end if;', i));
    assert.match(bloc, /'ouvert', false/);
    assert.match(bloc, /'motif', 'prise_de_poste_managerial'/);
    assert.ok(i < code.indexOf("if v_pdp.role is distinct from 'caissiere' then"), 'le motif managérial doit être rendu avant le motif générique');
  },
  corps_inchange_hors_etape_5: S => {
    assert.strictEqual(sansEtape5(corpsFonctionSql(S.migration, RPC)), sansEtape5(corpsFonctionSql(S.origine, RPC)),
      'hors étape 5, le corps doit rester celui de 20260916220500');
  },
  aucun_privilege_touche: S => {
    const code = sansCommentaires(S.migration, '--');
    assert.ok(!/\b(grant|revoke)\b/i.test(code), 'la migration ne doit toucher aucun privilège');
    assert.ok(!/alter function|owner to|security invoker/i.test(code), 'propriétaire et mode de sécurité inchangés');
    const corps = corpsFonctionSql(S.migration, RPC);
    assert.match(corps, /\nsecurity definer\nset search_path = ''\nas \$\$/);
  },
  ecran_affiche_le_refus: S => {
    const code = sansCommentaires(S.prise, '//');
    assert.ok(code.includes("if (data.ouvert === false && data.message) { messageOuvertureFdj = { ton: 'info', texte: data.message }; return; }"),
      "l'écran Prise de poste doit afficher le motif d'un refus");
  },
};

// Une mutation = [contrôle visé, fichier, ancre (unique), remplacement].
const MUTATIONS = [
  ['liste_blanche_caissiere', 'migration', "  if v_pdp.role is distinct from 'caissiere' then", "  if v_pdp.role in ('renfort') then"],
  ['liste_blanche_caissiere', 'migration', "'motif', 'prise_de_poste_hors_caisse'", "'motif', 'prise_de_poste_managerial'"],
  ['refus_managerial_conserve', 'migration', "  if v_pdp.role = 'manager' then\n", "  if false then\n"],
  ['corps_inchange_hors_etape_5', 'migration', "  -- 7. Date métier depuis le fuseau du site, jamais depuis l'appareil.\n  v_date := public.fdj_date_metier(v_pdp.site_id, v_pdp.heure_debut);",
    "  -- 7. Date métier depuis le fuseau du site, jamais depuis l'appareil.\n  v_date := current_date;"],
  ['aucun_privilege_touche', 'migration', '\n$$;\n', '\n$$;\n\ngrant execute on function public.fdj_ouvrir_quart_depuis_prise_de_poste(uuid) to anon;\n'],
  ['ecran_affiche_le_refus', 'prise', "if (data.ouvert === false && data.message) { messageOuvertureFdj = { ton: 'info', texte: data.message }; return; }",
    'if (data.ouvert === false) return;'],
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
console.log('Tous les tests "ouverture FDJ caissière seule" passent.');
