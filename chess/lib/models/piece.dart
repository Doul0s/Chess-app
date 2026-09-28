class Piece {
  final String color; // "white" | "black"
  final String type; // king, queen, rook, bishop, knight, pawn

  const Piece(this.color, this.type);

  static const _glyphs = {
    "king": "♔",
    "queen": "♕",
    "rook": "♖",
    "bishop": "♗",
    "knight": "♘",
    "pawn": "♙",
  };

  String get glyph => _glyphs[type]!;
}
