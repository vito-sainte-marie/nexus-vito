// Épreuve — 08/10/2026, mandat consolidé §6 (B5) : nouvelle validation
// quand le résultat change. P1 (e6ab6f1) réalignait l'écart validé d'un
// audit modifié sans toucher valide_le_* : la caisse restait « clôturée »
// et ouverte aux versements de régularisation sur une valeur qu'aucun
// manager n'avait validée. Désormais le serveur pose
// revalidation_requise_*_le (migration 20261008150000, banc
// outils/epreuve-revalidation-20261008), refuse versement et restitution
// [ECART_A_REVALIDER], et Verify l'affiche avec un bouton de revalidation.
//
// Le code de l'écran est extrait du vrai NEXUS-Verify-v1.html et exécuté.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const DIR = __dirname;
const html = fs.readFileSync(path.join(DIR, 'NEXUS-Verify-v1.html'), 'utf8');
const moteurSrc = fs.readFileSync(path.join(DIR, 'nexus-verify-moteur.js'), 'utf8');
const migration = fs.readFileSync(path.join(DIR, 'supabase/migrations/20261008150000_audits_caisse_revalidation_si_resultat_change.sql'), 'utf8');
const banc = path.join(DIR, 'outils/epreuve-revalidation-20261008');

let n = 0;
function ok(label) { n++; console.log('OK —', label); }

function unique(source, motif) {
  const i = source.indexOf(motif);
  assert.ok(i !== -1, `Introuvable : ${motif}`);
  assert.strictEqual(source.indexOf(motif, i + 1), -1, `Ancre non unique : ${motif}`);
  return i;
}
function extraireBloc(source, debutMotif) {
  const debut = unique(source, debutMotif);
  let j = source.indexOf('{', debut) + 1, profondeur = 1;
  while (profondeur > 0) {
    assert.ok(j < source.length, `Bloc non fermé : ${debutMotif}`);
    if (source[j] === '{') profondeur++;
    else if (source[j] === '}') profondeur--;
    j++;
  }
  return source.slice(debut, j);
}
// Une fonction SQL n'a pas d'accolades : elle finit à son premier « $$; ».
function extraireFonctionSql(source, debutMotif) {
  const debut = unique(source, debutMotif);
  const fin = source.indexOf('$$;', debut);
  assert.ok(fin !== -1, `Fin introuvable : ${debutMotif}`);
  return source.slice(debut, fin);
}

// 1. Serveur : le drapeau appartient au déclencheur, pas à l'écran.
{
  assert.ok(/create trigger trg_audits_caisse_revalidation\s+before insert or update on public\.audits_caisse/.test(migration));
  const fn = extraireFonctionSql(migration, 'create or replace function public.audits_caisse_revalidation_controle()');
  assert.ok(/security definer\s+set search_path = ''/.test(fn.slice(0, 300)), 'SECURITY DEFINER, search_path vide');
  for (const role of ['public', 'anon', 'authenticated']) {
    assert.ok(migration.includes(`revoke all on function public.audits_caisse_revalidation_controle() from ${role};`), `revoke ${role}`);
  }
  for (const c of ['piste', 'boutique']) {
    assert.ok(migration.includes(`new.revalidation_requise_${c}_le := null;`), `insertion : drapeau ${c} ignoré`);
    assert.ok(migration.includes(`new.valide_le_${c} is distinct from old.valide_le_${c}`), `validation ${c} : drapeau levé`);
  }
  ok('drapeau posé et levé par le seul déclencheur, fonction fermée aux rôles clients');
}

// 2. Serveur : versement et restitution refusés tant que la caisse attend.
{
  const origine = extraireFonctionSql(migration, 'create or replace function public._ecarts_regul_origine(');
  assert.ok(origine.includes('[ECART_A_REVALIDER]'));
  assert.ok(origine.includes('un manager doit la valider de nouveau avant toute régularisation'), 'message explicite');
  assert.ok(/revalidation_requise_piste_le is null/.test(origine) && /revalidation_requise_boutique_le is null/.test(origine), 'une caisse à revalider n’est plus clôturée');
  const etat = extraireFonctionSql(migration, 'create or replace function public.ecart_regularisation_etat(');
  assert.ok(etat.includes("'revalidation_requise'"), 'état exposé');
  ok('[ECART_A_REVALIDER] refuse toute régularisation ; l’état expose revalidation_requise');
}

// 3. Le banc existe, couvre le chemin réel (upsert) et chaque mutation annonce ce qu'elle rougit.
{
  const exec = fs.readFileSync(path.join(banc, 'executer.sh'), 'utf8');
  const attendus = exec.match(/ATTENDUS="([^"]+)"/)[1].split(' ');
  for (const e of ['DRAPEAU', 'UPSERT', 'ECRAN', 'VERSEMENT', 'RESTITUTION', 'REVALIDATION', 'SANSCHANGEMENT', 'INDEPENDANCE']) {
    assert.ok(attendus.includes(e), `scénario ${e}`);
  }
  const scenarios = fs.readFileSync(path.join(banc, 'scenarios.sql'), 'utf8');
  assert.ok(scenarios.includes('on conflict (site, date, quart) do update'), 'upsert de Verify simulé');
  const mutations = fs.readdirSync(path.join(banc, 'mutations')).filter(f => f.endsWith('.sql'));
  assert.ok(mutations.length >= 9);
  for (const m of mutations) {
    assert.ok(/Rougit : [A-Z ]+\./.test(fs.readFileSync(path.join(banc, 'mutations', m), 'utf8').split('\n')[0]), `en-tête ${m}`);
  }
  ok(`banc : ${attendus.length} scénarios dont l’upsert réel, ${mutations.length} contre-témoins annoncés`);
}

// 4. Libellés P1 : la validation ne « suit » plus le calcul.
{
  const sandbox = { console }; sandbox.window = sandbox; vm.createContext(sandbox);
  vm.runInContext(moteurSrc, sandbox);
  const M = sandbox.NexusVerifyMoteur;
  const t1 = M.libelleSignalementValidation({ caisse: 'piste', code: 'validation_realignee', avant: -20, apres: -5 });
  const t2 = M.libelleSignalementValidation({ caisse: 'boutique', code: 'validation_manuelle_conservee', valide: 3.1, recalcul: 0.68 });
  for (const t of [t1, t2]) {
    assert.ok(t.includes('valider de nouveau') && t.includes('avant toute régularisation'), t);
  }
  assert.ok(!moteurSrc.includes('elle suit donc la correction'));
  ok('l’aperçu de modification annonce la nouvelle validation');
}

// 5. Bloc de validation exécuté depuis le vrai HTML.
{
  const src = extraireBloc(html, 'function renderBlocValidationCaisse(a, i, type) {');
  const ctx = {
    fmtDateFuseau: iso => `J(${iso})`, nomAuteurValidation: id => `M(${id})`,
    renderFormValidationCaisse: (a, i, type) => `<form-${type}-${i}>`,
  };
  vm.createContext(ctx);
  vm.runInContext(src + '; this.f = renderBlocValidationCaisse;', ctx);
  const base = { ecart_piste: -5, ecart_piste_valide: -5, valide_le_piste: '2026-10-08T12:00:00Z', premiere_validation_le_piste: '2026-10-08T12:00:00Z', valide_par_piste: 'm1' };

  const valide = ctx.f(base, 3, 'piste');
  assert.ok(valide.includes('✅ Piste validée') && !valide.includes('nouvelle validation requise'));

  const attente = ctx.f({ ...base, revalidation_requise_piste_le: '2026-10-08T14:00:00Z' }, 3, 'piste');
  assert.ok(attente.includes('⚠️ Piste : résultat modifié après validation — nouvelle validation requise'));
  assert.ok(!attente.includes('✅ Piste validée'), 'plus affichée comme acquise');
  assert.ok(attente.includes('J(2026-10-08T14:00:00Z)') && attente.includes('J(2026-10-08T12:00:00Z)') && attente.includes('M(m1)'), 'dates au fuseau, auteur précédent');
  assert.ok(attente.includes('Aucun versement ni restitution'));
  assert.ok(attente.includes('class="btn-valider-audit" data-idx="3" data-type="piste">✅ Valider de nouveau Piste</button>'), 'bouton qui ouvre le formulaire');
  assert.ok(attente.includes('<form-piste-3>'));

  const boutique = ctx.f({ ...base, ecart_boutique: 1, valide_le_boutique: base.valide_le_piste, premiere_validation_le_boutique: base.valide_le_piste, revalidation_requise_piste_le: '2026-10-08T14:00:00Z' }, 3, 'boutique');
  assert.ok(boutique.includes('✅ Boutique validée'), 'la boutique ne suit pas le drapeau piste');

  const fuseau = extraireBloc(html, 'function fmtDateFuseau(iso) {');
  assert.ok(fuseau.includes('timeZone: FUSEAU_STATION') && fuseau.includes('!FUSEAU_STATION'), 'jour de la station ou rien');
  ok('badge « nouvelle validation requise », dates au fuseau de la station, bouton de revalidation, caisses indépendantes');
}

// 6. L'écran n'écrit jamais le drapeau ; la revalidation passe par valide_le_*.
{
  const valider = html.slice(unique(html, "document.querySelectorAll('[id^=\"btnConfirmerValidation-\"]').forEach(btn => {"));
  const patch = valider.slice(valider.indexOf('const patch = {'), valider.indexOf('};', valider.indexOf('const patch = {')));
  assert.ok(patch.includes('[`valide_le_${type}`]: maintenant,'), 'nouvelle validation = valide_le_* renouvelé');
  assert.ok(!/revalidation_requise/.test(html.replace(/\/\/[^\n]*/g, '').replace(/a\[`revalidation_requise_\$\{type\}_le`\]/g, '')), 'aucune écriture du drapeau par l’écran');
  ok('Verify lit le drapeau sans jamais l’écrire ; valider de nouveau renouvelle valide_le_*');
}

console.log(`\n${n} vérifications — revalidation B5 conforme.`);
