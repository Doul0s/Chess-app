import "package:flutter/material.dart";
import "package:flutter/services.dart";
import "package:provider/provider.dart";
import "../state/game_state.dart";
import "../widgets/chess_board.dart";

class GameScreen extends StatefulWidget {
  const GameScreen({super.key});

  @override
  State<GameScreen> createState() => _GameScreenState();
}

class _GameScreenState extends State<GameScreen> {
  String? _selected;
  bool _turnAlerted = false;
  bool _gameOverShown = false;
  late GameState _game;

  @override
  void initState() {
    super.initState();
    _game = context.read<GameState>();
    _game.onIllegalMove = (reason) {
      setState(() => _selected = null);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text("Illegal move: $reason")));
    };
  }

  @override
  void dispose() {
    _game.onIllegalMove = null;
    super.dispose();
  }

  void _onTap(String square, GameState game) {
    final piece = game.board.at(square);
    final mine = piece != null && piece.color == game.myColor;

    if (_selected == null) {
      if (mine && game.isMyTurn) setState(() => _selected = square);
      return;
    }
    if (square == _selected) {
      setState(() => _selected = null);
      return;
    }
    if (mine) {
      setState(() => _selected = square);
      return;
    }

    final movingPiece = game.board.at(_selected!);
    final promotion = movingPiece?.type == "pawn" && (square.endsWith("8") || square.endsWith("1")) ? "q" : null;
    game.makeMove(_selected!, square, promotion: promotion);
    setState(() => _selected = null);
  }

  void _maybeShowGameOver(GameState game) {
    if (game.phase != GamePhase.over || _gameOverShown) return;
    _gameOverShown = true;
    final youWon = game.winner != null && game.winner == game.myColor;
    final message = game.gameOverStatus == "opponent_disconnected"
        ? "Your opponent disconnected."
        : game.winner == null
            ? "Game over: ${game.gameOverStatus}."
            : youWon
                ? "You won by ${game.gameOverStatus}!"
                : "You lost by ${game.gameOverStatus}.";
    WidgetsBinding.instance.addPostFrameCallback((_) {
      showDialog(
        context: context,
        builder: (_) => AlertDialog(
          backgroundColor: Colors.grey.shade900,
          title: const Text("Game over", style: TextStyle(color: Colors.white)),
          content: Text(message, style: const TextStyle(color: Colors.white70)),
          actions: [
            TextButton(
              onPressed: () {
                Navigator.of(context).pop();
                game.leave();
              },
              child: const Text("Back to menu"),
            ),
          ],
        ),
      );
    });
  }

  void _maybeAlertTurn(GameState game) {
    if (!game.isMyTurn) {
      _turnAlerted = false;
      return;
    }
    if (_turnAlerted) return;
    _turnAlerted = true;
    WidgetsBinding.instance.addPostFrameCallback((_) => HapticFeedback.mediumImpact());
  }

  @override
  Widget build(BuildContext context) {
    final game = context.watch<GameState>();
    _maybeAlertTurn(game);
    _maybeShowGameOver(game);

    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(
        child: Column(
          children: [
            const SizedBox(height: 16),
            Text(
              game.isMyTurn ? "Your move" : "Opponent's move",
              style: TextStyle(color: game.isMyTurn ? Colors.white : Colors.white38, fontSize: 18),
            ),
            const SizedBox(height: 16),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: ChessBoard(
                board: game.board,
                orientation: game.myColor ?? "white",
                selected: _selected,
                onTap: (square) => _onTap(square, game),
              ),
            ),
            const Spacer(),
            TextButton(onPressed: game.leave, child: const Text("Resign / leave")),
          ],
        ),
      ),
    );
  }
}
