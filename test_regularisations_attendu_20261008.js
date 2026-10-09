// Épreuve — 08/10/2026, mandat consolidé §3 (B8) : l'attendu de chaque
// tiroir comprend les versements de régularisation reçus, moins les
// restitutions payées et les transferts au coffre qui en sortent, ventilés
// par mode. Le net vient du serveur (regularisations_tiroirs, migration
// 20261008160000, banc outils/epreuve-regularisations-attendu-20261008) ;
// l'écran ne le calcule jamais et refuse d'enregistrer s'il est illisible.
//
// Le code est extrait des vrais NEXUS-Verify-v1.html et
// NEXUS-FDJ-Manager-v1.html : la preuve porte sur ce que les écrans
// calculent et appellent réellement.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const DIR = __dirname;
const verify = fs.readFileSync(path.join(DIR, 'NEXUS-Verify-v1.html'), 'utf8');
const fdjManager = fs.readFileSync(path.join(DIR, 'NEXUS-FDJ-Manager-v1.html'), 'utf8');
const moteurSrc = fs.readFileSync(path.join(DIR, 'nexus-verify-moteur.js'), 'utf8');
const fdjMoteurSrc = fs.readFileSync(path.join(DIR, 'nexus-fdj-moteur.js'), 'utf8');
const migration = fs.readFileSync(path.join(DIR, 'supabase/migrations/20261008160000_attendu_tiroirs_regularisations.sql'), 'utf8');

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
    if (source[j] === '{') profondeur++;
    else if (source[j] === '}') profondeur--;
    j++;
  }
  return source.slice(debut, j);
}

const sandbox = { console };
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(moteurSrc, sandbox);
vm.runInContext(fdjMoteurSrc, sandbox);
const M = sandbox.NexusVerifyMoteur;

const detail = {
  net: 25, entrees: 50, sorties: 25,
  par_mode: {
    especes: { entrees: 30, sorties: 25, net: 5 },
    carte_bancaire: { entrees: 20, sorties: 0, net: 20 },
  },
};

// 1. Moteur : lecture, phrase par mode, refus d'une réponse illisible.
{
  const lu = M.lireRegularisationsTiroir(detail);
  assert.strictEqual(lu.net, 25); assert.strictEqual(lu.entrees, 50); assert.strictEqual(lu.sorties, 25);
  assert.strictEqual(lu.modes.map(m => m.libelle).join('|'), 'Carte bancaire|Espèces');
  assert.strictEqual(M.phraseRegularisationsTiroir(lu), 'Carte bancaire : reçu 20,00 € ; Espèces : reçu 30,00 €, sorti 25,00 €');
  assert.strictEqual(M.lireRegularisationsTiroir(null), null);
  assert.strictEqual(M.lireRegularisationsTiroir({}), null, 'sans net, la lecture est illisible, jamais 0');
  assert.strictEqual(M.lireRegularisationsTiroir({ net: 'abc' }), null);
  const vide = M.lireRegularisationsTiroir({ net: 0, entrees: 0, sorties: 0, par_mode: {} });
  assert.strictEqual(vide.net, 0); assert.strictEqual(M.phraseRegularisationsTiroir(vide), null);
  ok('lecture ventilée par mode ; une réponse sans net est illisible, jamais 0');
}

// 2. Moteur : messages explicites, table propre à chaque écran.
{
  const brut = '[REGULARISATIONS_PERIMEES] Caisse FDJ, quart 2 du 2026-10-07 : …';
  assert.ok(M.messageRegularisationsTiroir(brut).includes('Calculer et enregistrer'));
  assert.ok(M.messageRegularisationsTiroir(brut, M.MESSAGES_REGULARISATIONS_FDJ).includes('recalculée avant la validation'));
  assert.ok(M.messageRegularisationsTiroir('[QUART_INVALIDE] x').includes('quart (1 ou 2)'));
  assert.strictEqual(M.messageRegularisationsTiroir('duplicate key'), null);
  assert.strictEqual(M.messageRegularisationsTiroir(null), null);
  ok('refus PERIMEES dit quoi faire, différemment dans Verify et FDJ Manager ; un autre refus n\'est pas maquillé');
}

// 3. Moteur : faut-il recalculer avant de valider ?
{
  const lu = M.lireRegularisationsTiroir(detail);
  assert.strictEqual(M.regularisationsARecalculer(25, lu), false);
  assert.strictEqual(M.regularisationsARecalculer('25.00', lu), false);
  assert.strictEqual(M.regularisationsARecalculer(0, lu), true);
  assert.strictEqual(M.regularisationsARecalculer(24.99, lu), true, 'un centime suffit');
  assert.strictEqual(M.regularisationsARecalculer(25, null), true, 'lecture absente : recalculer');
  ok('recalcul exigé dès qu\'un centime diffère, ou si le tiroir n\'a pas été lu');
}

// 4. Verify : la lecture serveur précède l'attendu, un échec n'enregistre rien.
{
  const debut = unique(verify, "const { data: regulTiroirs, error: eRegul } = await nexusClient.rpc('regularisations_tiroirs'");
  const iPiste = unique(verify, 'const attenduPiste = vente_piste - transfert - remise_cuve + reglement_compte_anterieur_piste + regularisations_piste;');
  const iBoutique = unique(verify, 'const attenduBoutique = vente_boutique + transfert + reglement_compte_anterieur_boutique + regularisations_boutique;');
  assert.ok(debut < iPiste && debut < iBoutique, 'la lecture doit précéder le calcul');
  const garde = verify.slice(debut, iPiste);
  assert.ok(/if \(!regulPiste \|\| !regulBoutique\) \{[\s\S]*?return;\s*\}/.test(garde), 'un tiroir illisible doit arrêter l\'enregistrement');
  assert.ok(garde.includes('const regularisations_piste = regulPiste.net, regularisations_boutique = regulBoutique.net;'));
  const iUpsert = unique(verify, 'regularisations_piste, regularisations_boutique,\n        ecart_piste, ecart_boutique, ecart_total,');
  assert.ok(iUpsert > iBoutique);
  ok('Verify lit le serveur avant l\'attendu, refuse sans lecture, et écrit les deux nets avec l\'écart');
}

// 5. Verify : les refus PERIMEES sont traduits aux trois points d'écriture.
{
  assert.ok(verify.includes("|| NexusVerifyMoteur.messageRegularisationsTiroir(error.message);\n        box.innerHTML"), 'enregistrement');
  assert.ok(verify.includes("alert(refusRegul ? 'Validation refusée — ' + refusRegul"), 'validation');
  assert.ok(verify.includes("alert(refusRegul ? 'Restauration refusée — ' + refusRegul"), 'restauration');
  assert.ok(/nexus-verify-moteur\.js\?v=/.test(verify));
  ok('Verify dit le refus PERIMEES à l\'enregistrement, à la validation et à la restauration');
}

// 6. FDJ Manager : l'attendu affiché ajoute le net lu (calcul réel extrait).
{
  assert.ok(/<script src="nexus-verify-moteur\.js\?v=[^"]+"><\/script>/.test(fdjManager), 'le moteur Verify doit être chargé');
  const code = [
    extraireBloc(fdjManager, 'function versementsRegulEdition()'),
    extraireBloc(fdjManager, 'function caisseAttendueEdition()'),
  ].join('\n');
  const ctx = { NexusFdjMoteur: sandbox.NexusFdjMoteur, Math, edition: null, caisseGrattageEdition: () => 100 };
  vm.createContext(ctx);
  vm.runInContext(code + '\nthis.f = caisseAttendueEdition;', ctx);
  ctx.edition = { caisseTirages: 50, regularisations: [], versementsRegul: null };
  const sans = ctx.f();
  ctx.edition.versementsRegul = M.lireRegularisationsTiroir(detail);
  assert.strictEqual(Math.round((ctx.f() - sans) * 100), 2500, 'le net (25,00 €) s\'ajoute à l\'attendu');
  ok('FDJ Manager : l\'attendu affiché comprend le net du tiroir FDJ');
}

// 7. FDJ Manager : avant fdj_valider_caisse, relecture et recalcul si besoin.
{
  const iLecture = unique(fdjManager, 'const versementsLus = await chargerVersementsTiroirFdj();');
  const iValider = fdjManager.indexOf("rpc('fdj_valider_caisse'", iLecture);
  assert.ok(iValider > iLecture, 'la relecture doit précéder la validation');
  const entre = fdjManager.slice(iLecture, iValider);
  assert.ok(/if \(!versementsLus\) \{[^}]*return; \}/.test(entre), 'tiroir illisible : rien n\'est validé');
  assert.ok(entre.includes('if (montantsCaisseModifies() || versementsARecalculer) {'));
  assert.ok(entre.includes("rpc('fdj_corriger_caisse_manager'"));
  assert.ok(entre.includes('p_motif: motifRecalcul,'), 'le recalcul porte un motif nominatif, jamais un auteur fictif');
  assert.ok(fdjManager.includes('NexusVerifyMoteur.messageRegularisationsTiroir(eVal.message, NexusVerifyMoteur.MESSAGES_REGULARISATIONS_FDJ)'));
  assert.ok(fdjManager.includes("versementsRegulRetenus: cash ? (cash.versements_regularisation || 0) : 0,"));
  ok('FDJ Manager recalcule par la correction manager avant de valider quand le tiroir a bougé');
}

// 8. Migration : le serveur ajoute lui-même, refuse ce qui est périmé, n'ouvre pas anon.
{
  assert.ok(migration.includes('create or replace function public.regularisations_tiroirs(p_site text, p_date date, p_quart text)'));
  assert.strictEqual((migration.match(/raise exception '\[REGULARISATIONS_PERIMEES\]/g) || []).length, 2, 'Verify et FDJ');
  assert.ok(migration.includes('grant execute on function public.regularisations_tiroirs(text, date, text) to authenticated, service_role;'));
  assert.ok(!/to anon|to public/i.test(migration.replace(/--.*$/gm, '')), 'aucun droit à anon ni public');
  ok('migration : deux refus PERIMEES, lecture réservée à authenticated');
}

console.log(`\n${n} épreuves B8 vertes.`);
