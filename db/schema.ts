import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const leagues = sqliteTable("leagues", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  pinHash: text("pin_hash").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const teams = sqliteTable("teams", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  leagueId: text("league_id").notNull().references(() => leagues.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  seed: integer("seed").notNull(),
}, (table) => [
  index("teams_league_idx").on(table.leagueId),
  uniqueIndex("teams_league_name_idx").on(table.leagueId, table.name),
]);

export const matches = sqliteTable("matches", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  leagueId: text("league_id").notNull().references(() => leagues.id, { onDelete: "cascade" }),
  round: integer("round").notNull(),
  homeTeamId: integer("home_team_id").notNull().references(() => teams.id),
  awayTeamId: integer("away_team_id").notNull().references(() => teams.id),
  homeScore: integer("home_score"),
  awayScore: integer("away_score"),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("matches_league_idx").on(table.leagueId),
  uniqueIndex("matches_league_round_idx").on(table.leagueId, table.round),
]);
