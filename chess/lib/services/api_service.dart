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
  Future<AuthResult> _auth(String path, String username, String password) async {
    final res = await http.post(
      Uri.parse("$httpBase$path"),
      headers: {"Content-Type": "application/json"},
      body: jsonEncode({"username": username, "password": password}),
    );
    final body = jsonDecode(res.body) as Map<String, dynamic>;
    if (res.statusCode >= 400) throw ApiException(body["error"] ?? "request_failed");
    return AuthResult(body["token"], body["userId"], body["rating"]);
  }

  Future<AuthResult> register(String username, String password) => _auth("/register", username, password);
  Future<AuthResult> login(String username, String password) => _auth("/login", username, password);

  Future<List<String>> publicRooms() async {
    final res = await http.get(Uri.parse("$httpBase/rooms/public"));
    return (jsonDecode(res.body) as List).cast<String>();
  }
}
