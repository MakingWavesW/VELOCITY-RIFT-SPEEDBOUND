/** Stage 3 courses use existing Main City ground, bridges, ramps and skyline roofs.
 * Static shared definitions are used by the server for validation and by the client for guidance.
 * No client-supplied position or completion messages are accepted.
 */
export const PARKOUR_COURSES = [
  {
    id: "sunburst",
    name: "Sunburst Starter Flight",
    description: "Launch through the Solar Hoop and reach the north finish.",
    start: { x: 0, y: 0, z: -24, radius: 9 },
    checkpoints: [
      { type: "hoop", id: 0, title: "Solar Hoop" },
      { type: "point", x: 0, y: 0, z: -92, radius: 12, title: "North finish" },
    ],
    gems: 6, minimumMs: 1500, maximumMs: 120000, cooldownMs: 300000,
  },
  {
    id: "gardens",
    name: "Crystal Garden Leap",
    description: "Cross the two garden bridges and reach the crystal overlook.",
    start: { x: -185, y: 0, z: 169, radius: 11 },
    checkpoints: [
      { type: "point", x: -201, y: 0, z: 120, radius: 9, title: "First bridge" },
      { type: "point", x: -225, y: 0, z: 179, radius: 10, title: "Garden turn" },
      { type: "point", x: -251, y: 0, z: 230, radius: 9, title: "Second bridge" },
    ],
    gems: 9, minimumMs: 3000, maximumMs: 180000, cooldownMs: 300000,
  },
  {
    id: "skyline",
    name: "Skyline Skyway",
    description: "Climb the stepped terrace to the high rooftop loop.",
    start: { x: 90, y: 0, z: 65, radius: 8 },
    checkpoints: [
      { type: "point", x: 90, y: 12, z: 120, radius: 7, title: "Skyline terrace" },
      { type: "point", x: 133, y: 24, z: 120, radius: 8, title: "Upper staircase" },
      { type: "point", x: 152, y: 26, z: 105, radius: 8, title: "Tower roof" },
      { type: "point", x: 149, y: 26, z: 135, radius: 8, title: "Skyway finish" },
    ],
    gems: 18, minimumMs: 3500, maximumMs: 240000, cooldownMs: 300000,
  },
] as const;

export type ParkourCourse = (typeof PARKOUR_COURSES)[number];
export type ParkourCheckpoint = ParkourCourse["checkpoints"][number];
export type ParkourPosition = { x: number; y: number; z: number };

export function inParkourRange(
  location: { x: number; y: number; z: number; radius: number },
  position: ParkourPosition,
) {
  return Math.hypot(location.x - position.x, location.z - position.z) <
    location.radius && Math.abs(location.y - position.y) < 3;
}
