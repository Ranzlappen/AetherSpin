/**
 * Helpers to load canonical game definitions.
 *
 * In a Vite/browser build, prefer a direct JSON import:
 *   import novaforged from "@aetherspin/shared/games/novaforged/game-definition.json";
 * These helpers are for Node tooling (tests, scripts, the mock RGS).
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { GameDefinition } from "./types/game.js";

const here = dirname(fileURLToPath(import.meta.url));
const gamesDir = join(here, "..", "games");

export function loadGameDefinition(gameId: string): GameDefinition {
  const path = join(gamesDir, gameId, "game-definition.json");
  if (!existsSync(path)) {
    throw new Error(`Game definition not found for '${gameId}' at ${path}`);
  }
  return JSON.parse(readFileSync(path, "utf-8")) as GameDefinition;
}

export function listGameIds(): string[] {
  return readdirSync(gamesDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
}
