import "dart:convert";
import "package:http/http.dart" as http;
import "../config.dart";

class AuthResult {
  final String token;
  final String userId;
  final int rating;
  AuthResult(this.token, this.userId, this.rating);
}

class ApiException implements Exception {
  final String message;
  ApiException(this.message);
}

class ApiService {
  /// Decodes a JSON object body, tolerating non-JSON (proxy/gateway) error pages.
  static Map<String, dynamic> _decodeObject(String raw) {
    try {
      final decoded = jsonDecode(raw);
      if (decoded is Map<String, dynamic>) return decoded;
    } catch (_) {}
    return const {};
  }

  Future<AuthResult> _auth(String path, String username, String password) async {
    final res = await http.post(
      Uri.parse("$httpBase$path"),
      headers: {"Content-Type": "application/json"},
      body: jsonEncode({"username": username, "password": password}),
    );
    final body = _decodeObject(res.body);
    if (res.statusCode >= 400) throw ApiException(body["error"] ?? "request_failed");
    final token = body["token"];
    final userId = body["userId"];
    if (token is! String || userId is! String) throw ApiException("malformed_response");
    return AuthResult(token, userId, (body["rating"] as num?)?.toInt() ?? 0);
  }

  Future<AuthResult> register(String username, String password) => _auth("/register", username, password);
  Future<AuthResult> login(String username, String password) => _auth("/login", username, password);

  Future<List<String>> publicRooms() async {
    final res = await http.get(Uri.parse("$httpBase/rooms/public"));
    if (res.statusCode >= 400) throw ApiException("request_failed");
    final decoded = jsonDecode(res.body);
    if (decoded is! List) throw ApiException("malformed_response");
    return decoded.whereType<String>().toList();
  }
}
