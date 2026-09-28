import "package:flutter/material.dart";
import "package:flutter/services.dart";
import "package:provider/provider.dart";
import "../state/game_state.dart";
import "../theme.dart";
import "../widgets/ui.dart";

class WaitingRoomScreen extends StatelessWidget {
  const WaitingRoomScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final game = context.watch<GameState>();
    final searching = game.phase == GamePhase.searching;
    return Scaffold(
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 320),
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(searching ? "SEARCHING" : "WAITING", style: const TextStyle(fontSize: 20, letterSpacing: 6, fontWeight: FontWeight.bold)),
                const SizedBox(height: 4),
                Text(searching ? "for an opponent" : "for an opponent to join", style: const TextStyle(color: dim)),
                const SizedBox(height: 20),
                const LinearProgressIndicator(color: accent, backgroundColor: line, minHeight: 2),
                if (game.roomId != null) ...[
                  const SizedBox(height: 40),
                  const Text("ROOM CODE", style: TextStyle(color: dim, fontSize: 12, letterSpacing: 2)),
                  const SizedBox(height: 8),
                  Container(
                    padding: const EdgeInsets.only(left: 12),
                    decoration: BoxDecoration(border: Border.all(color: Colors.white38)),
                    child: Row(
                      children: [
                        Expanded(child: SelectableText(game.roomId!, style: const TextStyle(fontSize: 13))),
                        IconButton(
                          icon: const Icon(Icons.copy, size: 18, color: accent),
                          onPressed: () {
                            Clipboard.setData(ClipboardData(text: game.roomId!));
                            ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("COPIED")));
                          },
                        ),
                      ],
                    ),
                  ),
                ],
                const SizedBox(height: 40),
                MenuButton(label: "Cancel", onPressed: game.leave),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
