export const DAY_NIGHT = { cycleMs: 12 * 60 * 1000, offsetMs: 0 };
/** Shared clock; 0=dawn, .25=noon, .5=dusk, .75=midnight. */
export function daylight(time: number, cycleMs = DAY_NIGHT.cycleMs) {
  const phase =
    ((((time + DAY_NIGHT.offsetMs) % cycleMs) + cycleMs) % cycleMs) / cycleMs;
  const sun = Math.sin(phase * Math.PI * 2);
  return {
    phase,
    night: Math.max(0, Math.min(1, 0.5 - sun * 1.2)),
    sunset: Math.max(0, 1 - Math.abs(sun) * 5),
    label:
      sun > 0.35
        ? "DAY"
        : sun < -0.35
          ? "NIGHT"
          : phase < 0.25 || phase > 0.75
            ? "DAWN"
            : "DUSK",
  };
}
