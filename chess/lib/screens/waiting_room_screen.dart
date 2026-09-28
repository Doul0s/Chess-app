import "package:flutter/material.dart";
import "package:provider/provider.dart";
import "../state/game_state.dart";

class WaitingRoomScreen extends StatelessWidget {
  const WaitingRoomScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final game = context.watch<GameState>();
    return Scaffold(
      backgroundColor: Colors.black,
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const CircularProgressIndicator(color: Colors.white),
            const SizedBox(height: 24),
            Text(
              game.phase == GamePhase.searching ? "Searching for an opponent…" : "Waiting for an opponent to join…",
              style: const TextStyle(color: Colors.white70),
            ),
            if (game.roomId != null) ...[
              const SizedBox(height: 16),
              const Text("Share this code:", style: TextStyle(color: Colors.white38)),
              SelectableText(game.roomId!, style: const TextStyle(color: Colors.white, fontSize: 16)),
            ],
            const SizedBox(height: 32),
            TextButton(onPressed: game.leave, child: const Text("Cancel")),
          ],
        ),
      ),
    );
  }
}
