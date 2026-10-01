'use strict';
// Épreuve de la garde ORDRE-MIGRATION-CODE (outils/garde-ordre-migration-code.js).
//
// CE QUE CETTE ÉPREUVE DOIT PROUVER, et pourquoi c'est elle le point faible.
// Une garde verte ne prouve rien : le 08/09/2026, quatre gardes étaient vertes
// et inutiles. Et le 30/09, un banc est passé au vert « pour la mauvaise
// raison » parce qu'un motif non ancré collait au premier caractère. Donc ici,
// chaque contrôle est un COUPLE : un cas qui doit passer, et la mutation
// minimale du même cas qui doit être REFUSÉE — avec son code de refus exact.
// Si la garde cessait de mordre, ce sont les secondes moitiés qui rougiraient.
//
// La mesure de référence est figée (MAINTENANT) : une épreuve qui dépend de
// l'heure réelle pourrit, et une mesure « périmée » ne doit pas devenir verte
// le jour où quelqu'un rejoue le banc.

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const garde = require('./outils/garde-ordre-migration-code.js');
const { controler, extraireObjets, classer, mesureValide, ETATS } = garde;

let n = 0;
function ok(quoi) { n++; console.log('  ✅ ' + quoi); }

const MAINTENANT = Date.parse('2026-09-30T18:00:00Z');
const MESURE_BONNE = { source: 'catalogue', le: '2026-09-30T14:00:00Z', cible: 'uzhjpqpctpvxytxpxoqz', par: 'frederic' };

// ------------------------------------------------------------------
// Un dépôt jetable : deux refs, une migration nouvelle, du code qui en dépend.
// Le fac-similé reprend la forme exacte de la migration #65 — colonne NOT NULL
// avec défaut, contrainte CHECK, fonction SECURITY DEFINER, trigger remplacé
// par drop-if-exists + create.
// ------------------------------------------------------------------
const MIGRATION_65 = `
alter table public.carburant_reception_visites
  add column if not exists mode_saisie text not null default 'temps_reel',
  add column if not exists regularisation_motif text,
  add column if not exists regularisation_par uuid;

do $$ begin
  alter table public.carburant_reception_visites
    add constraint carburant_reception_visites_mode_saisie_check
    check (mode_saisie in ('temps_reel', 'regularisation'));
exception when duplicate_object then null; end $$;

create or replace function public.nexus_garde_regularisation_reception()
returns trigger language plpgsql security definer set search_path = public
as $$ begin return new; end; $$;

drop trigger if exists trg_garde_regularisation_reception on public.carburant_reception_visites;
create trigger trg_garde_regularisation_reception
before insert or update on public.carburant_reception_visites
for each row execute function public.nexus_garde_regularisation_reception();
`;

function git(depot, args) {
  return execFileSync('git', ['-C', depot, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function depotJetable() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-garde-ordre-'));
  git(d, ['init', '-q', '-b', 'cible']);
  git(d, ['config', 'user.email', 'banc@nexus.test']);
  git(d, ['config', 'user.name', 'Banc NEXUS']);
  git(d, ['config', 'commit.gpgsign', 'false']);
  fs.mkdirSync(path.join(d, 'supabase', 'migrations'), { recursive: true });

  // La cible : deux migrations anciennes, et un écran qui ignore tout du lot.
  fs.writeFileSync(path.join(d, 'supabase/migrations/20260815114849_receptions.sql'),
    'create table if not exists public.carburant_reception_visites (id uuid primary key, site uuid, heure_fin timestamptz);\n');
  fs.writeFileSync(path.join(d, 'supabase/migrations/20260920140000_bascule.sql'), '-- rien\n');
  fs.writeFileSync(path.join(d, 'NEXUS-Carburant-Reception-v1.html'),
    '<script>const charge = { site: s, heure_fin: f, statut: "termine" };</script>\n');
  git(d, ['add', '-A']); git(d, ['commit', '-q', '-m', 'cible']);

  // Le candidat : la migration, et l'écran qui envoie mode_saisie SANS CONDITION.
  git(d, ['checkout', '-q', '-b', 'candidat']);
  fs.writeFileSync(path.join(d, 'supabase/migrations/20260919103000_carburant_reception_regularisation_releve_manuscrit.sql'), MIGRATION_65);
  fs.writeFileSync(path.join(d, 'NEXUS-Carburant-Reception-v1.html'),
    '<script>const charge = { site: s, heure_fin: f, mode_saisie: estRegularisation() ? "regularisation" : "temps_reel" };</script>\n');
  git(d, ['add', '-A']); git(d, ['commit', '-q', '-m', 'candidat #65']);
  return d;
}

function qualifier(depot, fiche) {
  const f = path.join(depot, 'qualification.json');
  fs.writeFileSync(f, JSON.stringify({ migrations: fiche ? { '20260919103000': fiche } : {} }, null, 2));
  return f;
}

function lancer(depot, fiche, extra) {
  return controler(Object.assign({
    depot, candidate: 'candidat', cible: 'cible',
    qualification: qualifier(depot, fiche), maintenant: MAINTENANT, heures: 72,
  }, extra || {}));
}

const D = depotJetable();

// ------------------------------------------------------------------
// A. L'extraction : la garde voit-elle vraiment ce que la migration fait ?
//    Une garde qui n'extrait rien refuserait tout « correctement » — et
//    pour rien. On mesure donc d'abord son instrument.
// ------------------------------------------------------------------
{
  const a = extraireObjets(MIGRATION_65);
  const noms = a.objets.map(o => o.genre + ':' + o.nom);
  assert.ok(noms.includes('colonne:mode_saisie'), 'colonne mode_saisie vue : ' + noms.join(' '));
  assert.ok(noms.includes('colonne:regularisation_motif') && noms.includes('colonne:regularisation_par'),
    'les colonnes suivantes d’un alter multi-lignes sont vues aussi : ' + noms.join(' '));
  assert.ok(noms.includes('contrainte:carburant_reception_visites_mode_saisie_check'), 'contrainte vue');
  assert.ok(noms.includes('fonction:nexus_garde_regularisation_reception'), 'fonction vue');
  assert.ok(noms.includes('trigger:trg_garde_regularisation_reception'), 'trigger vu');
  ok('A1 — l’extraction voit les 3 colonnes, la contrainte, la fonction et le trigger');

  // Mutation : si l'ancre d'extraction se mettait à coller n'importe où, ce
  // contrôle-ci ne le dirait pas — celui-là si.
  const vide = extraireObjets('-- une migration de pure prose, aucun DDL\nselect 1;\n');
  assert.strictEqual(vide.objets.length, 0, 'aucun objet inventé sur une migration sans DDL');
  ok('A2 — contre-témoin : aucun objet inventé là où il n’y a pas de DDL');
}

{
  // Un `drop trigger if exists X` suivi du `create trigger X` est un
  // remplacement : la garde ne doit pas crier au loup, sinon elle sera
  // désactivée et ne protégera plus rien.
  const a = extraireObjets(MIGRATION_65);
  assert.deepStrictEqual(a.destructifs, [], 'drop-puis-create du même trigger n’est pas destructif : ' + a.destructifs.join(','));
  ok('A3 — un objet détruit puis recréé dans le même fichier n’est pas compté comme destruction');

  // Mutation : le même drop SANS le create redevient une destruction.
  const sansRecreation = MIGRATION_65.replace(/create trigger trg_garde_regularisation_reception[\s\S]*$/, '');
  const b = extraireObjets(sansRecreation);
  assert.ok(b.destructifs.some(x => x.startsWith('drop_trigger:')),
    'drop sans recréation est destructif : ' + b.destructifs.join(','));
  ok('A4 — le même drop, sans la recréation, EST compté comme destruction');

  const c = extraireObjets('alter table t drop column vieux;');
  assert.ok(c.destructifs.includes('drop_column'), 'drop column toujours destructif');
  const d2 = extraireObjets('alter table t add column if not exists x text not null;');
  assert.deepStrictEqual(d2.colonnesNotNullSansDefaut, ['x'], 'NOT NULL sans défaut repéré');
  const e2 = extraireObjets("alter table t add column if not exists x text not null default 'y';");
  assert.deepStrictEqual(e2.colonnesNotNullSansDefaut, [], 'NOT NULL AVEC défaut n’est pas signalé');
  ok('A5 — drop column, et NOT NULL sans défaut distingué de NOT NULL avec défaut');
}

// ------------------------------------------------------------------
// B. L'ensemble des migrations : différence de refs, jamais un cardinal.
//    Le 30/09, « 277 contre 276 » avait laissé croire à un écart d'un
//    fichier sans jamais dire LEQUEL.
// ------------------------------------------------------------------
{
  const r = lancer(D, { etat: ETATS.ADDITIVE_AVANT_CODE, mesure: MESURE_BONNE });
  assert.strictEqual(r.migrations.length, 1, 'une seule migration nouvelle');
  assert.strictEqual(r.migrations[0].estampille, '20260919103000', 'estampille extraite du nom de fichier');
  assert.ok(r.ok, 'le cas nominal passe : ' + r.code + '\n' + r.message);
  assert.strictEqual(r.code, 'QUALIFIE');
  // Preuve que le vert n'est pas vide : la garde a bien vu la dépendance du code.
  assert.ok(r.migrations[0].nommePar.some(t => t.identifiant === 'mode_saisie'),
    'le code du candidat est constaté dépendant de mode_saisie');
  assert.strictEqual(r.migrations[0].nommeParCible.length, 0, 'le code de la CIBLE n’en dépend pas');
  ok('B1 — cas nominal : migration additive qualifiée, dépendance du code du candidat constatée');
}

{
  // Aucune migration nouvelle : la question ne se pose pas, et la garde ne
  // doit pas exiger de qualification pour rien.
  const r = controler({ depot: D, candidate: 'cible', cible: 'cible', qualification: qualifier(D, null), maintenant: MAINTENANT });
  assert.ok(r.ok && r.code === 'AUCUNE_MIGRATION_NOUVELLE', 'pas de migration nouvelle = pas de qualification exigée : ' + r.code);
  ok('B2 — sans migration nouvelle, la garde ne réclame rien');
}

{
  // Une migration qui DISPARAÎT du candidat : un candidat doit être un
  // sur-ensemble de sa cible.
  const r = controler({ depot: D, candidate: 'cible', cible: 'candidat', qualification: qualifier(D, null), maintenant: MAINTENANT });
  assert.ok(!r.ok && r.code === 'MIGRATION_RETIREE', 'migration retirée refusée : ' + r.code);
  ok('B3 — une migration de la cible absente du candidat est un refus');
}

// ------------------------------------------------------------------
// C. LE CŒUR : état inconnu = refus fermé. Quatre formes de silence,
//    quatre refus. C'est la moitié de la mission qui tient ici.
// ------------------------------------------------------------------
{
  const cas = [
    ['aucune fiche du tout',            null,                                                   'MIGRATION_NON_QUALIFIEE'],
    ['fiche sans champ etat',           { mesure: MESURE_BONNE },                               'ETAT_INCONNU'],
    ['etat explicitement inconnu',      { etat: ETATS.INCONNU, mesure: MESURE_BONNE },           'ETAT_INCONNU'],
    ['etat hors des cinq',              { etat: 'ca_devrait_aller', mesure: MESURE_BONNE },      'ETAT_NON_RECONNU'],
  ];
  for (const [quoi, fiche, attendu] of cas) {
    const r = lancer(D, fiche);
    assert.ok(!r.ok, quoi + ' : devait être refusé, a passé');
    assert.strictEqual(r.code, attendu, quoi + ' : code attendu ' + attendu + ', obtenu ' + r.code);
  }
  ok('C1 — les quatre formes d’état non qualifié sont REFUSÉES (refus fermé, pas une attente)');
}

{
  // Le fichier de qualification absent ne vaut pas « conforme », et illisible
  // encore moins : une référence illisible ne conclut rien.
  const r1 = controler({ depot: D, candidate: 'candidat', cible: 'cible', qualification: path.join(D, 'nexiste-pas.json'), maintenant: MAINTENANT });
  assert.ok(!r1.ok && r1.code === 'MIGRATION_NON_QUALIFIEE', 'fichier absent = refus : ' + r1.code);
  const f = path.join(D, 'casse.json'); fs.writeFileSync(f, '{ ceci n’est pas du JSON');
  const r2 = controler({ depot: D, candidate: 'candidat', cible: 'cible', qualification: f, maintenant: MAINTENANT });
  assert.ok(!r2.ok && r2.code === 'QUALIFICATION_ILLISIBLE', 'fichier illisible = refus : ' + r2.code);
  ok('C2 — qualification absente ou illisible : refus, jamais « conforme »');
}

// ------------------------------------------------------------------
// D. La dent tirée de la mesure du 30/09 : le REGISTRE ne qualifie pas un
//    SCHÉMA. Mesuré ce jour-là sur Test — les sept colonnes, les deux
//    contraintes, la fonction et le trigger présents, estampille absente du
//    registre, et 286/287 lignes du registre avec statements à NULL.
//    Si cette moitié-ci devenait verte, la garde aurait réappris l'erreur.
// ------------------------------------------------------------------
{
  const parCatalogue = lancer(D, { etat: ETATS.ADDITIVE_AVANT_CODE, mesure: MESURE_BONNE });
  assert.ok(parCatalogue.ok, 'une mesure sur le catalogue est recevable');

  for (const source of ['registre', 'supabase_migrations', 'schema_migrations', 'migration list']) {
    const r = lancer(D, { etat: ETATS.ADDITIVE_AVANT_CODE, mesure: Object.assign({}, MESURE_BONNE, { source }) });
    assert.ok(!r.ok, 'mesure « ' + source + ' » devait être refusée');
    assert.strictEqual(r.code, 'MESURE_NON_RECEVABLE', 'mesure « ' + source + '  » : ' + r.code);
    assert.ok(/registre des migrations ne/.test(r.message), 'le refus doit DIRE pourquoi, pas seulement refuser');
  }
  ok('D1 — une qualification mesurée sur le registre est REFUSÉE ; sur le catalogue, acceptée');

  assert.ok(mesureValide({ source: 'schema', le: '2026-09-30T14:00:00Z', cible: 'x' }, MAINTENANT, 72).ok,
    '« schema » est accepté comme synonyme de catalogue');
  ok('D2 — « catalogue », « schema » et « schéma » sont les seules sources recevables');
}

{
  // Une observation est datée. « Une impossibilité constatée le 28 septembre
  // ne doit jamais devenir une propriété permanente en octobre sans nouvelle
  // mesure. » Une base bouge : la qualification périme.
  const cas = [
    ['sans mesure du tout',  {},                                                          'MESURE_ABSENTE'],
    ['sans date',            { source: 'catalogue', cible: 'x' },                          'MESURE_SANS_DATE'],
    ['sans cible',           { source: 'catalogue', le: '2026-09-30T14:00:00Z' },          'MESURE_SANS_CIBLE'],
    ['vieille de 5 jours',   { source: 'catalogue', le: '2026-09-25T14:00:00Z', cible: 'x' }, 'MESURE_PERIMEE'],
    ['datée dans le futur',  { source: 'catalogue', le: '2026-10-05T14:00:00Z', cible: 'x' }, 'MESURE_DANS_LE_FUTUR'],
  ];
  for (const [quoi, mesure, attendu] of cas) {
    const r = lancer(D, { etat: ETATS.ADDITIVE_AVANT_CODE, mesure });
    assert.ok(!r.ok, quoi + ' : devait être refusé');
    assert.strictEqual(r.code, attendu, quoi + ' : attendu ' + attendu + ', obtenu ' + r.code);
  }
  // Mutation inverse : la même mesure, de 4 h d'âge, passe.
  const frais = lancer(D, { etat: ETATS.ADDITIVE_AVANT_CODE, mesure: MESURE_BONNE });
  assert.ok(frais.ok, 'une mesure de 4 h passe — la péremption n’est pas un refus permanent');
  ok('D3 — une mesure sans date, sans cible, périmée ou future est refusée ; fraîche, elle passe');
}

// ------------------------------------------------------------------
// E. Chacun des quatre états exigibles a sa propre dent.
// ------------------------------------------------------------------
{
  // « déjà appliquée » : une affirmation nue est refusée ; il faut avoir
  // constaté les objets UN PAR UN. C'est exactement ce qui manquait le 30/09
  // quand le registre disait « non enregistrée » et que le schéma de Test
  // portait tout.
  const nue = lancer(D, { etat: ETATS.DEJA_APPLIQUEE, mesure: MESURE_BONNE });
  assert.ok(!nue.ok && nue.code === 'OBJETS_NON_CONSTATES', 'affirmation nue refusée : ' + nue.code);

  const partielle = lancer(D, {
    etat: ETATS.DEJA_APPLIQUEE, mesure: MESURE_BONNE,
    objets_constates: ['mode_saisie', 'regularisation_motif'],
  });
  assert.ok(!partielle.ok && partielle.code === 'OBJETS_NON_CONSTATES',
    'un constat PARTIEL est refusé : ' + partielle.code);
  assert.ok(partielle.message.includes('trg_garde_regularisation_reception'),
    'le refus nomme l’objet non constaté');

  const complete = lancer(D, {
    etat: ETATS.DEJA_APPLIQUEE, mesure: MESURE_BONNE,
    objets_constates: ['mode_saisie', 'regularisation_motif', 'regularisation_par',
      'carburant_reception_visites_mode_saisie_check',
      'nexus_garde_regularisation_reception', 'trg_garde_regularisation_reception'],
  });
  assert.ok(complete.ok, 'un constat objet par objet passe : ' + complete.code + '\n' + complete.message);
  ok('E1 — « déjà appliquée » exige le constat de CHAQUE objet ; partiel = refus');
}

{
  // « exige code d'abord » et « atomique » exigent une procédure écrite ET
  // existante. Une preuve de fonction n'est pas une preuve de câblage : un
  // chemin déclaré mais absent du dépôt ne protège personne.
  for (const etat of [ETATS.EXIGE_CODE_D_ABORD, ETATS.ATOMIQUE]) {
    const sans = lancer(D, { etat, mesure: MESURE_BONNE });
    assert.ok(!sans.ok && sans.code === 'PROCEDURE_ABSENTE', etat + ' sans procédure : ' + sans.code);
    const fantome = lancer(D, { etat, mesure: MESURE_BONNE, procedure: 'docs/deploiement/jamais-ecrite.md' });
    assert.ok(!fantome.ok && fantome.code === 'PROCEDURE_INTROUVABLE', etat + ' procédure fantôme : ' + fantome.code);
  }
  fs.mkdirSync(path.join(D, 'docs', 'deploiement'), { recursive: true });
  fs.writeFileSync(path.join(D, 'docs/deploiement/procedure.md'), 'les gestes, dans l’ordre\n');
  const bonne = lancer(D, { etat: ETATS.ATOMIQUE, mesure: MESURE_BONNE, procedure: 'docs/deploiement/procedure.md' });
  assert.ok(bonne.ok, 'procédure réellement présente : ' + bonne.code + '\n' + bonne.message);
  ok('E2 — « code d’abord » et « atomique » exigent une procédure qui existe VRAIMENT dans le dépôt');
}

{
  // « additive compatible avant code » est la seule des cinq que la garde
  // peut CONTREDIRE mécaniquement — et elle doit le faire.
  const avecDestruction = classer({
    estampille: '20260919103000',
    fiche: { etat: ETATS.ADDITIVE_AVANT_CODE, mesure: MESURE_BONNE },
    analyse: { objets: [], destructifs: ['drop_column'], colonnesNotNullSansDefaut: [] },
    nommePar: [], nommeParCible: [], racine: D, maintenant: MAINTENANT, heures: 72,
  });
  assert.strictEqual(avecDestruction.refus && avecDestruction.refus.code, 'ADDITIVE_IMPOSSIBLE_DDL_DESTRUCTIF',
    'additive + drop column = contradiction');

  const notNull = classer({
    estampille: '20260919103000',
    fiche: { etat: ETATS.ADDITIVE_AVANT_CODE, mesure: MESURE_BONNE },
    analyse: { objets: [], destructifs: [], colonnesNotNullSansDefaut: ['x'] },
    nommePar: [], nommeParCible: [], racine: D, maintenant: MAINTENANT, heures: 72,
  });
  assert.strictEqual(notNull.refus && notNull.refus.code, 'ADDITIVE_IMPOSSIBLE_NOT_NULL_SANS_DEFAUT',
    'additive + NOT NULL sans défaut = contradiction');

  // Mais la MÊME migration destructive déclarée « atomique » avec procédure
  // passe : la garde arbitre l'ordre, elle n'interdit pas le DDL.
  const atomique = classer({
    estampille: '20260919103000',
    fiche: { etat: ETATS.ATOMIQUE, mesure: MESURE_BONNE, procedure: 'docs/deploiement/procedure.md' },
    analyse: { objets: [], destructifs: ['drop_column'], colonnesNotNullSansDefaut: [] },
    nommePar: [], nommeParCible: [], racine: D, maintenant: MAINTENANT, heures: 72,
  });
  assert.strictEqual(atomique.refus, null, 'destructif + atomique + procédure : la garde laisse passer');
  ok('E3 — « additive » est contredite mécaniquement par un DDL destructif ; « atomique » l’assume');
}

{
  // Si le code DÉJÀ en cible nomme les nouveaux objets, ce n'est plus un
  // choix d'ordre : la cible est déjà dépendante, donc déjà cassée. Ce cas
  // doit se voir, pas se fondre dans « additive, tout va bien ».
  const r = classer({
    estampille: '20260919103000',
    fiche: { etat: ETATS.ADDITIVE_AVANT_CODE, mesure: MESURE_BONNE },
    analyse: { objets: [{ genre: 'colonne', nom: 'mode_saisie' }], destructifs: [], colonnesNotNullSansDefaut: [] },
    nommePar: [], nommeParCible: [{ identifiant: 'mode_saisie', fichiers: ['cible:ecran.html'] }],
    racine: D, maintenant: MAINTENANT, heures: 72,
  });
  assert.strictEqual(r.refus && r.refus.code, 'CIBLE_DEJA_DEPENDANTE', 'cible déjà dépendante : ' + JSON.stringify(r.refus));
  ok('E4 — une cible dont le code nomme déjà les nouveaux objets est signalée comme panne en cours');
}

// ------------------------------------------------------------------
// F. Le refus doit être LISIBLE. Une garde qui refuse sans dire quoi faire
//    est contournée, et une garde contournée rassure sans protéger.
// ------------------------------------------------------------------
{
  const r = lancer(D, null);
  assert.ok(!r.ok);
  assert.ok(r.message.includes('20260919103000'), 'le refus nomme la migration');
  assert.ok(r.message.includes('mode_saisie'), 'le refus nomme les objets vus');
  assert.ok(/code du candidat qui en dépend\s*:.*mode_saisie/.test(r.message),
    'le refus dit que le code en dépend : ' + r.message);
  assert.ok(/Qualification attendue dans\s*:/.test(r.message), 'le refus dit OÙ qualifier');
  assert.ok(r.message.includes('refus fermé'), 'le refus dit que l’état inconnu est fermé');
  ok('F1 — un refus nomme la migration, ses objets, la dépendance du code et où la qualifier');
}

{
  // La garde ne doit jamais ouvrir une base ni lire un secret : elle lit des
  // refs Git et un fichier. Contrôle statique sur sa propre source.
  const src = fs.readFileSync(path.join(__dirname, 'outils', 'garde-ordre-migration-code.js'), 'utf8');
  for (const interdit of ['PGPASSWORD', 'psql', 'service_role', 'SUPABASE_', 'DB_URL', 'https://']) {
    assert.ok(!src.includes(interdit), 'la garde ne doit pas contenir « ' + interdit + ' »');
  }
  assert.ok(!/require\(['"](https?|net|tls)/.test(src), 'aucun accès réseau');
  ok('F2 — la garde n’ouvre aucune base, ne nomme aucun secret, n’a aucun accès réseau');
}

// ------------------------------------------------------------------
// G. 01/10/2026 — l'option mal nommée. La garde a rendu un REFUS plausible
//    pour avoir reçu `candidat` au lieu de `candidate` : l'option inconnue
//    était ignorée, le candidat retombait sur `HEAD`, et le rouge obtenu ne
//    parlait pas de la PR jugée. Un verdict pour la mauvaise raison est pire
//    qu'une panne, parce qu'il se lit comme un verdict.
// ------------------------------------------------------------------
{
  // Une clé hors contrat ne doit pas produire de verdict — ni vert, ni rouge.
  assert.throws(
    () => controler({ depot: D, refCandidat: 'candidat', cible: 'cible', maintenant: MAINTENANT }),
    /option\(s\) non reconnue\(s\) : refCandidat/,
    'une option inconnue doit lever, pas retomber sur HEAD en silence');
  ok('G1 — une option non reconnue est incapable de produire un verdict');
}

{
  // `candidat` est l'orthographe de la maison — toutes les autres options de
  // la garde sont françaises. Elle doit désigner le MÊME candidat, pas être
  // avalée. C'est l'assertion qui rougit sans le correctif.
  const q = qualifier(D, { etat: ETATS.ADDITIVE_AVANT_CODE, mesure: MESURE_BONNE });
  const fr = controler({ depot: D, candidat: 'candidat', cible: 'cible', qualification: q, maintenant: MAINTENANT });
  const en = controler({ depot: D, candidate: 'candidat', cible: 'cible', qualification: q, maintenant: MAINTENANT });
  assert.strictEqual(fr.ok, en.ok, '`candidat` et `candidate` doivent rendre le même verdict');
  assert.strictEqual(fr.message, en.message, '`candidat` doit désigner la même ref que `candidate`');
  assert.ok(/candidat : candidat\s/.test(fr.message), 'la ref reçue doit être celle passée : ' + fr.message);
  ok('G2 — `candidat` désigne la même ref que `candidate`, il n’est pas avalé');
}

{
  // Deux orthographes contradictoires : la garde ne choisit pas pour nous.
  assert.throws(
    () => controler({ depot: D, candidat: 'candidat', candidate: 'cible', cible: 'cible', maintenant: MAINTENANT }),
    /valeurs diff\u00e9rentes/,
    'deux orthographes en désaccord doivent lever');
  ok('G3 — `candidat` et `candidate` en désaccord : refus de deviner');
}

fs.rmSync(D, { recursive: true, force: true });
console.log(`\n${n} tests passés.`);
