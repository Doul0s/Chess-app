export type GameScore = 1 | 0.5 | 0;

const K_FACTOR = 32;

export function expectedScore(rating: number, opponentRating: number): number {
  return 1 / (1 + 10 ** ((opponentRating - rating) / 400));
}

export function eloDelta(rating: number, opponentRating: number, score: GameScore): number {
  return Math.round(K_FACTOR * (score - expectedScore(rating, opponentRating)));
}
