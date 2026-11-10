// Guardian 6767377059 (10/11/2026) : lot 3 des emojis, Carburants Performance.
// Présentation seulement : libellés métier gardés, couleur et pictogramme suivent la gravité (charte NexusBadgeEtat).
const assert = require('assert');
const fs = require('fs');
const path = require('path');
let n = 0;
function t(nom, f) { f(); n++; console.log('OK ' + nom); }
function garde(nom, src, regle, litteral, remplacement) {
  t(nom, () => {
    assert.ok(regle(src), 'la garde doit passer sur la source');
    assert.ok(src.indexOf(litteral) >= 0, 'littéral introuvable : ' + litteral);
    assert.ok(!regle(src.replace(litteral, remplacement)), 'la garde doit rougir sur la source mutée');
  });
}
const lire = f => fs.readFileSync(path.join(__dirname, f), 'utf8');
const H = lire('NEXUS-Carburants-Pilotage-v1.html');
const bloc = (debut, fin) => { const i = H.indexOf(debut); assert.ok(i >= 0, debut); const j = H.indexOf(fin, i); assert.ok(j > i, fin); return H.slice(i, j); };
const STYLE = bloc('const ETAT_COMMANDE_STYLE', '};\n');
const entree = cle => { const m = new RegExp(cle + ':\\s*\\{[^}]*\\}').exec(STYLE); assert.ok(m, cle); return m[0]; };

// Libellés métier conservés
const LIBELLES = { confortable: 'Rien à faire', a_anticiper: 'À surveiller', moment_ideal: 'Commander aujourd\'hui', securite: 'Risque de rupture', securite_probable: 'Risque de rupture probable — à confirmer', non_calculable: 'Non calculable' };
Object.keys(LIBELLES).forEach(k => t('libellé conservé : ' + k, () => { assert.ok(entree(k).replace(/\\'/g, "'").indexOf(LIBELLES[k]) >= 0); }));

// Gravités
const GRAV = { confortable: 'conforme', a_anticiper: 'a-verifier', securite: 'critique', securite_probable: 'a-verifier' };
const regleGrav = (c, k, g) => new RegExp(k + ':\\s*\\{[^}]*gravite:\\s*\'' + g + '\'').test(c);
Object.keys(GRAV).forEach(k => t('gravité ' + k + ' → ' + GRAV[k], () => { assert.ok(regleGrav(STYLE, k, GRAV[k])); }));
t('« Commander aujourd\'hui » est une action, pas une gravité', () => {
  const e = entree('moment_ideal');
  assert.ok(/action:\s*'agir'/.test(e));
  assert.ok(!/gravite:\s*'(critique|a-verifier|conforme|information)'/.test(e));
});
t('« Calcul suspendu » : pas de gravité (rendu neutre)', () => { assert.ok(/gravite:\s*null/.test(entree('non_calculable'))); });
t('plus aucun emoji ni champ icone dans ETAT_COMMANDE_STYLE', () => { assert.ok(!/icone:/.test(STYLE)); assert.ok(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(STYLE)); });
garde('gravité : Risque de rupture reste critique', STYLE, c => regleGrav(c, 'securite', 'critique'), "gravite: 'critique'", "gravite: 'a-verifier'");
garde('action : moment_ideal garde le marqueur Agir', STYLE, c => /moment_ideal:\s*\{[^}]*action:\s*'agir'/.test(c), "action: 'agir'", "gravite: 'critique'");

// Fiabilité
t('fiabilité : Confirmée / À confirmer / Calcul suspendu', () => {
  const b = bloc('const NIVEAU_FIABILITE_BADGE', '};\n');
  assert.ok(/fiable:[^}]*conforme[^}]*Confirmée/.test(b));
  assert.ok(/a_confirmer:[^}]*en-attente[^}]*À confirmer/.test(b));
  assert.ok(/non_calculable:[^}]*a-verifier[^}]*Calcul suspendu/.test(b));
});
t('diagnostic : anomalie → critique, relevé non valide et vérification incomplète → à vérifier', () => {
  const b = bloc('const NIVEAU_DIAGNOSTIC', '};\n');
  assert.ok(/anomalie_a_investiguer:\s*'critique'/.test(b));
  assert.ok(/releve_non_valide:\s*'a-verifier'/.test(b));
  assert.ok(/verify_incomplet:\s*'a-verifier'/.test(b));
});
t('messages : ok/attention/alerte/attente/info → charte', () => {
  const b = bloc('const NIVEAU_CHARTE_MESSAGE', '\n');
  assert.ok(/alerte:\s*'critique'/.test(b) && /attention:\s*'a-verifier'/.test(b) && /info:\s*'information'/.test(b) && /ok:\s*'conforme'/.test(b) && /attente:\s*'en-attente'/.test(b));
});
garde('messages : alerte reste critique', H, c => /alerte:\s*'critique'/.test(c), "alerte: 'critique'", "alerte: 'a-verifier'");

// Règle de Frédéric : action et risque coexistent
t('Agir à côté du badge de risque, sans absorption', () => {
  assert.ok(/NexusBadgeEtat\.action\('agir', \{ clicable: true, attrs: 'data-cp-agir' \}\)/.test(H));
  assert.ok(/actionCarte\.type === 'commander'[\s\S]{0,400}stCarteCle\.action \? '' : ' ' \+ NexusBadgeEtat\.action\('agir'/.test(H));
  assert.ok(/ctx\.commandeRecommandee/.test(H));
});
garde('chip Agir : ouvre la fiche de commande', H, c => /\[data-cp-agir\]'\)\.forEach[^;]*ouvrirFicheCommande\(ctx\)/.test(c), "zone.querySelectorAll('[data-cp-agir]')", "zone.querySelectorAll('[data-cp-x]')");

// Pas de valeur écrite modifiée : clés inchangées, aucun libellé affiché ne part en écriture
t('clés d\'état inchangées', () => { ['confortable', 'a_anticiper', 'moment_ideal', 'securite', 'securite_probable', 'non_calculable'].forEach(k => assert.ok(new RegExp('\\b' + k + ':\\s*\\{').test(STYLE), k)); });
t('aucune écriture ne consomme les libellés ou classes affichés', () => {
  assert.ok(!/(insert|upsert|update)\([^)]*(badgeLibelle|htmlEtatCommande|ETAT_COMMANDE_STYLE|NIVEAU_FIABILITE_BADGE)/.test(H));
  assert.ok(!/replace\(\/\^\\S\+\\s\/, ''\)/.test(H), 'plus de retrait fragile du premier mot');
});

// Deux ⚠️ et accordéons
t('les deux ⚠️ deviennent des badges À vérifier', () => {
  assert.ok(!/⚠️/.test(H.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')));
  assert.ok(/gravite\('a-verifier', \{ libelle: 'volume non encore réceptionné' \}\)/.test(H));
  assert.ok(/gravite\('a-verifier', \{ libelle: 'Aucun jaugeage' \}\)/.test(H));
});
const ACC = { 'mod-reception-carburant': 1, 'mod-carburants': 1, 'mod-resultats': 1, 'mod-carburants-performance': 1, 'mod-evolution': 1, 'mod-centre-intelligence': 1, 'mod-capital': 1, 'mod-journal': 1 };
t('8 sections dépliables : pictogramme du kit, emoji gardé en repli', () => {
  const m = H.match(/class="accordion-icon [^"]*" data-cp-icone="([^"]+)">[^<]+<\/span>/g) || [];
  assert.strictEqual(m.length, 8);
  Object.keys(ACC).forEach(id => assert.ok(H.indexOf('data-cp-icone="' + id + '"') >= 0, id));
  assert.ok(/querySelectorAll\('\[data-cp-icone\]'\)/.test(H));
});
garde('accordéons : initialisation du kit', H, c => /querySelectorAll\('\[data-cp-icone\]'\)/.test(c), "querySelectorAll('[data-cp-icone]')", "querySelectorAll('[data-cp-aucun]')");
t('composants chargés dans le bon ordre', () => {
  const a = H.indexOf('nexus-etats-conseiller.js'), b = H.indexOf('nexus-badge-etat.js'), c = H.indexOf('const NIVEAU_CHARTE_MESSAGE');
  assert.ok(a > 0 && b > a && c > b);
});
// Hors périmètre intact
t('hors périmètre intact : ☰ Menu, ✕, 🎯', () => { assert.ok(H.indexOf('☰ Menu') >= 0); assert.ok(H.indexOf('✕') >= 0); assert.ok(H.indexOf('🎯') >= 0); });

// Guardian 6768039739 + arbitrages de Frédéric 6769057864 (10/11/2026)
const vm = require('vm');
const CSSH = H.split('</style>')[0];
const decl = sel => { const m = new RegExp('(?:^|\\n)\\s*' + sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}').exec(CSSH); assert.ok(m, sel); return m[1]; };
t('libellé d\'état : police normale, retour à la ligne, min-width 0', () => {
  const d = decl('.cp-etat-libelle');
  assert.ok(/font-family:\s*var\(--sans\)/.test(d) && /white-space:\s*normal/.test(d) && /min-width:\s*0/.test(d));
  assert.ok(!/nowrap|--mono/.test(d));
  assert.ok(!/style="color:var\(--text\);"/.test(H.slice(H.indexOf('function htmlEtatCommande'), H.indexOf('function htmlEtatCommande') + 900)));
});
t('badge de gravité de la carte : se replie au lieu de déborder', () => { assert.ok(/white-space:\s*normal/.test(decl('.cp-carte-etat .nbe-badge')) && /max-width:\s*100%/.test(decl('.cp-carte-etat .nbe-badge'))); });
t('à 375 px : titre, badge et consigne empilés sur une colonne', () => {
  const m = /@media \(max-width:600px\)\{([\s\S]*?)\n  \}/.exec(CSSH.slice(CSSH.indexOf('.cp-carte-etat{')));
  assert.ok(m);
  assert.ok(/\.commande-carte-tete\{flex-direction:column; align-items:flex-start;\}/.test(m[1]));
  assert.ok(/\.commande-carte-tete \.cp-carte-etat\{flex-direction:column; align-items:flex-start; width:100%;\}/.test(m[1]));
});
t('l\'en-tête de carte n\'hérite plus de .commande-carte-badge (mono, nowrap)', () => {
  const i = H.indexOf('<div class="commande-carte-tete">');
  assert.ok(/<span class="cp-carte-etat">\$\{badgeEtatCommandeHTML\}<\/span>/.test(H.slice(i, i + 400)));
  assert.ok(!/commande-carte-badge/.test(H.slice(i, i + 400)));
});
garde('empilement mobile', H, c => /\.commande-carte-tete\{flex-direction:column; align-items:flex-start;\}/.test(c), 'flex-direction:column; align-items:flex-start;}', 'flex-direction:row; align-items:flex-start;}');
garde('libellé : white-space normal', H, c => /\.cp-etat-libelle\{[^}]*white-space:\s*normal/.test(c), 'white-space:normal; min-width:0; overflow-wrap:anywhere', 'white-space:nowrap; min-width:0; overflow-wrap:anywhere');
t('simulateur : le badge passe par htmlEtatCommande (pictogramme du kit)', () => {
  const i = H.indexOf('Simulation : \' + stSim.libelle');
  assert.ok(i > 0);
  assert.ok(/htmlEtatCommande\(simulation\.etatGlobal, \{ libelle: 'Simulation : ' \+ stSim\.libelle \}\)/.test(H));
  assert.ok(!/<span class="commande-carte-badge" style="background:\$\{stSim\.f\}/.test(H));
});
garde('simulateur : rendu par le composant', H, c => /htmlEtatCommande\(simulation\.etatGlobal, \{ libelle: 'Simulation : '/.test(c), "htmlEtatCommande(simulation.etatGlobal, { libelle: 'Simulation : '", "('Simulation : ' + (");

// Action selon la confirmation : fonction réelle extraite et exécutée
const ctxVm = { console, escCP: s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])) };
vm.createContext(ctxVm);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'nexus-etats-conseiller.js'), 'utf8'), ctxVm);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'nexus-badge-etat.js'), 'utf8'), ctxVm);
const iA = H.indexOf('function actionCarteCommande'), iB = H.indexOf('function htmlEtatCommande');
vm.runInContext(H.slice(iA, iB), ctxVm);
const AC = (ctx, e) => vm.runInContext('actionCarteCommande', ctxVm)(ctx, e);
const avis = [{ date: '2026-10-28', quart: 'matin' }];
t('à confirmer + contrôle Verify : bouton Ouvrir Verify avec lien profond', () => {
  const a = AC({ avisVerifyJour: avis, commandeRecommandee: true }, 'proposition_a_confirmer');
  assert.strictEqual(a.type, 'verify');
  assert.strictEqual(a.href, 'NEXUS-Verify-v1.html?ouvrir_date=2026-10-28&ouvrir_quart=matin');
});
t('à confirmer sans date ni quart : lien Verify générique', () => { assert.strictEqual(AC({ avisVerifyJour: [{}] }, 'proposition_a_confirmer').href, 'NEXUS-Verify-v1.html'); });
t('confirmée le jour même : Commander aujourd\'hui (ouvre la fiche)', () => { assert.strictEqual(AC({ avisVerifyJour: avis, commandeRecommandee: true }, 'confirmee').type, 'commander'); });
t('rien à ouvrir : consigne écrite, jamais de bouton', () => {
  assert.strictEqual(AC({ avisVerifyJour: [], commandeRecommandee: true }, 'proposition_a_confirmer').type, 'consigne');
  assert.strictEqual(AC({ avisVerifyJour: [], commandeRecommandee: true }, 'calcul_impossible').type, 'consigne');
  assert.strictEqual(AC({ commandeRecommandee: false }, 'confirmee').type, 'aucune');
  const consigne = vm.runInContext("NexusBadgeEtat.action('agir', { clicable: false })", ctxVm);
  assert.ok(/<span class="nbe-consigne/.test(consigne) && !/<button/.test(consigne));
});
t('carte : cas Verify = état « Proposition à confirmer », pas de chip Agir ni « Commander aujourd\'hui »', () => {
  const i = H.indexOf("if (actionCarte.type === 'verify')"), j = H.indexOf("} else if (actionCarte.type === 'commander')");
  const b = H.slice(i, j);
  assert.ok(/gravite\('a-verifier', \{ libelle: 'Proposition à confirmer' \}\)/.test(b));
  assert.ok(/data-cp-verify=/.test(b) && />Ouvrir Verify<\/button>/.test(b));
  assert.ok(!/NexusBadgeEtat\.action\('agir'/.test(b));
  assert.ok(/stCarteCle\.action/.test(b), 'le risque établi garde son badge');
});
t('carte : « Ouvrir Verify » ouvre bien Verify', () => { assert.ok(/\[data-cp-verify\]'\)\.forEach\(b => b\.addEventListener\('click', \(\) => \{ window\.location\.href = b\.getAttribute\('data-cp-verify'\)/.test(H)); });
t('carte : cas consigne = consigne métier, pas « À faire : agir »', () => {
  assert.ok(/consigneCommandeAujourdhui\(\) : ''/.test(H));
  assert.ok(H.indexOf("Commande à passer aujourd\\'hui") >= 0);
  assert.ok(!/NexusBadgeEtat\.action\('agir', \{ clicable: false \}\)/.test(H));
});
const regleLigne = c => /ETAT_COMMANDE_STYLE\[cle\]\.action && etatConfirmationDe\(ctx\) !== 'confirmee'/.test(c) && /\$\{etatLigneCommande\(ev\.etat, ctx\)\}/.test(c);
t('lignes par carburant : pas de « Commander aujourd\'hui » ni Agir sans confirmation', () => { assert.ok(regleLigne(H)); assert.ok(/etatLigneCommande[\s\S]{0,400}Proposition à confirmer/.test(H)); });
garde('lignes : la condition de confirmation est nécessaire', H, regleLigne, "etatConfirmationDe(ctx) !== 'confirmee'", "etatConfirmationDe(ctx) !== 'calcul_impossible'");
const regleBouton = c => /ctx\.commandeRecommandee && etatConfirmationDe\(ctx\) !== 'confirmee'\s*\?\s*`<div[^`]*Voir la fiche de commande/.test(c);
t('bouton : lien discret « Voir la fiche de commande » si non confirmée', () => { assert.ok(regleBouton(H)); assert.ok(/Préparer ma commande →<\/button>/.test(H)); });
garde('bouton : le lien discret dépend de la confirmation', H, regleBouton, "etatConfirmationDe(ctx) !== 'confirmee'\n      ? `<div", "etatConfirmationDe(ctx) === 'zz'\n      ? `<div");
t('Commande déjà passée hors NEXUS reste proposée', () => { assert.ok(H.indexOf('Commande déjà passée hors NEXUS') >= 0 && H.indexOf('lienFicheHorsNexus') >= 0); });
garde('action : Verify seulement si à confirmer avec un contrôle', H, c => /etatConfirmation === 'proposition_a_confirmer' && avis\.length > 0/.test(c), "etatConfirmation === 'proposition_a_confirmer' && avis.length > 0", "etatConfirmation === 'proposition_a_confirmer' || avis.length > 0");
garde('action : Commander aujourd\'hui seulement si confirmée', H, c => /etatConfirmation === 'confirmee' && ctx && ctx\.commandeRecommandee\) return \{ type: 'commander' \}/.test(c), "etatConfirmation === 'confirmee' && ctx", "etatConfirmation !== 'calcul_impossible' && ctx");
garde('carte : Ouvrir Verify est un vrai bouton', H, c => /<button type="button" class="nbe-action nbe-action-agir"[^>]*data-cp-verify/.test(c), '<button type="button" class="nbe-action nbe-action-agir"', '<span class="nbe-action nbe-action-agir"');
console.log(n + ' épreuves OK');
