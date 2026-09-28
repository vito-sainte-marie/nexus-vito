// Épreuves de la garde des branches en rade (outils/garde-branches-en-rade.js).
//
// Ce que ces épreuves défendent : une garde de ce genre échoue de deux façons
// opposées, et la seconde est la plus dangereuse.
//
// Elle échoue en criant trop — 19 signalements sur 20 au premier jet mesuré —
// auquel cas on la désactive et elle emporte les vraies trouvailles avec elle.
//
// Et elle échoue en se taisant : un classement bâclé, une entrée mal formée,
// un clone sans références distantes, et la garde répond « aucune branche en
// rade » avec l'aplomb du silence. C'est le mode de défaillance qui compte,
// parce qu'il ressemble exactement au succès.
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { spawnSync } = require('child_process');

const OUTIL = path.join(__dirname, 'outils', 'garde-branches-en-rade.js');
const { analyser, validerEntree, renvoisDuBacklog, releverDepot, lireAutorites, resoudreRegle, SORTS, AUTORITES } = require(OUTIL);

let passes = 0;
function t(nom, fn) { fn(); passes++; console.log('OK — ' + nom); }

// Une autorité de laboratoire. Les épreuves d'origine ont été écrites quand la
// garde tenait une référence unique et implicite ; la référence est désormais
// portée par la branche. Leur sujet n'a pas changé — on leur rend seulement la
// référence qu'elles avaient sans le dire.
const AUT = { nom: 'canonique-test', tete: 'c'.repeat(40), date: '2026-09-08' };
const TABLE = { regles: [{ motif: 'claude/', autorite: 'canonique-test', examine: true }] };
const SHA_A = 'a'.repeat(40);
const SHA_B = 'b'.repeat(40);
const classement = (sur) => ({ branche: 'claude/x', tete: sur, sort: 'INTEGREE', motif: 'contenu repris à la main' });
const codes = (s) => s.map(x => x.code).sort();
const bloquants = (s) => s.filter(x => x.bloquant);

t('un dépôt sans branche en rade ne dit rien', () => {
  // Sans cette épreuve, toutes les suivantes passeraient avec une garde qui
  // signale absolument tout.
  const s = analyser({
    branches: [{ nom: 'claude/x', tete: SHA_A, autorite: AUT }],
    contenues: new Set(['claude/x']),
    classees: [],
  });
  assert.deepStrictEqual(s, []);
});

t('une branche non fusionnée et non classée est EN RADE, et elle est nommée', () => {
  // Le défaut du 08/09/2026 : trois branches portaient du travail réel, dont
  // une décision d'arbitrage attendue, et rien ne le disait.
  const s = analyser({
    branches: [{ nom: 'claude/issue-28-20260907-2119', tete: SHA_A, autorite: AUT }],
    contenues: new Set(),
    classees: [],
  });
  assert.deepStrictEqual(codes(s), ['EN_RADE']);
  assert.strictEqual(bloquants(s).length, 1, 'une branche en rade doit bloquer');
  assert.ok(/20260907-2119/.test(s[0].texte), 'la branche doit être nommée : ' + s[0].texte);
});

t('une branche classée se tait', () => {
  const s = analyser({
    branches: [{ nom: 'claude/x', tete: SHA_A, autorite: AUT }],
    contenues: new Set(),
    classees: [classement(SHA_A)],
  });
  assert.deepStrictEqual(s, []);
});

t('un classement ne couvre QUE le sha qu’il a vu', () => {
  // Sans cela, classer une branche une fois la rendrait muette à jamais — y
  // compris pour du travail poussé le lendemain, qui est précisément le cas
  // que cette garde existe pour attraper.
  const s = analyser({
    branches: [{ nom: 'claude/x', tete: SHA_B, autorite: AUT }],
    contenues: new Set(),
    classees: [classement(SHA_A)],
  });
  assert.deepStrictEqual(codes(s), ['REPRISE']);
  assert.strictEqual(bloquants(s).length, 1);
  assert.ok(/aaaaaaa/.test(s[0].texte) && /bbbbbbb/.test(s[0].texte),
    'les deux shas doivent être lisibles : ' + s[0].texte);
});

t('un classement MAL FORMÉ ne classe rien — la branche reste en rade', () => {
  // Le mode de défaillance qui compte. Une entrée bâclée qui ferait taire une
  // branche transformerait ce registre en interrupteur, alors qu'il est une
  // trace de décision.
  for (const casse of [
    { ...classement(SHA_A), tete: 'aaaa' },
    { ...classement(SHA_A), sort: 'RANGE' },
    { ...classement(SHA_A), motif: '   ' },
    { ...classement(SHA_A), motif: undefined },
  ]) {
    const s = analyser({ branches: [{ nom: 'claude/x', tete: SHA_A, autorite: AUT }], contenues: new Set(), classees: [casse] });
    assert.deepStrictEqual(codes(s), ['CLASSEMENT_INVALIDE'], JSON.stringify(casse));
    assert.strictEqual(bloquants(s).length, 1, 'un classement inexploitable doit bloquer : ' + JSON.stringify(casse));
    assert.ok(/reste donc en rade/.test(s[0].texte), s[0].texte);
  }
});

t('un sort hors vocabulaire ne classe rien', () => {
  assert.ok(validerEntree({ ...classement(SHA_A), sort: 'AUTRE' }).length);
  assert.ok(validerEntree({ ...classement(SHA_A), sort: 'TRANSPORTE' }).length,
    'l’ancien vocabulaire inventé ici ne doit plus passer');
});

t('A_REPRENDRE sans renvoi ne classe rien — le registre n’est pas un placard', () => {
  // Ce sort reconnaît qu'il RESTE du travail. Sans destination, il ferait taire
  // la garde sur une dette dont plus rien ne porterait la trace. Le travail en
  // attente se suit au Backlog ; le registre ne dit que le sort de la branche.
  const sans = { branche: 'claude/x', tete: SHA_A, sort: 'A_REPRENDRE', motif: 'garanties event-driven à comparer' };
  const s = analyser({ branches: [{ nom: 'claude/x', tete: SHA_A, autorite: AUT }], contenues: new Set(), classees: [sans] });
  assert.deepStrictEqual(codes(s), ['CLASSEMENT_INVALIDE']);
  assert.ok(/renvoi/.test(s[0].texte), s[0].texte);
  // Avec un renvoi, il classe.
  const avec = { ...sans, renvoi: 'GOV-002' };
  assert.deepStrictEqual(validerEntree(avec), []);
  assert.deepStrictEqual(
    analyser({ branches: [{ nom: 'claude/x', tete: SHA_A, autorite: AUT }], contenues: new Set(), classees: [avec] }), []);
  // Et le renvoi n'est exigé que pour A_REPRENDRE : les autres sorts sont clos.
  for (const sort of SORTS.filter(x => x !== 'A_REPRENDRE')) {
    assert.deepStrictEqual(validerEntree({ branche: 'claude/x', tete: SHA_A, sort, motif: 'm' }), [], sort);
  }
});

t('un renvoi qui ne désigne AUCUNE entrée du Backlog ne classe rien', () => {
  // Un renvoi inventé est un placard avec une belle étiquette : il rassure
  // sans rien suivre. Vérifier la seule FORME de l'identifiant aurait laissé
  // passer « GOV-999 ».
  const connus = new Set(['ARCH-003']);
  const bidon = { branche: 'claude/x', tete: SHA_A, sort: 'A_REPRENDRE', motif: 'm', renvoi: 'GOV-999' };
  const s = analyser({ branches: [{ nom: 'claude/x', tete: SHA_A, autorite: AUT }], contenues: new Set(),
    classees: [bidon], renvoisConnus: connus });
  assert.deepStrictEqual(codes(s), ['CLASSEMENT_INVALIDE']);
  assert.ok(/GOV-999/.test(s[0].texte), s[0].texte);
  const vrai = { ...bidon, renvoi: 'ARCH-003' };
  assert.deepStrictEqual(analyser({ branches: [{ nom: 'claude/x', tete: SHA_A, autorite: AUT }], contenues: new Set(),
    classees: [vrai], renvoisConnus: connus }), []);
});

t('un Backlog illisible n’invente pas de refus', () => {
  // Ne pas pouvoir vérifier n'est pas une raison de condamner. La garde cesse
  // alors d'exiger ce qu'elle ne contrôle pas — mais elle continue d'exiger
  // qu'un renvoi soit PRÉSENT.
  assert.strictEqual(renvoisDuBacklog(null), null);
  const e = { branche: 'claude/x', tete: SHA_A, sort: 'A_REPRENDRE', motif: 'm', renvoi: 'GOV-999' };
  assert.deepStrictEqual(validerEntree(e, null), []);
  assert.ok(validerEntree({ ...e, renvoi: '' }, null).length, 'un renvoi absent reste refusé');
});

t('les identifiants du Backlog sont lus dans ses lignes de tableau', () => {
  // Un identifiant CITÉ dans la description d'une autre entrée n'est pas une
  // entrée. Le Backlog réel en contient — « la collision est suivie en
  // ARCH-002 » — et les compter validerait un renvoi vers une entrée qui
  // n'existe pas, ce que l'épreuve précédente prétend justement empêcher.
  const ids = renvoisDuBacklog([
    '| ARCH-003 | A_ETUDIER | P1 | titre | la collision est suivie séparément en ARCH-042 |',
    '| SEC-014 | ATTENTE_FREDERIC | P0 | titre | critère |',
    'du texte en prose mentionnant GOV-777 sans être une ligne de tableau',
  ].join('\n'));
  assert.deepStrictEqual([...ids].sort(), ['ARCH-003', 'SEC-014'],
    'seul le premier champ d’une ligne de tableau est un identifiant');
});

t('le registre RÉEL du dépôt est exploitable de bout en bout', () => {
  // Épreuve d'amorçage : les 19 branches classées le 08/09/2026 doivent
  // toutes passer la validation, avec leur sha réel. Sans elle, on aurait pu
  // livrer un registre que la garde elle-même refuse.
  const registre = JSON.parse(fs.readFileSync(
    path.join(__dirname, 'docs', 'handoff', 'BRANCHES-CLASSEES.json'), 'utf8'));
  const connus = renvoisDuBacklog(fs.readFileSync(path.join(__dirname, 'docs', 'nexus', 'BACKLOG.md'), 'utf8'));
  assert.ok(registre.classees.length >= 19, 'le registre doit être amorcé');
  for (const c of registre.classees) {
    assert.deepStrictEqual(validerEntree(c, connus), [], `${c.branche} : ${JSON.stringify(c)}`);
  }
});

t('le vocabulaire est celui de l’audit canonique, pas un second', () => {
  // Un deuxième vocabulaire pour la même notion est une deuxième vérité à
  // maintenir. Celui-ci vient mot pour mot de l'audit du 07/09/2026.
  assert.deepStrictEqual(SORTS, ['INTEGREE', 'SUPERSEDEE', 'A_REPRENDRE', 'HISTORIQUE_SANS_ACTION']);
  const audit = fs.readFileSync(
    path.join(__dirname, 'docs', 'gouvernance', '2026-09-07-audit-travaux-claude-branches-isolees.md'), 'utf8');
  for (const sort of SORTS) {
    assert.ok(audit.includes(sort), `${sort} doit venir de l’audit canonique, pas d’ici`);
  }
});

t('une branche fusionnée ET classée signale un registre qui se fossilise, sans bloquer', () => {
  const s = analyser({
    branches: [{ nom: 'claude/x', tete: SHA_A, autorite: AUT }],
    contenues: new Set(['claude/x']),
    classees: [classement(SHA_A)],
  });
  assert.deepStrictEqual(codes(s), ['CLASSEMENT_INUTILE']);
  assert.strictEqual(bloquants(s).length, 0, 'ranger n’est pas un défaut : ne pas bloquer la CI pour ça');
});

t('un classement dont la branche a disparu est signalé, sans bloquer', () => {
  const s = analyser({ branches: [], contenues: new Set(), classees: [classement(SHA_A)] });
  assert.deepStrictEqual(codes(s), ['CLASSEMENT_ORPHELIN']);
  assert.strictEqual(bloquants(s).length, 0);
});

t('plusieurs branches sont jugées une par une, pas en bloc', () => {
  // Un verdict global « il y a des branches en rade » ne se traite pas : il
  // faut savoir lesquelles, sinon on les relit toutes à chaque fois.
  const s = analyser({
    branches: [
      { nom: 'claude/a', tete: SHA_A, autorite: AUT },
      { nom: 'claude/b', tete: SHA_B, autorite: AUT },
      { nom: 'claude/c', tete: SHA_A, autorite: AUT },
    ],
    contenues: new Set(['claude/c']),
    classees: [{ branche: 'claude/b', tete: SHA_B, sort: 'SUPERSEDEE', motif: 'supersédée par claude/a' }],
  });
  assert.deepStrictEqual(codes(s), ['EN_RADE']);
  assert.ok(/claude\/a/.test(s[0].texte), s[0].texte);
});

t('un registre vide n’absout personne', () => {
  const s = analyser({ branches: [{ nom: 'claude/x', tete: SHA_A, autorite: AUT }], contenues: new Set(), classees: undefined });
  assert.deepStrictEqual(codes(s), ['EN_RADE']);
});

t('FAIL CLOSED — un clone SANS références distantes rend INDISPONIBLE', () => {
  // Survivante de mutation : ce chemin ne s'exécute jamais sur le dépôt réel,
  // qui a ses branches distantes. Une mutation le remplaçant par « aucune
  // branche, tout va bien » y survivait donc en silence — et la garde aurait
  // rassuré un clone superficiel, qui est exactement le cas où elle ne sait
  // rien. Ce qu'on ne peut pas provoquer, on ne l'a pas vérifié.
  const faux = (...a) => {
    if (a[0] === 'rev-parse') return 'ok';
    if (a[0] === 'for-each-ref') return '';
    throw new Error('inattendu : ' + a.join(' '));
  };
  const r = releverDepot({ git: faux, table: TABLE });
  assert.ok(r.erreur, 'un clone sans références distantes ne doit rien conclure');
  assert.ok(/ne rien conclure/.test(r.erreur), r.erreur);
  assert.strictEqual(r.branches, undefined, 'ne pas rendre une liste vide qui se lira « rien à signaler »');
});

t('des références distantes illisibles rendent INDISPONIBLE', () => {
  const faux = (...a) => {
    if (a[0] === 'rev-parse') return 'ok';
    throw new Error('git cassé');
  };
  const r = releverDepot({ git: faux, table: TABLE });
  assert.ok(r.erreur && /ne rien conclure/.test(r.erreur), JSON.stringify(r));
});

t('seules les branches du préfixe de travail sont examinées', () => {
  // La garde ne doit pas se mettre à juger `production`, `main` ou une branche
  // de travail humaine : elle parlerait de ce qu'elle ne comprend pas.
  const faux = (...a) => {
    if (a[0] === 'rev-parse') return 'ok';
    if (a[0] === 'for-each-ref') return [
      'origin/main abc',
      'origin/production def',
      'origin/claude/x ' + SHA_A,
    ].join('\n');
    if (a[0] === 'rev-list') return '3';
    throw new Error('inattendu');
  };
  const r = releverDepot({ git: faux, table: TABLE });
  assert.deepStrictEqual(r.branches.map(b => b.nom), ['claude/x'],
    'ni main ni production ne relèvent de cette garde');
});

t('FAIL CLOSED — une branche canonique introuvable rend INDISPONIBLE, jamais « aucune »', () => {
  // Éprouvé de bout en bout sur le vrai dépôt : ne pas savoir doit se lire
  // « je ne sais pas », jamais « tout va bien ». C'est la différence entre une
  // garde et un décor.
  const r = spawnSync('node', [OUTIL], {
    encoding: 'utf8', cwd: __dirname,
    env: { ...process.env, NEXUS_BRANCHE_CANONIQUE: 'branche-qui-n-existe-pas-20260908' },
  });
  assert.notStrictEqual(r.status, 0, 'doit échouer, pas rassurer');
  assert.ok(/INDISPONIBLE/.test(r.stderr), r.stderr);
  assert.ok(/ne rien conclure/.test(r.stderr), r.stderr);
  assert.ok(!/aucune/i.test(r.stdout), 'ne jamais annoncer « aucune » sans avoir regardé : ' + r.stdout);
});

// ── La référence contre laquelle on mesure ──────────────────────────────
//
// Reprise du 28/09/2026. Ces épreuves défendent une seule idée : une garde qui
// se trompe de référence ne se trompe pas un peu, elle se trompe entièrement,
// et elle le fait avec le ton assuré d'une mesure. Le 28/09, la référence
// unique de cette garde était gelée depuis quatorze jours : 87 branches criées,
// dont 26 pour ce seul motif. Le même raisonnement, appliqué au candidat
// Production #65, l'a fait déclarer abandonné alors qu'il était à jour.

t('une branche dont AUCUNE règle ne dit contre quoi la mesurer n’est PAS mesurée', () => {
  // Le cœur de la reprise. L'ancienne garde faisait retomber toute branche sur
  // une référence globale : elle rendait donc toujours un verdict, y compris
  // quand la question n'avait pas de sens. Ne pas savoir doit se voir.
  const s = analyser({
    branches: [{ nom: 'claude/x', tete: SHA_A }],
    contenues: new Set(),
    classees: [],
  });
  assert.deepStrictEqual(codes(s), ['AUTORITE_INDECLAREE']);
  assert.strictEqual(bloquants(s).length, 1, 'une mesure impossible ne peut pas passer pour un silence rassurant');
  assert.ok(!/en rade/i.test(s[0].texte), 'ne pas accuser une branche qu’on n’a pas pu mesurer : ' + s[0].texte);
});

t('un signalement NOMME sa référence, avec son sha et sa date', () => {
  // L'épreuve qui aurait fait tomber le défaut le jour même. Le message
  // d'origine disait « absent de config-par-environnement » — sans sha ni date,
  // rien ne laissait voir que cette branche ne bougeait plus depuis le 14/09.
  const s = analyser({
    branches: [{ nom: 'claude/x', tete: SHA_A, autorite: { nom: 'rail-2026', tete: 'e'.repeat(40), date: '2026-09-14' } }],
    contenues: new Set(),
    classees: [],
  });
  assert.ok(/rail-2026/.test(s[0].texte), 'la référence doit être nommée : ' + s[0].texte);
  assert.ok(/eeeeeee/.test(s[0].texte), 'le sha de la référence doit être lisible : ' + s[0].texte);
  assert.ok(/2026-09-14/.test(s[0].texte), 'la date de la référence doit être lisible : ' + s[0].texte);
});

t('chaque famille se mesure contre SA base, pas contre une référence unique', () => {
  // La correction d'autorité du 28/09 : un candidat Production se mesure contre
  // Production. Mesuré contre le rail, il paraissait abandonné depuis 24 jours ;
  // contre sa vraie baseline il était à +8 / -0.
  const table = { regles: [
    { motif: 'claude/', autorite: 'rail', examine: true },
    { motif: 'rebuild/', autorite: 'production', examine: true },
  ] };
  const vues = [];
  const faux = (...a) => {
    if (a[0] === 'rev-parse') return 'sha-' + a[2].replace('^{commit}', '');
    if (a[0] === 'log') return '2026-09-27';
    if (a[0] === 'for-each-ref') return ['origin/claude/x ' + SHA_A, 'origin/rebuild/c65 ' + SHA_B].join('\n');
    if (a[0] === 'rev-list') { vues.push(a[2]); return '3'; }
    throw new Error('inattendu ' + a[0]);
  };
  const r = releverDepot({ git: faux, table });
  assert.deepStrictEqual(vues.sort(), ['origin/production..origin/rebuild/c65', 'origin/rail..origin/claude/x'],
    'chaque branche doit être située contre SA base déclarée — vues : ' + JSON.stringify(vues));
  assert.deepStrictEqual(r.branches.map(b => b.autorite.nom), ['rail', 'production']);
});

t('une famille déclarée NON examinée reste hors du champ de cette garde', () => {
  // Un candidat de PR n'est pas du travail en rade : sa PR le suit déjà. Le
  // silence est ici la bonne réponse — mais un silence déclaré, pas un oubli.
  const table = { regles: [
    { motif: 'claude/', autorite: 'rail', examine: true },
    { motif: 'rebuild/', autorite: 'production', examine: false },
  ] };
  const faux = (...a) => {
    if (a[0] === 'rev-parse') return 'sha';
    if (a[0] === 'log') return '2026-09-27';
    if (a[0] === 'for-each-ref') return ['origin/claude/x ' + SHA_A, 'origin/rebuild/c65 ' + SHA_B].join('\n');
    if (a[0] === 'rev-list') return '3';
    throw new Error('inattendu');
  };
  assert.deepStrictEqual(releverDepot({ git: faux, table }).branches.map(b => b.nom), ['claude/x']);
});

t('FAIL CLOSED — une autorité DÉCLARÉE mais absente du dépôt arrête tout', () => {
  // La table dit « mesure contre X » et X n'existe nulle part. Examiner les
  // autres familles quand même, c'est rendre un rapport partiel qui se lira
  // comme un rapport complet.
  const table = { regles: [{ motif: 'claude/', autorite: 'rail-disparu', examine: true }] };
  const faux = (...a) => {
    if (a[0] === 'rev-parse') throw new Error('unknown revision');
    if (a[0] === 'for-each-ref') return 'origin/claude/x ' + SHA_A;
    throw new Error('inattendu');
  };
  const r = releverDepot({ git: faux, table });
  assert.ok(r.erreur && /introuvable/.test(r.erreur) && /ne rien conclure/.test(r.erreur), JSON.stringify(r));
  assert.strictEqual(r.branches, undefined, 'ne pas rendre une liste vide qui se lira « rien à signaler »');
});

t('une règle EXAMINÉE qui ne nomme aucune autorité est refusée à la lecture', () => {
  // Sans ce refus, la table pourrait réintroduire en douce ce qu'elle existe
  // pour supprimer : une famille examinée sans référence explicite.
  const fichier = path.join(__dirname, 'scratchpad-autorites-epreuve.json');
  try {
    fs.writeFileSync(fichier, JSON.stringify({ regles: [{ motif: 'claude/', examine: true }] }));
    const r = lireAutorites(fichier);
    assert.ok(r.erreur && /aucune autorité/.test(r.erreur), JSON.stringify(r));
  } finally { fs.rmSync(fichier, { force: true }); }
});

t('une table vide ou absente ne fait retomber la garde sur RIEN', () => {
  assert.ok(lireAutorites(path.join(__dirname, 'table-qui-n-existe-pas.json')).erreur);
  const fichier = path.join(__dirname, 'scratchpad-autorites-vide.json');
  try {
    fs.writeFileSync(fichier, JSON.stringify({ regles: [] }));
    assert.ok(lireAutorites(fichier).erreur, 'une table sans règle ne peut pas passer pour une table');
  } finally { fs.rmSync(fichier, { force: true }); }
});

t('une exception nomme une branche entière et prime sur sa famille', () => {
  // C'est le seul endroit où une désignation humaine particulière peut
  // contredire la règle de famille. Elle doit gagner, sinon elle ne sert à rien.
  const table = {
    regles: [{ motif: 'claude/', autorite: 'rail', examine: true }],
    exceptions: [{ branche: 'claude/special', autorite: 'production' }],
  };
  assert.strictEqual(resoudreRegle('claude/special', table).autorite, 'production');
  assert.strictEqual(resoudreRegle('claude/x', table).autorite, 'rail');
  assert.strictEqual(resoudreRegle('autre/x', table), null, 'hors de toute règle : aucune autorité, et surtout pas une par défaut');
});

t('la table RÉELLE du dépôt est exploitable, et le rail qu’elle déclare EXISTE', () => {
  // Une table valide qui désigne une branche disparue est un décor. Et une
  // autorité gelée est exactement ce qui a produit 26 faux signalements : on
  // vérifie donc que la référence déclarée est bien celle d'une branche vivante
  // du dépôt, pas un nom qui a survécu à son objet.
  const r = lireAutorites();
  assert.ok(!r.erreur, 'la table du dépôt doit être lisible : ' + r.erreur);
  const examinees = r.table.regles.filter(x => x.examine);
  assert.ok(examinees.length, 'une table qui n’examine rien ne garde rien');
  for (const regle of examinees) {
    const sortie = spawnSync('git', ['rev-parse', '--verify', `origin/${regle.autorite}^{commit}`],
      { cwd: __dirname, encoding: 'utf8' });
    assert.strictEqual(sortie.status, 0,
      `l’autorité déclarée pour ${regle.motif}* (${regle.autorite}) n’existe pas sur origin`);
    assert.ok(String(regle.pourquoi || '').trim(),
      `la règle ${regle.motif}* doit dire POURQUOI cette base fait autorité`);
  }
});

t('CONTRAT — la garde nomme, elle ne fusionne pas', () => {
  // Elle lit des branches de travail non relues. Lui donner le moindre verbe
  // d'écriture, c'est lui donner le pouvoir de faire entrer du code que
  // personne n'a lu — exactement ce que les gates humaines interdisent.
  const source = fs.readFileSync(OUTIL, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n');
  for (const verbe of ['merge', 'push', 'cherry-pick', 'rebase', 'reset', 'commit', 'writeFileSync', 'apply']) {
    assert.ok(!new RegExp(`['"\`]${verbe}['"\`]`).test(source),
      `la garde ne doit jamais employer « ${verbe} »`);
  }
});

console.log(`\n${passes}/${passes} vérifications passées — la garde nomme le silence, elle ne le comble pas.`);
