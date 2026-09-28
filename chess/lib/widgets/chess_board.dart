import "package:flutter/material.dart";
import "../models/board.dart";

class ChessBoard extends StatelessWidget {
  final Board board;
  final String orientation; // "white" | "black" — which side is at the bottom
  final String? selected;
  final void Function(String square) onTap;

  const ChessBoard({
    super.key,
    required this.board,
    required this.orientation,
    required this.selected,
    required this.onTap,
  });

  List<String> get _squares {
    final files = "abcdefgh".split("");
    final ranks = List.generate(8, (i) => "${8 - i}");
    if (orientation == "black") {
      files.replaceRange(0, 8, files.reversed);
      ranks.replaceRange(0, 8, ranks.reversed);
    }
    return [for (final r in ranks) for (final f in files) "$f$r"];
  }

  @override
  Widget build(BuildContext context) {
    return AspectRatio(
      aspectRatio: 1,
      child: GridView.count(
        crossAxisCount: 8,
        physics: const NeverScrollableScrollPhysics(),
        children: _squares.map((square) {
          final piece = board.at(square);
          final isSelected = square == selected;
          return GestureDetector(
            onTap: () => onTap(square),
            child: Container(
              decoration: BoxDecoration(
                border: Border.all(color: Colors.white24, width: 0.5),
                color: isSelected ? Colors.white12 : Colors.black,
              ),
              alignment: Alignment.center,
              child: piece == null
                  ? null
                  : Text(
                      piece.glyph,
                      style: TextStyle(
                        fontSize: 28,
                        color: piece.color == "white" ? Colors.white : Colors.grey.shade500,
                      ),
                    ),
            ),
          );
        }).toList(),
      ),
    );
  }
}
