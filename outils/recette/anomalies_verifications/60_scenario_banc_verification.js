#!/usr/bin/env node
'use strict';
// Scénario de banc : cycle « Marquer comme vérifié » de l'écran Scanner tarifaire.
// Lecture seule : banc statique (client Supabase simulé en mémoire), aucun réseau, ni Test ni Production.
// Prérequis : serveur statique à la racine du dépôt (npx http-server -p 8099) et Playwright installé
// dans l'environnement (non ajouté aux dépendances du dépôt). Les données T1 restent hors dépôt.
//   BANC_URL=http://127.0.0.1:8099 CAPTURES=/chemin/hors/depot node outils/recette/anomalies_verifications/60_scenario_banc_verification.js
// Échec = code de sortie 1 ; rien n'est écrit hors de CAPTURES.
const base = process.env.BANC_URL || 'http://127.0.0.1:8099';
const dossier = process.env.CAPTURES || '';
const URL_BANC = base + '/outils/recette/ecran_scanner/banc.html';
let chromium; try { ({ chromium } = require('playwright')); } catch (e) { console.error('Playwright absent : scénario non joué.'); process.exit(2); }

let ok = 0, ko = 0;
function verif(nom, cond, detail) { if (cond) { ok++; console.log('OK  ' + nom); } else { ko++; console.log('KO  ' + nom + (detail ? ' : ' + detail : '')); } }

(async () => {
  const nav = await chromium.launch();
  for (const vp of [{ w: 375, h: 812 }, { w: 1280, h: 800 }]) {
    const ctx = await nav.newContext({ viewport: { width: vp.w, height: vp.h } });
    const page = await ctx.newPage();
    await page.goto(URL_BANC + '?scenario=gerant&theme=jour');
    await page.waitForSelector('#vueCorps [data-ctl-info], #vueCorps button[data-verifier]', { timeout: 15000 });
    const tag = vp.w + 'px';

    // Étape 2 : le (i) ouvre la phrase de contrôle, fermée par défaut (avenant A4).
    verif(tag + ' contrôle fermé : pas de phrase de contrôle', await page.locator('#vueCorps .pt-ctl-3').count() === 0);
    const info = page.locator('#vueCorps [data-ctl-info]').first();
    await info.click();
    verif(tag + ' (i) ouvert : phrase de contrôle visible', await page.locator('#vueCorps .pt-ctl-3').first().isVisible());
    if (dossier) await page.screenshot({ path: dossier + '/ctl_info_' + vp.w + '.png', fullPage: false });

    // Étape 5 : marquer vérifié sort la ligne des contrôles à effectuer et l'inscrit à l'historique.
    const boutons = page.locator('#vueCorps button[data-verifier][data-ver-article]');
    const avant = await boutons.count();
    verif(tag + ' au moins un contrôle à vérifier', avant > 0);
    if (avant > 0) {
      await boutons.first().click();
      await page.waitForTimeout(400);
      const apres = await page.locator('#vueCorps button[data-verifier][data-ver-article]').count();
      verif(tag + ' la ligne quitte les contrôles à effectuer', apres === avant - 1, avant + ' -> ' + apres);
      const texte = await page.locator('#vueCorps').innerText();
      verif(tag + ' historique : « Vérifié le » avec auteur et date', /Vérifié le .+ par /.test(texte));
    }
    // Étape 8 : filtre Vérifiés présent dans l'historique.
    verif(tag + ' filtre « Vérifiés » disponible', /Vérifiés/.test(await page.locator('#vueCorps').innerText()));
    if (dossier) await page.screenshot({ path: dossier + '/apres_verif_' + vp.w + '.png', fullPage: true });
    await ctx.close();
  }
  await nav.close();
  console.log(ok + ' OK, ' + ko + ' KO');
  process.exit(ko ? 1 : 0);
})().catch(e => { console.error(e.message); process.exit(1); });
