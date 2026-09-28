# Chess client

1. `flutter pub get`
2. Edit `lib/config.dart` — set `httpBase`/`wsBase` to your server (10.0.2.2 = Android emulator's localhost; use your machine's LAN IP for a physical device).
3. `flutter run`

## Design notes
- State: Provider. `Session` holds auth, `GameState` owns the socket + board and drives which screen shows (`_Root` in `main.dart` switches on `phase`).
- Board: 8x8 `GridView` of bordered cells, Unicode glyphs for pieces, no assets.
- Moves are sent optimistically (board updates immediately) and rolled back on a server `error` — the server is the only real move validator, matching how the backend is written (it never acks your own move, only forwards it to your opponent).
- Promotion is auto-queen; there's no promotion-choice dialog yet.
- "Resign / leave" just closes the socket — the backend already treats any disconnect as a loss for the room (`opponent_disconnected` for the other player), there's no separate resign message in the protocol.
- Turn notification is in-app only (banner + haptic), not a system push notification.
