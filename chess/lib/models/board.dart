import "piece.dart";

class Board {
  final Map<String, Piece> squares;
  final String turn;

  const Board(this.squares, this.turn);

  factory Board.initial() {
    const back = ["rook", "knight", "bishop", "queen", "king", "bishop", "knight", "rook"];
    final files = "abcdefgh".split("");
    final squares = <String, Piece>{};
    for (var i = 0; i < 8; i++) {
      squares["${files[i]}1"] = Piece("white", back[i]);
      squares["${files[i]}2"] = const Piece("white", "pawn");
      squares["${files[i]}7"] = const Piece("black", "pawn");
      squares["${files[i]}8"] = Piece("black", back[i]);
    }
    return Board(squares, "white");
  }

  Piece? at(String square) => squares[square];

  /// Applies a LAN move (e.g. "e2e4", "e7e8q") and returns the new board.
  /// Infers castling (king moves 2 files) and en passant (pawn moves
  /// diagonally into an empty square) the same way the server does.
  Board applyMove(String move) {
    if (move.length < 4) return this;
    final from = move.substring(0, 2);
    final to = move.substring(2, 4);
    final promotion = move.length > 4 ? move[4] : null;

    final next = Map<String, Piece>.from(squares);
    final piece = next.remove(from);
    if (piece == null) return this;

    if (piece.type == "pawn" && from[0] != to[0] && !next.containsKey(to)) {
      next.remove("${to[0]}${from[1]}"); // en passant capture
    }

    if (piece.type == "king" && (to.codeUnitAt(0) - from.codeUnitAt(0)).abs() == 2) {
      final rank = from[1];
      final rookFrom = to.codeUnitAt(0) > from.codeUnitAt(0) ? "h$rank" : "a$rank";
      final rook = next.remove(rookFrom);
      if (rook != null) {
        next[rookFrom == "h$rank" ? "f$rank" : "d$rank"] = rook;
      }
    }

    const promoted = {"q": "queen", "r": "rook", "b": "bishop", "n": "knight"};
    final promotionType = promotion == null ? null : promoted[promotion];
    next[to] = promotionType == null ? piece : Piece(piece.color, promotionType);

    return Board(next, turn == "white" ? "black" : "white");
  }
}
