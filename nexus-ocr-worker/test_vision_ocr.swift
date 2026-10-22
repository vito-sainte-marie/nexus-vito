// NEXUS — tests synthétiques du lecteur Vision (JAUGEAGE-OCR-2-20261022,
// étape A). N'importe pas Vision et n'utilise aucune image réelle : ils
// exercent uniquement la logique d'assemblage (vision_ocr_core.swift), pure
// et donc testable sans l'iMac. Les observations sont fabriquées à la main
// pour représenter les deux usages visés par ce lot : une lecture directe de
// l'écran Veeder-Root, et un bon scanné.
//
// Aucun Vision requis pour ce fichier (compilable sur tout Mac) :
//   swiftc vision_ocr_core.swift test_vision_ocr.swift -o test_vision_ocr
//   ./test_vision_ocr

import Foundation

var verifications = 0
var echecs = 0

func verifier(_ condition: Bool, _ message: String) {
    verifications += 1
    if condition {
        print("OK — \(message)")
    } else {
        echecs += 1
        print("ÉCHEC — \(message)")
    }
}

func frag(_ t: String, _ c: Double, _ x: Double, _ y: Double, _ w: Double, _ h: Double = 0.01) -> Fragment {
    Fragment(t: t, c: c, x: x, y: y, w: w, h: h)
}

@main
struct TestsVision {
    static func main() {
    // --- Grille 2 × 2 de réservoirs (valeurs relevées sur la photo Veeder-Root du
    // 21/10) : chaque libellé garde sa valeur, chaque colonne reste séparée. ---
    let grille = [
        frag("RESERVOIR 4", 0.5, 0.558, 0.446, 0.12),
        frag("RESERVOIR 1", 0.5, 0.199, 0.522, 0.12),
        frag("Volume Produit", 1.0, 0.672, 0.480, 0.116),
        frag("22710", 1.0, 0.463, 0.481, 0.047),
        frag("RESERVOIR 2", 1.0, 0.556, 0.519, 0.12),
        frag("Volume Produit", 1.0, 0.315, 0.481, 0.116),
        frag("8081", 1.0, 0.835, 0.480, 0.047),
        frag("RESERVOIR 3", 0.5, 0.202, 0.448, 0.12),
    ]
    let rg = assemblerResultat(grille)
    let textes = rg.lignes.map(\.t)
    verifier(rg.lignes.count == 6, "Grille 2×2 : six lignes (quatre en-têtes, deux rangées de volumes par colonne regroupées)")
    verifier(textes.contains("Volume Produit 22710"), "Grille 2×2 : libellé et valeur de la colonne gauche restent ensemble")
    verifier(textes.contains("Volume Produit 8081"), "Grille 2×2 : libellé et valeur de la colonne droite restent ensemble")
    let ligneHaut = rg.lignes.first { $0.t == "RESERVOIR 1" }
    let ligneDroite = rg.lignes.first { $0.t == "RESERVOIR 2" }
    verifier(ligneHaut != nil && ligneDroite != nil && ligneHaut!.x < ligneDroite!.x, "Grille 2×2 : RESERVOIR 1 à gauche de RESERVOIR 2 (repère x conservé)")
    verifier(
        rg.lignes.firstIndex { $0.t == "RESERVOIR 1" }! < rg.lignes.firstIndex { $0.t == "RESERVOIR 3" }!,
        "Grille 2×2 : RESERVOIR 1 au-dessus de RESERVOIR 3 (repère y conservé)"
    )

    // --- Colonnes éloignées : deux fragments à la même hauteur, écart ≈ 0,15 :
    // jamais fusionnés en une ligne. ---
    let eloignes = assemblerResultat([frag("A", 0.9, 0.10, 0.50, 0.05), frag("B", 0.9, 0.30, 0.50, 0.05)])
    verifier(eloignes.lignes.count == 2, "Colonnes éloignées : deux lignes, pas de fusion")
    let proches = assemblerResultat([frag("Volume", 0.9, 0.10, 0.50, 0.10), frag("22710", 0.9, 0.23, 0.50, 0.05)])
    verifier(proches.lignes.count == 1 && proches.lignes[0].t == "Volume 22710", "Libellé et valeur voisins (écart ≈ 0,03) : une seule ligne")
    verifier(proches.lignes[0].fragments.count == 2, "Les fragments sont conservés dans la ligne")

    // --- Ligne à faible confiance identifiable : confiance propre = minimum de
    // ses fragments, boîte = union. ---
    let melange = assemblerResultat([frag("Volume", 0.95, 0.10, 0.50, 0.10), frag("2271O", 0.30, 0.23, 0.50, 0.05)])
    verifier(abs(melange.lignes[0].c - 0.30) < 0.0001, "Ligne à faible confiance : sa confiance est celle du fragment le plus faible")
    verifier(abs(melange.lignes[0].x - 0.10) < 1e-9 && abs(melange.lignes[0].w - 0.18) < 1e-9, "Boîte de la ligne = union des fragments")
    let parasites = assemblerResultat(grille + [frag("RCuons", 0.3, 0.05, 0.10, 0.08)])
    verifier(parasites.lignes.contains { $0.t == "RCuons" && $0.c < 0.5 }, "Parasite à faible confiance repérable sous le seuil 0,5")

    // --- Tri : l'ordre d'entrée ne change pas le résultat ---
    let ordre1 = assemblerResultat(grille).text
    let ordre2 = assemblerResultat(grille.reversed()).text
    verifier(ordre1 == ordre2, "Résultat indépendant de l'ordre d'entrée")
    verifier(abs(rg.confidence - 0.8125) < 0.0001, "Confiance moyenne conservée en complément")

    // --- Cas limite : aucune observation (image illisible ou vide pour Vision) ---
    let resultatVide = assemblerResultat([])
    verifier(resultatVide.text == "", "Aucune observation : texte vide")
    verifier(resultatVide.confidence == 0, "Aucune observation : confiance à zéro, jamais négative ni NaN")

    // --- Contrat JSON lu côté Python par _ocr_image (hors périmètre de ce lot,
    // mais le contrat de sortie est fixé ici) ---
    let jsonResultat = encoderJSON(OCRResult(text: "V1 123456", confidence: 0.95, lignes: []))
    verifier(jsonResultat.contains("\"text\":\"V1 123456\""), "JSON du résultat contient le champ text")
    verifier(jsonResultat.contains("\"confidence\":0.95"), "JSON du résultat contient la confiance")
    let jsonLignes = encoderJSON(eloignes)
    verifier(jsonLignes.contains("\"lignes\"") && jsonLignes.contains("\"fragments\""), "JSON contient lignes et fragments")

    let jsonErreur = encoderJSON(OCRError(error: "image illisible : /tmp/x.jpg"))
    verifier(jsonErreur.contains("image illisible"), "JSON d'erreur contient le message")

    if echecs == 0 {
        print("Tous les tests synthétiques sont verts (\(verifications) vérifications).")
        exit(0)
    } else {
        print("\(echecs)/\(verifications) échec(s) sur les tests synthétiques.")
        exit(1)
    }
    }
}
