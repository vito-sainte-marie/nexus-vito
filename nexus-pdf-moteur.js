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
 *   <script src="nexus-pdf-moteur.js"></script>
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
      // Jeux de caractères réellement représentables par les polices
      // embarquées (Helvetica standard = encodage WinAnsi/cp1252) —
      // table figée (voir JEU_WINANSI ci-dessus), PAS une introspection
      // runtime de la police (cf. historique dans le commentaire de
      // JEU_WINANSI : getCharacterSet() s'est révélé peu fiable pour
      // les polices standard 14 en conditions réelles).
      this._jeuCarPolice = JEU_WINANSI;
      this._jeuCarPoliceGrasse = JEU_WINANSI;
      this.entete = entete || null; // { app, sousTitre } répété en haut de chaque page
      this.page = null;
      this.y = 0;
      this.numeroPage = 0;
      this._nouvellePage();
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
    _assainir(texte, gras) {
      const jeu = gras ? this._jeuCarPoliceGrasse : this._jeuCarPolice;
      let resultat = '';
      for (const car of String(texte == null ? '' : texte)) {
        if (jeu.has(car.codePointAt(0))) resultat += car;
      }
      return resultat.replace(/[ \t]{2,}/g, ' ').trim();
    }

    _nouvellePage() {
      this.page = this.doc.addPage([A4.largeur, A4.hauteur]);
      this.numeroPage += 1;
      this.y = A4.hauteur - MARGE;
      if (this.entete) this._dessinerBandeauEntete();
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
  };
})(window);
