'use strict';
// Lot 3 : Suivi des contrôles DLC (page) et non-régression de « Priorités du jour ».
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const D = __dirname;
let n = 0;
function t(nom, f) { f(); n++; console.log('OK ' + nom); }
const page = fs.readFileSync(path.join(D, 'NEXUS-Dates-Courtes-v1.html'), 'utf8');
const mig = fs.readFileSync(path.join(D, 'supabase/migrations/20261123140000_dates_courtes_lot3_suivi.sql'), 'utf8');
const js = [...page.matchAll(/<script>([\s\S]*?)<\/script>/g)].pop()[1];
const lot3 = page.slice(page.indexOf('/* Lot 3'), page.indexOf('</style>'));
const has = (s, r) => (r instanceof RegExp ? r.test(s) : s.includes(r));

t('le script de la page est syntaxiquement valide', () => { new Function(js); });
t('lien de contrôle puis sélecteur à deux segments sous l\'en-tête, Priorités du jour actif par défaut', () => {
  const i = page.indexOf('</header>'), j = page.indexOf('id="segments"'), k = page.indexOf('class="lien-controle"');
  assert.ok(i > 0 && k > i && j > k, 'ordre header, lien « Faire un contrôle », segments');
  assert.ok(page.includes('>Faire un contrôle<'));
  assert.ok(/id="segPrio"[^>]*aria-pressed="true"/.test(page) && /id="segSuivi"[^>]*aria-pressed="false"/.test(page));
  assert.ok(page.includes('>Priorités du jour<') && page.includes('Suivi des contrôles DLC <span'));
});
t('compteur en Plex Mono, masqué à 0', () => {
  assert.ok(/id="cptSuivi" hidden/.test(page) && /\.segments \.cpt\{[^}]*var\(--mono\)/.test(page));
  assert.ok(/c\.hidden = !\(SV\.total > 0\)/.test(js));
});
t('ancre #suivi-dlc : lue au démarrage, sur hashchange, écrite au changement de vue', () => {
  assert.ok(/location\.hash === '#suivi-dlc'/.test(js));
  assert.ok(/addEventListener\('hashchange'/.test(js));
  assert.ok(/'#suivi-dlc'/.test(js) && /history\.replaceState/.test(js));
});
t('cible : segments (data-vue)', () => { assert.ok(has(js, "closest('[data-vue]')")); });
t('cible : période 7 et 30 jours, sans saisie libre', () => {
  assert.ok(/\[7, 30\]\.map/.test(js) && /derniers jours/.test(js) && !/type="date"/.test(js));
  assert.ok(has(js, "q('[data-per]')"));
});
t('cible : ouvrir le détail, retour, certifier, confirmer, annuler', () => {
  ['[data-ouvrir]', '[data-retour]', '[data-certifier]', '[data-confirmer]', '[data-annuler]'].forEach(s => assert.ok(has(js, "q('" + s + "')"), s));
});
t('cible : demander une correction, tout cocher, annuler, envoyer, réessayer, voir la suite', () => {
  ['[data-corriger]', '[data-tout]', '[data-annuler-corr]', '[data-envoyer]', '[data-recharger]', '[data-plus]'].forEach(s => assert.ok(has(js, "q('" + s + "')"), s));
});
t('cible : recherche, filtre d\'état, cases à cocher, motif', () => {
  assert.ok(/id="svRech"/.test(js) && /id="svEtat"/.test(js) && /data-coche=/.test(js) && /id="svMotif"/.test(js));
});
t('recherche et filtres seulement au-delà de 10 lignes, 10 premières visibles', () => {
  assert.ok(/tout\.length > 10/.test(js) && /lst\.slice\(0, 10\)/.test(js));
});
t('tri : à certifier, correction demandée, en cours, certifiées', () => {
  const r = js.match(/TERMINEE_A_CERTIFIER:\{[^}]*rang:(\d)\}[\s\S]*?CORRECTION_DEMANDEE:\{[^}]*rang:(\d)\}[\s\S]*?EN_COURS:\{[^}]*rang:(\d)\}[\s\S]*?CERTIFIEE:\{[^}]*rang:(\d)\}/);
  assert.deepStrictEqual(r.slice(1).map(Number), [1, 2, 3, 4]);
});
t('RPC : lecture, certification et demande de correction avec clé d\'idempotence', () => {
  assert.ok(/rpc\('dates_courtes_suivi_controles'/.test(js));
  assert.ok(/rpc\('dates_courtes_certifier_tournee', \{p_tournee:id, p_observations:null, p_cle_idempotence/.test(js));
  assert.ok(/rpc\('dates_courtes_demander_correction', \{p_tournee:id, p_releves:[^}]*p_motif:[^}]*p_cle_idempotence/.test(js));
});
t('certifier : ligne passée à Certifiée, compteur décrémenté immédiatement, sans confirm()', () => {
  assert.ok(/majLigneLocale\(id, 'CERTIFIEE'\)/.test(js) && /SV\.total = Math\.max\(0, SV\.total - 1\)/.test(js));
  assert.ok(!/\bconfirm\(|\balert\(|\bprompt\(/.test(js));
});
t('certifier en deux gestes : bouton puis confirmation visible dans la page', () => {
  assert.ok(/data-certifier/.test(js) && /Confirmer la certification/.test(js) && /role="group" aria-label="Confirmation"/.test(js));
});
t('demande de correction : envoi inactif sans produit ni motif, raison écrite à côté', () => {
  assert.ok(/Cochez au moins un produit\./.test(js) && /Indiquez le motif de la demande\./.test(js));
  assert.ok(/raison \|\| SV\.occupe \? ' disabled'/.test(js) && /id="svRaison"/.test(js));
});
t('produits en anomalie précochés', () => { assert.ok(/filter\(r => r\.anomalies\.length > 0\)/.test(js)); });
t('erreur : texte seul après « code : », action maintenue', () => {
  assert.ok(/\^\[a-z_\]\+\\s\*:\\s\*\(\[\\s\\S\]\+\)\$/.test(js));
  assert.ok(/SV\.occupe = false; SV\.msg = \{id:id/.test(js));
});
t('anomalies : quatre libellés déduits, jamais « Ambigu », jamais « anom. »', () => {
  ['Code incomplet', 'Code logistique provisoire', 'Article saisi en texte libre', 'Modifié après la clôture'].forEach(l => assert.ok(js.includes(l), l));
  assert.ok(!/mbigu/.test(js) && !/anom\./.test(js));
  assert.ok(/'1 anomalie'/.test(js) && /' anomalies'/.test(js));
});
t('ligne : « commencée à HH:MM · en cours », auteur par nom (jamais l\'identifiant)', () => {
  assert.ok(/commencée à ' \+ esc\(t\.debut\) \+ ' · en cours/.test(js));
  assert.ok(/t\.auteur/.test(js) && !/saisi_par/.test(js));
});
t('badge via nexus-badge-etat.js, quatre états', () => {
  assert.ok(/src="nexus-badge-etat\.js/.test(page) && /NexusBadgeEtat/.test(js));
  ['À certifier', 'Correction demandée', 'En cours', 'Certifiée'].forEach(l => assert.ok(js.includes("lib:'" + l + "'"), l));
});
t('historique : certification, renommage, demande de correction et réponse', () => {
  ['certifiee', 'renommee', 'correction_demandee', 'reponse'].forEach(w => assert.ok(js.includes(w), w));
});
t('charte : jetons --t-* / alias seulement, pas de couleur en dur, pas d\'emoji d\'état', () => {
  assert.ok(!/#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(lot3), 'couleur en dur dans le CSS du lot');
  assert.ok(!/[\u{1F300}-\u{1FAFF}☀-➿]/u.test(lot3 + js));
  assert.ok(/min-height:44px/.test(lot3));
});
t('non-régression : Priorités du jour inchangé (même RPC, mêmes fonctions, vue par défaut)', () => {
  assert.ok(/rpc\('dates_courtes_prevention_pertes'/.test(js));
  ['function rendre(', 'async function charger(', 'function messageEtat('].forEach(f => assert.ok(js.includes(f), f));
  assert.ok(/<main id="contenu"/.test(page) && /id="suivi" hidden/.test(page));
  assert.ok(/SV = \{vue:'priorites'/.test(js));
});
t('non-régression : accès réservé à la gestion conservé', () => {
  assert.ok(/nexusEstManager\(employee\)/.test(js) && /Prévention des pertes est réservée à la gestion/.test(js));
});
t('migration : lecture seule, security invoker, aucun octroi sur table, calculs de prévention intacts', () => {
  assert.ok(/security invoker/.test(mig) && !/\b(insert|update|delete)\s+(into|from)?\s*dates_courtes/i.test(mig.replace(/--.*$/gm, '')));
  assert.ok(!/grant\s+(select|insert|update|delete)[^;]*\bon\s+(table\s+)?dates_courtes/i.test(mig));
  assert.ok(!/dates_courtes_prevention_pertes/.test(mig.replace(/--.*$/gm, '')));
});
console.log(n + '/' + n);

t('liste : Certifier seulement sans anomalie, sinon « Voir les N anomalies » ; détail : code et unités en toutes lettres', () => {
  assert.ok(/aCert && t\.anomalies > 0/.test(js) && js.includes("'l\\'anomalie'") && js.includes("' anomalies'"));
  assert.ok(js.includes('code provisoire') && /sv-code/.test(page));
  assert.ok(js.includes("'unités' : 'unité'") && !/ u\.'/.test(js.slice(js.indexOf('function ligneSv'))));
});
