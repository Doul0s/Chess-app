import "package:flutter/material.dart";
import "package:provider/provider.dart";
import "screens/game_screen.dart";
import "screens/main_menu_screen.dart";
import "screens/waiting_room_screen.dart";
import "state/game_state.dart";
import "state/session.dart";
import "theme.dart";

void main() => runApp(const ChessApp());

class ChessApp extends StatelessWidget {
  const ChessApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => Session()),
        ChangeNotifierProxyProvider<Session, GameState>(
          create: (ctx) => GameState(ctx.read<Session>()),
          update: (ctx, session, previous) => previous ?? GameState(session),
        ),
      ],
      child: MaterialApp(
        title: "Chess",
        debugShowCheckedModeBanner: false,
        theme: appTheme,
        home: const _Root(),
      ),
    );
  }
}

class _Root extends StatelessWidget {
  const _Root();

  @override
  Widget build(BuildContext context) {
    final phase = context.watch<GameState>().phase;
    switch (phase) {
      case GamePhase.idle:
        return const MainMenuScreen();
      case GamePhase.searching:
      case GamePhase.waitingForOpponent:
        return const WaitingRoomScreen();
      case GamePhase.active:
      case GamePhase.over:
        return const GameScreen();
    }
  }
}
