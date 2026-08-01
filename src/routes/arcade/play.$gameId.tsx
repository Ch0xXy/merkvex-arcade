import { createFileRoute, Link } from "@tanstack/react-router";
import type { JSX } from "react";
import { BreakoutGame } from "@/games/BreakoutGame";
import { FlappyGame } from "@/games/FlappyGame";
import { HangmanGame } from "@/games/HangmanGame";
import { InvadersGame } from "@/games/InvadersGame";
import { JumperGame } from "@/games/JumperGame";
import { MemoryGame } from "@/games/MemoryGame";
import { RunnerGame } from "@/games/RunnerGame";
import { SnakeGame } from "@/games/SnakeGame";
import { TowerGame } from "@/games/TowerGame";
import { WhackGame } from "@/games/WhackGame";
import { getGame } from "@/games/catalog";
import type { GameId } from "@/lib/scores";

export const Route = createFileRoute("/arcade/play/$gameId")({
  component: PlayPage,
});

const GAMES_MAP: Record<GameId, () => JSX.Element> = {
  breakout: BreakoutGame,
  flappy: FlappyGame,
  whack: WhackGame,
  snake: SnakeGame,
  jumper: JumperGame,
  hangman: HangmanGame,
  invaders: InvadersGame,
  tower: TowerGame,
  runner: RunnerGame,
  memory: MemoryGame,
};

function PlayPage() {
  const { gameId } = Route.useParams();
  const meta = getGame(gameId);
  const Game = GAMES_MAP[gameId as GameId];

  if (!meta || !Game) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="font-display text-xl text-electric">Unknown cabinet</p>
        <Link
          to="/arcade"
          className="rounded-xl bg-electric px-6 py-3 font-display text-sm font-bold text-void-deep"
        >
          Back to arcade
        </Link>
      </div>
    );
  }

  return <Game />;
}
