import {
  OneShotLocation,
  type LocationAdapter,
  LocationDeniedError,
} from "@/features/location/locateOnce";
import { PermissionStatus } from "expo-location";
function adapter(): LocationAdapter {
  return {
    getForegroundPermissionsAsync: jest.fn(async () => ({
      status: PermissionStatus.GRANTED,
      granted: true,
      canAskAgain: true,
      expires: "never" as const,
    })),
    requestForegroundPermissionsAsync: jest.fn(),
    hasServicesEnabledAsync: jest.fn(async () => true),
    getCurrentPositionAsync: jest.fn(async () => ({
      timestamp: 0,
      coords: {
        longitude: -97,
        latitude: 35,
        altitude: null,
        accuracy: 1500,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      },
    })),
  };
}
test("permission denial never starts GPS", async () => {
  const api = adapter();
  api.getForegroundPermissionsAsync = async () => ({
    status: PermissionStatus.DENIED,
    granted: false,
    canAskAgain: false,
    expires: "never" as const,
  });
  await expect(new OneShotLocation(api).locate()).rejects.toBeInstanceOf(
    LocationDeniedError,
  );
  expect(api.getCurrentPositionAsync).not.toHaveBeenCalled();
});
test("late fix cannot override a newer manual selection", async () => {
  const api = adapter();
  let resolve!: (
    v: Awaited<ReturnType<LocationAdapter["getCurrentPositionAsync"]>>,
  ) => void;
  api.getCurrentPositionAsync = () =>
    new Promise((r) => {
      resolve = r;
    });
  const locator = new OneShotLocation(api);
  const p = locator.locate();
  await Promise.resolve();
  await Promise.resolve();
  locator.cancel();
  await expect(p).rejects.toThrow("CANCELED");
  resolve?.({
    timestamp: 0,
    coords: {
      longitude: -97,
      latitude: 35,
      altitude: null,
      accuracy: 20,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
    },
  });
});
test("approximate fix keeps full coordinates and has no watch", async () => {
  expect(await new OneShotLocation(adapter()).locate()).toEqual({
    coordinates: [-97, 35],
    approximate: true,
  });
});
test("15 second timeout rejects uncancelable native work", async () => {
  jest.useFakeTimers();
  const api = adapter();
  api.getCurrentPositionAsync = () => new Promise(() => {});
  const p = new OneShotLocation(api).locate();
  const assertion = expect(p).rejects.toThrow("TIMEOUT");
  await jest.advanceTimersByTimeAsync(15000);
  await assertion;
  jest.useRealTimers();
});
