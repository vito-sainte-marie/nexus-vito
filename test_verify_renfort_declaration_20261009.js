// Verify — déclarer un renfort à la clôture (§5, §6, §8, §10 et §11 du
// cahier des charges du 09/10/2026).
//
// Trois exigences gouvernent ce fichier, et chacune y a ses assertions :
//
//   1. §8, exigence PRIORITAIRE : la nouveauté ne doit pas compliquer la
//      clôture de caisse. « Non » par défaut n'affiche aucun autre champ, et
//      l'écriture du renfort ne peut en aucun cas faire échouer la clôture.
//      Tant que la migration attend sa gate humaine, la colonne
//      audits_caisse.employes_renfort n'existe pas — et une colonne inconnue
//      demandée dans l'upsert fait échouer TOUTE la requête (PostgREST
//      42703). D'où l'écriture séparée, après succès, testée ici.
//
//   2. §5.2 et §2 : la durée standard du renfort n'est pas retapée dans
//      Verify. Elle vient des Paramètres Station, lue par reglesHeures() du
//      moteur de paye — le vrai moteur est chargé ici, pas une imitation,
//      sinon le test prouverait la duplication au lieu de l'interdire.
//
//   3. §10 : la liste proposée ne peut pas élargir le périmètre. Elle part
//      des salariés actifs de CE site, et la recherche ne fait que la
//      réduire. Aucun salarié inactif ni d'un autre site n'y entre.
//
// §7 n'a rien à faire ici et c'est volontaire : aucun retard ne se déduit
// d'une présence, et Verify ne touche pas aux retards.
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const RACINE = __dirname;
const ECRAN = fs.readFileSync(path.join(RACINE, 'NEXUS-Verify-v1.html'), 'utf8');
const sansCommentaires = t => t.split('\n')
  .filter(l => !/^\s*(\/\/|\*|<!--|-->)/.test(l)).join('\n');
const CODE = sansCommentaires(ECRAN);

// Source exécutable d'une fonction du script en ligne : de sa déclaration
// jusqu'à son accolade fermante, à l'indentation 4 de l'IIFE.
function sourceDe(nom) {
  let i = CODE.indexOf(`function ${nom}(`);
  assert.ok(i !== -1, `${nom} introuvable`);
  if (CODE.slice(i - 6, i) === 'async ') i -= 6;
  const j = CODE.indexOf('\n    }', i);
  assert.ok(j !== -1, `fin de ${nom} introuvable`);
  return `${CODE.slice(i, j)}\n}`;
}

function ligneDe(motif) {
  const l = CODE.split('\n').filter(x => x.includes(motif));
  assert.strictEqual(l.length, 1, `${motif} : ${l.length} ligne(s), il en faut 1`);
  return l[0].trim();
}

let passes = 0;
function verifier(nom, fn) { fn(); passes++; console.log('OK   — ' + nom); }
async function verifierAsync(nom, fn) { await fn(); passes++; console.log('OK   — ' + nom); }

// ------------------------------------------------------------
// STRUCTURE — ce que l'écran offre, et ce qu'il n'offre pas.
// ------------------------------------------------------------

verifier('le bloc existe et porte la question du cahier des charges', () => {
  assert.ok(ECRAN.includes('Renfort présent pendant ce service ?'),
    'le libellé du §5.1 est celui que le caissier doit lire');
  assert.ok(/<div id="blocRenfort"[^>]*display:none/.test(ECRAN),
    'le bloc part masqué : il ne s’offre qu’une fois la colonne sondée présente');
});

verifier('« Non » est le défaut, et n’affiche aucun autre champ (§8.1)', () => {
  const nonActif = /<button type="button" class="renfort-btn actif" id="renfortNon">/.test(ECRAN);
  const ouiInactif = /<button type="button" class="renfort-btn" id="renfortOui">/.test(ECRAN);
  assert.ok(nonActif && ouiInactif, '« Non » est actif au chargement, pas « Oui »');
  assert.ok(/<div id="zoneRenfort" style="display:none;">/.test(ECRAN),
    'tout ce qui suit la question est masqué tant que « Non » est actif');
});

verifier('la liste a une recherche rapide, posée hors du conteneur réécrit', () => {
  const i = ECRAN.indexOf('id="rechercheRenfort"');
  const j = ECRAN.indexOf('id="menuEmployesRenfort"');
  assert.ok(i !== -1 && j !== -1, 'champ de recherche et liste présents (§5.1, §8.2)');
  assert.ok(i < j,
    'le champ précède le conteneur que renderMenuEmployes() réécrit : dedans, chaque frappe le détruirait avec le focus');
});

verifier('aucun horaire à saisir à la clôture (§5.2, §8.1)', () => {
  const i = ECRAN.indexOf('<div id="blocRenfort"');
  const bloc = ECRAN.slice(i, ECRAN.indexOf('\n      </div>', i));
  assert.ok(!/type="time"|id="renfortDebut"|id="renfortFin"|id="renfortPause"/.test(bloc),
    'le caissier ne saisit pas les horaires : ils viennent des Paramètres Station');
});

verifier('les cibles tactiles sont larges (§8.2)', () => {
  assert.ok(/\.renfort-btn\{[^}]*min-height:44px/.test(ECRAN), 'les deux boutons font 44 px de haut');
  assert.ok(/\.emp-recherche\{[^}]*min-height:40px/.test(ECRAN), 'le champ de recherche reste saisissable au doigt');
  assert.ok(/\.emp-recherche\{[^}]*box-sizing:border-box[^}]*width:100%|\.emp-recherche\{[^}]*width:100%[^}]*box-sizing:border-box/.test(ECRAN),
    'largeur contrainte : pas de débordement horizontal');
});

// ------------------------------------------------------------
// §8.3 et §11-13 — une erreur ne fait pas perdre la clôture.
// ------------------------------------------------------------

verifier('employes_renfort n’est JAMAIS dans l’upsert principal', () => {
  const i = CODE.indexOf(".from('audits_caisse').upsert({");
  assert.ok(i !== -1, 'upsert de clôture introuvable');
  const fin = CODE.indexOf("{ onConflict: 'site,date,quart' }", i);
  assert.ok(fin !== -1, 'fin de la charge utile introuvable');
  const charge = CODE.slice(i, fin);
  assert.ok(!charge.includes('employes_renfort'),
    'une colonne inconnue dans cet upsert ferait échouer TOUTE la clôture de caisse (PostgREST 42703)');
  assert.ok(charge.includes('employes_piste') && charge.includes('employes_boutique'),
    'les deux caisses, elles, restent bien dans la charge utile');
});

verifier('le renfort s’écrit à part, et seulement après la clôture réussie', () => {
  const iErreur = CODE.indexOf("console.error('Enregistrement audit caisse:', error);");
  const iRenfort = CODE.indexOf(".update({ employes_renfort: idsRenfort })");
  assert.ok(iErreur !== -1 && iRenfort !== -1, 'les deux points de code existent');
  assert.ok(iRenfort > iErreur,
    'l’écriture du renfort vient après le garde-fou d’erreur de la clôture, jamais avant');
  assert.ok(/\.eq\('site', SITE_ACTUEL\)\.eq\('date', date\)\.eq\('quart', quart\)/.test(
    CODE.slice(iRenfort, iRenfort + 320)),
    'la mise à jour cible la ligne de la clôture par sa clé naturelle');
});

verifier('un échec du renfort ne fait perdre ni la clôture ni le reste (§8.3)', () => {
  const i = CODE.indexOf('let renfortEnregistre = null;');
  assert.ok(i !== -1, 'le témoin d’écriture existe');
  const bloc = CODE.slice(i, i + 900);
  assert.ok(/catch \(e\) \{\s*renfortEnregistre = false;/.test(bloc),
    'une panne réseau est rattrapée, pas propagée');
  assert.ok(!/return;/.test(bloc.slice(0, bloc.indexOf('}\n      }'))),
    'aucun retour anticipé : la clôture est déjà enregistrée, le résumé doit s’afficher');
  assert.ok(ECRAN.includes('Le renfort n’a pas pu être enregistré. La clôture de caisse, elle, est bien enregistrée.'),
    'l’erreur se dit à l’écran, en nommant ce qui est malgré tout enregistré');
});

verifier('un enregistrement réussi se confirme visiblement (§8.2)', () => {
  assert.ok(/Renfort déclaré : <b>\$\{RENFORT_ACTIF && employesSelectionnes\.renfort\.size \? nomsEmployes/.test(CODE),
    'le résumé nomme le renfort enregistré');
  assert.ok(CODE.includes('✓ enregistré</div>'), 'et confirme explicitement l’écriture');
});

verifier('le planning n’est jamais lu pour déclarer un renfort (§5, §8.3)', () => {
  const noms = ['sonderColonneRenfort', 'chargerReglesRenfort', 'chargerRenfortsDejaDeclares',
                'majNotesRenfort', 'basculerRenfort'];
  noms.forEach(n => {
    assert.ok(!/from\('planning/.test(sourceDe(n)),
      `${n} ne consulte pas le planning : son indisponibilité ne doit pas empêcher la déclaration`);
  });
});

// ------------------------------------------------------------
// §10 et §11-12 — le périmètre ne s'élargit pas.
// ------------------------------------------------------------

verifier('la liste part des salariés actifs de CE site (§10, §11-12)', () => {
  const src = sourceDe('chargerEmployesSite');
  assert.ok(/\.eq\('site_id', SITE_ACTUEL\)/.test(src), 'filtré sur le site courant');
  assert.ok(/\.eq\('actif', true\)/.test(src), 'filtré sur les salariés actifs');
});

verifier('Verify n’écrit ni règle de paye ni paramètre station (§10)', () => {
  assert.ok(!/from\('station_config'\)[\s\S]{0,80}\.(upsert|update|insert)\(/.test(CODE),
    'un caissier dans Verify ne doit pas pouvoir modifier les paramètres de la station');
  assert.ok(!/from\('nexus_paye_items'\)|from\('nexus_paye_/.test(CODE),
    'ni toucher aux éléments de paye, réservés au manager');
  const src = sourceDe('chargerReglesRenfort');
  assert.ok(/\.select\('horaires,paye_config'\)/.test(src) && !/upsert|update|insert/.test(src),
    'les paramètres sont lus, jamais écrits');
});

verifier('l’historique de la clôture est préservé (§10, §11-14)', () => {
  // Production passe le motif de modification au snapshot (`motifModification`) :
  // l'ordre snapshot → écriture est ce qui compte, pas la valeur du motif.
  const iSnap = CODE.search(/snapshotAuditAvantEcriture\(auditExistant, 'modification', [A-Za-z]+\)/);
  const iUpsert = CODE.indexOf(".from('audits_caisse').upsert({");
  assert.ok(iSnap !== -1 && iSnap < iUpsert,
    'le snapshot précède l’écriture, donc le renfort antérieur entre dans l’historique');
  assert.ok(/\.select\('\*'\)\s*\n\s*\.eq\('site', SITE_ACTUEL\)\.eq\('date', date\)\.eq\('quart', quart\)/.test(CODE),
    'le snapshot part d’un select(*) : la nouvelle colonne y entre d’elle-même');
  assert.ok(/const idsRenfort = a\.employes_renfort \|\| \[\];/.test(CODE),
    'rouvrir une clôture réaffiche le renfort déclaré, au lieu de l’effacer par omission');
});

// ------------------------------------------------------------
// COMPORTEMENT — les fonctions exécutées, avec le vrai moteur.
// ------------------------------------------------------------

function harnais(options = {}) {
  const ctx = { console };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  // Le VRAI moteur de paye : c'est lui qui porte la règle d'heures, et le
  // test doit prouver que Verify s'en sert au lieu de la recopier.
  vm.runInContext(fs.readFileSync(path.join(RACINE, 'nexus-paye-moteur.js'), 'utf8'), ctx);

  const elements = new Map();
  const faireElement = id => ({
    id, innerHTML: '', textContent: '', value: '',
    style: {},
    classes: new Set(),
    classList: {
      add(c) { elements.get(id).classes.add(c); },
      remove(c) { elements.get(id).classes.delete(c); },
      contains(c) { return elements.get(id).classes.has(c); },
      toggle(c, v) { if (v) this.add(c); else this.remove(c); },
    },
    querySelectorAll() { return []; },
    querySelector() { return null; },
    addEventListener() {},
  });
  ['labelEmployesRenfort', 'menuEmployesRenfort', 'zoneRenfort', 'renfortOui', 'renfortNon',
   'rechercheRenfort', 'noteRenfortHoraire', 'noteRenfortDejaDeclare', 'noteRenfortDoublon',
   'v_date', 'v_quart', 'labelEmployesPiste', 'menuEmployesPiste',
   'labelEmployesBoutique', 'menuEmployesBoutique'].forEach(id => elements.set(id, faireElement(id)));
  elements.get('renfortNon').classes.add('actif');

  ctx.document = { getElementById: id => elements.get(id) || null };
  ctx.elements = elements;
  ctx.SITE_ACTUEL = 'vito-sainte-marie';
  ctx.EMPLOYES_SITE = options.employes || [];
  ctx.REGLES_RENFORT = options.regles || null;
  ctx.COLONNE_RENFORT_DISPONIBLE = options.colonne !== false;
  ctx.RENFORT_ACTIF = false;

  const repondre = options.repondre || (() => ({ data: [], error: null }));
  ctx.requetes = [];
  ctx.nexusClient = {
    from(table) {
      const etat = { table, colonnes: null, eq: {}, limite: null };
      ctx.requetes.push(etat);
      const q = {
        select(c) { etat.colonnes = c; return q; },
        eq(k, v) { etat.eq[k] = v; return q; },
        limit(n) { etat.limite = n; return Promise.resolve(repondre(etat)); },
        maybeSingle() { return Promise.resolve(repondre(etat)); },
        then(res, rej) { return Promise.resolve(repondre(etat)).then(res, rej); },
      };
      return q;
    },
  };

  const sources = ['normaliserTexte', 'nomsEmployes', 'majLabelEmployes', 'renderMenuEmployes',
                   'sonderColonneRenfort', 'chargerReglesRenfort', 'texteHoraireRenfort',
                   'chargerRenfortsDejaDeclares', 'majNotesRenfort', 'basculerRenfort'];
  vm.runInContext([
    ligneDe('const employesSelectionnes = {'),
    ligneDe('const CLE_CAISSE = {'),
    ligneDe('const PLACEHOLDER_EMPLOYES = {'),
    ligneDe('const FILTRE_EMPLOYES = {'),
    ...sources.map(sourceDe),
    // Les quatre structures ci-dessus sont déclarées en const : dans un
    // contexte vm, un const de premier niveau ne devient pas une propriété du
    // contexte, contrairement à une déclaration de fonction. On les expose
    // pour que le test puisse les lire, en gardant la MÊME référence que
    // celle capturée lexicalement par les fonctions.
    'globalThis.employesSelectionnes = employesSelectionnes;',
    'globalThis.CLE_CAISSE = CLE_CAISSE;',
    'globalThis.PLACEHOLDER_EMPLOYES = PLACEHOLDER_EMPLOYES;',
    'globalThis.FILTRE_EMPLOYES = FILTRE_EMPLOYES;',
  ].join('\n'), ctx);
  return ctx;
}

const EMPLOYES = [
  { id: 'e1', nom: 'Angélique', role: 'renfort' },
  { id: 'e2', nom: 'Bernadette', role: 'caissier' },
  { id: 'e3', nom: 'Christophe', role: 'pompiste' },
];

(async () => {

await verifierAsync('la durée standard vient des Paramètres Station, pas du code (§2, §5.2)', async () => {
  const ctx = harnais({
    employes: EMPLOYES,
    repondre: etat => (etat.table === 'station_config'
      ? { data: { paye_config: {}, horaires: { renfort: { debut: '09:00', fin: '17:00', pause_debut: '13:00', pause_fin: '14:00' } } }, error: null }
      : { data: [], error: null }),
  });
  ctx.REGLES_RENFORT = await ctx.chargerReglesRenfort();
  assert.strictEqual(ctx.REGLES_RENFORT.heures, 7, '09:00 → 17:00 moins 1 h de pause = 7 h nettes');
  const texte = ctx.texteHoraireRenfort();
  assert.ok(/09:00/.test(texte) && /17:00/.test(texte) && /pause 1 h/.test(texte) && /soit 7 h/.test(texte),
    `le rappel discret énonce l’horaire paramétré : ${texte}`);
  assert.ok(/Rien à saisir/.test(texte), 'et dit au caissier qu’il n’a rien à entrer');
});

await verifierAsync('changer le paramètre change l’affichage, sans toucher Verify', async () => {
  const ctx = harnais({
    repondre: etat => (etat.table === 'station_config'
      ? { data: { paye_config: { heures_renfort: 6 }, horaires: { renfort: { debut: '10:00', fin: '16:00' } } }, error: null }
      : { data: [], error: null }),
  });
  ctx.REGLES_RENFORT = await ctx.chargerReglesRenfort();
  assert.strictEqual(ctx.REGLES_RENFORT.heures, 6, 'la durée paramétrée prime');
  assert.ok(/soit 6 h/.test(ctx.texteHoraireRenfort()), 'et c’est elle qui s’affiche');
});

await verifierAsync('paramètres illisibles : repli annoncé, jamais de blocage', async () => {
  const ctx = harnais({
    repondre: () => { throw new Error('réseau coupé'); },
  });
  ctx.REGLES_RENFORT = await ctx.chargerReglesRenfort();
  assert.strictEqual(ctx.REGLES_RENFORT.heures, ctx.NexusPayeMoteur.HEURES_RENFORT_DEFAUT,
    'repli sur la durée par défaut du moteur, pas sur un nombre écrit ici');
  assert.ok(/soit 7 h nettes/.test(ctx.texteHoraireRenfort()), 'et l’écran reste utilisable');
});

await verifierAsync('colonne absente : le bloc n’est pas offert (§8.3)', async () => {
  const ctx = harnais({
    repondre: () => ({ data: null, error: { code: '42703', message: "column audits_caisse.employes_renfort does not exist" } }),
  });
  assert.strictEqual(await ctx.sonderColonneRenfort(), false,
    'mieux vaut ne rien offrir qu’offrir pour perdre la déclaration en silence');
});

await verifierAsync('colonne présente : le bloc peut s’offrir', async () => {
  const ctx = harnais({ repondre: () => ({ data: [], error: null }) });
  assert.strictEqual(await ctx.sonderColonneRenfort(), true);
  const sonde = ctx.requetes.find(r => r.table === 'audits_caisse');
  assert.strictEqual(sonde.colonnes, 'employes_renfort', 'la sonde ne lit qu’une colonne');
  assert.strictEqual(sonde.limite, 1, 'et qu’une ligne');
});

verifier('la recherche ne fait que réduire la liste (§5.1, §10, §11-12)', () => {
  const ctx = harnais({ employes: EMPLOYES });
  ctx.renderMenuEmployes('renfort');
  const tout = ctx.elements.get('menuEmployesRenfort').innerHTML;
  assert.ok(/Angélique/.test(tout) && /Bernadette/.test(tout) && /Christophe/.test(tout),
    'sans filtre, les trois actifs du site sont proposés');

  ctx.FILTRE_EMPLOYES.renfort = 'ber';
  ctx.renderMenuEmployes('renfort');
  const filtre = ctx.elements.get('menuEmployesRenfort').innerHTML;
  assert.ok(/Bernadette/.test(filtre), 'la recherche trouve, insensible à la casse');
  assert.ok(!/Angélique/.test(filtre) && !/Christophe/.test(filtre), 'et exclut le reste');

  ctx.FILTRE_EMPLOYES.renfort = 'angelique';
  ctx.renderMenuEmployes('renfort');
  assert.ok(/Angélique/.test(ctx.elements.get('menuEmployesRenfort').innerHTML),
    'la recherche ignore les accents, comme le reste de Verify');

  ctx.FILTRE_EMPLOYES.renfort = 'zoé';
  ctx.renderMenuEmployes('renfort');
  const vide = ctx.elements.get('menuEmployesRenfort').innerHTML;
  assert.ok(/Aucun salarié ne correspond/.test(vide),
    'un nom hors du site ne se fabrique pas : il ne correspond à rien');
  assert.ok(!/emp-item/.test(vide), 'et surtout, aucune ligne sélectionnable n’apparaît');
});

verifier('la recherche du renfort ne change rien aux listes de caisse (§8)', () => {
  const ctx = harnais({ employes: EMPLOYES });
  ctx.FILTRE_EMPLOYES.renfort = 'ber';
  ctx.renderMenuEmployes('piste');
  const piste = ctx.elements.get('menuEmployesPiste').innerHTML;
  assert.ok(/Angélique/.test(piste) && /Bernadette/.test(piste) && /Christophe/.test(piste),
    'la clôture de caisse reste exactement ce qu’elle était');
});

verifier('« Non » ne garde aucune déclaration en mémoire', () => {
  const ctx = harnais({ employes: EMPLOYES });
  ctx.basculerRenfort(true);
  ctx.employesSelectionnes.renfort.add('e1');
  ctx.FILTRE_EMPLOYES.renfort = 'ang';
  ctx.elements.get('rechercheRenfort').value = 'ang';
  ctx.majLabelEmployes('renfort');
  assert.strictEqual(ctx.elements.get('labelEmployesRenfort').textContent, 'Angélique');

  ctx.basculerRenfort(false);
  assert.strictEqual(ctx.employesSelectionnes.renfort.size, 0, 'la sélection est vidée');
  assert.strictEqual(ctx.FILTRE_EMPLOYES.renfort, '', 'le filtre est vidé');
  assert.strictEqual(ctx.elements.get('rechercheRenfort').value, '', 'le champ aussi');
  assert.strictEqual(ctx.elements.get('zoneRenfort').style.display, 'none', 'et la zone se referme');
  assert.strictEqual(ctx.elements.get('labelEmployesRenfort').textContent, 'Sélectionner le renfort',
    'le libellé revient à son invite');
  assert.ok(ctx.elements.get('renfortNon').classList.contains('actif')
    && !ctx.elements.get('renfortOui').classList.contains('actif'),
    'et « Non » redevient le choix actif');
});

await verifierAsync('caisse et renfort sur le même service : dit, jamais bloqué (§6, §11-9)', async () => {
  const ctx = harnais({ employes: EMPLOYES, regles: { heures: 7, debut: '09:00', fin: '17:00', pause: 60 } });
  ctx.RENFORT_ACTIF = true;
  ctx.employesSelectionnes.boutique.add('e2');
  ctx.employesSelectionnes.renfort.add('e2');
  await ctx.majNotesRenfort();
  const note = ctx.elements.get('noteRenfortDoublon');
  assert.notStrictEqual(note.style.display, 'none', 'le croisement est signalé');
  assert.ok(/Bernadette/.test(note.textContent), 'en nommant la personne concernée');
  assert.ok(/pas deux fois/.test(note.textContent), 'et en disant que la journée ne sera pas comptée deux fois');
  assert.ok(/laisser la déclaration/.test(note.textContent),
    'c’est une information : rien n’est supprimé, rien n’est bloqué');
  // Et surtout : la déclaration est TOUJOURS là. Le §6 confie la
  // consolidation au moteur, pas à l'écran ; Verify signale, il ne retire
  // pas. Sans cette assertion, une suppression silencieuse passerait.
  assert.ok(ctx.employesSelectionnes.renfort.has('e2'),
    'la déclaration de renfort survit à son propre signalement');
  assert.strictEqual(ctx.employesSelectionnes.boutique.size, 1,
    'et la caisse constatée n’est pas touchée non plus');

  ctx.employesSelectionnes.renfort.delete('e2');
  ctx.employesSelectionnes.renfort.add('e1');
  await ctx.majNotesRenfort();
  assert.strictEqual(ctx.elements.get('noteRenfortDoublon').style.display, 'none',
    'un renfort qui ne tient aucune caisse ne déclenche aucune alerte (jamais de fausse alerte)');
});

await verifierAsync('un renfort déjà déclaré sur un autre quart est montré (§6, §11-10)', async () => {
  const ctx = harnais({
    employes: EMPLOYES,
    regles: { heures: 7 },
    repondre: etat => (etat.table === 'audits_caisse' && etat.eq.date
      ? { data: [
          { quart: '1', employes_renfort: ['e1'] },
          { quart: '2', employes_renfort: ['e2'] },
          { quart: '3', employes_renfort: ['e3'] },
        ], error: null }
      : { data: [], error: null }),
  });
  ctx.RENFORT_ACTIF = true;
  ctx.elements.get('v_date').value = '2026-10-08';
  ctx.elements.get('v_quart').value = '2';
  await ctx.majNotesRenfort();
  const note = ctx.elements.get('noteRenfortDejaDeclare');
  assert.notStrictEqual(note.style.display, 'none', 'les déclarations du jour sont affichées');
  assert.ok(/Angélique/.test(note.textContent) && /Christophe/.test(note.textContent),
    'les deux autres quarts sont nommés, pour éviter un doublon');
  assert.ok(/quart 1/.test(note.textContent) && /quart 3/.test(note.textContent),
    'avec le quart de chacun');
  assert.ok(!/quart 2/.test(note.textContent),
    'le quart en cours n’est pas sa propre mise en garde');
});

await verifierAsync('renforts du jour illisibles : la déclaration reste possible (§8.3)', async () => {
  const ctx = harnais({
    employes: EMPLOYES, regles: { heures: 7 },
    repondre: etat => (etat.eq.date
      ? { data: null, error: { message: 'réseau' } }
      : { data: [], error: null }),
  });
  ctx.RENFORT_ACTIF = true;
  ctx.elements.get('v_date').value = '2026-10-08';
  ctx.elements.get('v_quart').value = '2';
  await ctx.majNotesRenfort();
  assert.strictEqual(ctx.elements.get('noteRenfortDejaDeclare').style.display, 'none',
    'rien à signaler plutôt qu’une erreur bloquante');
  assert.ok(/soit 7 h/.test(ctx.elements.get('noteRenfortHoraire').textContent),
    'le reste du bloc fonctionne toujours : on peut déclarer');
});

console.log(`\n${passes} vérifications passées.`);
})();
