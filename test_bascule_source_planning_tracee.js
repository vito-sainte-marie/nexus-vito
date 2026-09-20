const assert = require('assert');
const fs = require('fs');

// Etape 5 du chantier « source unique de planning » : declarer la source
// officielle d'un site est DEUX ecritures — le reglage `station_config
// .planning_source` et sa trace `planning_source_periodes` — que la garde
// differee `trg_planning_source_coherence` exige de voir ensemble.
//
// Ce que cette epreuve protege : depuis `20260919180000`, l'ecran faisait
// encore l'`update` seul. PostgREST ouvre une transaction par requete, la
// garde se verifie au COMMIT, et le bouton « Enregistrer la source
// officielle » rendait donc 23514 a tout coup. Temoin joue sur Test le
// 19/09/2026 :
//
//   A. update station_config seul      -> REFUSE 23514
//   B. update + insert dans la meme tx -> ACCEPTE
//
// La correction n'est pas de relacher la garde, c'est de rendre le geste
// qu'elle exige : la RPC `basculer_source_planning`.

// Les chemins sont resolus depuis le fichier, pas depuis le repertoire
// courant : une epreuve qui depend du cwd echoue en ENOENT et se fait prendre
// pour un refus de garde. Une campagne de mutation entiere y est deja passee.
const path = require('path');
const RACINE = __dirname;

const parametres = fs.readFileSync(path.join(RACINE, 'NEXUS-Parametres-Station-v1.html'), 'utf8');
const lire = nom => {
  const d = path.join(RACINE, 'supabase/migrations');
  const f = fs.readdirSync(d).filter(x => x.includes(nom) && x.endsWith('.sql')).sort().pop();
  if (!f) throw new Error(`migration ${nom} introuvable`);
  return fs.readFileSync(`${d}/${f}`, 'utf8');
};
const bascule = lire('bascule_source_planning_tracee');
const importGoogle = lire('import_planning_google_sheets');
const epreuveSql = fs.readFileSync(path.join(RACINE, 'outils/epreuve-bascule-source-planning.sql'), 'utf8');

// --- 1. L'ecran ne declare plus la source par un update direct -------------
// `planning_source` reste lu (le `select` de `chargerConfigPlanning`), mais
// plus jamais ecrit comme propriete d'un objet passe a `.update()`.
assert.ok(!parametres.includes('planning_source:'),
  "Parametres Station ecrit encore planning_source directement : la trace ne suivrait pas");

// --- 2. Il appelle la RPC, avec le motif ------------------------------------
const appel = parametres.indexOf("rpc('basculer_source_planning'");
assert.ok(appel > 0, 'Parametres Station n\'appelle pas basculer_source_planning');
// Fenetre bornee a la FIN de la fonction, pas a un nombre de caracteres :
// le compte rendu s'est enrichi le 19/09/2026 des cas retroactifs, et une
// fenetre fixe de 1400 signes l'a laisse sortir du champ alors qu'il etait
// intact. Une epreuve ne doit pas rougir parce qu'un texte a grandi.
const finFenetre = parametres.indexOf('rendreHistoriqueBascules();', appel);
assert.ok(finFenetre > appel, 'la fin de la bascule est introuvable : l\'epreuve ne juge plus rien');
const fenetre = parametres.slice(appel, finFenetre);
assert.ok(/p_site:\s*employee\.site_id/.test(fenetre),
  'la bascule doit viser le site de l\'employe connecte, jamais un site en dur');
assert.ok(/p_source:\s*source/.test(fenetre), 'la source choisie n\'est pas transmise');
assert.ok(/p_motif:\s*champMotif\.value/.test(fenetre), 'le motif saisi n\'est pas transmis');

// --- 3. Le compte rendu est celui de la base, pas celui de l'appareil -------
// La date d'effet est calculee dans le fuseau de la STATION par la base. Si
// l'ecran la reconstituait avec un `new Date()`, un manager en metropole
// annoncerait la veille de ce qui a ete inscrit.
assert.ok(fenetre.includes('compte.date_effet') && fenetre.includes('compte.source_precedente'),
  'le compte rendu doit reprendre la date d\'effet et la source precedente rendues par la base');
assert.ok(fenetre.includes('compte.inchangee'),
  'une declaration qui ne change rien doit se dire autrement qu\'une bascule');
assert.ok(!/new Date\(\)/.test(fenetre),
  'l\'ecran ne date pas une bascule : c\'est le jour metier de la station qui fait foi');

// --- 4. Motif et historique existent a l'ecran ------------------------------
assert.ok(parametres.includes('id="planningSourceMotif"') && parametres.includes('id="planningSourceHisto"'),
  'le champ motif et l\'historique des changements manquent dans la carte');
assert.ok(parametres.includes("from('planning_source_periodes')"),
  'l\'historique des bascules n\'est pas lu');
// L'ecran LIT le registre ; il n'y ecrit pas de son cote, sans quoi la trace
// pourrait exister sans le reglage qu'elle est censee attester.
const registre = parametres.indexOf("from('planning_source_periodes')");
assert.ok(/\.select\(/.test(parametres.slice(registre, registre + 200)),
  'la lecture du registre doit etre un select');
assert.ok(!/from\('planning_source_periodes'\)[\s\S]{0,200}\.(insert|upsert|update|delete)\(/.test(parametres),
  'seule la RPC ecrit dans planning_source_periodes');
// Les motifs et les noms sont des saisies libres : ils sont echappes.
assert.ok(/psh-motif[\s\S]{0,80}echapperTexte\(l\.motif\)/.test(parametres),
  'le motif affiche doit etre echappe');

// `date_effet` est un jour metier de la STATION. Le faire passer par un `Date`
// le reprojetterait dans le fuseau de l'appareil, et un manager en metropole
// lirait la veille de ce que la base a inscrit. La garde est bornee au corps de
// la fonction : c'est la seule qui touche a cette date.
const debutFmt = parametres.indexOf('function formaterJourMetier(');
assert.ok(debutFmt > 0, 'formaterJourMetier est introuvable');
const corpsFmt = parametres.slice(debutFmt, parametres.indexOf('\n  }', debutFmt));
// Une fenetre qui deborde rend la garde muette : elle trouverait `Date` plus
// loin dans l'ecran et resterait verte quoi qu'il arrive ici.
assert.ok(corpsFmt.length > 80 && corpsFmt.length < 400,
  `fenetre de formaterJourMetier aberrante (${corpsFmt.length} car.)`);
assert.ok(!/Date/.test(corpsFmt),
  'formaterJourMetier reprojette le jour metier de la station dans le fuseau de l\'appareil');
assert.ok(/\/\^\(\\d\{4\}\)-\(\\d\{2\}\)-\(\\d\{2\}\)\//.test(corpsFmt),
  'formaterJourMetier ne decoupe plus la chaine ISO telle quelle');

// --- 5. Les refus de la base sont affiches tels qu'elle les formule ---------
// Cherches dans la liste elle-meme, pas n'importe ou dans le fichier : un code
// cite en commentaire n'a jamais traduit un refus pour personne.
const listeRefus = /const REFUS_BASCULE_CONNUS = \[([^\]]*)\]/.exec(parametres);
assert.ok(listeRefus, 'la liste des refus traduits est introuvable');
['22023', 'P0002', '42501', '23514'].forEach(code => assert.ok(
  listeRefus[1].includes(`'${code}'`), `le code de refus ${code} n'est pas traite par l'ecran`));
assert.ok(/messageRefusBascule\(error\)/.test(fenetre),
  'le refus de la base n\'est pas affiche au manager');

// --- 6. La base porte les deux ecritures et borne la correction -------------
// Les reperes sont ancres en DEBUT DE LIGNE : commenter un `revoke` le laisse
// present dans le fichier, et une garde qui cherche une sous-chaine n'importe
// ou reste verte pendant que le privilege revient.
const ligne = motif => new RegExp('^' + motif, 'm');
assert.ok(ligne('create or replace function public\\.basculer_source_planning\\(').test(bascule));
assert.ok(ligne('revoke all on function public\\.basculer_source_planning\\(text, text, text\\) from anon;').test(bascule),
  'la RPC de bascule reste executable par anon');
assert.ok(ligne('grant execute on function public\\.basculer_source_planning\\(text, text, text\\) to authenticated;').test(bascule));

// `security definer` donnerait a n'importe quel employe le pouvoir de declarer
// la source de son site : la RPC doit rester invoker et se heurter a la RLS de
// `station_config`, qui la reserve au manager et au gerant.
const debutRpc = bascule.indexOf('create or replace function public.basculer_source_planning');
const enTeteRpc = bascule.slice(debutRpc, bascule.indexOf('as $fn$', debutRpc));
assert.ok(enTeteRpc.length > 0 && enTeteRpc.length < 400, 'en-tete de la RPC introuvable');
assert.ok(!/security\s+definer/.test(enTeteRpc), 'basculer_source_planning doit rester security invoker');

assert.ok(ligne('create policy update_planning_source_periodes on public\\.planning_source_periodes').test(bascule),
  'la correction du jour meme n\'est pas ouverte');
// Une fois dans le `using`, une fois dans le `with check` : la seconde manque
// souvent, et c'est elle qui empeche d'ECRIRE hors des bornes.
const debutPol = bascule.search(/^create policy update_planning_source_periodes /m);
const corpsPol = bascule.slice(debutPol, bascule.indexOf(';', debutPol));
const deuxFois = (motif, plainte) => assert.strictEqual(
  (corpsPol.match(motif) || []).length, 2, plainte);
// Trois bornes, chacune presente dans le `using` ET dans le `with check` : la
// seconde manque souvent, et c'est elle qui empeche d'ECRIRE hors des bornes —
// un `with check (true)` laisserait corriger une bascule vers n'importe quoi.
deuxFois(/\bsite = \(select public\.current_employee_site_id\(\)\)/g,
  'la policy doit borner la correction au site de l\'appelant des deux cotes');
deuxFois(/current_employee_role\(\)\) in \('manager', 'gerant'\)/g,
  'la policy doit reserver la correction au manager et au gerant des deux cotes');
deuxFois(/public\.planning_bascule_modifiable\(site, date_effet\)/g,
  'la policy doit borner la correction au jour metier de la station des deux cotes');
// Une fonction appelee depuis une policy ne doit jamais lever : l'ordre des
// `and` n'est pas garanti, et une ligne simplement hors perimetre deviendrait
// une panne. D'ou la jumelle booleenne a cote de celle qui refuse.
assert.ok(/create or replace function public\.planning_bascule_modifiable[\s\S]{0,400}language sql/.test(bascule),
  'planning_bascule_modifiable doit rester une fonction sql sans levee');
assert.ok(ligne('revoke all on table public\\.planning_source_periodes from authenticated;').test(bascule),
  'TRUNCATE et DELETE restent accordes a authenticated sur le registre');
const revoque = bascule.search(/^revoke all on table public\.planning_source_periodes from authenticated;$/m);
const accorde = bascule.search(/^grant select, insert, update on table public\.planning_source_periodes to authenticated;$/m);
assert.ok(revoque > 0 && accorde > revoque, 'le grant doit suivre le revoke, sinon il est efface');
assert.ok(/create or replace function public\.planning_source_periodes_normalise[\s\S]*?tg_op = 'UPDATE'/.test(bascule),
  'le trigger ne distingue pas une correction d\'une bascule neuve');
assert.ok(/^\s*before insert or update on public\.planning_source_periodes$/m.test(bascule),
  'le trigger ne couvre pas les corrections');
// Le commentaire pose par 20260919180000 annoncait une table « en AJOUT SEUL ».
const debutComm = bascule.search(/^comment on table public\.planning_source_periodes is$/m);
assert.ok(debutComm > 0, 'le commentaire de la table doit etre remis a jour avec la policy de correction');
// Borne au commentaire lui-meme : la prose de la migration a le droit de
// raconter ce que la table ETAIT, c'est ce qu'elle DIT d'elle-meme aux
// prochains qui la liront qui ne doit plus mentir.
const commTable = bascule.slice(debutComm, bascule.indexOf(';', debutComm));
assert.ok(!/ajout seul/i.test(commTable),
  'le commentaire de la table annonce encore une table en ajout seul');
assert.ok(/update_planning_source_periodes/.test(commTable),
  'le commentaire de la table ne dit pas ce que la correction du jour meme autorise');

// --- 7. Dette du lot precedent refermee ------------------------------------
// `revoke ... from public` n'a jamais ferme `anon` : Supabase lui accorde
// EXECUTE par un grant nomme.
assert.ok(ligne('revoke all on function public\\.importer_planning_google\\(text, date, date, jsonb, uuid, uuid\\) from anon;').test(bascule),
  'importer_planning_google reste executable par anon');
assert.ok(ligne('grant execute on function public\\.importer_planning_google').test(importGoogle),
  'repere de la migration d\'import perdu');

// --- 8. L'epreuve SQL couvre les deux points de vue -------------------------
assert.ok(epreuveSql.includes('set local role authenticated;') && epreuveSql.includes('reset role;'),
  'l\'epreuve SQL ne se joue pas aussi du point de vue d\'un manager');
assert.ok(/rollback;\s*$/.test(epreuveSql.trim() + '\n') || epreuveSql.includes('rollback;'),
  'l\'epreuve SQL doit se defaire d\'elle-meme');
assert.ok(epreuveSql.includes('truncate'), 'l\'epreuve SQL ne controle pas TRUNCATE');

console.log('Bascule de source de planning : ecran branche sur la RPC, trace et correction bornees.');
