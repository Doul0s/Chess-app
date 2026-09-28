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

  void Function(String reason)? onIllegalMove;
  Board? _preMoveBoard;

  bool get isMyTurn => phase == GamePhase.active && board.turn == myColor;

  Map<String, String> get _authParams => session.token != null ? {"token": session.token!} : {};

  void quickMatch() {
    _reset(GamePhase.searching);
    _socket.connect("/rooms", params: _authParams).listen((event) {
      if (event.type == EventType.text) _openRoom(event.text!);
    });
  }

  void createInvite(String visibility) {
    _reset(GamePhase.waitingForOpponent);
    final stream = _socket.connect("/invite", params: {..._authParams, "visibility": visibility});
    var gotRoomId = false;
    _listen(stream, onText: (text) {
      if (!gotRoomId) {
        gotRoomId = true;
        roomId = text;
        notifyListeners();
      } else {
        _assignColor(text);
      }
    });
  }

  void joinRoom(String id) {
    _reset(GamePhase.waitingForOpponent);
    roomId = id;
    _openRoom(id);
  }

  void _openRoom(String id) {
    roomId = id;
    phase = GamePhase.waitingForOpponent;
    notifyListeners();
    final stream = _socket.connect("/rooms/$id", params: _authParams);
    _listen(stream, onText: _assignColor);
  }

  void _assignColor(String color) {
    if (color != "white" && color != "black") return;
    myColor = color;
    phase = GamePhase.active;
    board = Board.initial();
    history = [];
    notifyListeners();
  }

  void _listen(Stream<ServerEvent> stream, {required void Function(String) onText}) {
    stream.listen((event) {
      switch (event.type) {
        case EventType.text:
          onText(event.text!);
          return;
        case EventType.move:
          board = board.applyMove(event.move!);
          history.add(event.move!);
          break;
        case EventType.error:
          if (_preMoveBoard != null) {
            board = _preMoveBoard!;
            history.removeLast();
            _preMoveBoard = null;
          }
          onIllegalMove?.call(event.reason!);
          break;
        case EventType.gameOver:
          phase = GamePhase.over;
          gameOverStatus = event.status;
          winner = event.winner;
          break;
        case EventType.opponentDisconnected:
          phase = GamePhase.over;
          gameOverStatus = "opponent_disconnected";
          break;
        case EventType.gameNotStarted:
          return;
      }
      notifyListeners();
    });
  }

  void makeMove(String from, String to, {String? promotion}) {
    if (!isMyTurn) return;
    final move = "$from$to${promotion ?? ''}";
    _preMoveBoard = board;
    board = board.applyMove(move);
    history.add(move);
    _socket.sendMove(move);
    notifyListeners();
  }

  void _reset(GamePhase next) {
    board = Board.initial();
    history = [];
    roomId = null;
    myColor = null;
    gameOverStatus = null;
    winner = null;
    phase = next;
    notifyListeners();
  }

  void leave() {
    _socket.close();
    _reset(GamePhase.idle);
  }
}
