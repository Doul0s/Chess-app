import "package:flutter/foundation.dart";
import "../services/api_service.dart";

class Session extends ChangeNotifier {
  final ApiService _api = ApiService();

  String? token;
  String? username;
  int? rating;

  bool get isGuest => token == null;

  Future<void> playAsGuest() async {
    token = null;
    username = "Guest";
    rating = null;
    notifyListeners();
  }

  Future<void> register(String user, String password) async {
    final result = await _api.register(user, password);
    _apply(user, result);
  }

  Future<void> login(String user, String password) async {
    final result = await _api.login(user, password);
    _apply(user, result);
  }

  void _apply(String user, AuthResult result) {
    token = result.token;
    username = user;
    rating = result.rating;
    notifyListeners();
  }

  void signOut() {
    token = null;
    username = null;
    rating = null;
    notifyListeners();
  }
}
