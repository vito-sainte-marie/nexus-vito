// Réconciliation canonique des carnets FDJ — lot FDJ-CARNETS-LEDGER-AUDIT-1,
// 05/10/2026 (GO decision-9 « étendre le lot »).
//
// Ce que ce test garde, sans base de données :
//   - le moteur date un mouvement par `effective_at` (repli `created_at`),
//     y compris pour le seuil du point zéro (rétroactivité) ;
//   - la migration 20261005090000 : l'aide interne fdj_reconcilier_caisse_jeu
//     est SECURITY DEFINER à search_path vide, réservée à service_role
//     (grants nommés : revoke public, anon ET authenticated), appelée par les
//     deux RPC d'écriture, avec des clés d'idempotence dérivées du seul
//     mouvement déclencheur, une source 'reconciliation_automatique', et ne
//     pose jamais `vue` (l'examen humain reste un geste distinct) ;
//   - l'écran Employé n'insère plus l'alerte activation_sans_carnet_confie
//     (c'est le serveur qui en décide, après recalcul) ;
//   - les compteurs d'alertes FDJ (sidebar, bureau, Manager) écartent les
//     alertes résolues automatiquement.
//
// Les scénarios A à G exécutés contre PostgreSQL vivent dans
// outils/epreuve-fdj-reconciliation-canonique-20261005/ (conteneur jetable, executer.sh).
//
// Preuve que chaque garde mord : chaque contrôle est rejoué sur une copie
// mutée en mémoire de la source qu'il protège (ancre exigée unique avant
// mutation) et doit alors échouer. Aucun fichier n'est modifié.

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const FICHIERS = {
  moteur: 'nexus-fdj-moteur.js',
  migration: 'supabase/migrations/20261005090000_fdj_reconciliation_canonique_caisse.sql',
  employe: 'NEXUS-FDJ-v1.html',
  manager: 'NEXUS-FDJ-Manager-v1.html',
  appDonnees: 'nexus-app-donnees.js',
  desktop: 'nexus-desktop.js',
};
const SOURCES = {};
for (const [cle, f] of Object.entries(FICHIERS)) SOURCES[cle] = fs.readFileSync(path.join(__dirname, f), 'utf8');

function chargerMoteur(source) {
  const sandbox = { window: {} };
  vm.runInNewContext(source, sandbox);
  return sandbox.window.NexusFdjMoteur;
}

// Corps d'une fonction SQL : de son `create or replace function` au premier `$$;`.
function corpsFonctionSql(sql, nom) {
  const debut = sql.indexOf(`create or replace function public.${nom}(`);
  assert.ok(debut >= 0, `fonction ${nom} introuvable`);
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

const HELPER = 'fdj_reconcilier_caisse_jeu';
const LOC = { caisse: 'caisse', bureau: 'bureau' };
const REF_T = '2026-10-03T08:00:00Z';

const CONTROLES = {
  instant_effet_prime: S => {
    const M = chargerMoteur(S.moteur);
    assert.strictEqual(M.instantEffetMouvement({ effective_at: '2026-10-02T10:00:00Z', created_at: '2026-10-05T10:00:00Z' }), '2026-10-02T10:00:00Z');
    assert.strictEqual(M.instantEffetMouvement({ effective_at: null, created_at: '2026-10-05T10:00:00Z' }), '2026-10-05T10:00:00Z');
  },
  retroactivite_point_zero: S => {
    const M = chargerMoteur(S.moteur);
    const ref = { creeLe: REF_T, lignes: { g: { bureau: 5, caisse: 0 } } };
    const mvt = effet => [{ game_id: 'g', type_mouvement: 'transfert', quantite: 1, location_source_id: 'bureau',
      location_destination_id: 'caisse', created_at: '2026-10-05T10:00:00Z', effective_at: effet }];
    // Saisi après le point zéro, effet avant : déjà incorporé dans la référence.
    const avant = M.soldesCarnetsAvecReference(mvt('2026-10-02T10:00:00Z'), LOC, ref).g;
    assert.deepStrictEqual([avant.bureau, avant.confies], [5, 0], 'un effet antérieur à la référence ne doit pas compter');
    const apres = M.soldesCarnetsAvecReference(mvt('2026-10-04T10:00:00Z'), LOC, ref).g;
    assert.deepStrictEqual([apres.bureau, apres.confies], [4, 1], 'un effet postérieur à la référence doit compter');
  },
  helper_definer_search_path_vide: S => {
    const corps = corpsFonctionSql(S.migration, HELPER);
    assert.match(corps, /\bsecurity definer\b/);
    assert.match(corps, /\bset search_path = ''\n/);
  },
  helper_reserve_service_role: S => {
    const blocs = S.migration.split(/\ndo \$\$/).slice(1).filter(b => b.includes(`'public.${HELPER}(uuid)'`));
    assert.strictEqual(blocs.length, 1, "un seul bloc de privilèges doit nommer l'aide");
    const b = sansCommentaires(blocs[0].slice(0, blocs[0].indexOf('$$;')), '--');
    for (const r of ['public', 'anon', 'authenticated']) {
      assert.ok(b.includes(`'revoke all on function %s from ${r}'`), `revoke ${r} manquant sur l'aide`);
    }
    assert.ok(b.includes("'grant execute on function %s to service_role'"));
    assert.ok(!/grant execute on function %s to (authenticated|anon|public)/.test(b), "l'aide ne doit être accordée qu'à service_role");
    assert.ok(!b.includes('fdj_activer_carnet') && !b.includes('fdj_enregistrer_mouvement_stock'), 'les RPC ne partagent pas le bloc de l’aide');
  },
  rpc_appellent_le_helper: S => {
    for (const rpc of ['fdj_activer_carnet', 'fdj_enregistrer_mouvement_stock']) {
      const code = sansCommentaires(corpsFonctionSql(S.migration, rpc), '--');
      assert.ok(code.includes(`public.${HELPER}(v_id)`), `${rpc} doit réconcilier après son écriture`);
    }
  },
  cles_derivees_du_declencheur: S => {
    const code = sansCommentaires(corpsFonctionSql(S.migration, HELPER), '--');
    const cles = code.match(/md5\([^)]*\)::uuid/g) || [];
    assert.deepStrictEqual(cles.sort(), [
      "md5('fdj_reconciliation_auto_retour|' || p_declencheur::text)::uuid",
      "md5('fdj_reconciliation_auto|' || p_declencheur::text)::uuid",
    ], 'deux clés, dérivées du seul déclencheur');
  },
  source_reconciliation_automatique: S => {
    const code = sansCommentaires(corpsFonctionSql(S.migration, HELPER), '--');
    const inserts = code.split('insert into public.fdj_stock_movements').slice(1);
    assert.strictEqual(inserts.length, 2, 'deux écritures automatiques attendues (retour, transfert)');
    for (const ins of inserts) {
      const valeurs = ins.slice(0, ins.indexOf('returning id'));
      assert.match(valeurs, /'reconciliation_automatique'\s*\)\s*$/, 'chaque écriture automatique doit être tracée comme telle');
    }
  },
  helper_ne_pose_jamais_vue: S => {
    const code = sansCommentaires(corpsFonctionSql(S.migration, HELPER), '--');
    assert.ok(!/\bvue\s*=/.test(code), 'la réconciliation résout, elle n’examine pas : jamais `vue`');
    assert.match(code, /set resolue_automatiquement = true, resolue_le = now\(\)/);
  },
  employe_n_insere_plus_l_alerte: S => {
    const code = sansCommentaires(S.employe, '//');
    assert.ok(!code.includes('activation_sans_carnet_confie'), "l'écran Employé ne doit plus décider seul de l'alerte");
  },
  compteurs_ecartent_les_resolues: S => {
    const filtre = ".eq('vue', false).eq('resolue_automatiquement', false)";
    for (const [cle, ancre] of [['appDonnees', "client.from('fdj_alertes')"], ['desktop', "nexusClient.from('fdj_alertes')"]]) {
      const i = S[cle].indexOf(ancre);
      assert.ok(i >= 0, `${cle} : requête fdj_alertes introuvable`);
      const requete = S[cle].slice(i, S[cle].indexOf(';', i));
      assert.ok(requete.includes(filtre), `${cle} : le compteur doit écarter les alertes résolues automatiquement`);
    }
    assert.ok(S.manager.includes(`.from('fdj_alertes').select('*').eq('site', siteId)${filtre}`), 'Manager : liste des alertes');
  },
};

// Une mutation = [contrôle visé, fichier, ancre (unique), remplacement].
const MUTATIONS = [
  ['instant_effet_prime', 'moteur', 'return m.effective_at || m.created_at || null;', 'return m.created_at || null;'],
  ['retroactivite_point_zero', 'moteur', 'return m.effective_at || m.created_at || null;', 'return m.created_at || null;'],
  ['helper_definer_search_path_vide', 'migration',
    `${HELPER}(p_declencheur uuid)\nreturns jsonb\nlanguage plpgsql\nvolatile\nsecurity definer\nset search_path = ''`,
    `${HELPER}(p_declencheur uuid)\nreturns jsonb\nlanguage plpgsql\nvolatile\nsecurity definer\nset search_path = public`],
  ['helper_reserve_service_role', 'migration', "    execute format('revoke all on function %s from authenticated', v_sig);\n", ''],
  ['rpc_appellent_le_helper', 'migration', `  v_reco := public.${HELPER}(v_id);`, '  v_reco := null;'],
  ['cles_derivees_du_declencheur', 'migration', "md5('fdj_reconciliation_auto|' || p_declencheur::text)", "md5('fdj_reconciliation_auto|' || gen_random_uuid()::text)"],
  ['source_reconciliation_automatique', 'migration',
    "|| p_declencheur::text || '.',\n          'reconciliation_automatique'\n        )\n        returning id into v_id;\n\n        insert into public.fdj_audit_log (\n          site, shift_id, entite_type, entite_id, action, acteur_id, motif, nouvelle_valeur\n        )\n        values (\n          v_mvt.site, v_mvt.shift_id, 'fdj_stock_movement', v_id,\n          'fdj_reconciliation_auto_retour'",
    "|| p_declencheur::text || '.',\n          'manager'\n        )\n        returning id into v_id;\n\n        insert into public.fdj_audit_log (\n          site, shift_id, entite_type, entite_id, action, acteur_id, motif, nouvelle_valeur\n        )\n        values (\n          v_mvt.site, v_mvt.shift_id, 'fdj_stock_movement', v_id,\n          'fdj_reconciliation_auto_retour'"],
  ['helper_ne_pose_jamais_vue', 'migration', 'set resolue_automatiquement = true, resolue_le = now()', 'set resolue_automatiquement = true, resolue_le = now(), vue = true'],
  ['employe_n_insere_plus_l_alerte', 'employe', '    // L\'alerte `activation_sans_carnet_confie` qui suivait ici',
    "    await nexusClient.from('fdj_alertes').insert({ type: 'activation_sans_carnet_confie' });\n    // L'alerte `activation_sans_carnet_confie` qui suivait ici"],
  ['compteurs_ecartent_les_resolues', 'desktop', ".eq('resolue_automatiquement', false)", ''],
  ['compteurs_ecartent_les_resolues', 'appDonnees', ".eq('resolue_automatiquement', false)", ''],
  ['compteurs_ecartent_les_resolues', 'manager',
    ".select('*').eq('site', siteId).eq('vue', false).eq('resolue_automatiquement', false)", ".select('*').eq('site', siteId).eq('vue', false)"],
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
console.log('Tous les tests "réconciliation canonique FDJ" passent.');
