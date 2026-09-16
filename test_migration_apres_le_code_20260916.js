/*
 * Le trigger arrive APRÈS le code qui le nourrit, jamais avant.
 * ============================================================================
 * LA MIGRATION EN CAUSE : `20260911180600_pointage_exige_service_et_evenement`.
 * Elle pose sur `public.pointages` un trigger qui refuse (23502) tout INSERT
 * ne portant pas `service_id` ET `client_event_id`.
 *
 * LE DÉFAUT QU'ELLE PEUT CAUSER, mesuré des deux côtés le 16/09/2026 :
 *   * Production (uzhjpqpctpvxytxpxoqz) : migration ABSENTE, trigger
 *     inexistant, et le code servi — GitHub Pages sert le dépôt brut — insère
 *     des pointages SANS ces deux colonnes.
 *   * Test (udljdqxerrbbbajxubfn) : migration inscrite, trigger posé.
 *
 * Appliquer ce trigger sur une Production qui ne sait pas encore envoyer les
 * deux colonnes ne dégrade pas le pointage : il le refuse ENTIÈREMENT. Et la
 * panne ne se verrait pas le jour même, `station_config.pointage_actif` étant
 * à false pour vito-sainte-marie depuis le 03/09 — elle serait ARMÉE, et
 * tomberait le jour où quelqu'un rallume l'interrupteur, sans rapport visible
 * avec le geste qui l'aurait causée.
 *
 * L'ORDRE EST DONC NON RÉVERSIBLE : le code d'abord, le trigger ensuite. Un
 * commentaire le disait déjà dans NEXUS-Pointage-v1.html. Un commentaire ne
 * retient rien. Cette épreuve le rend mécanique, du côté du dépôt :
 *
 *     TANT QUE LE FICHIER DE MIGRATION EST PRÉSENT AU DÉPÔT, AUCUN CHEMIN
 *     D'ÉCRITURE DE POINTAGE DU DÉPÔT NE PEUT OMETTRE LES DEUX COLONNES.
 *
 * Ce qu'elle ne prétend pas faire : juger ce qui est APPLIQUÉ sur un serveur.
 * Un test ne voit pas une base. Elle juge ce qui partirait ensemble, ce qui
 * est exactement la décision qu'on peut encore tenir au moment de la fusion.
 *
 * §5 la mute contre elle-même : retirer une des deux colonnes du code, ou la
 * garde du rejeu de file, doit la faire tomber. Une garde qu'on n'a pas vue
 * échouer n'est pas une garde.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const RACINE = __dirname;
const PREFIXE_MIGRATION = '20260911180600';
const COLONNES = ['service_id', 'client_event_id'];

let reussites = 0, echecs = 0;
function verifier(nom, condition, detail) {
  if (condition) { reussites++; console.log(`  ✓ ${nom}`); }
  else { echecs++; console.log(`  ✗ ${nom}${detail ? '\n      ' + detail : ''}`); }
}

// ── Les fichiers réellement servis : tout le dépôt sauf les épreuves ───────
function fichiersServis() {
  const trouves = [];
  (function marcher(dossier) {
    for (const e of fs.readdirSync(dossier, { withFileTypes: true })) {
      if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === '_site') continue;
      const p = path.join(dossier, e.name);
      if (e.isDirectory()) { marcher(p); continue; }
      if (!/\.(html|js)$/.test(e.name)) continue;
      if (e.name.startsWith('test_')) continue;
      trouves.push(p);
    }
  })(RACINE);
  return trouves;
}

// ── Découpage équilibré : l'argument d'un appel, le corps d'un littéral ────
function jusquAuFermant(texte, debut, ouvrant, fermant) {
  let profondeur = 0;
  for (let i = debut; i < texte.length; i++) {
    if (texte[i] === ouvrant) profondeur++;
    else if (texte[i] === fermant) { profondeur--; if (profondeur === 0) return texte.slice(debut, i + 1); }
  }
  return null;
}

// ── Les sites d'insertion dans `pointages`, quels qu'ils soient ────────────
// Rien n'est présumé de leur nombre ni de leur emplacement : on les cherche.
// Un site nouveau, ajouté demain dans un écran qu'on n'a pas prévu, sera vu.
function sitesInsertion(sources) {
  const sites = [];
  for (const [nom, texte] of sources) {
    const re = /from\((['"])pointages\1\)/g;
    let m;
    while ((m = re.exec(texte))) {
      const fenetre = texte.slice(m.index, m.index + 400);
      const rel = fenetre.indexOf('.insert(');
      if (rel < 0) continue;
      // Un autre `from('pointages')` entre les deux : l'`insert` appartient à
      // celui-là, pas à celui-ci. On ne compte pas deux fois le même site.
      if (/from\((['"])pointages\1\)/.test(fenetre.slice(m[0].length, rel))) continue;
      const posParenthese = m.index + rel + '.insert'.length;
      const arg = jusquAuFermant(texte, posParenthese, '(', ')');
      sites.push({
        nom, texte,
        ligne: texte.slice(0, m.index).split('\n').length,
        argument: arg === null ? null : arg.slice(1, -1).trim(),
        index: m.index,
      });
    }
  }
  return sites;
}

// ── Ce qui part vraiment : le littéral, ou la variable qui le porte ────────
function objetInsere(site) {
  const a = site.argument;
  if (a === null) return { forme: 'illisible', objet: null };
  if (a.startsWith('{')) return { forme: 'littéral', objet: a };
  if (/^[A-Za-z_$][\w$]*$/.test(a)) {
    const re = new RegExp(`const\\s+${a}\\s*=\\s*\\{`, 'g');
    let m, posAccolade = -1;
    while ((m = re.exec(site.texte))) { if (m.index > site.index) break; posAccolade = m.index + m[0].length - 1; }
    if (posAccolade < 0) return { forme: `variable ${a}, jamais déclarée en littéral`, objet: null };
    return { forme: `variable ${a}`, objet: jusquAuFermant(site.texte, posAccolade, '{', '}') };
  }
  return { forme: `expression « ${a} »`, objet: null };
}

function colonnesManquantes(objet) {
  if (!objet) return COLONNES.slice();
  return COLONNES.filter(c => !new RegExp(`(^|[^\\w.])${c}\\s*:`).test(objet));
}

// L'unique exception admise, et elle est nommée : le rejeu de la file hors
// ligne réinsère `entree.ligne`, un objet qui n'existe qu'à l'exécution. Il
// est couvert autrement, par le §3 — pas par confiance, par une autre mesure.
const REJEU_DE_FILE = 'entree.ligne';

function verdicts(sources) {
  return sitesInsertion(sources).map(site => {
    if (site.argument === REJEU_DE_FILE) return { site, verdict: 'file' };
    const { forme, objet } = objetInsere(site);
    const manquantes = colonnesManquantes(objet);
    return { site, verdict: manquantes.length ? 'manque' : 'conforme', forme, manquantes };
  });
}

// ══ 0 · La migration est-elle au dépôt ? ═══════════════════════════════════
const migrations = fs.existsSync(path.join(RACINE, 'supabase', 'migrations'))
  ? fs.readdirSync(path.join(RACINE, 'supabase', 'migrations')) : [];
const migration = migrations.find(f => f.startsWith(PREFIXE_MIGRATION) && f.endsWith('.sql'));

console.log('\n── 0 · Le trigger est au dépôt, donc la règle s’applique ──');
verifier('la migration 20260911180600 est présente', !!migration,
  'absente : cette épreuve n’a alors plus d’objet, et le dépôt n’exige rien');
if (!migration) {
  console.log(`\n${echecs === 0 ? '✓' : '✗'} ${reussites} réussite(s), ${echecs} échec(s)\n`);
  if (echecs > 0) process.exit(1);
  process.exit(0);
}
const sqlMigration = fs.readFileSync(path.join(RACINE, 'supabase', 'migrations', migration), 'utf8');
for (const colonne of COLONNES) {
  verifier(`le trigger exige bien ${colonne}`,
    new RegExp(`new\\.${colonne} is null`).test(sqlMigration),
    'si le trigger n’exige plus cette colonne, c’est cette épreuve qu’il faut corriger, pas le code');
}

// ══ 1 · Tous les chemins d'écriture du dépôt ═══════════════════════════════
const sources = new Map(fichiersServis().map(p => [path.relative(RACINE, p), fs.readFileSync(p, 'utf8')]));
const resultats = verdicts(sources);

console.log('\n── 1 · Les chemins d’écriture de pointage sont tous vus ──');
verifier('au moins un chemin d’écriture existe', resultats.length > 0,
  'aucun `.insert` sur `pointages` : la recherche est cassée, ou l’écriture a déménagé');
for (const r of resultats) console.log(`      · ${r.site.nom}:${r.site.ligne} → ${r.site.argument} [${r.verdict}]`);

// ══ 2 · Chacun porte les deux colonnes ═════════════════════════════════════
console.log('\n── 2 · Aucun n’omet service_id ni client_event_id ──');
for (const r of resultats.filter(x => x.verdict !== 'file')) {
  verifier(`${r.site.nom}:${r.site.ligne} (${r.forme}) porte les deux colonnes`,
    r.verdict === 'conforme',
    r.manquantes && r.manquantes.length
      ? `manque : ${r.manquantes.join(', ')} — le trigger refuserait cette écriture avec 23502`
      : undefined);
}

// ══ 3 · Le rejeu de la file, couvert autrement ═════════════════════════════
// La file ne contient que ce que `fileAjouter` y met, et le rejeu écarte de
// lui-même ce qui ne porte pas de service. Deux mesures, pas une promesse.
console.log('\n── 3 · Le rejeu de la file ne peut rien envoyer d’incomplet ──');
const rejeux = resultats.filter(x => x.verdict === 'file');
// Les deux mesures, réunies en une fonction : le §5 les rejoue sur du code
// muté, ce qu'il ne pourrait pas faire si elles vivaient en ligne ici.
function rejeuCouvert(texte) {
  const appels = [...texte.matchAll(/fileAjouter\(\s*([A-Za-z_$][\w$]*)\s*[,)]/g)].map(m => m[1]);
  const objetsSains = appels.length > 0 && [...new Set(appels)].every(nomObjet =>
    colonnesManquantes(objetInsere({ texte, index: texte.length, argument: nomObjet }).objet).length === 0);
  const posGarde = texte.indexOf('if (!entree.ligne.service_id)');
  const posInsert = texte.indexOf(".from('pointages').insert(entree.ligne)");
  const filtreAvantEnvoi = posGarde > -1 && posInsert > -1 && posGarde < posInsert;
  return { appels, objetsSains, filtreAvantEnvoi, couvert: objetsSains && filtreAvantEnvoi };
}

for (const r of rejeux) {
  const mesure = rejeuCouvert(r.site.texte);
  verifier(`${r.site.nom} : la file n’est alimentée que par des objets nommés`,
    mesure.appels.length > 0, 'aucun appel à fileAjouter : le chemin de file a changé de forme');
  verifier(`${r.site.nom} : ce qui entre en file (${[...new Set(mesure.appels)].map(a => `« ${a} »`).join(', ')}) porte les deux colonnes`,
    mesure.objetsSains, 'un objet mis en file sans service_id ou sans client_event_id sera refusé au rejeu');
  verifier(`${r.site.nom} : une entrée sans service est écartée AVANT d’être envoyée`,
    mesure.filtreAvantEnvoi,
    'sans cette garde, les entrées d’avant le 11/09 seraient rejouées sans fin, refusées à chaque fois');
}

// ══ 4 · Personne d'autre n'écrit dans pointages ════════════════════════════
// NEXUS-Debug-v1.html reprenait un historique d'appareil et l'insérait en
// base sans service : ce chemin-là ne pouvait plus qu'échouer, et il a été
// remplacé par un export le 16/09/2026. Le §1 le reverrait s'il revenait.
console.log('\n── 4 · Le dépôt n’a pas de chemin d’écriture oublié ──');
verifier('aucun site d’insertion n’est illisible pour cette épreuve',
  resultats.every(r => r.site.argument !== null),
  'un `.insert(` dont l’argument ne se referme pas : la mesure serait fausse, pas rassurante');
verifier('aucun site ne s’appuie sur une expression non résolue',
  resultats.every(r => r.verdict === 'file' || r.verdict === 'conforme'
                    || (r.manquantes && r.manquantes.length)),
  'un argument que cette épreuve ne sait pas lire doit être nommé ici, pas ignoré');

// ══ 5 · La garde mord ══════════════════════════════════════════════════════
// Trois mutations, chacune sur le code réel du dépôt, en mémoire seulement.
console.log('\n── 5 · Témoin de mutation : la garde tombe quand le code recule ──');
const CIBLE = 'NEXUS-Pointage-v1.html';
const original = sources.get(CIBLE);
verifier('le fichier de pointage est bien celui qu’on mute', typeof original === 'string');

function mutation(nom, remplacer) {
  const mute = remplacer(original);
  if (mute === original) { verifier(`mutation « ${nom} » : le code visé existe`, false,
    'la mutation n’a rien changé : elle vise un texte disparu, et ne prouve donc rien'); return; }
  verifier(`mutation « ${nom} » : le code visé existe`, true);
  const apres = verdicts(new Map([[CIBLE, mute]]));
  const tombe = apres.some(r => r.verdict === 'manque')
    || apres.some(r => r.verdict === 'file'
        && colonnesManquantes(objetInsere({ texte: mute, index: mute.length, argument: 'ligne' }).objet).length > 0);
  verifier(`mutation « ${nom} » : la garde tombe`, tombe,
    'la garde reste verte sur un code qui serait refusé en base — elle ne protège rien');
}

mutation('le pointage principal perd client_event_id',
  s => s.replace('      client_event_id: evenementClient,\n', ''));
mutation('le pointage principal perd service_id',
  s => s.replace(/ {6}service_id: \(serviceDuJour && serviceDuJour\.id\) \|\| null,\n/, ''));
mutation('la clôture de pause au départ perd ses deux colonnes',
  s => s.replace('          service_id: serviceDuJour.id, client_event_id: identifiantTentative(),\n', ''));

// La garde du rejeu de file, mutée à part : c'est la mesure du §3 qu'on
// rejoue sur le code muté, pas un remplacement de texte qu'on se contenterait
// de constater. Un `!== original` ne prouve qu'une chose : que sed a marché.
const sansFiltre = original.replace('if (!entree.ligne.service_id)', 'if (false)');
verifier('mutation « le rejeu de file ne filtre plus » : le code visé existe',
  sansFiltre !== original,
  'le texte de la garde a changé : c’est le §3 qu’il faut revoir, pas le code');
verifier('mutation « le rejeu de file ne filtre plus » : la mesure du §3 tombe',
  sansFiltre !== original && rejeuCouvert(original).couvert && !rejeuCouvert(sansFiltre).couvert,
  'la mesure reste verte sur un rejeu qui n’écarte plus rien');

const sansClientEventEnFile = original.replace('      client_event_id: evenementClient,\n', '');
verifier('mutation « ce qui entre en file perd client_event_id » : la mesure du §3 tombe',
  sansClientEventEnFile !== original && !rejeuCouvert(sansClientEventEnFile).objetsSains,
  'la file accepterait des tentatives que le serveur refusera à chaque rejeu');

console.log(`\n${echecs === 0 ? '✓' : '✗'} ${reussites} réussite(s), ${echecs} échec(s)\n`);
// Sortie d'échec explicite, pas un ternaire : un échec doit se lire dans le
// code sans l'exécuter.
if (echecs > 0) process.exit(1);
