// Épreuve — 21/10/2026, lot PARCOURS-POMPISTE-LOT2-FIL-DEBUT-DE-QUART-20261021 (fil « Mon début de quart »).
// Exigences : jusqu'à trois étapes qui s'ouvrent l'une l'autre (jaugeage d'ouverture → relevé des index → inventaire gaz / glaçons / écailles) ;
// même règle que determinerProchaineActionEmploye : une étape déjà faite ou sans objet n'y figure pas (jaugeage fait le matin) ;
// progression sur les étapes réellement restantes (« Étape 1 sur 2 »), jamais un « sur 3 » figé ; pas de FDJ (boutique seule) ; un seul bouton de continuation par étape ; reprise là où le pompiste s'est arrêté, brouillons conservés ;
// même sortie « Quitter et revenir à l'Accueil » partout ; ni Missions, ni catalogue de l'Inventaire, ni menu des Relevés piste, ni Matin/Soir
// pendant le fil ; la prise de poste ne laisse plus Missions comme destination ; aucun pointage.
// Le module est exécuté tel quel ; les écrans sont lus dans leurs vraies sources. Chaque épreuve est contrôlée par une mutation.

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const lire = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');
const fichierModule = path.join(__dirname, 'nexus-fil-debut-quart.js');
const SRC = {
  module: fs.existsSync(fichierModule) ? lire('nexus-fil-debut-quart.js') : '',
  releves: lire('NEXUS-Releves-Piste-v1.html'),
  pdp: lire('NEXUS-Prise-De-Poste-v1.html'),
  inv: lire('NEXUS-Inventaire-v1.html'),
  app: lire('NEXUS-App-v1.html'),
  jeu: lire('supabase/recette-jeux/20261021_jeu_recette_fil_debut_quart.sql'),
};

function charger(src) {
  const m = { exports: {} };
  new Function('module', 'self', src)(m, undefined);
  return m.exports;
}
function stockage() {
  const d = {};
  return { d, getItem: k => (k in d ? d[k] : null), setItem: (k, v) => { d[k] = String(v); }, removeItem: k => { delete d[k]; } };
}

function epreuves(S) {
  const echecs = [];
  const eprouve = (nom, f) => { try { f(); } catch (e) { echecs.push(`${nom} — ${e.message}`); } };
  let F = null;
  try { F = charger(S.module); } catch (e) { F = null; }
  const requis = () => { assert.ok(F && typeof F.urlEtape === 'function', 'module nexus-fil-debut-quart.js absent'); return F; };

  eprouve('F1 trois étapes, chacune ouvre la suivante (plan complet)', () => {
    const f = requis();
    assert.strictEqual(f.NOMBRE_ETAPES, 3);
    const P = [1, 2, 3];
    assert.ok(/^NEXUS-Releves-Piste-v1\.html\?fil=debut-quart&etape=1&debut=debut_q1&plan=1\.2\.3&ecran=jauge$/.test(f.urlEtape(1, 'debut_q1', P)), f.urlEtape(1, 'debut_q1', P));
    assert.ok(/^NEXUS-Releves-Piste-v1\.html\?fil=debut-quart&etape=2&debut=debut_q1&plan=1\.2\.3&moment=debut_q1$/.test(f.urlEtape(2, 'debut_q1', P)), f.urlEtape(2, 'debut_q1', P));
    assert.ok(/^NEXUS-Inventaire-v1\.html\?fil=debut-quart&etape=3&debut=debut_q1&plan=1\.2\.3$/.test(f.urlEtape(3, 'debut_q1', P)), f.urlEtape(3, 'debut_q1', P));
    assert.strictEqual(f.urlApres(1, 'debut_q1', P), f.urlEtape(2, 'debut_q1', P));
    assert.strictEqual(f.urlApres(2, 'debut_q2', P), f.urlEtape(3, 'debut_q2', P));
    assert.strictEqual(f.urlApres(3, 'debut_q1', P), 'NEXUS-App-v1.html', 'la dernière étape rend à l\'Accueil');
  });
  eprouve('F2 progression sur le plan complet et libellés des boutons', () => {
    const f = requis();
    assert.deepStrictEqual([1, 2, 3].map(n => f.libelleProgression(n, [1, 2, 3])), ['Étape 1 sur 3', 'Étape 2 sur 3', 'Étape 3 sur 3']);
    assert.strictEqual(f.libelleContinuer(1, [1, 2, 3]), 'Continuer vers le relevé des index');
    assert.strictEqual(f.libelleContinuer(2, [1, 2, 3]), 'Continuer vers l\'inventaire');
    assert.strictEqual(f.libelleContinuer(3, [1, 2, 3]), 'Terminer mon début de quart');
    assert.strictEqual(f.LIBELLE_SORTIE, 'Quitter et revenir à l\'Accueil');
  });
  eprouve('F2b jaugeage déjà fait (matin) : le fil commence aux index, « Étape 1 sur 2 », jamais « sur 3 »', () => {
    const f = requis();
    const plan = f.planSelonFaits({ resteJaugeage: false, resteIndex: true, resteInventaire: true });
    assert.deepStrictEqual(plan, [2, 3]);
    assert.strictEqual(f.libelleProgression(2, plan), 'Étape 1 sur 2');
    assert.strictEqual(f.libelleProgression(3, plan), 'Étape 2 sur 2');
    assert.strictEqual(f.libelleProgression(1, plan), '', 'une étape hors plan n\'a pas de rang');
    assert.strictEqual(f.libelleContinuer(2, plan), 'Continuer vers l\'inventaire');
    assert.strictEqual(f.libelleContinuer(3, plan), 'Terminer mon début de quart');
    assert.strictEqual(f.urlApres(2, 'debut_q2', plan), f.urlEtape(3, 'debut_q2', plan));
    const u = f.urlEtape(2, 'debut_q2', plan);
    assert.ok(/plan=2\.3/.test(u));
    assert.deepStrictEqual(f.planDe(u.slice(u.indexOf('?'))), [2, 3], 'le plan survit à l\'adresse');
  });
  eprouve('F2c une seule étape restante : « Étape 1 sur 1 », et elle termine le fil', () => {
    const f = requis();
    const plan = f.planSelonFaits({ resteJaugeage: false, resteIndex: false, resteInventaire: true });
    assert.deepStrictEqual(plan, [3]);
    assert.strictEqual(f.libelleProgression(3, plan), 'Étape 1 sur 1');
    assert.strictEqual(f.libelleContinuer(3, plan), 'Terminer mon début de quart');
    assert.strictEqual(f.urlApres(3, 'debut_q1', plan), 'NEXUS-App-v1.html');
    const sansIndex = f.planSelonFaits({ resteJaugeage: true, resteIndex: false, resteInventaire: true });
    assert.deepStrictEqual(sansIndex, [1, 3], 'un index fait ou sans objet saute à l\'inventaire');
    assert.strictEqual(f.urlApres(1, 'debut_q1', sansIndex), f.urlEtape(3, 'debut_q1', sansIndex));
    assert.strictEqual(f.libelleContinuer(1, sansIndex), 'Continuer vers l\'inventaire');
    assert.deepStrictEqual(f.planSelonFaits({ resteJaugeage: false, resteIndex: false, resteInventaire: false }), []);
  });
  eprouve('F2d plan absent ou illisible : le plan complet, jamais un plan vide ou désordonné', () => {
    const f = requis();
    for (const q of ['?fil=debut-quart&etape=2', '?fil=debut-quart&etape=2&plan=', '?fil=debut-quart&plan=3.2', '?fil=debut-quart&plan=9', '?fil=debut-quart&plan=a.b', '?fil=debut-quart&plan=2.2']) assert.deepStrictEqual(f.planDe(q), [1, 2, 3], q);
    assert.deepStrictEqual(f.planDe('?fil=debut-quart&plan=1.3'), [1, 3]);
    assert.strictEqual(f.libelleProgression(2, []), 'Étape 2 sur 3', 'plan vide traité comme complet');
  });
  eprouve('F2e pas de FDJ dans le fil : le FDJ relève de la boutique', () => {
    const f = requis();
    assert.ok(!/fdj|loto/i.test(S.module.replace(/\/\/.*$/gm, '')), 'le module nomme le FDJ');
    const plan = f.planSelonFaits({ resteJaugeage: true, resteIndex: true, resteInventaire: true, resteFdj: true });
    assert.deepStrictEqual(plan, [1, 2, 3], 'aucune étape FDJ, quoi qu\'on passe');
    for (let n = 1; n <= 3; n++) assert.ok(!/fdj/i.test(f.urlEtape(n, 'debut_q1', plan)), 'adresse FDJ');
    assert.ok(!/resteFdj|fdjFait/.test(S.app.slice(S.app.indexOf('const filLien'), S.app.indexOf('const filLien') + 500)), 'le lien du fil dépend du FDJ');
  });
  eprouve('F3 le fil se lit dans l\'adresse, rien d\'autre ne l\'active', () => {
    const f = requis();
    assert.strictEqual(f.estActif('?fil=debut-quart&etape=2'), true);
    assert.strictEqual(f.estActif('?moment=debut_q1'), false);
    assert.strictEqual(f.estActif(''), false);
    assert.strictEqual(f.etapeDe('?fil=debut-quart&etape=2'), 2);
    assert.strictEqual(f.etapeDe('?fil=debut-quart&etape=9'), null);
    assert.strictEqual(f.etapeDe('?etape=2'), null);
  });
  eprouve('F4 reprise : l\'étape atteinte est mémorisée, ne recule jamais, et la fin rend la main', () => {
    const f = requis(); const s = stockage();
    const tout = { resteJaugeage: true, resteIndex: true, resteInventaire: true };
    const r = (emp, jour) => f.urlRepriseSelonFaits(s, emp, jour, 'debut_q1', tout);
    assert.strictEqual(r('e1', '2026-10-21'), f.urlEtape(1, 'debut_q1', [1, 2, 3]));
    f.atteindre(s, 'e1', '2026-10-21', 2);
    assert.strictEqual(r('e1', '2026-10-21'), f.urlEtape(2, 'debut_q1', [1, 2, 3]));
    f.atteindre(s, 'e1', '2026-10-21', 1);
    assert.strictEqual(f.lire(s, 'e1', '2026-10-21').etape, 2, 'recul interdit');
    assert.strictEqual(r('e2', '2026-10-21'), f.urlEtape(1, 'debut_q1', [1, 2, 3]), 'un autre employé repart de 1');
    assert.strictEqual(r('e1', '2026-10-22'), f.urlEtape(1, 'debut_q1', [1, 2, 3]), 'un autre jour repart de 1');
    f.terminer(s, 'e1', '2026-10-21');
    assert.strictEqual(r('e1', '2026-10-21'), null);
    f.atteindre(s, 'e1', '2026-10-21', 3);
    assert.strictEqual(f.lire(s, 'e1', '2026-10-21').fini, true, 'un fil fini ne se rouvre pas');
  });
  eprouve('F5 reprise sur un autre appareil : les faits du serveur comptent autant que la mémoire locale', () => {
    const f = requis(); const s = stockage();
    const r = (j, i, v) => f.urlRepriseSelonFaits(s, 'e1', '2026-10-21', 'debut_q1', { resteJaugeage: j, resteIndex: i, resteInventaire: v });
    assert.strictEqual(r(true, true, true), f.urlEtape(1, 'debut_q1', [1, 2, 3]));
    assert.strictEqual(r(false, true, true), f.urlEtape(2, 'debut_q1', [2, 3]), 'jaugeage fait : on ouvre aux index, plan 2.3');
    assert.strictEqual(r(false, false, true), f.urlEtape(3, 'debut_q1', [3]));
    assert.strictEqual(r(false, false, false), null, 'plus rien à faire : pas de fil');
    f.atteindre(s, 'e1', '2026-10-21', 3);
    assert.strictEqual(r(true, true, true), f.urlEtape(3, 'debut_q1', [1, 2, 3]), 'jamais en dessous de la mémoire');
    assert.strictEqual(r(true, true, false), f.urlEtape(1, 'debut_q1', [1, 2]), 'mémoire au-delà du plan : première étape restante');
  });
  eprouve('F6 stockage indisponible : le fil ne casse pas', () => {
    const f = requis();
    const casse = { getItem() { throw new Error('refusé'); }, setItem() { throw new Error('plein'); } };
    assert.strictEqual(f.urlRepriseSelonFaits(casse, 'e1', 'd', 'debut_q1', { resteJaugeage: true, resteIndex: true, resteInventaire: true }), f.urlEtape(1, 'debut_q1', [1, 2, 3]));
    assert.strictEqual(f.atteindre(casse, 'e1', 'd', 2).etape, 2);
  });
  eprouve('F7 l\'inventaire du fil ne compte que gaz, glaçons, écailles', () => {
    const f = requis();
    for (const n of ['Gaz', 'Glaçons', 'Glacons', 'Écailles', 'Ecailles']) assert.ok(f.categorieDuFil(n), n);
    for (const n of ['Boissons', 'Lubrifiants', '', null]) assert.ok(!f.categorieDuFil(n), String(n));
  });
  eprouve('F8 module pur : aucune écriture en base, aucun pointage', () => {
    assert.ok(!/nexusClient|supabase|\.from\(|fetch\(|pointage/i.test(S.module.replace(/\/\/.*$/gm, '')), 'le module touche la base ou le pointage');
  });

  // --- Relevés piste ---
  const R = S.releves;
  eprouve('R1 Relevés piste : le script du fil est chargé et le fil se lit dans l\'adresse', () => {
    assert.ok(/<script src="nexus-fil-debut-quart\.js[^"]*"><\/script>/.test(R), 'script non chargé');
    assert.ok(/FIL\.etapeDe\(location\.search\)/.test(R), 'étape non lue');
  });
  eprouve('R2 Relevés piste : en fil, jamais le menu interne', () => {
    assert.ok(/if \(enFil\(\) && ecran === 'choix'\) ecran = 'filhors';/.test(R), 'le menu reste atteignable');
  });
  eprouve('R3 Relevés piste : progression et bouton unique de continuation', () => {
    assert.ok(/app\.innerHTML = filBandeau\(\) \+ vue;/.test(R), 'bandeau absent des vues');
    assert.ok(/data-act="filcontinuer"/.test(R) && /FIL\.libelleContinuer\(filEtape, filPlan\)/.test(R), 'bouton absent');
    assert.ok(/if \(a === 'filcontinuer'\) \{\s*if \(!enFil\(\)\) return; sauverAvantSortie\(\);/.test(R), 'la continuation ne range pas les brouillons');
    assert.ok(/const vers = FIL\.urlApres\(filEtape, filDebut, filPlan\);/.test(R) && /location\.href = vers;/.test(R), 'la continuation n\'ouvre pas la suite');
    assert.ok(/FIL\.libelleProgression\(filEtape, filPlan\)/.test(R) && /const filPlan = FIL\.planDe\(location\.search\);/.test(R), 'le plan n\'est pas lu');
  });
  eprouve('R4 Relevés piste : pas de « Retour » ni de sortie interne qui ramène au menu', () => {
    const jauge = /function vueJauge\(\)[\s\S]*?\n  \}\n/.exec(R);
    assert.ok(jauge, 'vueJauge introuvable');
    assert.ok(/enFil\(\)/.test(jauge[0]) || /filContinuer\(\)/.test(jauge[0]), 'vueJauge ignore le fil');
  });
  eprouve('R5 Relevés piste : sortie commune vers l\'Accueil conservée', () => {
    assert.ok(/data-act="sortie" href="NEXUS-App-v1\.html">← Quitter et revenir à l'Accueil/.test(R), 'sortie absente');
    assert.ok(/enFil\(\) && emp && date\) FIL\.atteindre/.test(R), 'la sortie ne mémorise pas l\'étape');
  });

  // --- Prise de poste ---
  const P = S.pdp;
  eprouve('P1 Prise de poste : le pompiste entre dans le fil, plus dans Missions', () => {
    assert.ok(/<script src="nexus-fil-debut-quart\.js[^"]*"><\/script>/.test(P), 'script non chargé');
    assert.ok(/window\.location\.href = NexusFilDebutQuart\.ACCUEIL_DEMARRAGE;/.test(P), 'redirection vers le fil absente');
    assert.ok(!/NEXUS-Missions-v1\.html/.test(/ACCUEIL_DEMARRAGE;/.exec(P) ? P.slice(P.indexOf('ACCUEIL_DEMARRAGE;'), P.indexOf('ACCUEIL_DEMARRAGE;') + 60) : 'Missions'), 'Missions reste la destination du pompiste');
    assert.ok(/ACCUEIL_DEMARRAGE = 'NEXUS-App-v1\.html\?fil=demarrer'/.test(S.module), 'entrée par l\'Accueil absente');
  });
  eprouve('P3 Prise de poste : seul le pompiste entre dans le fil ; caissière, renfort, polyvalent gardent Missions et « Ouvrir mon tableau de bord »', () => {
    const clic = /btnDashboard'\)\.addEventListener\('click'[\s\S]*?\n    \}\);/.exec(P)[0].replace(/\/\/.*$/gm, '');
    assert.ok(/if \(roleChoisi !== 'pompiste'\) \{ window\.location\.href = 'NEXUS-Missions-v1\.html'; return; \}/.test(clic), 'les autres rôles ne gardent pas Missions');
    assert.ok(clic.indexOf("roleChoisi !== 'pompiste'") < clic.indexOf('ACCUEIL_DEMARRAGE'), 'le fil s\'ouvre avant le contrôle du rôle');
    assert.ok(/estNiveauManagerCourant\(\) \? 'Ouvrir mon poste de pilotage' : \(roleChoisi === 'pompiste' \? 'Commencer mon début de quart' : 'Ouvrir mon tableau de bord'\)/.test(P), 'libellé d\'avant perdu pour les autres rôles');
  });
  eprouve('P2 le moment de début suit le quart du jour (calculé à l\'Accueil, qui connaît les faits)', () => {
    assert.ok(/NexusRelevesPiste\.momentDebutDuQuart\(quartDuJour\)/.test(S.app), 'moment non déduit du quart');
  });

  // --- Inventaire ---
  const I = S.inv;
  eprouve('I1 Inventaire : script du fil chargé avant le mode test, étape lue dans l\'adresse', () => {
    assert.ok(/<script src="nexus-fil-debut-quart\.js[^"]*"><\/script>/.test(I), 'script non chargé');
    assert.ok(/FIL\.etapeDe\(location\.search\)/.test(I), 'étape non lue');
  });
  eprouve('I2 Inventaire : en fil, aucun catalogue, aucun choix de zone, aucun Matin / Soir', () => {
    const c = /function renderCategoriesOuverture\(\) \{[\s\S]*?\n    \}\n/.exec(I);
    assert.ok(c && /if \(enFil\(\)\) \{[\s\S]*?ouvrirCategorie\(prochain\)[\s\S]*?renderFilValidation\(\);[\s\S]*?return;/.test(c[0]), 'le catalogue reste affiché en fil');
    assert.ok(/if \(enFil\(\)\) \{[\s\S]*?else demarrerOuvertureComptage\(\);\s*\} else if \(zonesAutorisees\.length > 1/.test(I), 'l\'init passe encore par le choix de zone / l\'Accueil');
    assert.ok(/\.fil-actif #btnRetourCategories/.test(I), '« Retour aux catégories » non masqué');
    assert.ok(/if \(quartDuShift\) quartActuel = quartDuShift;/.test(I), 'le quart choisi à la prise de poste n\'est pas repris');
  });
  eprouve('I3 Inventaire : seules les catégories du fil sont comptées', () => {
    assert.ok(/FIL\.categorieDuFil\(p\.inventaire_categories \? p\.inventaire_categories\.nom : ''\)/.test(I), 'filtre absent');
  });
  eprouve('I4 Inventaire : progression, sortie commune, fin vers l\'Accueil', () => {
    assert.ok(/id="filProgres"/.test(I) && /FIL\.libelleProgression\(filEtape, filPlan\)/.test(I), 'progression absente');
    assert.ok(/id="filSortie" href="\$\{FIL\.ACCUEIL\}"[^`]*\$\{FIL\.LIBELLE_SORTIE\}/.test(I), 'sortie absente');
    assert.ok(/document\.getElementById\('filSortie'\)\.addEventListener\('click', filSauverAvantSortie\)/.test(I), 'la sortie ne range pas le brouillon');
    assert.ok(/FIL\.terminer\(localStorage[\s\S]*?window\.location\.href = FIL\.ACCUEIL/.test(I), 'la fin ne rend pas à l\'Accueil');
    assert.ok(/addEventListener\('click', enFil\(\) \? filTerminer : renderAccueil\)/.test(I), 'bouton final non branché sur la fin du fil');
    assert.ok(/sauvegarderDraft\('ouverture'\)/.test(/function filSauverAvantSortie[\s\S]*?\n  \}/.exec(I)[0]), 'brouillon non rangé');
  });

  eprouve('I5 Inventaire : les catégories non comptées par le fil (huiles, lave-glace) ne deviennent ni un stock à zéro ni un écart à la validation', () => {
    const v = /async function validerOuverture\(\) \{[\s\S]*?\n  \}\n/.exec(I);
    assert.ok(v, 'validerOuverture introuvable');
    // La boucle de validation saute tout produit sans saisie : un produit non compté n'est ni écrit à 0 ni comparé au stock transmis.
    assert.ok(/for \(const p of produitsZone\) \{\s*const saisie = comptagesSaisie\[p\.id\];\s*if \(!saisie \|\| saisie\.compte === undefined\) continue;/.test(v[0]), 'la boucle ne saute plus les produits sans saisie');
    // Aucune saisie n'est créée d'office pour l'ensemble de la zone (ce qui compterait huiles et lave-glace à zéro).
    const code = I.replace(/\/\/.*$/gm, '');
    assert.ok(!/produitsZone\.(forEach|map)\([^)]*comptagesSaisie/.test(code) && !/for \(const \w+ of produitsZone\) \{[^}]*comptagesSaisie\[\w+\.id\] =/.test(code), 'une saisie par défaut est créée pour toute la zone');
    // Les écrans de saisie et la validation en bloc d'une catégorie ne partent que des groupes du parcours, déjà filtrés.
    assert.ok(/grouperParCategorie\(produitsZoneOuverturePourQuart\(\)\)/.test(code), 'le parcours ne part plus des produits filtrés du fil');
    assert.ok(/produitsRequis\(produitsZoneOuverturePourQuart\(\)\)/.test(code), 'les produits requis ne sont plus ceux du fil');
  });

  eprouve('J1 Jeu de recette Test : écailles présentes, rejouable sans doublon, jamais Production', () => {
    const sql = S.jeu;
    assert.ok(/'Écailles'/.test(sql), 'la catégorie Écailles est au jeu de recette');
    assert.ok(/'Huiles'/.test(sql) && /Lave-glace/.test(sql), 'huiles et lave-glace y figurent pour prouver leur exclusion');
    const inserts = (sql.match(/^insert into/gim) || []).length;
    assert.ok(inserts >= 3 && (sql.match(/on conflict \([^)]*\) do nothing/gi) || []).length === inserts, 'chaque insertion est idempotente (ON CONFLICT DO NOTHING)');
    assert.ok(/nexus-station-test/.test(sql) && /raise exception/i.test(sql), 'garde : site de Test seul, arrêt sans écriture sinon');
    assert.ok(!/schema_migrations/.test(sql.replace(/--.*$/gm, '')), 'ce n\'est pas une migration');
  });

  // --- Accueil ---
  const A = S.app;
  eprouve('A3 Accueil : arrivée à pointer, l\'entrée ?fil=demarrer ne redirige pas (le pointage d\'abord, comme determinerProchaineActionEmploye)', () => {
    const i = S.app.indexOf('NexusFilDebutQuart.demarrageDemande(location.search)');
    assert.ok(i > 0, 'entrée du fil absente');
    const ligne = S.app.slice(S.app.lastIndexOf('\n', i), S.app.indexOf('\n', i));
    assert.ok(/!\(pointageActifSite && prochainPointageEffectif === 'arrivee'\)/.test(ligne), 'l\'arrivée non pointée ne bloque pas l\'entrée');
    assert.ok(i > S.app.indexOf('const prochainPointageEffectif ='), 'la redirection précède le calcul du pointage');
  });
  eprouve('A1 Accueil : un lien de reprise du fil, calculé d\'après les faits, sans retirer Missions', () => {
    assert.ok(/Reprendre mon début de quart →/.test(A), 'libellé absent');
    assert.ok(/NexusFilDebutQuart\.urlRepriseSelonFaits\(localStorage, employee\.id, todayISO, momentIndexDebut, \{ resteJaugeage: jaugeageApplicable && !jaugeageFait, resteIndex: indexApplicable && !indexFait, resteInventaire: inventaireApplicable && !inventaireFait && !inventaireOuvertureFaite \}\)/.test(A), 'reprise non calculée sur les faits');
    assert.ok(/if \(filLien && !\(pointageActifSite && prochainPointageEffectif === 'arrivee'\) && NexusFilDebutQuart\.demarrageDemande\(location\.search\)\) \{ window\.location\.replace\(filLien\); return; \}/.test(A), 'l\'entrée explicite du fil est absente');
    assert.ok(/enService && resteDuFil && roleDuJour === 'pompiste'/.test(A), 'le lien est montré hors service ou à un autre rôle');
    assert.ok(/NEXUS-Missions-v1\.html/.test(A), 'l\'accès à Missions a disparu de l\'Accueil');
  });
  eprouve('A2 aucun pointage dans le fil', () => {
    for (const [nom, src] of [['module', S.module], ['Relevés', R]]) assert.ok(!/NEXUS-Pointage/.test(src.replace(/\/\/.*$/gm, '')), `${nom} renvoie au pointage`);
  });
  return echecs;
}

let n = 0;
const ok = (l) => { n++; console.log('OK —', l); };

const echecs = epreuves(SRC);
if (echecs.length) { echecs.forEach(e => console.error('ROUGE —', e)); console.error(`${echecs.length} épreuve(s) rouge(s) sur la source réelle.`); process.exit(1); }
ok('la source réelle passe toutes les épreuves (F1–F8 dont F2b–F2e, R1–R5, P1–P2, I1–I5, J1, A1–A3)');

function muter(nom, cle, de, vers, attendu) {
  assert.ok(SRC[cle].includes(de), `mutation « ${nom} » : ancre introuvable`);
  const mutant = Object.assign({}, SRC, { [cle]: SRC[cle].replace(de, vers) });
  const e = epreuves(mutant);
  assert.ok(e.some(x => x.startsWith(attendu)), `mutation « ${nom} » : ${attendu} est restée verte (rouges : ${e.join(' | ') || 'aucun'})`);
  ok(`mutation « ${nom} » → ${attendu} rougit`);
}
muter('étape 2 saute l\'étape 3', 'module', "return `${PAGES[3]}?${q}`;", "return ACCUEIL;", 'F1');
muter('progression sur 2', 'module', "const NOMBRE_ETAPES = 3;", "const NOMBRE_ETAPES = 2;", 'F1');
muter('libellé de continuation', 'module', "2: 'Continuer vers le relevé des index'", "2: 'Suivant'", 'F2');
muter('« sur 3 » figé', 'module', "`Étape ${i + 1} sur ${p.length}`", "`Étape ${i + 1} sur 3`", 'F2b');
muter('rang dans le plan ignoré', 'module', "`Étape ${i + 1} sur ${p.length}`", "`Étape ${n} sur ${p.length}`", 'F2b');
muter('jaugeage fait resté dans le plan', 'module', "resteJaugeage && 1", "1", 'F2b');
muter('index fait resté dans le plan', 'module', "resteIndex && 2", "2", 'F2c');
muter('inventaire fait resté dans le plan', 'module', "resteInventaire && 3", "3", 'F2c');
muter('dernière étape sans « Terminer »', 'module', "s ? LIBELLES_VERS[s] : LIBELLE_TERMINER", "LIBELLES_VERS[s || 3]", 'F2c');
muter('étape suivante ignore le plan', 'module', "planOuComplet(plan).find(x => x > n) || null", "PLAN_COMPLET.find(x => x > n) || null", 'F2c');
muter('plan désordonné accepté', 'module', "l.every((n, i) => i === 0 || n > l[i - 1])", "true", 'F2d');
muter('une étape FDJ s\'ajoute', 'module', "[resteJaugeage && 1, resteIndex && 2, resteInventaire && 3]", "[resteJaugeage && 1, resteIndex && 2, resteInventaire && 3, resteFdj && 4]", 'F2e');
muter('le module nomme le FDJ', 'module', "const NOMBRE_ETAPES = 3;", "const NOMBRE_ETAPES = 3; const fdj = 1;", 'F2e');
muter('le lien du fil dépend du FDJ', 'app', "const filLien = (enService", "const filLien = (fdjFait || enService", 'F2e');
muter('fil actif sans paramètre', 'module', "=== 'debut-quart'", "!== 'zzz'", 'F3');
muter('la mémoire recule', 'module', "n < actuel.etape", "false", 'F4');
muter('un fil fini se rouvre', 'module', "if (actuel.fini || ", "if (", 'F4');
muter('mémoire partagée entre jours', 'module', "`nexus_fil_debut_quart_${empId}_${date}`", "`nexus_fil_debut_quart_${empId}`", 'F4');
muter('faits du serveur ignorés', 'module', "const plan = planSelonFaits(faits);", "const plan = PLAN_COMPLET;", 'F5');
muter('sous la mémoire', 'module', "plan.find(x => x >= e.etape) || plan[0]", "plan[0]", 'F5');
muter('rien à faire ouvre quand même un fil', 'module', "if (!plan.length) return null;", "", 'F5');
muter('stockage refusé fait planter', 'module', "} catch (e) { /* illisible : on repart de l'étape 1 */ }", "} finally { }", 'F6');
muter('catalogue complet', 'module', "/(?<![\\p{L}\\p{N}])(?:gaz|gla[cç]ons?|[ée]cailles?)(?![\\p{L}\\p{N}])/iu", "/./", 'F7');
muter('le module touche la base', 'module', "const NOMBRE_ETAPES = 3;", "const NOMBRE_ETAPES = 3; const x = nexusClient.from('t');", 'F8');
muter('Relevés : plan non lu', 'releves', "const filPlan = FIL.planDe(location.search);", "const filPlan = [1, 2, 3];", 'R3');
muter('Relevés : progression figée', 'releves', "FIL.libelleProgression(filEtape, filPlan)", "FIL.libelleProgression(filEtape)", 'R3');
muter('Inventaire : progression figée', 'inv', "FIL.libelleProgression(filEtape, filPlan)", "FIL.libelleProgression(filEtape)", 'I4');
muter('menu interne atteignable en fil', 'releves', "if (enFil() && ecran === 'choix') ecran = 'filhors';", "", 'R2');
muter('bandeau absent', 'releves', "app.innerHTML = filBandeau() + vue;", "app.innerHTML = vue;", 'R3');
muter('continuer sans ranger les brouillons', 'releves', "if (!enFil()) return; sauverAvantSortie();\n      const vers", "if (!enFil()) return;\n      const vers", 'R3');
muter('continuer n\'ouvre pas la suite', 'releves', "const vers = FIL.urlApres(filEtape, filDebut, filPlan);", "const vers = 'NEXUS-App-v1.html';", 'R3');
muter('la sortie n\'enregistre pas l\'étape', 'releves', "if (enFil() && emp && date) FIL.atteindre(localStorage, emp.id, date, filEtape);", "", 'R5');
muter('Missions reste la destination', 'pdp', "window.location.href = NexusFilDebutQuart.ACCUEIL_DEMARRAGE;", "window.location.href = 'NEXUS-Missions-v1.html';", 'P1');
muter('moment de début faux', 'app', "NexusRelevesPiste.momentDebutDuQuart(quartDuJour)", "'debut_q1'", 'P2');
muter('catalogue affiché en fil', 'inv', "      if (prochain) { ouvrirCategorie(prochain); return; }\n      renderFilValidation();\n      return;\n    }", "    }", 'I2');
muter('choix de zone atteint en fil', 'inv', "      else demarrerOuvertureComptage();\n    } else if (zonesAutorisees.length > 1", "      else renderChoixZone();\n    } else if (zonesAutorisees.length > 1", 'I2');
muter('retour aux catégories visible', 'inv', ".fil-actif #btnRetourCategories, .fil-actif #btnRetourCategoriesCarrousel { display: none; }", "", 'I2');
muter('quart du soir ignoré', 'inv', "if (quartDuShift) quartActuel = quartDuShift;", "", 'I2');
muter('catalogue complet à l\'étape 3', 'inv', "FIL.categorieDuFil(p.inventaire_categories ? p.inventaire_categories.nom : '')", "true", 'I3');
muter('progression absente de l\'inventaire', 'inv', 'id="filProgres"', 'id="x"', 'I4');
muter('la fin ne rend pas à l\'Accueil', 'inv', "window.location.href = FIL.ACCUEIL;", "", 'I4');
muter('bouton final de l\'inventaire', 'inv', "addEventListener('click', enFil() ? filTerminer : renderAccueil)", "addEventListener('click', renderAccueil)", 'I4');
muter('pointage ignoré à l\'entrée', 'app', "if (filLien && !(pointageActifSite && prochainPointageEffectif === 'arrivee') && NexusFilDebutQuart", "if (filLien && NexusFilDebutQuart", 'A3');
muter('tous les rôles dans le fil', 'pdp', "if (roleChoisi !== 'pompiste') { window.location.href = 'NEXUS-Missions-v1.html'; return; }", "", 'P3');
muter('libellé unique', 'pdp', "(roleChoisi === 'pompiste' ? 'Commencer mon début de quart' : 'Ouvrir mon tableau de bord')", "'Commencer mon début de quart'", 'P3');
muter('lien de reprise montré à tous', 'app', "enService && resteDuFil && roleDuJour === 'pompiste'", "resteDuFil", 'A1');
muter('reprise ignore les faits', 'app', "resteJaugeage: jaugeageApplicable && !jaugeageFait, ", "resteJaugeage: true, ", 'A1');
muter('l\'inventaire fait reste dans le fil', 'app', "resteInventaire: inventaireApplicable && !inventaireFait", "resteInventaire: true", 'A1');
muter('l\'entrée explicite du fil disparaît', 'app', "if (filLien && !(pointageActifSite && prochainPointageEffectif === 'arrivee') && NexusFilDebutQuart.demarrageDemande(location.search)) { window.location.replace(filLien); return; }", "", 'A1');
muter('boucle de validation ne saute plus les non-comptés', 'inv', "if (!saisie || saisie.compte === undefined) continue;\n      nbComptes++;", "if (!saisie) continue;\n      nbComptes++;", 'I5');
muter('parcours sur toute la zone', 'inv', "grouperParCategorie(produitsZoneOuverturePourQuart())", "grouperParCategorie(produitsZone)", 'I5');
muter('saisie par défaut pour toute la zone', 'inv', "    let nbComptes = 0, nbEcarts = 0;\n", "    produitsZone.forEach(p => { if (!comptagesSaisie[p.id]) comptagesSaisie[p.id] = { compte: 0, ecartNonNul: false, justification: '' }; });\n    let nbComptes = 0, nbEcarts = 0;\n", 'I5');
muter('jeu de recette sans ON CONFLICT sur les catégories', 'jeu', "on conflict (site, nom) do nothing", "", 'J1');
muter('jeu de recette sans garde de site', 'jeu', "raise exception", "raise notice", 'J1');
console.log(`\n${n} contrôles OK`);
