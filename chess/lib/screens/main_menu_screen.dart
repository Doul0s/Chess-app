import "package:flutter/material.dart";
import "package:provider/provider.dart";
import "../services/api_service.dart";
import "../state/game_state.dart";
import "../state/session.dart";
import "../theme.dart";
import "../widgets/ui.dart";

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
  bool _loaded = false;
  String? _authError;
  List<String> _publicRooms = [];

  Future<void> _submitAuth(Session session) async {
    setState(() => _authError = null);
    try {
      if (_registering) {
        await session.register(_user.text, _pass.text);
      } else {
        await session.login(_user.text, _pass.text);
      }
    } catch (e) {
      setState(() => _authError = e is ApiException ? e.message : "connection_failed");
    }
  }

  Future<void> _loadPublicRooms() async {
    try {
      final rooms = await ApiService().publicRooms();
      setState(() {
        _publicRooms = rooms;
        _loaded = true;
      });
    } catch (_) {
      setState(() => _loaded = true);
    }
  }

  Widget _shell(Widget child) => Scaffold(
        body: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: ConstrainedBox(constraints: const BoxConstraints(maxWidth: 320), child: child),
            ),
          ),
        ),
      );

  Widget _authForm(Session session) {
    return _shell(
      Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const BrandTitle(),
          const SizedBox(height: 48),
          TextField(controller: _user, decoration: const InputDecoration(labelText: "USERNAME")),
          const SizedBox(height: 8),
          TextField(controller: _pass, obscureText: true, decoration: const InputDecoration(labelText: "PASSWORD")),
          if (_authError != null)
            Padding(
              padding: const EdgeInsets.only(top: 16),
              child: Text(_authError!.replaceAll("_", " ").toUpperCase(), style: const TextStyle(color: accent, fontSize: 12, letterSpacing: 2)),
            ),
          const SizedBox(height: 32),
          MenuButton(label: _registering ? "Register" : "Sign in", primary: true, onPressed: () => _submitAuth(session)),
          const SizedBox(height: 8),
          TextButton(
            onPressed: () => setState(() => _registering = !_registering),
            child: Text(_registering ? "HAVE AN ACCOUNT? SIGN IN" : "NEW HERE? REGISTER", style: const TextStyle(letterSpacing: 1)),
          ),
          TextButton(onPressed: session.playAsGuest, child: const Text("CONTINUE AS GUEST", style: TextStyle(letterSpacing: 1))),
        ],
      ),
    );
  }

  Widget _publicRow(String id, GameState game) {
    return InkWell(
      onTap: () => game.joinRoom(id),
      child: Container(
        margin: const EdgeInsets.only(top: 8),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
        decoration: BoxDecoration(border: Border.all(color: line)),
        child: Row(
          children: [
            Expanded(child: Text(id.length > 8 ? id.substring(0, 8) : id, style: const TextStyle(color: dim))),
            const Text("JOIN", style: TextStyle(color: accent, letterSpacing: 2, fontSize: 12)),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final session = context.watch<Session>();
    final game = context.read<GameState>();

    if (session.username == null) return _authForm(session);

    return _shell(
      Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const BrandTitle(),
          const SizedBox(height: 32),
          Row(
            children: [
              Expanded(child: Text(session.username!.toUpperCase(), style: const TextStyle(letterSpacing: 2))),
              if (session.rating != null) Text("${session.rating}", style: const TextStyle(color: accent, letterSpacing: 2)),
            ],
          ),
          const Divider(color: line, height: 32),
          MenuButton(label: "Quick match", primary: true, onPressed: game.quickMatch),
          const SizedBox(height: 12),
          MenuButton(label: "Host public game", onPressed: () => game.createInvite("public")),
          const SizedBox(height: 12),
          MenuButton(label: "Host private game", onPressed: () => game.createInvite("private")),
          const SizedBox(height: 32),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(child: TextField(controller: _roomCode, decoration: const InputDecoration(labelText: "ROOM CODE"))),
              const SizedBox(width: 12),
              SizedBox(
                width: 96,
                child: MenuButton(
                  label: "Join",
                  onPressed: () {
                    if (_roomCode.text.trim().isNotEmpty) game.joinRoom(_roomCode.text.trim());
                  },
                ),
              ),
            ],
          ),
          const SizedBox(height: 32),
          Row(
            children: [
              const Expanded(child: Text("PUBLIC GAMES", style: TextStyle(color: dim, fontSize: 12, letterSpacing: 2))),
              TextButton(onPressed: _loadPublicRooms, child: const Text("REFRESH", style: TextStyle(color: accent, letterSpacing: 2, fontSize: 12))),
            ],
          ),
          if (_loaded && _publicRooms.isEmpty)
            const Padding(padding: EdgeInsets.only(top: 8), child: Text("NONE OPEN", style: TextStyle(color: dim, fontSize: 12, letterSpacing: 2))),
          ..._publicRooms.map((id) => _publicRow(id, game)),
          const SizedBox(height: 24),
          TextButton(onPressed: session.signOut, child: const Text("SIGN OUT", style: TextStyle(letterSpacing: 2, fontSize: 12))),
        ],
      ),
    );
  }
}
