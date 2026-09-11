// NEXUS — A8 : identifier une page indépendamment de l'hébergeur (04/09/2026).
//
// Constaté en recette navigateur : aucun compte NON-MANAGER ne pouvait entrer
// dans l'application servie par Cloudflare. L'écran de prise de poste ne se
// reconnaissait pas dans la liste des pages de séquence obligatoire, concluait
// que la prise de poste manquait, et redirigeait vers lui-même — 68 fois, avec
// un `?retour=` ré-encodé à chaque tour, et AUCUNE erreur en console.
//
// Cause : les comparaisons portaient sur des noms de fichiers avec `.html`.
// GitHub Pages sert `/NEXUS-Prise-De-Poste-v1.html`, Cloudflare Pages répond
// 308 vers `/NEXUS-Prise-De-Poste-v1`. La production ne pouvait donc pas
// révéler ce défaut : seule la recette le pouvait.
//
// Ces tests exercent le vrai code de `nexus-page.js` sous les deux hébergeurs.
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const RACINE = __dirname;
let ok = 0;
function verifier(libelle, condition) {
  console.log(`${condition ? 'OK  ' : 'ÉCHEC'} — ${libelle}`);
  assert.ok(condition, libelle);
  ok++;
}

const SOURCE = fs.readFileSync(path.join(RACINE, 'nexus-page.js'), 'utf8');

// Charge nexus-page.js dans une fenêtre simulée servant l'URL demandée.
function sousUrl(pathname) {
  const fenetre = { location: { pathname } };
  new Function('window', 'globalThis', SOURCE)(fenetre, fenetre);
  return fenetre.NexusPage;
}

const SEQUENCE = ['NEXUS-Pointage-v1.html', 'NEXUS-Prise-De-Poste-v1.html'];

// ── Les deux hébergeurs, même résultat ──────────────────────────────────
verifier('GitHub Pages (avec .html) : la prise de poste se reconnaît',
  sousUrl('/NEXUS-Prise-De-Poste-v1.html').est(SEQUENCE) === true);
verifier('Cloudflare Pages (sans .html) : la prise de poste se reconnaît',
  sousUrl('/NEXUS-Prise-De-Poste-v1').est(SEQUENCE) === true);
verifier('GitHub Pages : le pointage se reconnaît',
  sousUrl('/NEXUS-Pointage-v1.html').est(SEQUENCE) === true);
verifier('Cloudflare Pages : le pointage se reconnaît',
  sousUrl('/NEXUS-Pointage-v1').est(SEQUENCE) === true);

// ── Une page ordinaire reste redirigée, sous les deux hébergeurs ────────
for (const url of ['/NEXUS-Cockpit-v2.html', '/NEXUS-Cockpit-v2']) {
  verifier(`${url} n'est pas une page de séquence : la redirection doit avoir lieu`,
    sousUrl(url).est(SEQUENCE) === false);
}

// ── `?retour=` ne fait plus grossir l'URL : la page reste la même ───────
// C'est le cœur de la boucle : chaque tour ajoutait un niveau d'encodage.
// Si la page est reconnue MALGRÉ le paramètre, il n'y a pas de second tour.
let url = '/NEXUS-Prise-De-Poste-v1';
let tours = 0;
while (!sousUrl(url).est(SEQUENCE) && tours < 5) {
  url = '/NEXUS-Prise-De-Poste-v1?retour=' + encodeURIComponent(url.slice(1));
  tours++;
}
verifier('aucun tour de redirection : `?retour=` ne peut plus s\'empiler', tours === 0);
verifier('une URL déjà chargée de retours imbriqués est reconnue du premier coup',
  sousUrl('/NEXUS-Prise-De-Poste-v1?retour=NEXUS-Prise-De-Poste-v1%3Fretour%3DNEXUS-App-v1').est(SEQUENCE) === true);

// ── Query et fragment n'altèrent pas l'identification ───────────────────
for (const url of ['/NEXUS-Inventaire-v1.html?test_role=caissiere',
                   '/NEXUS-Inventaire-v1?test_role=caissiere',
                   '/NEXUS-Inventaire-v1#section',
                   '/NEXUS-Inventaire-v1?a=1#b']) {
  verifier(`${url} → NEXUS-Inventaire-v1`,
    sousUrl(url).identifiant() === 'NEXUS-Inventaire-v1' &&
    sousUrl(url).est('NEXUS-Inventaire-v1.html') === true);
}
verifier('un sous-chemin ne trompe pas l\'identification',
  sousUrl('/app/ecrans/NEXUS-Inventaire-v1.html').est('NEXUS-Inventaire-v1.html') === true);
verifier('une page voisine n\'est pas confondue',
  sousUrl('/NEXUS-Inventaire-Manager-v1').est('NEXUS-Inventaire-v1.html') === false);

// ── Extensions Inventaire : même mécanisme, donc même vérification ──────
const SATELLITES = [
  'nexus-inventaire-stock-localise-ux-v2.js', 'nexus-inventaire-stock-transfert-v2.js',
  'nexus-inventaire-stock-transfert-deeplink-v1.js', 'nexus-inventaire-reassort-boutique-v1.js',
  'nexus-inventaire-manager-reassort-cigarettes-v1.js', 'nexus-inventaire-manager-reassort-cigarettes-v2.js',
  'nexus-inventaire-manager-reassort-cigarettes-v3.js', 'nexus-inventaire-couverture-operationnelle-v1.js',
  'nexus-inventaire-cigarettes-conditionnement-v1.js', 'nexus-inventaire-conditionnement-stock-localise.js',
  'nexus-inventaire-stock-localise-entry.js', 'nexus-carburant-demarrage-mois-v1.js',
  'nexus-reception-mobile-fix-v1.js',
];
for (const f of SATELLITES) {
  const src = fs.readFileSync(path.join(RACINE, f), 'utf8');
  verifier(`${f} : garde de page normalisé`,
    /NexusPage\.est\(/.test(src) &&
    !/pathname\.split\('\/'\)\.pop\(\)\s*\|\|\s*''\s*\)\s*!==/.test(src));
}

// ── nexus-auth.js : plus aucune comparaison à un nom de fichier ─────────
const AUTH = fs.readFileSync(path.join(RACINE, 'nexus-auth.js'), 'utf8');
verifier('nexus-auth.js n\'identifie plus la page à la main',
  !/const page\s*=\s*window\.location\.pathname\.split/.test(AUTH));
verifier('nexus-auth.js ne compare plus page à un littéral .html',
  !/\bpage\s*===?\s*'[^']*\.html'/.test(AUTH) && !/\.includes\(page\)/.test(AUTH));
verifier('les deux gardes de séquence obligatoire passent par NexusPage',
  (AUTH.match(/NexusPage\.est\(NEXUS_PAGES_SEQUENCE_OBLIGATOIRE\)/g) || []).length === 2);
verifier('l\'URL de retour garde l\'extension telle que l\'hébergeur la sert',
  /window\.location\.pathname\.split\('\/'\)\.pop\(\)\|\|'NEXUS-App-v1\.html'/.test(AUTH));

// ── Le build pose nexus-page.js avant nexus-auth.js ─────────────────────
const GEN = fs.readFileSync(path.join(RACINE, 'outils', 'generer-config.js'), 'utf8');
verifier('le build pose la balise nexus-page.js',
  /BALISE_PAGE = '<script src="nexus-page\.js"><\/script>'/.test(GEN));
verifier('l\'ordre des balises est explicite',
  /BALISES_ORDONNEES = \[BALISE_CONFIG, BALISE_PAGE, BALISE_BANDEAU\]/.test(GEN));

console.log(`\n${ok} vérifications passées.`);
