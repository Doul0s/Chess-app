import "package:flutter/material.dart";
import "package:provider/provider.dart";
import "../services/api_service.dart";
import "../state/game_state.dart";
import "../state/session.dart";

class MainMenuScreen extends StatefulWidget {
  const MainMenuScreen({super.key});

  @override
  State<MainMenuScreen> createState() => _MainMenuScreenState();
}

class _MainMenuScreenState extends State<MainMenuScreen> {
  final _user = TextEditingController();
  final _pass = TextEditingController();
  final _roomCode = TextEditingController();
  bool _registering = false;
  String? _authError;
  String? _roomsError;
  List<String> _publicRooms = [];

  @override
  void dispose() {
    _user.dispose();
    _pass.dispose();
    _roomCode.dispose();
    super.dispose();
  }

  Future<void> _submitAuth(Session session) async {
    setState(() => _authError = null);
    try {
      if (_registering) {
        await session.register(_user.text, _pass.text);
      } else {
        await session.login(_user.text, _pass.text);
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _authError = e is ApiException ? e.message : "connection_failed");
    }
  }

  Future<void> _loadPublicRooms() async {
    setState(() => _roomsError = null);
    try {
      final rooms = await ApiService().publicRooms();
      if (!mounted) return;
      setState(() => _publicRooms = rooms);
    } catch (_) {
      if (!mounted) return;
      setState(() => _roomsError = "Could not load public games.");
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = context.watch<Session>();
    final game = context.watch<GameState>();

    if (session.username == null) {
      return Scaffold(
        backgroundColor: Colors.black,
        body: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 320),
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text("CHESS", style: TextStyle(color: Colors.white, fontSize: 32, letterSpacing: 4)),
                  const SizedBox(height: 32),
                  TextField(controller: _user, style: const TextStyle(color: Colors.white), decoration: const InputDecoration(labelText: "Username")),
                  TextField(controller: _pass, style: const TextStyle(color: Colors.white), obscureText: true, decoration: const InputDecoration(labelText: "Password")),
                  if (_authError != null) Padding(padding: const EdgeInsets.only(top: 8), child: Text(_authError!, style: const TextStyle(color: Colors.redAccent))),
                  const SizedBox(height: 16),
                  ElevatedButton(onPressed: () => _submitAuth(session), child: Text(_registering ? "Register" : "Sign in")),
                  TextButton(onPressed: () => setState(() => _registering = !_registering), child: Text(_registering ? "Have an account? Sign in" : "New here? Register")),
                  const SizedBox(height: 24),
                  TextButton(onPressed: session.playAsGuest, child: const Text("Continue as guest")),
                ],
              ),
            ),
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: Colors.black,
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 320),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(session.username!, style: const TextStyle(color: Colors.white, fontSize: 20)),
              if (session.rating != null) Text("Rating ${session.rating}", style: const TextStyle(color: Colors.white54)),
              if (game.connectionError != null)
                Padding(
                  padding: const EdgeInsets.only(top: 12),
                  child: Text(game.connectionError!, style: const TextStyle(color: Colors.redAccent), textAlign: TextAlign.center),
                ),
              const SizedBox(height: 32),
              ElevatedButton(onPressed: game.quickMatch, child: const Text("Quick match")),
              const SizedBox(height: 12),
              ElevatedButton(onPressed: () => game.createInvite("public"), child: const Text("Host public game")),
              const SizedBox(height: 12),
              ElevatedButton(onPressed: () => game.createInvite("private"), child: const Text("Host private game")),
              const SizedBox(height: 24),
              Row(
                children: [
                  Expanded(child: TextField(controller: _roomCode, style: const TextStyle(color: Colors.white), decoration: const InputDecoration(labelText: "Room code"))),
                  IconButton(
                    icon: const Icon(Icons.arrow_forward, color: Colors.white),
                    onPressed: () {
                      if (_roomCode.text.trim().isNotEmpty) game.joinRoom(_roomCode.text.trim());
                    },
                  ),
                ],
              ),
              const SizedBox(height: 24),
              TextButton(onPressed: _loadPublicRooms, child: const Text("Browse public games")),
              if (_roomsError != null)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(_roomsError!, style: const TextStyle(color: Colors.redAccent)),
                ),
              ..._publicRooms.map((id) => ListTile(
                    title: Text(id, style: const TextStyle(color: Colors.white70), overflow: TextOverflow.ellipsis),
                    trailing: const Icon(Icons.play_arrow, color: Colors.white),
                    onTap: () => game.joinRoom(id),
                  )),
            ],
          ),
        ),
      ),
    );
  }
}
