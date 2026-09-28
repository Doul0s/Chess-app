import "package:flutter/material.dart";
import "package:flutter/services.dart";
import "package:provider/provider.dart";
import "../state/game_state.dart";
import "../theme.dart";
import "../widgets/chess_board.dart";
import "../widgets/ui.dart";

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
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text("ILLEGAL MOVE: ${reason.toUpperCase()}")));
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
    final disconnected = game.gameOverStatus == "opponent_disconnected";
    final title = disconnected
        ? "OPPONENT LEFT"
        : game.winner == null
            ? "DRAW"
            : game.winner == game.myColor
                ? "YOU WON"
                : "YOU LOST";
    final detail = (game.gameOverStatus ?? "").replaceAll("_", " ").toUpperCase();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      showDialog(
        context: context,
        barrierDismissible: false,
        builder: (_) => AlertDialog(
          title: Text(title, style: const TextStyle(color: accent, letterSpacing: 4, fontWeight: FontWeight.bold)),
          content: Text(detail, style: const TextStyle(color: dim, letterSpacing: 2)),
          actions: [
            TextButton(
              onPressed: () {
                Navigator.of(context).pop();
                game.leave();
              },
              child: const Text("MENU", style: TextStyle(color: Colors.white, letterSpacing: 2)),
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

    final me = game.myColor ?? "white";
    final opponent = me == "white" ? "black" : "white";
    final active = game.phase == GamePhase.active;
    final user = game.session;
    final myName = "${(user.username ?? "Guest").toUpperCase()}${user.rating != null ? "  ${user.rating}" : ""}";

    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            const SizedBox(height: 12),
            _PlayerBar(name: "OPPONENT", side: opponent, toMove: active && !game.isMyTurn),
            const SizedBox(height: 8),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: ChessBoard(
                board: game.board,
                orientation: me,
                selected: _selected,
                lastMove: game.history.isEmpty ? null : game.history.last,
                onTap: (square) => _onTap(square, game),
              ),
            ),
            const SizedBox(height: 8),
            _PlayerBar(name: myName, side: me, toMove: game.isMyTurn),
            const SizedBox(height: 12),
            Expanded(child: _MoveList(moves: game.history)),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
              child: MenuButton(label: "Resign", onPressed: game.leave),
            ),
          ],
        ),
      ),
    );
  }
}

class _PlayerBar extends StatelessWidget {
  final String name;
  final String side;
  final bool toMove;

  const _PlayerBar({required this.name, required this.side, required this.toMove});

  @override
  Widget build(BuildContext context) {
    final white = side == "white";
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(border: Border(left: BorderSide(color: toMove ? accent : line, width: 3))),
      child: Row(
        children: [
          Container(
            width: 10,
            height: 10,
            decoration: BoxDecoration(
              color: white ? Colors.white : Colors.transparent,
              border: Border.all(color: white ? Colors.white : dim),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(child: Text(name, overflow: TextOverflow.ellipsis, style: const TextStyle(letterSpacing: 2))),
          if (toMove) const Text("TO MOVE", style: TextStyle(color: accent, fontSize: 12, letterSpacing: 2)),
        ],
      ),
    );
  }
}

class _MoveList extends StatelessWidget {
  final List<String> moves;

  const _MoveList({required this.moves});

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 28),
      reverse: true,
      child: Align(
        alignment: Alignment.topLeft,
        child: Wrap(
          spacing: 16,
          runSpacing: 4,
          children: [
            for (var i = 0; i < moves.length; i += 2)
              Text(
                "${i ~/ 2 + 1}. ${moves[i]}${i + 1 < moves.length ? " ${moves[i + 1]}" : ""}",
                style: const TextStyle(color: dim, fontSize: 12),
              ),
          ],
        ),
      ),
    );
  }
}
