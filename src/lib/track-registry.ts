import rawTracks from "../../content/tracks.json";

import { tracksSchema, type Track } from "./tracks";

/**
 * The track registry, parsed once at module load. A bad edit to
 * `content/tracks.json` fails the build rather than shipping a track the app
 * cannot grade.
 */
export const TRACKS: Track[] = tracksSchema.parse(rawTracks);

export const TRACK_NAMES: Map<string, string> = new Map(TRACKS.map((track) => [track.id, track.name]));
