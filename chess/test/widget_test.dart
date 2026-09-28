import "package:chess_app/main.dart";
import "package:chess_app/models/board.dart";
import "package:chess_app/models/piece.dart";
import "package:flutter_test/flutter_test.dart";

void main() {
  testWidgets("app starts on the sign-in screen when signed out", (tester) async {
    await tester.pumpWidget(const ChessApp());

    expect(find.text("CHESS"), findsOneWidget);
    expect(find.text("Sign in"), findsOneWidget);
    expect(find.text("Continue as guest"), findsOneWidget);
    expect(find.text("Quick match"), findsNothing);
  });

  testWidgets("choosing guest reveals the matchmaking menu", (tester) async {
    await tester.pumpWidget(const ChessApp());

    await tester.tap(find.text("Continue as guest"));
    await tester.pump();

    expect(find.text("Guest"), findsOneWidget);
    expect(find.text("Quick match"), findsOneWidget);
    expect(find.text("Host public game"), findsOneWidget);
  });

  group("Board", () {
    test("starts with the standard opening position", () {
      final board = Board.initial();

      expect(board.turn, "white");
      expect(board.squares.length, 32);
      expect(board.at("e1")?.type, "king");
      expect(board.at("e1")?.color, "white");
      expect(board.at("d8")?.type, "queen");
      expect(board.at("e5"), isNull);
    });

    test("flips the turn and empties the origin square", () {
      final board = Board.initial().applyMove("e2e4");

      expect(board.turn, "black");
      expect(board.at("e2"), isNull);
      expect(board.at("e4")?.type, "pawn");
    });

    test("removes a captured piece", () {
      final after = Board.initial()
          .applyMove("e2e4")
          .applyMove("d7d5")
          .applyMove("e4d5");

      expect(after.at("d5")?.color, "white");
      expect(after.at("d7"), isNull);
    });

    test("moves the rook when the king castles kingside", () {
      final board = Board.initial()
          .applyMove("e2e4")
          .applyMove("e7e5")
          .applyMove("g1f3")
          .applyMove("b8c6")
          .applyMove("f1e2")
          .applyMove("g8f6")
          .applyMove("e1g1");

      expect(board.at("g1")?.type, "king");
      expect(board.at("h1"), isNull);
      expect(board.at("f1")?.type, "rook");
    });

    test("promotes using the trailing promotion letter", () {
      final board = Board.initial().applyMove("e7e8q");

      expect(board.at("e8")?.type, "queen");
      expect(board.at("e8")?.color, "black");
    });

    test("moves the rook when the king castles queenside", () {
      final board = Board.initial()
          .applyMove("d2d4")
          .applyMove("d7d5")
          .applyMove("c1f4")
          .applyMove("c8f5")
          .applyMove("b1c3")
          .applyMove("b8c6")
          .applyMove("e1c1");

      expect(board.at("c1")?.type, "king");
      expect(board.at("a1"), isNull);
      expect(board.at("d1")?.type, "rook");
    });

    test("survives a malformed or unknown promotion letter", () {
      final short = Board.initial().applyMove("e2");
      expect(short.turn, "white");
      expect(short.at("e2")?.type, "pawn");

      final unknown = Board.initial().applyMove("e7e8x");
      expect(unknown.at("e8")?.type, "pawn");
    });

    test("ignores a move with no piece on the origin square", () {
      final board = Board.initial().applyMove("e4e5");

      expect(board.at("e4"), isNull);
      expect(board.turn, "white");
    });

    test("removes the captured pawn on an en passant capture", () {
      final board = Board.initial()
          .applyMove("e2e4")
          .applyMove("a7a6")
          .applyMove("e4e5")
          .applyMove("d7d5")
          .applyMove("e5d6");

      expect(board.at("d6")?.type, "pawn");
      expect(board.at("d6")?.color, "white");
      expect(board.at("d5"), isNull);
    });
  });

  group("Piece", () {
    test("exposes a glyph for every piece type", () {
      for (final type in ["king", "queen", "rook", "bishop", "knight", "pawn"]) {
        expect(Piece("white", type).glyph, isNotEmpty);
      }
    });
  });
}
