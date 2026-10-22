// NEXUS — lecteur OCR Apple Vision (JAUGEAGE-OCR-2-20261022, étape A).
//
// Logique d'assemblage pure, sans import Vision et sans image réelle :
// isolée ici pour rester testable sans l'iMac. La reconnaissance elle-même
// (qui a besoin de Vision et donc de macOS) vit dans vision_ocr.swift.

import Foundation

struct OCRResult: Codable, Equatable {
    let text: String
    let confidence: Double
}

struct OCRError: Codable, Equatable {
    let error: String
}

/// Une observation Vision réduite à ce dont l'assemblage a besoin : la
/// hauteur (`y`, repère Vision — origine en bas à gauche, normalisé 0...1),
/// le texte du meilleur candidat et sa confiance. Permet de tester le tri
/// et la moyenne sans jamais appeler Vision.
struct ObservationTexte {
    let y: Double
    let texte: String
    let confiance: Double
}

/// Assemble des observations en un résultat unique : tri du haut vers le bas
/// de l'image (y décroissant dans le repère Vision), lignes jointes par
/// '\n', confiance moyenne des candidats retenus. Sans cela, les quatre
/// blocs de l'écran Veeder-Root (ou les lignes d'un bon scanné) sortiraient
/// de Vision dans un ordre non garanti.
func assemblerResultat(_ observations: [ObservationTexte]) -> OCRResult {
    guard !observations.isEmpty else {
        return OCRResult(text: "", confidence: 0)
    }
    let triees = observations.sorted { $0.y > $1.y }
    let texte = triees.map(\.texte).joined(separator: "\n")
    let confiance = triees.map(\.confiance).reduce(0, +) / Double(triees.count)
    return OCRResult(text: texte, confidence: confiance)
}

func encoderJSON<T: Encodable>(_ valeur: T) -> String {
    let encodeur = JSONEncoder()
    guard let donnees = try? encodeur.encode(valeur),
          let ligne = String(data: donnees, encoding: .utf8) else {
        return "{\"error\":\"encodage JSON impossible\"}"
    }
    return ligne
}
