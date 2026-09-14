CREATE TABLE users (
  id UUID PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  rating INTEGER NOT NULL DEFAULT 1200,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE games (
  id UUID PRIMARY KEY,
  white_id UUID NOT NULL REFERENCES users(id),
  black_id UUID NOT NULL REFERENCES users(id),
  white_rating_before INTEGER NOT NULL,
  black_rating_before INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('checkmate', 'stalemate', 'draw', 'timeout')),
  winner_id UUID REFERENCES users(id),
  moves TEXT[] NOT NULL DEFAULT '{}',
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX games_white_id_idx ON games(white_id);
CREATE INDEX games_black_id_idx ON games(black_id);
