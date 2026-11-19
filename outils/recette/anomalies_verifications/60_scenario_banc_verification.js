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
// L1 : les panneaux inactifs sont masqués (hidden) : on ouvre l'axe avant de lire ou cliquer.
async function axe(page, id) { await page.locator('#vueCorps [data-axe-onglet="' + id + '"]').click(); await page.waitForTimeout(150); }
function verif(nom, cond, detail) { if (cond) { ok++; console.log('OK  ' + nom); } else { ko++; console.log('KO  ' + nom + (detail ? ' : ' + detail : '')); } }

(async () => {
  const nav = await chromium.launch();
  for (const vp of [{ w: 375, h: 812 }, { w: 1280, h: 800 }]) {
    const ctx = await nav.newContext({ viewport: { width: vp.w, height: vp.h } });
    const page = await ctx.newPage();
    await page.goto(URL_BANC + '?scenario=gerant&theme=jour');
    await page.waitForSelector('#vueCorps button[data-verifier]', { state: 'attached', timeout: 15000 });
    const tag = vp.w + 'px';

    // L3 : à 375 px la liste est seule à l'écran ; le détail s'ouvre en plein écran au toucher d'une ligne.
    if (vp.w < 900) {
      const lignes = page.locator('#vueCorps [data-ctl-sel]');
      verif(tag + ' L3 : mode liste par défaut, détail masqué', await page.locator('#vueCorps .pt-ctl-deux[data-mode="liste"]').count() === 1 && !(await page.locator('#vueCorps [data-ctl-detail]').first().isVisible()));
      const cle0 = await lignes.nth(1).getAttribute('data-ctl-sel');
      await lignes.nth(1).scrollIntoViewIfNeeded(); await page.waitForTimeout(100);
      const y0 = await page.evaluate(() => Math.round(window.pageYOffset));
      await lignes.nth(1).click(); await page.waitForTimeout(250);
      verif(tag + ' L3 : toucher une ligne ouvre le détail', await page.locator('#vueCorps .pt-ctl-deux[data-mode="detail"]').count() === 1 && await page.locator('#vueCorps [data-ctl-detail]').first().isVisible());
      const cibles = await page.evaluate(() => ['[data-ctl-retour]', '[data-ctl-suivant]', '.pt-actions button'].map(q => [...document.querySelectorAll('#vueCorps ' + q)].filter(e => e.offsetParent).map(e => Math.round(e.getBoundingClientRect().height))).flat());
      verif(tag + ' L3 : cibles d\'au moins 44 px', cibles.length >= 3 && cibles.every(h => h >= 44), cibles.join(','));
      verif(tag + ' L3 : aucun débordement horizontal', await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));
      const barre = await page.evaluate(() => { const b = document.querySelector('#vueCorps .pt-actions'); if (!b) return null; const r = b.getBoundingClientRect(); return { bas: r.bottom, h: innerHeight, t: b.textContent }; });
      verif(tag + ' L3 : barre d\'action en bas avec Suivant et Marquer comme vérifié', !!barre && Math.abs(barre.h - barre.bas) <= 2 && /Suivant/.test(barre.t) && /Marquer comme vérifié/.test(barre.t), barre ? JSON.stringify(barre) : 'absente');
      const plein = await page.evaluate(() => { const d = document.querySelector('#vueCorps .pt-ctl-droite'); if (!d) return null; const r = d.getBoundingClientRect(); const haut = document.elementFromPoint(innerWidth / 2, 4), bas = document.elementFromPoint(innerWidth / 2, innerHeight - 4); return { pos: getComputedStyle(d).position, l: r.width, h: r.height, w: innerWidth, hh: innerHeight, hautDans: !!(haut && d.contains(haut)), basDans: !!(bas && d.contains(bas)) }; });
      verif(tag + ' L3 : le détail occupe tout l\'écran (aucun axe ni filtre visible)', !!plein && plein.pos === 'fixed' && plein.l >= plein.w - 1 && plein.h >= plein.hh - 1 && plein.hautDans && plein.basDans, plein ? JSON.stringify(plein) : 'absent');
      verif(tag + ' L3 : position k / N affichée', /^\d+ \/ \d+$/.test(((await page.locator('#vueCorps [data-ctl-pos]').first().textContent()) || '').trim()));
      if (dossier) await page.screenshot({ path: dossier + '/l3_detail_' + vp.w + '.png', fullPage: false });
      // Retour par le bouton de l'écran : même ligne, même défilement, focus sur la ligne.
      await page.locator('#vueCorps [data-ctl-retour]').click(); await page.waitForTimeout(250);
      const foc = await page.evaluate(() => { const a = document.activeElement; return a && a.getAttribute ? a.getAttribute('data-ctl-sel') : null; });
      const y1 = await page.evaluate(() => Math.round(window.pageYOffset));
      verif(tag + ' L3 : retour (bouton) vers la liste, focus sur la même ligne', foc === cle0, String(foc));
      verif(tag + ' L3 : retour (bouton) au même défilement', Math.abs(y1 - y0) <= 2, y0 + ' -> ' + y1);
      verif(tag + ' L3 : retour (bouton) garde la ligne choisie', await page.locator('#vueCorps [data-ctl-sel][aria-current="true"]').first().getAttribute('data-ctl-sel') === cle0);
      // Retour du navigateur.
      await page.locator('#vueCorps [data-ctl-sel]').nth(1).click(); await page.waitForTimeout(250);
      await page.goBack(); await page.waitForTimeout(250);
      const foc2 = await page.evaluate(() => { const a = document.activeElement; return a && a.getAttribute ? a.getAttribute('data-ctl-sel') : null; });
      verif(tag + ' L3 : retour du navigateur ferme le détail, focus sur la ligne', await page.locator('#vueCorps .pt-ctl-deux[data-mode="liste"]').count() === 1 && foc2 === cle0, String(foc2));
      verif(tag + ' L3 : retour du navigateur au même défilement', Math.abs(await page.evaluate(() => Math.round(window.pageYOffset)) - y0) <= 2);
      // Échap ferme le détail.
      await page.locator('#vueCorps [data-ctl-sel]').nth(1).click(); await page.waitForTimeout(250);
      await page.keyboard.press('Escape'); await page.waitForTimeout(250);
      verif(tag + ' L3 : Échap ferme le détail', await page.locator('#vueCorps .pt-ctl-deux[data-mode="liste"]').count() === 1);
      // Suivant passe au contrôle suivant, la barre reste en bas.
      await page.locator('#vueCorps [data-ctl-sel]').nth(0).click(); await page.waitForTimeout(250);
      const avantS = await page.locator('#vueCorps [data-ctl-sel][aria-current="true"]').first().getAttribute('data-ctl-sel');
      await page.locator('#vueCorps [data-ctl-suivant]').click(); await page.waitForTimeout(250);
      const apresS = await page.locator('#vueCorps [data-ctl-sel][aria-current="true"]').first().getAttribute('data-ctl-sel');
      verif(tag + ' L3 : Suivant sélectionne un autre contrôle', !!apresS && apresS !== avantS, avantS + ' -> ' + apresS);
      await page.keyboard.press('Escape'); await page.waitForTimeout(250);
      // On rouvre une ligne pour la suite du scénario (vérification en détail).
      await page.locator('#vueCorps [data-ctl-sel]').nth(0).click(); await page.waitForTimeout(250);
    }

    // L2 : la consigne est toujours visible dans le détail ; « Sources et calcul » est un <details> natif.
    verif(tag + ' détail : consigne de contrôle visible', await page.locator('#vueCorps [data-ctl-detail] .pt-ctl-3').first().isVisible());
    verif(tag + ' détail : « Sources et calcul » en <details> natif', await page.locator('#vueCorps [data-ctl-detail] details.pt-sources-calcul > summary:has-text("Sources et calcul")').count() === 1);
    verif(tag + ' liste : une seule ligne porte aria-current', await page.locator('#vueCorps [data-ctl-sel][aria-current="true"]').count() === 1);
    if (dossier) await page.screenshot({ path: dossier + '/ctl_info_' + vp.w + '.png', fullPage: false });

    // Étape 5 : marquer vérifié sort la ligne des contrôles à effectuer et l'inscrit à l'historique.
    // Comptage sur les données : le total de l'en-tête « Contrôles à effectuer (N) », pas les 10 lignes visibles.
    const total = async () => { const m = /Contrôles à effectuer \((\d+)\)/.exec(await page.locator('#vueCorps summary:has-text("Contrôles à effectuer")').first().innerText()); return m ? +m[1] : -1; };
    const boutons = page.locator('#vueCorps button[data-verifier][data-ver-article]');
    const avant = await total();
    verif(tag + ' au moins un contrôle à vérifier', avant > 0);
    if (avant > 0) {
      const article = await boutons.first().getAttribute('data-ver-article');
      await boutons.first().click();
      await page.waitForTimeout(400);
      // 1) La confirmation immédiate (écriture déjà réussie) se lit dans la zone aria-live de Contrôler.
      const msg = await page.locator('#vueCorps [data-ctl-live] [data-verif-ok]').first().innerText().catch(() => '');
      verif(tag + ' Contrôler : confirmation « Vérification enregistrée. Contrôle suivant ouvert. » après le clic', /Vérification enregistrée\. Contrôle suivant ouvert\./.test(msg), msg);
      const apres = await total();
      verif(tag + ' le total des contrôles à effectuer baisse de 1 (comptage sur les données)', apres === avant - 1, avant + ' -> ' + apres);
      // 1 bis) L4, 375 px : confirmation et « Annuler » sont dans le détail plein écran. Motif vide refusé, puis motif saisi : annulation acceptée.
      if (vp.w < 900) {
        const det = page.locator('#vueCorps [data-ctl-detail]');
        verif(tag + ' L4 : la confirmation est dans le détail', await det.locator('[data-ctl-live] [data-verif-ok]').count() > 0);
        await det.locator('[data-ctl-annuler]').first().click();
        await page.locator('#vueCorps [data-annul-confirmer]').first().click();
        const refus = await page.locator('#vueCorps [data-annul-erreur]').first().innerText().catch(() => '');
        verif(tag + ' L4 : motif vide refusé', /motif/i.test(refus), refus);
        await page.locator('#ptAnnulMotif').fill('Vérification faite par erreur de pointage');
        await page.locator('#vueCorps [data-annul-confirmer]').first().click();
        await page.waitForTimeout(400);
        const retab = await total();
        verif(tag + ' L4 : annulation acceptée, le total revient à sa valeur de départ', retab === avant, avant + ' -> ' + retab);
        // On revérifie pour la suite du scénario.
        await boutons.first().click();
        await page.waitForTimeout(400);
        verif(tag + ' L4 : revérification après annulation', await total() === avant - 1);
      }
      // 2) Dans Suivre, la ligne de l'article porte « Vérifié ». Sous 900 px le détail couvre l'écran : retour à la liste d'abord.
      const retourListe = page.locator('#vueCorps [data-ctl-retour]');
      if (vp.w < 900 && await retourListe.count() && await retourListe.first().isVisible()) { await retourListe.first().click(); await page.waitForTimeout(200); }
      await axe(page, 'suivre');
      const ligneSuivre = await page.evaluate(a => [...document.querySelectorAll('#vueCorps [data-axe-pan="suivre"] li, #vueCorps .pt-axe-pan:not([hidden]) li')].filter(e => e.textContent.includes(a)).map(e => e.textContent).join(' | '), article);
      verif(tag + ' Suivre : la ligne de l\'article porte « Vérifié »', /Vérifié/.test(ligneSuivre), ligneSuivre.slice(0, 120));
    }
    // Étape 8 : filtre Vérifiés présent dans l'historique.
    await axe(page, 'suivre');
    verif(tag + ' filtre « Vérifiés » disponible', /Vérifiés/.test(await page.locator('#vueCorps').innerText()));
    if (dossier) await page.screenshot({ path: dossier + '/apres_verif_' + vp.w + '.png', fullPage: true });
    await ctx.close();
  }
  // Suite : article ciblé, réimport au même fichier_hash, nouveau lot où l'anomalie persiste, doublons d'étiquettes, cas_production.
  // Le banc garde les vérifications « écrites » dans sessionStorage quand ?persist=1 ; ?lot=<nom> change le fichier_hash du lot.
  const BTN = '#vueCorps button[data-verifier][data-ver-article]';
  async function doublons(page) {
    // Aucune ligne ne porte deux étiquettes .nbe-qualif de même texte.
    return page.evaluate(() => {
      const mauvais = [];
      document.querySelectorAll('#vueCorps .pt-ligne, #vueCorps .vp-ligne, #vueCorps li, #vueCorps tr').forEach(r => {
        const t = [...r.querySelectorAll('.nbe-qualif')].map(e => e.textContent.trim());
        if (new Set(t).size !== t.length) mauvais.push(t.join(' / '));
      });
      return mauvais;
    });
  }
  {
    const ctx = await nav.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    await page.goto(URL_BANC + '?scenario=gerant&theme=jour&persist=1&lot=hash-lot-A');
    await page.evaluate(() => { try { sessionStorage.removeItem('banc_verifs'); } catch (e) {} });
    await page.reload();
    await page.waitForSelector(BTN, { timeout: 15000 });
    // Article ciblé : on suit l'article du premier bouton, pas « les 10 premières lignes visibles ».
    const cible = await page.locator(BTN).first().getAttribute('data-ver-article');
    verif('suite : article ciblé identifié', !!cible);
    const totalPersist = async () => { const m = /Contrôles à effectuer \((\d+)\)/.exec(await page.locator('#vueCorps summary:has-text("Contrôles à effectuer")').first().innerText()); return m ? +m[1] : -1; };
    const avantA = await totalPersist();
    await page.locator(BTN + '[data-ver-article="' + cible.replace(/"/g, '\\"') + '"]').first().click();
    await page.waitForTimeout(400);
    const apresA = await totalPersist();
    verif('suite : la vérification retire le contrôle de l\'article ciblé', apresA === avantA - 1, avantA + ' -> ' + apresA);
    // Réimport au même fichier_hash : la ligne ne revient pas.
    await page.goto(URL_BANC + '?scenario=gerant&theme=jour&persist=1&lot=hash-lot-A');
    await page.waitForSelector('#vueCorps', { timeout: 15000 });
    await page.waitForTimeout(500);
    const memeLot = await totalPersist();
    verif('suite : même fichier_hash, le contrôle vérifié ne revient pas', memeLot === apresA, memeLot + ' attendu ' + apresA);
    // Nouveau lot où l'anomalie persiste : la ligne revient, qualifiée « Persistant ».
    await page.goto(URL_BANC + '?scenario=gerant&theme=jour&persist=1&lot=hash-lot-B');
    await page.waitForSelector('#vueCorps', { timeout: 15000 });
    await page.waitForTimeout(500);
    await axe(page, 'suivre');
    const texteB = await page.locator('#vueCorps').innerText();
    verif('suite : nouveau lot, l\'anomalie persistante revient « Persistant »', /Persistant/.test(texteB));
    // Pas deux étiquettes de même texte, y compris dans « Toutes les références ».
    verif('suite : aucune étiquette en double (vue par défaut)', (await doublons(page)).length === 0, (await doublons(page)).join(' ; '));
    await axe(page, 'analyser');
    const plus = page.locator('#vueCorps button[data-plus]').first();
    if (await plus.count()) {
      await plus.click(); await page.waitForTimeout(400);
      const d = await doublons(page);
      verif('suite : aucune étiquette en double (liste dépliée, « Voir les N autres références »)', d.length === 0, d.join(' ; '));
    } else verif('suite : bouton « Voir les N autres références » trouvé', false);
    await ctx.close();
  }
  {
    // cas_production : lignes fictives, sans libellé réel.
    const ctx = await nav.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    await page.goto(URL_BANC + '?scenario=cas_production&theme=jour');
    await page.waitForSelector('#vueCorps', { timeout: 15000 });
    await page.waitForTimeout(500);
    // L1 : le texte visible dépend de l'axe ouvert ; on lit les trois axes qui portent ces constats.
    let t = '';
    for (const id of ['controler', 'analyser', 'decider']) { await axe(page, id); t += '\n' + await page.locator('#vueCorps').innerText(); }
    verif('cas_production : article daté vendu près de 0 affiché « Démarque »', /Démarque/.test(t));
    verif('cas_production : S1 et S2 sur la même ligne, « À vérifier » et raison « contredit »', /À vérifier/.test(t) && /contredit/.test(t));
    verif('cas_production : marge négative extrême « Perte de … € HT par unité »', /Perte de .+ € HT par unité/.test(t));
    verif('cas_production : aucune étiquette en double', (await doublons(page)).length === 0);
    // Démarque : article préfixé d'une date, nommé, sans marge, hors marge estimée, hors « Sources qui se contredisent ».
    const lignesDem = await page.evaluate(() => [...document.querySelectorAll('#vueCorps li, #vueCorps tr, #vueCorps .pt-ligne')].filter(e => e.querySelector('[data-axe="demarque"]')).map(e => e.textContent));
    verif('cas_production : la démarque est nommée « Démarque : périmé ou casse » et sans marge', lignesDem.length > 0 && lignesDem.every(x => !/Perte de|Marge\s*[-+]?\d/.test(x)));
    const art = await page.evaluate(() => (window.__banc && window.__banc.analyse ? window.__banc.analyse.lignes : []).filter(l => /^\d{2}-\d{2}-\d{4}\s/.test(l.article)).length);
    const nMarge = /(\d+) sur (\d+)\s+Marge estimée/.exec(t) || /(\d+) sur (\d+)/.exec(t);
    const totalLignes = await page.evaluate(() => (window.__banc && window.__banc.analyse ? window.__banc.analyse.lignes.length : -1));
    verif('cas_production : démarque hors compteur « Marge estimée » (N sur N)', !!nMarge && (totalLignes < 0 || +nMarge[2] <= totalLignes - art), nMarge ? nMarge[0] + ' ; lignes ' + totalLignes + ' ; démarque ' + art : 'compteur introuvable');
    const sources = await page.evaluate(() => { const e = [...document.querySelectorAll('#vueCorps details.pt-ctrl')].filter(x => /^\s*Quelles sources se contredisent/.test((x.querySelector('summary') || {}).textContent || '')); return e.map(x => x.textContent).join(' '); });
    verif('cas_production : démarque hors « Sources qui se contredisent »', !/ARTICLE FICTIF DATE/.test(sources));
    if (dossier) await page.screenshot({ path: dossier + '/cas_production.png', fullPage: true });
    await ctx.close();
  }
  await nav.close();
  console.log(ok + ' OK, ' + ko + ' KO');
  process.exit(ko ? 1 : 0);
})().catch(e => { console.error(e.message); process.exit(1); });
