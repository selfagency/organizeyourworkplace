/**
 * R3.6 matchmaker entry point (05-security §Matchmaker hardening).
 *
 * Holds nothing on disk, writes no log line, and forgets every room when
 * the process restarts. The port comes from the environment.
 */
import { createMatchmaker, createMatchmakerServer } from './server.mjs';

const port = Number(process.env.PORT ?? 8090);
const matchmaker = createMatchmaker({
  powDifficulty: Number(process.env.POW_DIFFICULTY ?? 4),
  maxPeers: Number(process.env.MAX_PEERS ?? 8),
  joinsPerMinute: Number(process.env.JOINS_PER_MINUTE ?? 10),
  queueLimit: Number(process.env.QUEUE_LIMIT ?? 200),
});

createMatchmakerServer(matchmaker).listen(port, '0.0.0.0');
