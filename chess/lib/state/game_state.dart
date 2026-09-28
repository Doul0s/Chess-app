import "dart:async";

import "package:flutter/foundation.dart";
import "../models/board.dart";
import "../services/game_socket.dart";
import "session.dart";

enum GamePhase { idle, searching, waitingForOpponent, active, over }

class GameState extends ChangeNotifier {
  final Session session;
  final GameSocket _socket = GameSocket();

  GameState(this.session);

  GamePhase phase = GamePhase.idle;
  String? roomId;
  String? myColor;
  Board board = Board.initial();
  List<String> history = [];
  String? gameOverStatus;
  String? winner;

  /// Why matchmaking or joining a room failed, so the menu can explain it.
  String? connectionError;

  void Function(String reason)? onIllegalMove;
  Board? _preMoveBoard;
  StreamSubscription<ServerEvent>? _subscription;

  bool get isMyTurn => phase == GamePhase.active && board.turn == myColor;

  Map<String, String> get _authParams => session.token != null ? {"token": session.token!} : {};

  void quickMatch() {
    _reset(GamePhase.searching);
    _listen(
      _socket.connect("/rooms", params: _authParams),
      onText: _openRoom,
      closedMessage: "Could not reach the server.",
    );
  }

  void createInvite(String visibility) {
    _reset(GamePhase.waitingForOpponent);
    var gotRoomId = false;
    _listen(
      _socket.connect("/invite", params: {..._authParams, "visibility": visibility}),
      onText: (text) {
        if (gotRoomId) {
          _assignColor(text);
        } else {
          gotRoomId = true;
          roomId = text;
          notifyListeners();
        }
      },
      closedMessage: "The room closed before your opponent joined.",
    );
  }

  void joinRoom(String id) {
    _reset(GamePhase.waitingForOpponent);
    _openRoom(id);
  }

  void _openRoom(String id) {
    // The matchmaking socket has served its purpose; the game socket replaces it.
    _cancelSubscription();
    roomId = id;
    phase = GamePhase.waitingForOpponent;
    notifyListeners();
    _listen(
      _socket.connect("/rooms/$id", params: _authParams),
      onText: _assignColor,
      closedMessage: "That room is full or no longer exists.",
    );
  }

  void _assignColor(String color) {
    if (color != "white" && color != "black") return;
    myColor = color;
    phase = GamePhase.active;
    board = Board.initial();
    history = [];
    notifyListeners();
  }

  void _listen(
    Stream<ServerEvent> stream, {
    required void Function(String) onText,
    required String closedMessage,
  }) {
    _cancelSubscription();
    _subscription = stream.listen(
      (event) => _handle(event, onText),
      onError: (Object _) => _fail(closedMessage),
      onDone: () {
        // A close is only a failure while we are still waiting to start.
        if (phase == GamePhase.searching || phase == GamePhase.waitingForOpponent) {
          _fail(closedMessage);
        }
      },
    );
  }

  void _handle(ServerEvent event, void Function(String) onText) {
    switch (event.type) {
      case EventType.text:
        onText(event.text!);
        return;
      case EventType.move:
        _preMoveBoard = null;
        board = board.applyMove(event.move!);
        history.add(event.move!);
        break;
      case EventType.error:
        _rollbackPendingMove();
        onIllegalMove?.call(event.reason!);
        break;
      case EventType.gameOver:
        _preMoveBoard = null;
        phase = GamePhase.over;
        gameOverStatus = event.status;
        winner = event.winner;
        break;
      case EventType.opponentDisconnected:
        _preMoveBoard = null;
        phase = GamePhase.over;
        gameOverStatus = "opponent_disconnected";
        break;
      case EventType.gameNotStarted:
        return;
    }
    notifyListeners();
  }

  void _rollbackPendingMove() {
    if (_preMoveBoard == null) return;
    board = _preMoveBoard!;
    if (history.isNotEmpty) history.removeLast();
    _preMoveBoard = null;
  }

  void makeMove(String from, String to, {String? promotion}) {
    if (!isMyTurn) return;
    final piece = board.at(from);
    if (piece == null || piece.color != myColor) return;
    final target = board.at(to);
    if (target != null && target.color == piece.color) return;

    final move = "$from$to${promotion ?? ''}";
    _preMoveBoard = board;
    board = board.applyMove(move);
    history.add(move);
    _socket.sendMove(move);
    notifyListeners();
  }

  void _reset(GamePhase next) {
    _cancelSubscription();
    _socket.close();
    board = Board.initial();
    history = [];
    roomId = null;
    myColor = null;
    gameOverStatus = null;
    winner = null;
    _preMoveBoard = null;
    connectionError = null;
    phase = next;
    notifyListeners();
  }

  void _fail(String message) {
    if (phase == GamePhase.idle || phase == GamePhase.over) return;
    _reset(GamePhase.idle);
    connectionError = message;
    notifyListeners();
  }

  void _cancelSubscription() {
    _subscription?.cancel();
    _subscription = null;
  }

  void leave() {
    _reset(GamePhase.idle);
  }
}
