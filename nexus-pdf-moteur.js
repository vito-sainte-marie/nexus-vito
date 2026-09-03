/* ------------------------------------------------------------
 * NEXUS PDF Moteur (10/08/2026)
 *
 * Suite à la demande explicite de Frédéric : ne plus utiliser
 * window.print() comme moteur principal d'export PDF de NEXUS. Ce
 * fichier construit des PDF applicatifs — le moteur reçoit des DONNÉES
 * (déjà calculées par la page appelante) et compose lui-même les
 * pages, jamais une "photo" de ce qui est affiché à l'écran.
 *
 * Portée volontairement GÉNÉRIQUE — ce fichier ne connaît RIEN à FDJ,
 * à Coach, ni à aucun module métier NEXUS. Il fournit uniquement des
 * primitives de mise en page réutilisables (titre, ligne clé/valeur,
 * paragraphe, encadré, tableau, image, pagination automatique, pied de
 * page numéroté) plus un utilitaire de partage/téléchargement du PDF
 * généré. Chaque module NEXUS (FDJ Pilotage, Coach, Verify,
 * Inventaire, Brief, rapports manager…) compose SON rapport avec ces
 * primitives, dans SA propre page — jamais une logique métier ici
 * (Article 11 de la Constitution NEXUS, "une seule vérité" : les
 * chiffres viennent toujours du moteur métier du module concerné,
 * celui-ci ne fait que les mettre en page).
 *
 * Bibliothèque : pdf-lib (CDN cdnjs, licence MIT, aucune dépendance
 * payante) — génère un vrai fichier PDF (Blob), indépendant du moteur
 * d'impression du navigateur. Charger AVANT ce script :
 *   <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js"></script>
 *   <script src="nexus-pdf-moteur.js?v=20260903-1136"></script>
 *
 * Diffusion du PDF généré — audit "developpeur" du 09/08/2026 sur les
 * limites d'impression des PWA iOS en mode standalone (bug WebKit
 * documenté de longue date : aperçu d'impression non fonctionnel dans
 * une app ajoutée à l'écran d'accueil) : NEXUS ne dépend plus JAMAIS du
 * dialogue d'impression. `partagerOuTelechargerPdf()` essaie, dans
 * l'ordre : (1) Web Share API avec fichier (iOS Safari 15+ et Android
 * Chrome, y compris en PWA standalone), (2) téléchargement direct du
 * Blob, (3) en tout dernier recours, ouverture dans un nouvel onglet.
 * ------------------------------------------------------------ */
(function (global) {
  'use strict';

  if (typeof PDFLib === 'undefined') {
    console.error('NexusPdfMoteur : PDFLib introuvable — charger pdf-lib.min.js AVANT nexus-pdf-moteur.js.');
    return;
  }
  const { PDFDocument, StandardFonts, rgb } = PDFLib;

  // Format A4 portrait, en points (1 pt = 1/72 pouce) — unité native de
  // pdf-lib. Origine (0,0) en bas à gauche de la page, y croît vers le
  // haut (à l'inverse du DOM/Canvas).
  const A4 = { largeur: 595.28, hauteur: 841.89 };
  const MARGE = 44;
  const LARGEUR_UTILE = A4.largeur - MARGE * 2;

  // Palette "papier professionnel" — volontairement distincte du thème
  // sombre de l'app à l'écran (illisible/gaspille l'encre imprimé),
  // identique sur tous les rapports NEXUS pour une identité visuelle
  // cohérente d'un module à l'autre.
  const COULEUR = {
    texte: rgb(0.07, 0.09, 0.12),
    texteDim: rgb(0.42, 0.46, 0.51),
    cyan: rgb(0.02, 0.4, 0.48),
    vert: rgb(0.09, 0.45, 0.28),
    ambre: rgb(0.58, 0.4, 0.0),
    jaune: rgb(0.62, 0.5, 0.04),
    rouge: rgb(0.6, 0.11, 0.12),
    ligne: rgb(0.86, 0.88, 0.9),
    fondEntete: rgb(0.94, 0.96, 0.97),
    fondAlterne: rgb(0.97, 0.98, 0.98),
    blanc: rgb(1, 1, 1),
  };

  /**
   * Table WinAnsiEncoding (Windows-1252 / PDF spec Appendix D.2) codée
   * EN DUR — c'est un standard figé, immuable, donc une constante fixe
   * est fiable par construction, contrairement à une introspection
   * runtime de la police (PDFFont.getCharacterSet()).
   *
   * Historique : la première version de ce moteur s'appuyait sur
   * police.getCharacterSet() pour déterminer les caractères
   * représentables. Ça a semblé correct en test (mocks), mais en
   * conditions réelles, pour les 14 polices standard (Helvetica,
   * Helvetica-Bold) embarquées via l'énum StandardFonts — donc SANS
   * fichier de police réel à introspecter — getCharacterSet() ne
   * reflète pas fiablement le support WinAnsi : des caractères comme
   * "→" (0x2192) passaient le filtre puis faisaient planter drawText()
   * avec "WinAnsi cannot encode...". D'où cette table figée qui ne
   * dépend d'aucun comportement interne de pdf-lib.
   */
  const CODES_WINANSI_SPECIAUX = [
    0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6,
    0x2030, 0x0160, 0x2039, 0x0152, 0x017d, 0x2018, 0x2019, 0x201c,
    0x201d, 0x2022, 0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a,
    0x0153, 0x017e, 0x0178,
  ];

  function construireJeuWinAnsi() {
    const jeu = new Set();
    for (let i = 0x20; i <= 0x7e; i++) jeu.add(i); // ASCII imprimable
    for (let i = 0xa0; i <= 0xff; i++) jeu.add(i); // Latin-1 (accents français)
    CODES_WINANSI_SPECIAUX.forEach(c => jeu.add(c));
    return jeu;
  }

  // Identique pour Helvetica normale et grasse : WinAnsiEncoding ne
  // varie pas selon la graisse de la police.
  const JEU_WINANSI = construireJeuWinAnsi();

  /**
   * Point d'entrée UNIQUE pour l'assainissement WinAnsi — utilisé par
   * TOUTES les classes de rapport de ce moteur (ConstructeurRapport,
   * ConstructeurRapportUnePage, et toute classe future). Un seul
   * endroit à corriger si un problème d'encodage réapparaît, plutôt
   * qu'une logique dupliquée par classe (demande explicite de
   * Frédéric, 10/08/2026 : « une seule correction, dans un moteur
   * commun, pas une par module »).
   */
  // Caractères non-WinAnsi mais STRUCTURANTS (ils portent un sens dans la
  // phrase, ex. une plage de dates "10/08 → 16/08") — remplacés par un
  // équivalent ASCII plutôt que supprimés silencieusement. Bug réel constaté
  // au test iPhone du 10/08/2026 : "10/08/2026 → 16/08/2026" affichait
  // "10/08/2026  16/08/2026" (séparateur invisible, juste un espace en trop),
  // parce que la flèche disparaissait sans rien laisser à sa place. Les
  // emoji, eux, restent supprimés sans remplacement : purement décoratifs.
  const REMPLACEMENTS_STRUCTURANTS = [
    [/[→⇒➜➔]/g, '-'],
    [/[←⇐]/g, '-'],
  ];

  function assainirWinAnsi(texte) {
    let brut = String(texte == null ? '' : texte);
    REMPLACEMENTS_STRUCTURANTS.forEach(([motif, remplacement]) => { brut = brut.replace(motif, remplacement); });
    let resultat = '';
    for (const car of brut) {
      if (JEU_WINANSI.has(car.codePointAt(0))) resultat += car;
    }
    return resultat.replace(/[ \t]{2,}/g, ' ').trim();
  }

  /** Tronque un texte à `max` caractères, en coupant sur un espace si possible, avec une ellipse — pour les blocs à budget de place fixe (ex. Conseil NEXUS d'un rapport une-page). */
  function tronquerCaracteres(texte, max) {
    const t = String(texte == null ? '' : texte);
    if (t.length <= max) return t;
    const coupe = t.slice(0, max);
    const dernierEspace = coupe.lastIndexOf(' ');
    return (dernierEspace > max * 0.6 ? coupe.slice(0, dernierEspace) : coupe) + '…';
  }

  /**
   * Découpe un texte en lignes qui tiennent dans `largeurMax`, pour une
   * police/taille donnée — pdf-lib ne fait AUCUN retour à la ligne
   * automatique (contrairement à un rendu HTML), c'est au moteur de
   * mise en page de le faire.
   */
  function decouperEnLignes(texte, police, taille, largeurMax) {
    const mots = String(texte == null ? '' : texte).split(/\s+/).filter(Boolean);
    const lignes = [];
    let ligneActuelle = '';
    mots.forEach(mot => {
      const essai = ligneActuelle ? `${ligneActuelle} ${mot}` : mot;
      if (!ligneActuelle || police.widthOfTextAtSize(essai, taille) <= largeurMax) {
        ligneActuelle = essai;
      } else {
        lignes.push(ligneActuelle);
        ligneActuelle = mot;
      }
    });
    if (ligneActuelle) lignes.push(ligneActuelle);
    return lignes.length ? lignes : [''];
  }

  /**
   * ConstructeurRapport — pagination maîtrisée : chaque ajout vérifie
   * l'espace vertical restant sur la page et insère automatiquement une
   * nouvelle page si nécessaire (jamais un contenu tronqué en bas de
   * page, contrairement à un simple rendu navigateur figé).
   */
  class ConstructeurRapport {
    constructor(doc, police, policeGrasse, entete) {
      this.doc = doc;
      this.police = police;
      this.policeGrasse = policeGrasse;
      this.entete = entete || null; // { app, sousTitre } répété en haut de chaque page
      this.page = null;
      this.y = 0;
      this.numeroPage = 0;
      // La toute première page ne porte jamais le bandeau d'en-tête, même
      // si `entete` est fourni au constructeur — c'est la page que
      // pageDeGarde() (ci-dessous) va utiliser pour la couverture premium
      // du rapport, qui doit rester sobre (aucun bandeau applicatif dessus).
      // Si l'appelant n'utilise pas pageDeGarde(), cette première page
      // reste simplement sans bandeau — un choix par défaut plus sobre,
      // jamais bloquant.
      this._nouvellePage({ sansBandeau: true });
    }

    /**
     * Filtre les caractères que la police embarquée ne sait pas
     * représenter (emoji, flèches Unicode →, etc.) — pdf-lib lève une
     * exception à drawText() sinon ("WinAnsi cannot encode…"), ce qui
     * fait échouer TOUTE la génération du rapport pour un seul caractère
     * fautif. Défensif par construction : ce moteur est générique
     * (Article 11) et ne contrôle pas à l'avance le texte métier que
     * chaque module NEXUS lui donne — un emoji utilisé pour l'affichage
     * écran ailleurs dans l'app (ex. "🔴 CRITIQUE") ne doit jamais
     * planter le PDF, il doit simplement être retiré.
     */
    _assainir(texte) {
      return assainirWinAnsi(texte);
    }

    _nouvellePage(options) {
      this.page = this.doc.addPage([A4.largeur, A4.hauteur]);
      this.numeroPage += 1;
      this.y = A4.hauteur - MARGE;
      if (this.entete && !(options && options.sansBandeau)) this._dessinerBandeauEntete();
    }

    _dessinerBandeauEntete() {
      const app = this._assainir(this.entete.app, true);
      this.page.drawRectangle({ x: 0, y: A4.hauteur - 30, width: A4.largeur, height: 30, color: COULEUR.fondEntete });
      this.page.drawText(app, { x: MARGE, y: A4.hauteur - 20, size: 9, font: this.policeGrasse, color: COULEUR.cyan });
      if (this.entete.sousTitre) {
        const sousTitre = this._assainir(this.entete.sousTitre, false);
        const largeurSous = this.police.widthOfTextAtSize(sousTitre, 8.5);
        this.page.drawText(sousTitre, { x: A4.largeur - MARGE - largeurSous, y: A4.hauteur - 20, size: 8.5, font: this.police, color: COULEUR.texteDim });
      }
      this.y = A4.hauteur - 30 - 22;
    }

    /** Espace vertical restant avant la marge basse (réserve 20pt pour le pied de page). */
    espaceDisponible() { return this.y - MARGE - 20; }

    /** Force une nouvelle page si l'espace restant est insuffisant pour `hauteurRequise`. */
    assurerEspace(hauteurRequise) {
      if (this.espaceDisponible() < hauteurRequise) this._nouvellePage();
    }

    titre(texte, { taille = 19 } = {}) {
      const t = this._assainir(texte, true);
      this.assurerEspace(taille + 14);
      this.page.drawText(t, { x: MARGE, y: this.y - taille, size: taille, font: this.policeGrasse, color: COULEUR.texte });
      this.y -= taille + 14;
    }

    sousTitre(texte, { taille = 10.5, couleur = COULEUR.texteDim } = {}) {
      const t = this._assainir(texte, false);
      this.assurerEspace(taille + 10);
      this.page.drawText(t, { x: MARGE, y: this.y - taille, size: taille, font: this.police, color: couleur });
      this.y -= taille + 10;
    }

    /** Bandeau d'alerte plein largeur (ex. "données provisoires"). */
    bandeau(texte, { couleur = COULEUR.ambre } = {}) {
      const taille = 9.5, interligne = 13;
      const lignes = decouperEnLignes(this._assainir(texte, false), this.police, taille, LARGEUR_UTILE - 20);
      const hauteur = lignes.length * interligne + 12;
      this.assurerEspace(hauteur + 8);
      this.page.drawRectangle({ x: MARGE, y: this.y - hauteur, width: LARGEUR_UTILE, height: hauteur, color: COULEUR.fondAlterne, borderColor: couleur, borderWidth: 1 });
      let yc = this.y - 12;
      lignes.forEach(l => { this.page.drawText(l, { x: MARGE + 10, y: yc - taille, size: taille, font: this.police, color: couleur }); yc -= interligne; });
      this.y -= hauteur + 10;
    }

    sectionTitre(texte) {
      const t = this._assainir(texte, true).toUpperCase();
      this.assurerEspace(30);
      this.y -= 4;
      this.page.drawLine({ start: { x: MARGE, y: this.y }, end: { x: A4.largeur - MARGE, y: this.y }, thickness: 1.2, color: COULEUR.cyan });
      this.y -= 16;
      this.page.drawText(t, { x: MARGE, y: this.y - 10, size: 10.5, font: this.policeGrasse, color: COULEUR.texte });
      this.y -= 22;
    }

    paragraphe(texte, { taille = 9.5, couleur = COULEUR.texte, interligne = 13 } = {}) {
      decouperEnLignes(this._assainir(texte, false), this.police, taille, LARGEUR_UTILE).forEach(ligne => {
        this.assurerEspace(interligne);
        this.page.drawText(ligne, { x: MARGE, y: this.y - taille, size: taille, font: this.police, color: couleur });
        this.y -= interligne;
      });
    }

    /** Ligne clé / valeur alignée à droite (ex. "CA FDJ" … "12 480,50 €"). */
    ligneCle(label, valeur, { couleurValeur = COULEUR.texte } = {}) {
      const taille = 10;
      const texteLabel = this._assainir(label, false);
      const texteValeur = this._assainir(valeur, true);
      this.assurerEspace(18);
      this.page.drawText(texteLabel, { x: MARGE, y: this.y - taille, size: taille, font: this.police, color: COULEUR.texteDim });
      const largeurValeur = this.policeGrasse.widthOfTextAtSize(texteValeur, taille);
      this.page.drawText(texteValeur, { x: A4.largeur - MARGE - largeurValeur, y: this.y - taille, size: taille, font: this.policeGrasse, color: couleurValeur });
      this.y -= 8;
      this.page.drawLine({ start: { x: MARGE, y: this.y }, end: { x: A4.largeur - MARGE, y: this.y }, thickness: 0.5, color: COULEUR.ligne });
      this.y -= 10;
    }

    /** Encadré simple (ex. conseil NEXUS, point de vigilance) — bordure colorée, texte libre. */
    encadre(lignes, { couleurBordure = COULEUR.cyan } = {}) {
      const taille = 9.5, interligne = 13;
      const decoupees = [];
      lignes.forEach(l => decouperEnLignes(this._assainir(l.texte, !!l.gras), l.gras ? this.policeGrasse : this.police, taille, LARGEUR_UTILE - 24)
        .forEach(ligne => decoupees.push({ ligne, gras: l.gras })));
      const hauteur = decoupees.length * interligne + 18;
      this.assurerEspace(hauteur + 10);
      this.page.drawRectangle({ x: MARGE, y: this.y - hauteur, width: LARGEUR_UTILE, height: hauteur, color: COULEUR.fondAlterne, borderColor: couleurBordure, borderWidth: 1 });
      let yc = this.y - 13;
      decoupees.forEach(({ ligne, gras }) => {
        this.page.drawText(ligne, { x: MARGE + 12, y: yc - taille, size: taille, font: gras ? this.policeGrasse : this.police, color: COULEUR.texte });
        yc -= interligne;
      });
      this.y -= hauteur + 12;
    }

    /**
     * Tableau simple — colonnes: [{ label, cle, largeur (fraction de la
     * largeur utile, somme = 1), align: 'gauche'|'droite' }], lignes:
     * [{ [cle]: valeur déjà formatée }]. Pagination automatique ligne
     * par ligne (l'en-tête n'est pas répété sur une page suivante —
     * limite acceptée pour des tableaux courts, typiques des rapports
     * NEXUS ; à revoir si un module a besoin de tableaux longs).
     */
    tableau(colonnes, lignes) {
      const interligne = 15.5, tailleEnTete = 8.5, taille = 9;
      this.assurerEspace(interligne * 2);
      let x = MARGE;
      this.page.drawRectangle({ x: MARGE, y: this.y - interligne, width: LARGEUR_UTILE, height: interligne, color: COULEUR.fondEntete });
      colonnes.forEach(col => {
        const largeurCol = col.largeur * LARGEUR_UTILE;
        const texte = this._assainir(col.label, true);
        const decal = col.align === 'droite' ? largeurCol - this.policeGrasse.widthOfTextAtSize(texte, tailleEnTete) - 6 : 6;
        this.page.drawText(texte, { x: x + decal, y: this.y - interligne + 4.5, size: tailleEnTete, font: this.policeGrasse, color: COULEUR.texte });
        x += largeurCol;
      });
      this.y -= interligne;
      lignes.forEach((ligne, i) => {
        this.assurerEspace(interligne);
        if (i % 2 === 1) this.page.drawRectangle({ x: MARGE, y: this.y - interligne, width: LARGEUR_UTILE, height: interligne, color: COULEUR.fondAlterne });
        let xx = MARGE;
        colonnes.forEach(col => {
          const largeurCol = col.largeur * LARGEUR_UTILE;
          const val = this._assainir(ligne[col.cle] == null ? '—' : ligne[col.cle], false);
          const decal = col.align === 'droite' ? largeurCol - this.police.widthOfTextAtSize(val, taille) - 6 : 6;
          this.page.drawText(val, { x: xx + decal, y: this.y - interligne + 4.5, size: taille, font: this.police, color: COULEUR.texte });
          xx += largeurCol;
        });
        this.y -= interligne;
      });
      this.y -= 8;
    }

    /**
     * Image PNG (typiquement un graphique Chart.js exporté via
     * `chart.toBase64Image()`) — mise à l'échelle pour tenir dans la
     * largeur utile en conservant les proportions. `pngDataUrl` : chaîne
     * data:image/png;base64,... (pdf-lib l'accepte directement).
     */
    async image(pngDataUrl, { hauteurMax = 210, legende } = {}) {
      const img = await this.doc.embedPng(pngDataUrl);
      const dims = img.scaleToFit(LARGEUR_UTILE, hauteurMax);
      this.assurerEspace(dims.height + (legende ? 16 : 0) + 12);
      this.page.drawImage(img, { x: MARGE, y: this.y - dims.height, width: dims.width, height: dims.height });
      this.y -= dims.height + 6;
      if (legende) this.sousTitre(legende, { taille: 8.5 });
      this.y -= 6;
    }

    /**
     * Page de couverture premium (11/08/2026, "Rapport NEXUS de
     * Direction") — sobre, sans aucun KPI : titre du rapport, nom de
     * l'entreprise, période, puis la signature NEXUS centrée plus bas,
     * et la mention de génération en petit en bas de page. Toujours sa
     * propre page (jamais mélangée à du contenu de chapitre), sans le
     * bandeau d'en-tête habituel (this.entete neutralisé le temps de
     * cette page puis restauré) — une couverture ne doit pas porter le
     * même bandeau que les pages de chapitre.
     * `{ titre, nomEntreprise, periodeLabel, periodeBornes, accroche,
     *   sousAccroche, mentionBas }`
     *
     * Doit être le tout premier appel après creerRapport() : dessine sur
     * la page 1 déjà créée sans bandeau par le constructeur, plutôt que
     * d'en ouvrir une nouvelle (qui laisserait une page 1 vide en tête du
     * document). Appeler rapport._nouvellePage() juste après pour passer
     * au premier chapitre sur une page fraîche, avec bandeau cette fois.
     */
    pageDeGarde({ titre, nomEntreprise, periodeLabel, periodeBornes, accroche, sousAccroche, mentionBas }) {
      const centrer = (texte, police, taille) => (A4.largeur - police.widthOfTextAtSize(texte, taille)) / 2;

      let y = A4.hauteur - 300;

      const t = this._assainir(titre || 'RAPPORT NEXUS DE DIRECTION', true);
      this.page.drawText(t, { x: centrer(t, this.policeGrasse, 22), y, size: 22, font: this.policeGrasse, color: COULEUR.texte });
      y -= 34;

      if (nomEntreprise) {
        const n = this._assainir(nomEntreprise, false);
        this.page.drawText(n, { x: centrer(n, this.police, 14), y, size: 14, font: this.police, color: COULEUR.texteDim });
        y -= 24;
      }
      if (periodeBornes || periodeLabel) {
        const p = this._assainir(periodeBornes || periodeLabel, false);
        this.page.drawText(p, { x: centrer(p, this.police, 11.5), y, size: 11.5, font: this.police, color: COULEUR.cyan });
        y -= 60;
      }

      const acc = this._assainir(accroche || 'Propulsé par le Conseiller NEXUS', true);
      this.page.drawText(acc, { x: centrer(acc, this.policeGrasse, 11), y, size: 11, font: this.policeGrasse, color: COULEUR.texte });
      y -= 16;
      const sAcc = this._assainir(sousAccroche || 'Des données aux décisions.', false);
      this.page.drawText(sAcc, { x: centrer(sAcc, this.police, 10), y, size: 10, font: this.police, color: COULEUR.texteDim });

      if (mentionBas) {
        const m = this._assainir(mentionBas, false);
        this.page.drawText(m, { x: centrer(m, this.police, 9), y: MARGE + 30, size: 9, font: this.police, color: COULEUR.texteDim });
      }
    }

    /** Pied de page numéroté ("Page X / Y") + texte de gauche, appliqué à TOUTES les pages déjà créées — à appeler en dernier, une fois le contenu terminé. */
    piedDePageToutesPages(texteGauche) {
      const gauche = this._assainir(texteGauche || '', false);
      const pages = this.doc.getPages();
      pages.forEach((p, i) => {
        p.drawLine({ start: { x: MARGE, y: MARGE - 8 }, end: { x: A4.largeur - MARGE, y: MARGE - 8 }, thickness: 0.5, color: COULEUR.ligne });
        p.drawText(gauche, { x: MARGE, y: MARGE - 20, size: 7.5, font: this.police, color: COULEUR.texteDim });
        const texteDroite = `Page ${i + 1} / ${pages.length}`;
        const largeur = this.police.widthOfTextAtSize(texteDroite, 7.5);
        p.drawText(texteDroite, { x: A4.largeur - MARGE - largeur, y: MARGE - 20, size: 7.5, font: this.police, color: COULEUR.texteDim });
      });
    }
  }

  /* ------------------------------------------------------------
   * ConstructeurRapportUnePage — rapport "synthèse dirigeante" tenant
   * TOUJOURS sur une seule page A4, quelle que soit la quantité de
   * données disponibles (demande explicite de Frédéric, 10/08/2026) :
   * « Le moteur PDF ne doit pas essayer d'imprimer l'intégralité des
   * données disponibles : il doit sélectionner et hiérarchiser les
   * informations réellement utiles au pilotage. »
   *
   * Contrairement à ConstructeurRapport (pagination automatique, texte
   * qui coule librement, pour des rapports détaillés multi-pages), ce
   * constructeur utilise des ZONES DE HAUTEUR FIXE allouées une seule
   * fois à la construction : la page ne s'allonge jamais. Si un module
   * appelant fournit trop d'éléments (ex. 12 employés), c'est à LUI de
   * plafonner (Top 5, 4 employés, 3 décisions…) — chaque primitive
   * plafonne aussi défensivement en interne et peut afficher une ligne
   * de renvoi ("+ N autres — voir détail dans l'app") au lieu de
   * déborder.
   *
   * Générique par construction (Article 11, "une seule vérité") : ce
   * fichier ne connaît toujours rien à FDJ, Verify, Inventaire, Brief,
   * etc. Tout module NEXUS voulant un rapport "1 page" (hebdomadaire,
   * mensuel, annuel — la spec d'un module donné change simplement LES
   * DONNÉES envoyées à ces primitives, jamais leur mise en page) utilise
   * ces mêmes primitives.
   * ------------------------------------------------------------ */

  // 1 mm en points PDF (unité native de pdf-lib) — les zones ci-dessous
  // sont définies en millimètres pour rester lisibles/vérifiables
  // contre un gabarit papier réel, puis converties une fois ici.
  const MM = 72 / 25.4;
  const mm = n => n * MM;

  // Marges volontairement plus serrées qu'un rapport détaillé multi-page
  // (MARGE=44pt/~15.5mm) : un rapport une-page doit maximiser la
  // surface utile pour tenir toute l'info sur un seul A4.
  const MARGE_1P = mm(10);
  const LARGEUR_UTILE_1P = A4.largeur - MARGE_1P * 2;

  // Budget vertical fixe par bloc, en mm — somme ≈ 277mm, la hauteur
  // utile d'un A4 (297mm) avec 10mm de marge en haut et en bas. Un
  // module appelant peut ignorer les blocs qu'il n'utilise pas (ex. pas
  // de graphique) et redistribuer leur budget à d'autres blocs.
  const ZONES_1P = {
    entete: mm(20),
    kpi: mm(25),
    synthese: mm(30),
    graphique: mm(45),
    ventes: mm(55),
    equipe: mm(45),
    decisions: mm(50),
    piedDePage: mm(7),
  };

  class ConstructeurRapportUnePage {
    // 21/08/2026, demande de Frédéric ("relevé de clôture FDJ en A4
    // paysage, une seule page à l'impression") — voir gap documenté le
    // 20/08/2026 (Data Dictionary v2.188) : l'orientation était figée en
    // constante de MODULE (A4.largeur/A4.hauteur), ce qui aurait forcé à
    // toucher le rendu des 3 AUTRES modules déjà en production sur ce
    // constructeur (Inventaire, FDJ Analyse, Verify) pour livrer une
    // demande scopée à un seul rapport. Au lieu de ça : `orientation`
    // devient un paramètre D'INSTANCE, jamais lu depuis la constante de
    // module — `portrait` par défaut (comportement strictement identique
    // à avant pour tout appelant existant, aucun argument à changer),
    // `paysage` explicite pour inverser largeur/hauteur de la page. Les
    // méthodes de dessin de cette classe ne lisent déjà QUE `zone.x`/
    // `zone.largeur`/`zone.yHaut`/`zone.yBas` (jamais A4 directement) —
    // seuls les 2 usages ci-dessous devaient donc changer.
    constructor(doc, police, policeGrasse, { orientation = 'portrait' } = {}) {
      this.doc = doc;
      this.police = police;
      this.policeGrasse = policeGrasse;
      this.orientation = orientation;
      this.pageLargeur = orientation === 'paysage' ? A4.hauteur : A4.largeur;
      this.pageHauteur = orientation === 'paysage' ? A4.largeur : A4.hauteur;
      this.page = doc.addPage([this.pageLargeur, this.pageHauteur]);
      this.x = MARGE_1P;
      this.largeur = this.pageLargeur - MARGE_1P * 2;
      this.y = this.pageHauteur - MARGE_1P;
    }

    _assainir(texte) {
      return assainirWinAnsi(texte);
    }

    _texte(texte, x, y, { taille = 9, gras = false, couleur = COULEUR.texte } = {}) {
      const t = this._assainir(texte);
      if (!t) return t;
      this.page.drawText(t, { x, y, size: taille, font: gras ? this.policeGrasse : this.police, color: couleur });
      return t;
    }

    _largeurTexte(texte, taille, gras) {
      const t = this._assainir(texte);
      return (gras ? this.policeGrasse : this.police).widthOfTextAtSize(t, taille);
    }

    /**
     * Tronque UNE ligne de texte pour qu'elle tienne dans `largeurMax` points,
     * avec ellipse — indispensable pour toute primitive à colonnes fixes
     * (`listePoints`, `tableauCompact`, `barresHorizontales`…) : contrairement
     * à `decouperEnLignes()` (qui répartit sur plusieurs lignes), ici il n'y a
     * qu'une seule ligne disponible, donc un texte trop long DOIT être coupé —
     * sinon pdf-lib le dessine quand même, hors des bornes de la colonne, et
     * il vient se superposer visuellement au contenu de la zone voisine.
     * Bug réel constaté (test iPhone du 10/08/2026, rapport Brief) : la
     * colonne "FORCES DU MOMENT" débordait sur "À SURVEILLER".
     */
    _tronquerLargeur(texte, taille, largeurMax, gras = false) {
      const police = gras ? this.policeGrasse : this.police;
      const t = this._assainir(texte);
      if (largeurMax <= 0 || police.widthOfTextAtSize(t, taille) <= largeurMax) return t;
      let coupe = t;
      while (coupe.length > 1 && police.widthOfTextAtSize(`${coupe}…`, taille) > largeurMax) {
        coupe = coupe.slice(0, -1);
      }
      return `${coupe.trimEnd()}…`;
    }

    _texteCentre(texte, xCentre, y, opts = {}) {
      const largeur = this._largeurTexte(texte, opts.taille || 9, !!opts.gras);
      this._texte(texte, xCentre - largeur / 2, y, opts);
    }

    _texteDroite(texte, xDroite, y, opts = {}) {
      const largeur = this._largeurTexte(texte, opts.taille || 9, !!opts.gras);
      this._texte(texte, xDroite - largeur, y, opts);
    }

    /** Petit carré coloré (marqueur d'urgence/priorité) — remplace les emoji, non représentables par la police standard. */
    _puce(x, y, couleur, taille = 6) {
      this.page.drawRectangle({ x, y, width: taille, height: taille, color: couleur });
    }

    /**
     * Alloue un bloc de hauteur fixe `hauteurPt` (voir ZONES_1P) en
     * partant du haut de la zone déjà consommée. Retourne les bornes du
     * bloc — c'est aux méthodes ci-dessous (ou à un module appelant
     * avancé) de dessiner DANS ces bornes, jamais au-delà.
     */
    allouerZone(hauteurPt) {
      const yHaut = this.y;
      const yBas = this.y - hauteurPt;
      this.y = yBas;
      return { x: this.x, yHaut, yBas, largeur: this.largeur, hauteur: hauteurPt };
    }

    /** Divise une zone en deux colonnes côte à côte (même hauteur). */
    diviserColonnes(zone, { gouttiere = 14, ratioGauche = 0.5 } = {}) {
      const largeurGauche = (zone.largeur - gouttiere) * ratioGauche;
      const largeurDroite = zone.largeur - gouttiere - largeurGauche;
      return {
        gauche: { x: zone.x, yHaut: zone.yHaut, yBas: zone.yBas, largeur: largeurGauche, hauteur: zone.hauteur },
        droite: { x: zone.x + largeurGauche + gouttiere, yHaut: zone.yHaut, yBas: zone.yBas, largeur: largeurDroite, hauteur: zone.hauteur },
      };
    }

    /** Sous-divise une zone verticalement en `n` tranches empilées (ex. Conseil NEXUS + Décisions dans la même zone). */
    diviserLignes(zone, hauteurs) {
      const total = hauteurs.reduce((s, h) => s + h, 0);
      const echelle = total > zone.hauteur ? zone.hauteur / total : 1;
      let yHaut = zone.yHaut;
      return hauteurs.map(h => {
        const hEch = h * echelle;
        const bloc = { x: zone.x, yHaut, yBas: yHaut - hEch, largeur: zone.largeur, hauteur: hEch };
        yHaut -= hEch;
        return bloc;
      });
    }

    // === Bloc en-tête compact : nom d'app + 1-2 lignes de contexte ===
    entete(zone, { app, ligne1, ligne2 }) {
      let y = zone.yHaut - 15;
      this._texte(this._tronquerLargeur(app, 13.5, zone.largeur, true), zone.x, y, { taille: 13.5, gras: true, couleur: COULEUR.cyan });
      y -= 16;
      if (ligne1) { this._texte(this._tronquerLargeur(ligne1, 10, zone.largeur, true), zone.x, y, { taille: 10, gras: true, couleur: COULEUR.texte }); y -= 13; }
      if (ligne2) { this._texte(this._tronquerLargeur(ligne2, 8.5, zone.largeur), zone.x, y, { taille: 8.5, couleur: COULEUR.texteDim }); }
      this.page.drawLine({ start: { x: zone.x, y: zone.yBas + 4 }, end: { x: zone.x + zone.largeur, y: zone.yBas + 4 }, thickness: 1, color: COULEUR.cyan });
    }

    // === Rangée de KPI (2 à 4 cartes réparties uniformément) ===
    // kpis: [{ label, valeur, detail, couleurValeur }]
    ligneKpi(zone, kpis) {
      const n = kpis.length;
      const largeurCase = zone.largeur / n;
      kpis.forEach((k, i) => {
        const xCentre = zone.x + i * largeurCase + largeurCase / 2;
        if (i > 0) this.page.drawLine({ start: { x: zone.x + i * largeurCase, y: zone.yHaut }, end: { x: zone.x + i * largeurCase, y: zone.yBas + 4 }, thickness: 0.6, color: COULEUR.ligne });
        this._texteCentre(this._tronquerLargeur(k.label, 7.8, largeurCase - 8, true), xCentre, zone.yHaut - 14, { taille: 7.8, couleur: COULEUR.texteDim, gras: true });
        this._texteCentre(this._tronquerLargeur(k.valeur, 15, largeurCase - 6, true), xCentre, zone.yHaut - 33, { taille: 15, gras: true, couleur: k.couleurValeur || COULEUR.texte });
        if (k.detail) this._texteCentre(this._tronquerLargeur(k.detail, 7.5, largeurCase - 8), xCentre, zone.yHaut - 47, { taille: 7.5, couleur: COULEUR.texteDim });
      });
      this.page.drawLine({ start: { x: zone.x, y: zone.yBas + 4 }, end: { x: zone.x + zone.largeur, y: zone.yBas + 4 }, thickness: 0.6, color: COULEUR.ligne });
    }

    // === "Ce qu'il faut savoir" : liste de points clé plafonnée ===
    // points: [{ label, valeur }] ou chaînes déjà formées.
    listePoints(zone, { titre = 'CE QU\'IL FAUT SAVOIR', points, max = 5, texteRenvoi } = {}) {
      let y = zone.yHaut - 11;
      this._texte(titre, zone.x, y, { taille: 9.5, gras: true, couleur: COULEUR.cyan });
      y -= 15;
      const visibles = points.slice(0, max);
      const interligne = Math.min(13.5, (zone.hauteur - 22) / Math.max(1, visibles.length + (points.length > max ? 1 : 0)));
      visibles.forEach(p => {
        const texte = typeof p === 'string' ? p : `${p.label} : ${p.valeur}`;
        const texteAffiche = this._tronquerLargeur(texte, 9.3, zone.largeur - 9);
        this.page.drawRectangle({ x: zone.x, y: y - 6.5, width: 3, height: 3, color: COULEUR.cyan });
        this._texte(texteAffiche, zone.x + 9, y - 8, { taille: 9.3, couleur: COULEUR.texte });
        y -= interligne;
      });
      if (points.length > max && texteRenvoi) {
        this._texte(`+ ${points.length - max} autres — ${texteRenvoi}`, zone.x + 9, y - 8, { taille: 8, couleur: COULEUR.texteDim });
      }
    }

    // === Image (graphique déjà rendu en PNG, ex. Chart.js) réduite pour tenir dans la zone ===
    async graphique(zone, pngDataUrl, { legende } = {}) {
      const img = await this.doc.embedPng(pngDataUrl);
      const hauteurLegende = legende ? 12 : 0;
      const dims = img.scaleToFit(zone.largeur, zone.hauteur - hauteurLegende - 4);
      const xImg = zone.x + (zone.largeur - dims.width) / 2;
      this.page.drawImage(img, { x: xImg, y: zone.yBas + hauteurLegende + 4, width: dims.width, height: dims.height });
      if (legende) this._texte(legende, zone.x, zone.yBas + 2, { taille: 7.8, couleur: COULEUR.texteDim });
    }

    // === Mini-tableau plafonné (2 colonnes typiquement : libellé / valeur) ===
    // colonnes: [{ label, cle, largeur (fraction), align }], lignes: [{ [cle]: valeur }]
    tableauCompact(zone, { titre, colonnes, lignes, max = 5, texteRenvoi } = {}) {
      let y = zone.yHaut - 10;
      if (titre) { this._texte(titre, zone.x, y, { taille: 8.7, gras: true, couleur: COULEUR.texte }); y -= 13; }
      const visibles = lignes.slice(0, max);
      const nLignesTotal = visibles.length + (titre ? 0 : 0) + 1; // +1 pour l'en-tête colonnes
      const interligne = Math.min(13, (zone.hauteur - (zone.yHaut - y) - (lignes.length > max ? 10 : 0)) / Math.max(1, nLignesTotal));
      // en-tête colonnes
      let x = zone.x;
      colonnes.forEach(col => {
        const largeurCol = col.largeur * zone.largeur;
        const texte = this._tronquerLargeur(col.label, 7.5, largeurCol - 6, true);
        const decal = col.align === 'droite' ? largeurCol - this._largeurTexte(texte, 7.5, true) - 4 : 0;
        this._texte(texte, x + decal, y - 8, { taille: 7.5, gras: true, couleur: COULEUR.texteDim });
        x += largeurCol;
      });
      y -= interligne;
      visibles.forEach((ligne, i) => {
        if (i % 2 === 1) this.page.drawRectangle({ x: zone.x, y: y - interligne + 3, width: zone.largeur, height: interligne, color: COULEUR.fondAlterne });
        let xx = zone.x;
        colonnes.forEach(col => {
          const largeurCol = col.largeur * zone.largeur;
          const val = this._tronquerLargeur(ligne[col.cle] == null ? '—' : ligne[col.cle], 8.6, largeurCol - 6, false);
          const decal = col.align === 'droite' ? largeurCol - this._largeurTexte(val, 8.6, false) - 4 : 0;
          this._texte(val, xx + decal, y - 8, { taille: 8.6, couleur: COULEUR.texte });
          xx += largeurCol;
        });
        y -= interligne;
      });
      if (lignes.length > max && texteRenvoi) {
        this._texte(`+ ${lignes.length - max} autres — ${texteRenvoi}`, zone.x, zone.yBas + 2, { taille: 7.3, couleur: COULEUR.texteDim });
      }
    }

    // === Petites barres horizontales (ex. répartition par palier) ===
    // items: [{ label, valeur, part (0..1) }]
    // largeurLabel n'est PAS fixé en dur : cette primitive a d'abord été
    // pensée pour des libellés courts (paliers FDJ "1 €"/"5 €"…), mais
    // d'autres modules l'utilisent avec des libellés plus longs ("Commerce",
    // "Opérations", "À surveiller"…). Sans mesure réelle, un libellé trop
    // long pour 34pt fixes se coupait de façon illisible ("Com…", "Opéra…")
    // — constaté au test iPhone du 10/08/2026 (Brief : boussole 5 axes,
    // Verify : répartition par gravité). La colonne s'élargit maintenant
    // selon le libellé le plus long réellement affiché, plafonnée à 42% de
    // la zone pour laisser de la place à la barre elle-même.
    barresHorizontales(zone, { titre, items, max = 6, texteRenvoi, largeurValeur = 46 } = {}) {
      let y = zone.yHaut - 10;
      if (titre) { this._texte(titre, zone.x, y, { taille: 8.7, gras: true, couleur: COULEUR.texte }); y -= 14; }
      const visibles = items.slice(0, max);
      const hauteurBas = (items.length > max && texteRenvoi) ? 10 : 0;
      const interligne = Math.min(15, (zone.hauteur - (zone.yHaut - y) - hauteurBas) / Math.max(1, visibles.length));
      const largeurLabelSouhaitee = visibles.reduce((max2, it) => Math.max(max2, this._largeurTexte(it.label, 8.2)), 0) + 6;
      const largeurLabel = Math.min(zone.largeur * 0.42, Math.max(34, largeurLabelSouhaitee));
      const largeurBarreMax = zone.largeur - largeurLabel - largeurValeur - 8;
      visibles.forEach(it => {
        this._texte(this._tronquerLargeur(it.label, 8.2, largeurLabel - 3), zone.x, y - 8, { taille: 8.2, couleur: COULEUR.texteDim });
        const xBarre = zone.x + largeurLabel;
        this.page.drawRectangle({ x: xBarre, y: y - 9, width: largeurBarreMax, height: 7, color: COULEUR.fondAlterne });
        const part = Math.max(0, Math.min(1, it.part || 0));
        if (part > 0) this.page.drawRectangle({ x: xBarre, y: y - 9, width: largeurBarreMax * part, height: 7, color: COULEUR.cyan });
        this._texteDroite(this._tronquerLargeur(it.valeur, 8.2, largeurValeur - 3, true), zone.x + zone.largeur, y - 8, { taille: 8.2, gras: true, couleur: COULEUR.texte });
        y -= interligne;
      });
      if (items.length > max && texteRenvoi) {
        this._texte(`+ ${items.length - max} autres — ${texteRenvoi}`, zone.x, zone.yBas + 2, { taille: 7.3, couleur: COULEUR.texteDim });
      }
    }

    // === Équipe : 1 référence (échantillon suffisant) + reste sans classement (« vérité avant certitude ») ===
    // reference: { nom, valeurParUnite, unite, quantite } | null ; autres: [{ nom, detail }]
    listeEquipe(zone, { titre, reference, autres = [], texteInsuffisant, texteAucuneDonnee } = {}) {
      let y = zone.yHaut - 10;
      if (titre) { this._texte(titre, zone.x, y, { taille: 8.7, gras: true, couleur: COULEUR.texte }); y -= 14; }
      if (!reference && !autres.length) {
        this._texte(texteAucuneDonnee || 'Aucune donnée sur cette période.', zone.x, y - 8, { taille: 8.4, couleur: COULEUR.texteDim });
        return;
      }
      if (reference) {
        this._puce(zone.x, y - 8, COULEUR.cyan, 6);
        const texteRef = this._tronquerLargeur(`Référence : ${reference.nom} — ${reference.valeurParUnite} (${reference.quantite})`, 8.6, zone.largeur - 10, true);
        this._texte(texteRef, zone.x + 10, y - 8, { taille: 8.6, gras: true, couleur: COULEUR.texte });
        y -= 14;
      }
      autres.slice(0, 4).forEach(a => {
        const texteAutre = this._tronquerLargeur(`${a.nom} — ${a.detail}`, 8.2, zone.largeur - 10);
        this._texte(texteAutre, zone.x + 10, y - 8, { taille: 8.2, couleur: COULEUR.texteDim });
        y -= 12;
      });
      if (autres.length && texteInsuffisant) {
        this._texte(texteInsuffisant, zone.x + 10, y - 8, { taille: 7.6, couleur: COULEUR.texteDim });
      }
    }

    // === Stock condensé : ruptures + surveillance, jamais la liste complète ===
    stockCondense(zone, { titre, ruptures = [], nbSurveillance = 0, prioritaires = [], texteRenvoi } = {}) {
      let y = zone.yHaut - 10;
      if (titre) { this._texte(titre, zone.x, y, { taille: 8.7, gras: true, couleur: COULEUR.texte }); y -= 14; }
      if (ruptures.length) {
        this._puce(zone.x, y - 8, COULEUR.rouge, 6);
        const texteRupture = this._tronquerLargeur(`${ruptures.length} rupture${ruptures.length > 1 ? 's' : ''} : ${ruptures.map(r => r.nom).slice(0, 2).join(', ')}${ruptures.length > 2 ? '…' : ''}`, 8.4, zone.largeur - 10, true);
        this._texte(texteRupture, zone.x + 10, y - 8, { taille: 8.4, gras: true, couleur: COULEUR.rouge });
        y -= 13;
      } else {
        this._texte('Aucune rupture.', zone.x, y - 8, { taille: 8.4, couleur: COULEUR.vert });
        y -= 13;
      }
      if (nbSurveillance > 0) {
        this._puce(zone.x, y - 8, COULEUR.ambre, 6);
        const texteSurveillance = this._tronquerLargeur(`${nbSurveillance} jeu${nbSurveillance > 1 ? 'x' : ''} à surveiller, dont ${prioritaires.length} prioritaire${prioritaires.length > 1 ? 's' : ''}`, 8.4, zone.largeur - 10);
        this._texte(texteSurveillance, zone.x + 10, y - 8, { taille: 8.4, couleur: COULEUR.ambre });
        y -= 13;
      }
      prioritaires.slice(0, 4).forEach(p => {
        this._texte(this._tronquerLargeur(`• ${p.nom}`, 8, zone.largeur - 10), zone.x + 10, y - 8, { taille: 8, couleur: COULEUR.texteDim });
        y -= 11;
      });
      if (texteRenvoi) this._texte(texteRenvoi, zone.x, zone.yBas + 2, { taille: 7.3, couleur: COULEUR.texteDim });
    }

    // === Conseil NEXUS : encadré, texte plafonné en caractères ===
    conseil(zone, { titre = 'CONSEIL NEXUS', texte, max = 250 } = {}) {
      const t = tronquerCaracteres(this._assainir(texte), max);
      this._texte(titre, zone.x, zone.yHaut - 9, { taille: 8.7, gras: true, couleur: COULEUR.cyan });
      const hauteurBoite = zone.hauteur - 12;
      this.page.drawRectangle({ x: zone.x, y: zone.yBas, width: zone.largeur, height: hauteurBoite, color: COULEUR.fondAlterne, borderColor: COULEUR.cyan, borderWidth: 0.8 });
      const lignes = decouperEnLignes(t, this.police, 8.6, zone.largeur - 16);
      const interligne = Math.min(11.5, (hauteurBoite - 10) / Math.max(1, lignes.length));
      let y = zone.yBas + hauteurBoite - 12;
      lignes.forEach(l => { this._texte(l, zone.x + 8, y, { taille: 8.6, couleur: COULEUR.texte }); y -= interligne; });
    }

    // === Décisions recommandées : maximum `max`, marqueur coloré par urgence ===
    // items: [{ urgence: 'critique'|'important'|'observation', titre, detail }]
    decisions(zone, { titre = 'DÉCISIONS RECOMMANDÉES', items = [], max = 3, texteAucune } = {}) {
      this._texte(titre, zone.x, zone.yHaut - 9, { taille: 8.7, gras: true, couleur: COULEUR.texte });
      let y = zone.yHaut - 22;
      const visibles = items.slice(0, max);
      if (!visibles.length) {
        this._texte(texteAucune || 'Rien qui mérite l’attention du manager sur cette période.', zone.x, y, { taille: 8.4, couleur: COULEUR.texteDim });
        return;
      }
      const interligne = Math.min(30, (zone.hauteur - 22) / visibles.length);
      const couleurUrgence = { critique: COULEUR.rouge, important: COULEUR.ambre, observation: COULEUR.jaune };
      visibles.forEach(it => {
        const couleur = couleurUrgence[it.urgence] || COULEUR.cyan;
        this._puce(zone.x, y - 7, couleur, 6);
        const titreAffiche = this._tronquerLargeur(it.titre, 8.8, zone.largeur - 10, true);
        this._texte(titreAffiche, zone.x + 10, y - 8, { taille: 8.8, gras: true, couleur: COULEUR.texte });
        if (it.detail) {
          const lignesDetail = decouperEnLignes(this._assainir(it.detail), this.police, 8, zone.largeur - 10);
          const ligneDetail = lignesDetail.length > 1 ? `${lignesDetail[0]}…` : lignesDetail[0];
          this._texte(ligneDetail, zone.x + 10, y - 19, { taille: 8, couleur: COULEUR.texteDim });
        }
        y -= interligne;
      });
    }

    // === Paragraphe libre, plusieurs lignes, borné à la zone (ex. synthèse
    // exécutive de Brief NEXUS, remarques Conseiller de Verify…) — jamais de
    // débordement hors zone : si le texte est trop long, la dernière ligne
    // visible reçoit une ellipse plutôt que de déborder sur le bloc suivant.
    paragraphe(zone, { titre, texte, taille = 9, interligne = 12.5, couleur = COULEUR.texte } = {}) {
      let y = zone.yHaut - 10;
      if (titre) { this._texte(titre, zone.x, y, { taille: 8.7, gras: true, couleur: COULEUR.cyan }); y -= 13; }
      const lignes = decouperEnLignes(this._assainir(texte), this.police, taille, zone.largeur);
      const disponible = Math.max(1, Math.floor((y - zone.yBas) / interligne));
      const tronque = lignes.length > disponible;
      const visibles = tronque ? lignes.slice(0, disponible) : lignes;
      visibles.forEach((l, i) => {
        const dernier = tronque && i === visibles.length - 1;
        this._texte(dernier ? `${l}…` : l, zone.x, y, { taille, couleur });
        y -= interligne;
      });
    }

    /** Pied de page unique (pas de numérotation — un rapport une-page n'en a pas besoin). */
    piedDePage(zone, texteGauche, texteDroite) {
      this.page.drawLine({ start: { x: zone.x, y: zone.yHaut }, end: { x: zone.x + zone.largeur, y: zone.yHaut }, thickness: 0.5, color: COULEUR.ligne });
      this._texte(texteGauche || '', zone.x, zone.yHaut - 11, { taille: 7, couleur: COULEUR.texteDim });
      if (texteDroite) this._texteDroite(texteDroite, zone.x + zone.largeur, zone.yHaut - 11, { taille: 7, couleur: COULEUR.texteDim });
    }
  }

  /** Crée un document PDF A4 + polices standard embarquées et un ConstructeurRapportUnePage prêt à l'emploi — voir ConstructeurRapportUnePage pour la philosophie "toujours 1 page". `orientation` : 'portrait' (défaut, comportement inchangé) ou 'paysage'. */
  async function creerRapportUnePage({ titre, auteur = 'NEXUS OS', sujet, orientation = 'portrait' } = {}) {
    const doc = await PDFDocument.create();
    if (titre) doc.setTitle(titre);
    doc.setAuthor(auteur);
    if (sujet) doc.setSubject(sujet);
    doc.setCreator('NEXUS PDF Moteur');
    doc.setProducer('NEXUS PDF Moteur (pdf-lib)');
    const police = await doc.embedFont(StandardFonts.Helvetica);
    const policeGrasse = await doc.embedFont(StandardFonts.HelveticaBold);
    return new ConstructeurRapportUnePage(doc, police, policeGrasse, { orientation });
  }

  /**
   * Crée un document PDF A4 + polices standard embarquées (Helvetica,
   * gras) et un ConstructeurRapport prêt à l'emploi. `entete` :
   * { app, sousTitre } affiché en haut de chaque page.
   */
  async function creerRapport({ titre, auteur = 'NEXUS OS', sujet, entete } = {}) {
    const doc = await PDFDocument.create();
    if (titre) doc.setTitle(titre);
    doc.setAuthor(auteur);
    if (sujet) doc.setSubject(sujet);
    doc.setCreator('NEXUS PDF Moteur');
    doc.setProducer('NEXUS PDF Moteur (pdf-lib)');
    const police = await doc.embedFont(StandardFonts.Helvetica);
    const policeGrasse = await doc.embedFont(StandardFonts.HelveticaBold);
    return new ConstructeurRapport(doc, police, policeGrasse, entete);
  }

  /** Termine le document et renvoie les octets PDF (Uint8Array). */
  async function finaliser(constructeur) {
    return constructeur.doc.save();
  }

  /** La Web Share API (avec fichiers) est-elle disponible dans ce navigateur ? Utile pour n'afficher un bouton "Partager" que s'il a une chance de fonctionner. */
  function webShareDisponible() {
    return !!(global.navigator && navigator.canShare && navigator.share);
  }

  /**
   * Partage un PDF déjà généré via la Web Share API — iOS Safari 15+ et
   * Android Chrome, y compris en PWA installée sur l'écran d'accueil
   * (contourne le bug d'impression documenté de window.print() en mode
   * standalone iOS, audit "developpeur" 09/08/2026). Ne fait AUCUN repli
   * automatique — à appeler directement depuis un geste utilisateur
   * (clic), jamais après une longue attente asynchrone, certains
   * navigateurs (Safari en particulier) exigeant que le partage reste
   * proche du geste qui l'a déclenché. Retourne 'partage' | 'annule'
   * (l'utilisateur a fermé la feuille de partage — pas une erreur) |
   * 'echec' | 'indisponible' (pas de Web Share API ici, ou fichier PDF
   * refusé — au développeur de proposer `telechargerPdf` à la place).
   */
  async function partagerPdf(pdfBytes, nomFichier, { titre, texte } = {}) {
    if (!webShareDisponible()) return 'indisponible';
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    try {
      const fichier = new File([blob], nomFichier, { type: 'application/pdf' });
      if (!navigator.canShare({ files: [fichier] })) return 'indisponible';
      await navigator.share({ files: [fichier], title: titre || nomFichier, text: texte || '' });
      return 'partage';
    } catch (e) {
      if (e && e.name === 'AbortError') return 'annule';
      console.warn('NexusPdfMoteur : partage impossible.', e);
      return 'echec';
    }
  }

  /**
   * Téléchargement direct du Blob (lien <a download>) — fonctionne
   * partout. Sur iOS Safari en onglet normal (hors PWA standalone), le
   * navigateur ignore souvent l'attribut download pour un blob: et ouvre
   * simplement le PDF dans sa visionneuse native, avec son propre bouton
   * de partage/enregistrement — c'est un repli tout à fait correct, pas
   * un échec. Dernier recours seulement si même ça échoue : ouverture
   * dans un nouvel onglet. Retourne 'telechargement' | 'nouvel_onglet'.
   */
  async function telechargerPdf(pdfBytes, nomFichier) {
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    try {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = nomFichier; a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 15000);
      return 'telechargement';
    } catch (e) {
      console.warn('NexusPdfMoteur : téléchargement impossible, dernier recours (nouvel onglet).', e);
    }
    const urlSecours = URL.createObjectURL(blob);
    global.open(urlSecours, '_blank');
    return 'nouvel_onglet';
  }

  /**
   * Diffuse un PDF déjà généré en un seul appel — essaie `partagerPdf`
   * puis retombe sur `telechargerPdf` si le partage est indisponible ou
   * échoue (mais pas si l'utilisateur a simplement annulé). Pratique
   * pour un module qui veut un unique bouton "faire le bon choix" plutôt
   * que deux actions distinctes (voir `partagerPdf`/`telechargerPdf`
   * pour une UI à deux boutons, ex. "Partager" / "Ouvrir").
   */
  async function partagerOuTelechargerPdf(pdfBytes, nomFichier, options) {
    const resultat = await partagerPdf(pdfBytes, nomFichier, options);
    if (resultat === 'partage' || resultat === 'annule') return resultat;
    return telechargerPdf(pdfBytes, nomFichier);
  }

  global.NexusPdfMoteur = {
    creerRapport,
    finaliser,
    webShareDisponible,
    partagerPdf,
    telechargerPdf,
    partagerOuTelechargerPdf,
    ConstructeurRapport,
    COULEUR,
    A4,
    MARGE,
    LARGEUR_UTILE,
    // Rapport "1 page A4" (synthèse dirigeante) — voir ConstructeurRapportUnePage.
    creerRapportUnePage,
    ConstructeurRapportUnePage,
    MM,
    MARGE_1P,
    LARGEUR_UTILE_1P,
    ZONES_1P,
  };
})(window);
