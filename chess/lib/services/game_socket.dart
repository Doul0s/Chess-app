import "dart:convert";
import "package:web_socket_channel/web_socket_channel.dart";
import "../config.dart";

enum EventType { text, move, error, gameOver, opponentDisconnected, gameNotStarted }

class ServerEvent {
  final EventType type;
  final String? text; // raw string payload (room id, or "white"/"black")
  final String? move;
  final String? reason;
  final String? status;
  final String? winner;

  ServerEvent._(this.type, {this.text, this.move, this.reason, this.status, this.winner});

  factory ServerEvent.parse(String raw) {
    try {
      final json = jsonDecode(raw);
      if (json is Map<String, dynamic>) {
        switch (json["type"]) {
          case "move":
            return ServerEvent._(EventType.move, move: json["move"]);
          case "error":
            return ServerEvent._(EventType.error, reason: json["reason"]);
          case "game_over":
            return ServerEvent._(EventType.gameOver, status: json["status"], winner: json["winner"]);
          case "opponent_disconnected":
            return ServerEvent._(EventType.opponentDisconnected);
          case "game_not_started":
            return ServerEvent._(EventType.gameNotStarted);
        }
      }
    } catch (_) {}
    return ServerEvent._(EventType.text, text: raw);
  }
}

class GameSocket {
  WebSocketChannel? _channel;

  Stream<ServerEvent> connect(String path, {Map<String, String>? params}) {
    final uri = Uri.parse("$wsBase$path").replace(queryParameters: params);
    _channel = WebSocketChannel.connect(uri);
    return _channel!.stream.map((raw) => ServerEvent.parse(raw is String ? raw : utf8.decode(raw as List<int>)));
  }

  void sendMove(String move) => _channel?.sink.add(move);

  void close() {
    _channel?.sink.close();
    _channel = null;
  }
}
