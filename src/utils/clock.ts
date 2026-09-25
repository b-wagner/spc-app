export interface Clock {
  now(): number;
}
export const FIXTURE_TIME = Date.UTC(2026, 8, 24, 18);
export const fixtureMode = process.env.EXPO_PUBLIC_DATA_MODE === "fixtures";
/** Fixture time is fixed explicitly; a live failure never enables demo mode. */
export const appClock: Clock = {
  now: () => (fixtureMode ? FIXTURE_TIME : Date.now()),
};
