// NEXUS — lecteur OCR Apple Vision (JAUGEAGE-OCR-2-20261022, étape A).
//
// Logique d'assemblage pure, sans import Vision et sans image réelle :
// isolée ici pour rester testable sans l'iMac. La reconnaissance elle-même
// (qui a besoin de Vision et donc de macOS) vit dans vision_ocr.swift.

import Foundation

/// Contrat de sortie (décision-3 de JAUGEAGE-OCR-2-20261022).
///
/// Repère : celui de Vision. Origine en bas à gauche de l'image, valeurs
/// normalisées 0...1 ; `x`,`y` sont le coin bas-gauche de la boîte, `w`,`h`
/// sa largeur et sa hauteur. Un `y` plus grand est plus haut dans l'image.
///
/// JSON d'une réussite (une ligne sur stdout) :
///   {"text":"…","confidence":0.93,"lignes":[{"t":"…","c":0.9,"x":…,"y":…,"w":…,"h":…,
///     "fragments":[{"t":"…","c":0.9,"x":…,"y":…,"w":…,"h":…}, …]}, …]}
/// - `lignes` : du haut vers le bas ; `c` d'une ligne = la plus basse des
///   confiances de ses fragments (une ligne n'est pas plus sûre que son
///   maillon faible) ; sa boîte est l'union de celles de ses fragments.
/// - `fragments` : toujours conservés, triés par `x` dans la ligne.
/// - `text` et `confidence` (moyenne de tous les fragments) restent, en
///   complément pour l'ancien appelant, jamais en remplacement.
/// JSON d'une erreur : {"error":"…"}.
struct Fragment: Codable, Equatable {
    let t: String
    let c: Double
    let x: Double
    let y: Double
    let w: Double
    let h: Double
}

struct Ligne: Codable, Equatable {
    let t: String
    let c: Double
    let x: Double
    let y: Double
    let w: Double
    let h: Double
    let fragments: [Fragment]
}

struct OCRResult: Codable, Equatable {
    let text: String
    let confidence: Double
    let lignes: [Ligne]
}

struct OCRError: Codable, Equatable {
    let error: String
}

/// Un fragment appartient à la même ligne qu'un autre si leurs centres
/// verticaux diffèrent de moins de la moitié de la plus grande des deux
/// hauteurs ; il lui est rattaché s'il n'en est pas séparé par plus de
/// `ecartHorizontalMax` (fraction de la largeur de l'image). Ce second seuil
/// empêche de fusionner deux colonnes éloignées (écran à deux colonnes de
/// réservoirs) tout en gardant ensemble un libellé et sa valeur (écart
/// mesuré ≈ 0,03 sur la photo Veeder-Root du 21/10).
let ecartHorizontalMax = 0.08

private func centreY(_ f: Fragment) -> Double { f.y + f.h / 2 }

/// Regroupe des fragments en lignes ordonnées du haut vers le bas.
func regrouperEnLignes(_ fragments: [Fragment]) -> [Ligne] {
    var restants = fragments.sorted { centreY($0) > centreY($1) }
    var lignes: [Ligne] = []
    while !restants.isEmpty {
        let tete = restants.removeFirst()
        var groupe = [tete]
        var i = 0
        while i < restants.count {
            let f = restants[i]
            let memeHauteur = groupe.contains {
                abs(centreY($0) - centreY(f)) < max($0.h, f.h) / 2
            }
            if memeHauteur { groupe.append(f); restants.remove(at: i) } else { i += 1 }
        }
        groupe.sort { $0.x < $1.x }
        // Coupe le groupe là où l'écart horizontal dépasse le seuil.
        var morceaux: [[Fragment]] = [[groupe[0]]]
        var finCourante = groupe[0].x + groupe[0].w
        for f in groupe.dropFirst() {
            if f.x - finCourante > ecartHorizontalMax {
                morceaux.append([f])
                finCourante = f.x + f.w
            } else {
                morceaux[morceaux.count - 1].append(f)
                finCourante = max(finCourante, f.x + f.w)
            }
        }
        for m in morceaux { lignes.append(construireLigne(m)) }
    }
    // Ordre de lecture : haut→bas, puis gauche→droite à hauteur comparable.
    return lignes.sorted {
        let a = $0.y + $0.h / 2, b = $1.y + $1.h / 2
        if abs(a - b) < max($0.h, $1.h) / 2 { return $0.x < $1.x }
        return a > b
    }
}

private func construireLigne(_ fragments: [Fragment]) -> Ligne {
    let x0 = fragments.map(\.x).min()!
    let y0 = fragments.map(\.y).min()!
    let x1 = fragments.map { $0.x + $0.w }.max()!
    let y1 = fragments.map { $0.y + $0.h }.max()!
    return Ligne(
        t: fragments.map(\.t).joined(separator: " "),
        c: fragments.map(\.c).min()!,
        x: x0, y: y0, w: x1 - x0, h: y1 - y0,
        fragments: fragments
    )
}

/// Assemble les fragments reconnus en un résultat : lignes regroupées et
/// ordonnées, texte joint par '\n', confiance moyenne en complément.
func assemblerResultat(_ fragments: [Fragment]) -> OCRResult {
    guard !fragments.isEmpty else {
        return OCRResult(text: "", confidence: 0, lignes: [])
    }
    let lignes = regrouperEnLignes(fragments)
    let moyenne = fragments.map(\.c).reduce(0, +) / Double(fragments.count)
    return OCRResult(text: lignes.map(\.t).joined(separator: "\n"), confidence: moyenne, lignes: lignes)
}

func encoderJSON<T: Encodable>(_ valeur: T) -> String {
    let encodeur = JSONEncoder()
    guard let donnees = try? encodeur.encode(valeur),
          let ligne = String(data: donnees, encoding: .utf8) else {
        return "{\"error\":\"encodage JSON impossible\"}"
    }
    return ligne
}
