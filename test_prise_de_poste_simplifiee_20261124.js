// Changement de poste simplifié (lot PRISE-DE-POSTE-SIMPLIFIEE-20261124).
//
// Contrat gardé ici, sans réseau :
//  - la carte du poste actuel n'est pas cliquable (« Poste actuel », aria-disabled) ;
//  - aucun mot « quart » dans les textes du chemin de changement ;
//  - aucun écran intermédiaire ; le message FDJ suit l'employé sur son accueil ;
//  - la première écriture est toujours sans confirmation ;
//  - le motif reste transmis (≤ 200 caractères) ;
//  - l'avertissement FDJ ouverte / comptage en cours est factuel et NON bloquant ;
//  - le pied « commit » est masqué à l'employé, visible du manager et du gérant,
//    sauf une ligne « Application incomplète » si la génération est incohérente.
// Chaque garde est suivie d'une mutation qui doit la faire rougir.
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const R = __dirname;
const lire = f => fs.readFileSync(path.join(R, f), 'utf8');
const MOD = lire('nexus-prise-de-poste.js');
const ACC = lire('nexus-accueil-piste.js');
const BUILD = lire('outils/poser-build-id.js');
const AUTH = lire('nexus-auth.js');

function corps(src, debut) {
  const i = src.indexOf(debut);
  assert.ok(i !== -1, `${debut} introuvable`);
  const o = src.indexOf('{', src.indexOf(')', i));
  let d = 0;
  for (let k = o; k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}' && --d === 0) return src.slice(o, k + 1);
  }
  throw new Error('accolades déséquilibrées');
}
// Textes visibles du chemin : choix de poste + confirmation (sans commentaires JS).
function textesChemin(m) {
  const sansCommentaires = s => s.replace(/^\s*\/\/.*$/gm, '');
  return sansCommentaires(corps(m, 'function renderChoixPoste()') + corps(m, 'async function renderConfirmationChangement(')
    + corps(m, 'async function terminerPriseDePoste('));
}

function charger(src) {
  const vm = require('vm');
  const ctx = {}; ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(src, ctx);
  return ctx;
}

const GARDES = [];
function garde(nom, test, mutation) { GARDES.push({ nom, test, mutation }); }
const sur = (cible, nom, test, mutation) => garde(nom, test, mutation);

// 1. Le poste actuel n'est pas cliquable.
garde('la carte du poste actuel affiche « Poste actuel » et porte aria-disabled',
  m => { const f = corps(m, 'function renderChoixPoste()');
    return /badgePosteActuel\(\)/.test(f) && /aria-disabled="true"/.test(f) && /roleActuel/.test(f); },
  m => m.replace(/aria-disabled="true"/g, 'data-x="1"'));
garde('le clic n\'est posé que sur les cartes non désactivées',
  m => /querySelectorAll\('\.pdp-carte:not\(\[aria-disabled="true"\]\)'\)/.test(corps(m, 'function renderChoixPoste()')),
  m => m.replace(".pdp-carte:not([aria-disabled=\"true\"])", '.pdp-carte'));
garde('la carte du poste actuel n\'est ni un lien ni un bouton actif',
  m => { const f = corps(m, 'function renderChoixPoste()'); return !/<a\s/.test(f) && !/href=/.test(f); },
  m => m.replace('<button type="button" class="pdp-carte${actuel', '<a href="NEXUS-App-v1.html" class="pdp-carte${actuel'));

// 2. Pas de « quart » dans les textes du chemin.
garde('aucun mot « quart » dans les textes du chemin de changement',
  m => !/\bquarts?\b/i.test(textesChemin(m).replace(/\.quart\b|p_quart\b/g, '')),
  m => m.replace('Vos missions et justificatifs déjà enregistrés sont conservés.', 'Votre quart est conservé.'));
garde('la phrase de confirmation est celle validée',
  m => m.indexOf('Votre service ${ancien.label} sera clôturé et votre service ${nouveau.label} commencera. Vos missions et justificatifs déjà enregistrés sont conservés.') !== -1
    && /Poste actuel : <b>\$\{ancien\.label\}<\/b><\/p>\s*<p class="pdp-ligne-poste"><span>Nouveau poste : <b>\$\{nouveau\.label\}<\/b><\/span><\/p>/.test(m),
  m => m.replace('sera clôturé', 'sera terminé'));
garde('« Confirmer le changement » est le seul bouton plein ; « Annuler » est un lien',
  m => { const f = corps(m, 'async function renderConfirmationChangement(');
    return (f.match(/class="pdp-btn"/g) || []).length === 1 && /<button type="button" class="pdp-lien" id="btnAnnulerChangement">Annuler<\/button>/.test(f); },
  m => m.replace('class="pdp-lien" id="btnAnnulerChangement"', 'class="pdp-btn" id="btnAnnulerChangement"'));
garde('la confirmation n\'a ni cadre rouge ni cadre orange',
  m => { const f = corps(m, 'async function renderConfirmationChangement('); return /pdp-neutre/.test(f) && !/red|rouge|orange/.test(f.split('const sel')[0]); },
  m => m.replace('class="pdp-neutre" id="avertissementChangement"', 'class="pdp-neutre" style="border:2px solid var(--red)" id="avertissementChangement"'));

// 3. Aucun écran intermédiaire.
garde('aucun écran intermédiaire après la confirmation',
  m => { const f = corps(m, 'async function terminerPriseDePoste(');
    return !/innerHTML/.test(f) && !/Votre poste est pris/.test(m) && /aller\(\);\s*\}$/.test(f.trim().replace(/\s+\}$/, '\n}')) ; },
  m => m.replace('    aller();\n  }', "    hoteCourant.innerHTML = '<p>Votre poste est pris</p>';\n  }"));
garde('le message FDJ est confié à l\'accueil, pas affiché ici',
  m => /confierMessageFdj\(messageOuvertureFdj\)/.test(corps(m, 'async function terminerPriseDePoste(')),
  m => m.replace('confierMessageFdj(messageOuvertureFdj)', 'void 0'));
garde('l\'accueil caisse/renfort porte la ligne FDJ discrète',
  () => /id="apMessageFdj"/.test(ACC) && /v\.messageFdj && v\.messageFdj\.texte/.test(ACC),
  () => null); // mutation propre ci-dessous (source ACC)

// 4. Première écriture sans confirmation.
garde('la première écriture est toujours sans confirmation',
  m => /appelerChangementDeQart\(false, null\)/.test(corps(m, 'async function confirmerPriseDePoste(')),
  m => m.replace('appelerChangementDeQart(false, null)', 'appelerChangementDeQart(true, null)'));
garde('la confirmation demandée mène à l\'écran de confirmation, jamais à une écriture',
  m => /confirmation_requise[\s\S]{0,120}renderConfirmationChangement\(/.test(corps(m, 'async function confirmerPriseDePoste(')),
  m => m.replace('renderConfirmationChangement(reponse.data.quart_ouvert);', 'void 0;'));

// 5. Le motif reste transmis.
garde('le motif choisi est transmis à la confirmation',
  m => { const f = corps(m, 'async function renderConfirmationChangement(');
    return /appelerChangementDeQart\(true, motif\)/.test(f) && /sel\.value === 'releve'/.test(f) && /sel\.value === 'autre'/.test(f); },
  m => m.replace('appelerChangementDeQart(true, motif)', 'appelerChangementDeQart(true, null)'));
garde('le motif libre est limité à 200 caractères',
  m => /id="motifAutre" maxlength="200"/.test(m),
  m => m.replace('id="motifAutre" maxlength="200"', 'id="motifAutre"'));

// 6. Avertissement non bloquant.
garde('le bouton de confirmation n\'est jamais désactivé par un avertissement',
  m => { const f = corps(m, 'async function renderConfirmationChangement(');
    const avant = f.split("document.getElementById('btnConfirmerChangement').addEventListener")[0];
    return !/disabled/.test(avant) && !/avertissements\.length[^\n]*(disabled|return)/.test(f); },
  m => m.replace('<button class="pdp-btn" id="btnConfirmerChangement">', "<button class=\"pdp-btn\" id=\"btnConfirmerChangement\"${avertissements.length ? ' disabled' : ''}>"));
garde('l\'avertissement est une ligne factuelle, sans emoji, au jeton d\'alerte de la charte',
  m => { const f = corps(m, 'async function renderConfirmationChangement(');
    return /class="pdp-avertissement" id="avertissementOuvert" role="note"/.test(f)
      && /\.pdp-avertissement\{background:var\(--amber-dim\)/.test(lire('NEXUS-Prise-De-Poste-v1.html') + m)
      && !/[←-⯿\u{1F300}-\u{1FAFF}]/u.test(m.slice(m.indexOf('const TEXTE_FDJ_OUVERTE'), m.indexOf('function avertissementsChangement'))); },
  m => m.replace("'Votre caisse FDJ est encore ouverte : pensez à la clôturer.'", "'⚠️ Votre caisse FDJ est encore ouverte : pensez à la clôturer.'"));
garde('une erreur de lecture n\'ajoute ni ligne ni blocage',
  m => { const f = corps(m, 'async function lireAvertissementsChangement('); return /catch \(e\)[\s\S]*return \[\]/.test(f) && /fdj\.error \? \[\] : fdj\.data/.test(f); },
  m => m.replace('fdj.error ? [] : fdj.data', 'fdj.data'));
garde('les lectures restent en lecture seule (ni insert, ni update, ni rpc)',
  m => { const f = corps(m, 'async function lireAvertissementsChangement('); return !/\.(insert|update|upsert|delete|rpc)\(/.test(f)
    && !/fdj_cash_controls/.test(f); },
  m => m.replace("nexusClient.from('fdj_shifts').select('id, statut')", "nexusClient.from('fdj_shifts').update({ statut: 'x' })"));

// 7. Pied de page : calcul d'estampille.
garde('l\'estampille technique est posée masquée par défaut',
  () => /nexus-build-estampille';\s*s\.style\.cssText = 'display:none;/.test(BUILD),
  () => null);

// ---- Exécution des gardes sur le module ------------------------------------
let ok = 0;
const ACC_GARDE = 'l\'accueil caisse/renfort porte la ligne FDJ discrète';
const BUILD_GARDE = 'l\'estampille technique est posée masquée par défaut';
// 6. Retouches de la recette Guardian 7136389619.
garde('« Poste actuel » est un badge d\'état neutre du composant partagé, écrit en toutes lettres',
  m => /NexusBadgeEtat\.neutre\('Poste actuel'\)/.test(m) && /function badgePosteActuel\(\)/.test(m),
  m => m.replace("NexusBadgeEtat.neutre('Poste actuel')", "'Poste actuel'"));
garde('la carte du poste actuel est visiblement inactive (opacité 0,6), badge compris dans le sens écrit',
  m => /\.pdp-carte\.pdp-actuelle \.pdp-corps,\.pdp-carte\.pdp-actuelle \.pdp-visuel\{opacity:\.6;\}/.test(m),
  m => m.replace('opacity:.6;}', 'opacity:1;}'));
garde('la confirmation tient sur deux lignes : poste actuel, puis nouveau poste insécable',
  m => { const f = corps(m, 'async function renderConfirmationChangement(');
    return /<p class="pdp-ligne-poste">Poste actuel : <b>/.test(f) && /<span>Nouveau poste : <b>\$\{nouveau\.label\}<\/b><\/span>/.test(f) && /\.pdp-ligne-poste span\{white-space:nowrap;\}/.test(m) && /<b>\$\{ancien\.label\}<\/b><\/p>/.test(f); },
  m => m.replace(/<\/b><\/p>\s*<p class="pdp-ligne-poste"><span>/, '</b> · <span>'));
garde('le rappel de sécurité n\'a plus d\'emoji et garde son cadre rouge',
  m => !/⚠/.test(m) && /\.pdp-securite\{[^}]*border:1px solid rgba\(var\(--red-rgb\),\.4\)/.test(m) && /<b>Rappel sécurité<\/b>/.test(m),
  m => m.replace('<b>Rappel sécurité</b>', '⚠️ <b>Rappel sécurité</b>'));
garde('le sélecteur « Motif » suit les jetons --t-* (fond, bordure, rayon 8 px), sans style en ligne',
  m => /\.pdp-motif\{[^}]*background:var\(--t-raised\);border:1px solid var\(--t-line\);border-radius:8px;color:var\(--t-text\)/.test(m) && /<select id="motifChangement" class="pdp-motif">/.test(m),
  m => m.replace('border-radius:8px;color:var(--t-text)', 'border-radius:2px;color:var(--t-text)'));
garde('le composant de badge est chargé par l\'Accueil et par la page de prise de poste',
  () => ['NEXUS-App-v1.html', 'NEXUS-Prise-De-Poste-v1.html'].every(f => /<script src="nexus-badge-etat\.js[^"]*"><\/script>\s*<script src="nexus-prise-de-poste\.js/.test(require('fs').readFileSync(require('path').join(__dirname, f), 'utf8'))),
  () => '');

const ORDRE_BADGE = /<script src="nexus-badge-etat\.js[^"]*"><\/script>\s*<script src="nexus-prise-de-poste\.js/;
const mutantsSource = {
  ["le composant de badge est chargé par l'Accueil et par la page de prise de poste"]: { src: lire('NEXUS-App-v1.html'), test: s => ORDRE_BADGE.test(s), mut: s => s.replace('<script src="nexus-badge-etat.js"></script>', '') },
  [ACC_GARDE]: { src: ACC, test: s => /id="apMessageFdj"/.test(s) && /v\.messageFdj && v\.messageFdj\.texte/.test(s), mut: s => s.replace("v.messageFdj && v.messageFdj.texte", 'false') },
  [BUILD_GARDE]: { src: BUILD, test: s => /nexus-build-estampille';\s*s\.style\.cssText = 'display:none;/.test(s), mut: s => s.replace("s.style.cssText = 'display:none;", "s.style.cssText = 'display:block;") },
};
for (const g of GARDES) {
  const ext = mutantsSource[g.nom];
  if (ext) {
    assert.ok(ext.test(ext.src), `Garde rouge sur la source : ${g.nom}`);
    const mutee = ext.mut(ext.src);
    assert.notStrictEqual(mutee, ext.src, `Mutation sans effet : ${g.nom}`);
    assert.ok(!ext.test(mutee), `La mutation n'a pas fait rougir : ${g.nom}`);
  } else {
    assert.ok(g.test(MOD), `Garde rouge : ${g.nom}`);
    const mutee = g.mutation(MOD);
    assert.notStrictEqual(mutee, MOD, `Mutation sans effet : ${g.nom}`);
    assert.ok(!g.test(mutee), `La mutation n'a pas fait rougir : ${g.nom}`);
  }
  console.log('OK  —', g.nom); ok++;
}

// ---- Avertissements : présent dans chaque cas, absent sinon ------------------
{
  const { avertissementsChangement: av } = charger(MOD).NexusPriseDePoste || {};
  const fn = typeof av === 'function' ? (a, b) => JSON.parse(JSON.stringify(av(a, b))) : null;
  assert.ok(fn, 'avertissementsChangement exposée');
  const FDJ = 'Votre caisse FDJ est encore ouverte : pensez à la clôturer.';
  const CPT = 'Un comptage est en cours : il restera à terminer.';
  const cpt = (statut, extra) => [{ inventaire_quarts: Object.assign({ statut, cloture_le: null, is_simulation: false }, extra) }];
  assert.deepStrictEqual(fn([{ statut: 'brouillon' }], []), [FDJ], 'FDJ brouillon');
  assert.deepStrictEqual(fn([{ statut: 'cloture' }], []), [], 'FDJ close : rien');
  assert.deepStrictEqual(fn([], []), [], 'rien : rien');
  assert.deepStrictEqual(fn(null, null), [], 'null : rien');
  for (const s of ['ouverture_en_cours', 'ouvert', 'cloture_en_cours']) assert.deepStrictEqual(fn([], cpt(s)), [CPT], `comptage ${s}`);
  assert.deepStrictEqual(fn([], cpt('cloture')), [], 'comptage clos : rien');
  assert.deepStrictEqual(fn([], cpt('ouvert', { cloture_le: '2026-11-24T10:00:00Z' })), [], 'comptage daté de clôture : rien');
  assert.deepStrictEqual(fn([], cpt('ouvert', { is_simulation: true })), [], 'simulation : rien');
  assert.deepStrictEqual(fn([{ statut: 'brouillon' }], cpt('ouvert')), [FDJ, CPT], 'les deux, FDJ d\'abord');
  console.log('OK  — avertissements : présents dans chaque cas, absents sinon'); ok++;

  // Mutation : un comptage clos qui avertirait doit faire rougir la garde.
  const mut = MOD.replace("STATUTS_COMPTAGE_EN_COURS = ['ouverture_en_cours', 'ouvert', 'cloture_en_cours']", "STATUTS_COMPTAGE_EN_COURS = ['ouverture_en_cours', 'ouvert', 'cloture_en_cours', 'cloture']");
  assert.notStrictEqual(mut, MOD, 'mutation sans effet (statuts)');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(charger(mut).NexusPriseDePoste.avertissementsChangement([], cpt('cloture')))), [CPT], 'la mutation aurait dû avertir à tort');
  console.log('OK  — mutation « comptage clos avertit » détectée'); ok++;
}

// ---- Message FDJ : lu une fois, bon employé, pas périmé -----------------------
{
  const A = charger(ACC).NexusAccueilPiste;
  const cle = A.CLE_MESSAGE_FDJ;
  const boite = (obj) => { const d = Object.assign({}, obj); return { getItem: k => (k in d ? d[k] : null), removeItem: k => { delete d[k]; }, d }; };
  const maintenant = Date.UTC(2026, 10, 24, 10, 0, 0);
  const msg = (extra) => JSON.stringify(Object.assign({ texte: 'FDJ : reprise du fond de caisse.', employee: 'e1', t: maintenant - 60000, ton: 'info' }, extra));
  let s = boite({ [cle]: msg() });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(A.consommerMessageFdj(s, 'e1', maintenant))), { texte: 'FDJ : reprise du fond de caisse.', ton: 'info' });
  assert.strictEqual(A.consommerMessageFdj(s, 'e1', maintenant), null, 'lu une seule fois');
  assert.ok(!(cle in s.d), 'clé effacée');
  assert.strictEqual(A.consommerMessageFdj(boite({ [cle]: msg() }), 'e2', maintenant), null, 'autre employé');
  assert.strictEqual(A.consommerMessageFdj(boite({ [cle]: msg({ t: maintenant - 5 * 3600 * 1000 }) }), 'e1', maintenant), null, 'périmé après 4 h');
  assert.strictEqual(A.consommerMessageFdj(boite({ [cle]: '{pas du json' }), 'e1', maintenant), null, 'JSON invalide');
  assert.strictEqual(A.consommerMessageFdj(boite({}), 'e1', maintenant), null, 'rien à lire');
  console.log('OK  — message FDJ : une lecture, bon employé, 4 h'); ok++;
  const mut = ACC.replace("String(m.employee) !== String(employeeId)", 'false');
  assert.notStrictEqual(mut, ACC, 'mutation sans effet (employé)');
  assert.deepStrictEqual(charger(mut).NexusAccueilPiste.consommerMessageFdj(boite({ [cle]: msg() }), 'e2', maintenant) !== null, true, 'la mutation aurait dû livrer à un autre employé');
  const mut2 = ACC.replace("stockage.removeItem(CLE_MESSAGE_FDJ);", '');
  assert.notStrictEqual(mut2, ACC, 'mutation sans effet (effacement)');
  const s2 = boite({ [cle]: msg() });
  charger(mut2).NexusAccueilPiste.consommerMessageFdj(s2, 'e1', maintenant);
  assert.ok(cle in s2.d, 'sans effacement la clé reste : mutation détectée');
  console.log('OK  — mutations « autre employé » et « sans effacement » détectées'); ok++;

  // La ligne apparaît sur l'accueil caisse/renfort seulement si le message existe.
  assert.ok(/messageFdj/.test(lire('NEXUS-App-v1.html')) && /consommerMessageFdj\(typeof sessionStorage !== .undefined. \? sessionStorage : null, employee\.id, Date\.now\(\)\)/.test(lire('NEXUS-App-v1.html')), 'NEXUS-App câble le message');
  console.log('OK  — NEXUS-App-v1.html consomme le message FDJ'); ok++;
}

// ---- Pied de page : visible du manager et du gérant seulement -----------------
{
  const debut = BUILD.indexOf('function reglerEstampille(roleReel)');
  assert.ok(debut !== -1, 'reglerEstampille introuvable');
  const fin = BUILD.indexOf('function demarrer()', debut);
  const texte = BUILD.slice(debut, fin);
  const jouer = (src, roleReel, coherent) => {
    const pied = { technique: { style: {} }, rechargez: { style: {} } };
    const ctx = {
      document: { querySelector: s => s === 'footer' ? { querySelector: c => (c === '.nexus-build-estampille' ? pied.technique : c === '.nexus-build-rechargez' ? pied.rechargez : null) } : null },
      IDENTITE: { coherent },
    };
    require('vm').runInNewContext(src + '\nreglerEstampille(' + JSON.stringify(roleReel) + ');', ctx);
    return { technique: pied.technique.style.display, rechargez: pied.rechargez.style.display };
  };
  // Le code généré utilise IDENTITE : on le fournit comme variable globale du contexte.
  for (const r of ['manager', 'gerant']) {
    assert.deepStrictEqual(jouer(texte, r, true), { technique: 'block', rechargez: 'none' }, `${r} : pied visible`);
  }
  for (const r of ['pompiste', 'caissiere', 'renfort', null, undefined]) {
    assert.deepStrictEqual(jouer(texte, r, true), { technique: 'none', rechargez: 'none' }, `${r} : pied masqué`);
  }
  console.log('OK  — pied : visible du manager et du gérant, masqué de l\'employé'); ok++;
  // Pied incohérent : l'employé voit UNE ligne d'action, le manager garde le technique.
  assert.deepStrictEqual(jouer(texte, 'pompiste', false), { technique: 'none', rechargez: 'block' }, 'employé : ligne « rechargez »');
  assert.deepStrictEqual(jouer(texte, 'manager', false), { technique: 'block', rechargez: 'none' }, 'manager : technique, pas de ligne');
  assert.ok(/Application incomplète : rechargez la page/.test(BUILD), 'texte de la ligne');
  console.log('OK  — pied incohérent : l\'employé voit « Application incomplète : rechargez la page »'); ok++;
  // Mutations.
  const m1 = texte.replace("roleReel === 'manager' || roleReel === 'gerant'", "true");
  assert.notStrictEqual(m1, texte, 'mutation sans effet (pilote)');
  assert.notDeepStrictEqual(jouer(m1, 'pompiste', true), { technique: 'none', rechargez: 'none' }, 'pied visible de l\'employé : mutation détectée');
  const m2 = texte.replace("(!pilote && !IDENTITE.coherent)", 'false');
  assert.notStrictEqual(m2, texte, 'mutation sans effet (rechargez)');
  assert.notDeepStrictEqual(jouer(m2, 'pompiste', false), { technique: 'none', rechargez: 'block' }, 'ligne « rechargez » supprimée : mutation détectée');
  const m3 = texte.replace("roleReel === 'manager' || roleReel === 'gerant'", "roleReel === 'manager'");
  assert.notDeepStrictEqual(jouer(m3, 'gerant', true), { technique: 'block', rechargez: 'none' }, 'gérant sans pied : mutation détectée');
  console.log('OK  — mutations du pied détectées'); ok++;
  // Câblage : nexusRequireAuth règle l'estampille avec le rôle RÉEL.
  assert.ok(/NexusBuild\.reglerEstampille\(employee\.role_reel\)/.test(AUTH), 'nexusRequireAuth règle l\'estampille');
  assert.notStrictEqual(AUTH.replace('NexusBuild.reglerEstampille(employee.role_reel)', 'void 0'), AUTH);
  console.log('OK  — nexusRequireAuth règle le pied avec le rôle réel'); ok++;
}

console.log(`\n${ok} vérifications passées.`);
