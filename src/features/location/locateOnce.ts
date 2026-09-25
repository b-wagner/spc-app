import * as Location from "expo-location";
import type { LonLat } from "@/features/outlooks/types";
import { validCoordinates } from "@/features/outlooks/normalize";
import { AppError } from "@/utils/errors";
export interface LocationAdapter {
  getForegroundPermissionsAsync: typeof Location.getForegroundPermissionsAsync;
  requestForegroundPermissionsAsync: typeof Location.requestForegroundPermissionsAsync;
  hasServicesEnabledAsync: typeof Location.hasServicesEnabledAsync;
  getCurrentPositionAsync: typeof Location.getCurrentPositionAsync;
}
export class LocationDeniedError extends AppError {
  constructor(public canAskAgain: boolean) {
    super("LOCATION_DENIED");
  }
}
/** One operation, no watch. Timeout covers permission/services/fix; stale native completions are ignored. */
export class OneShotLocation {
  private operation = 0;
  private cancelPending: (() => void) | null = null;
  constructor(private api: LocationAdapter = Location) {}
  /** Manual point/place selection and unmount must call cancel before applying their selection. */
  cancel() {
    this.operation++;
    this.cancelPending?.();
    this.cancelPending = null;
  }
  async locate(): Promise<{ coordinates: LonLat; approximate: boolean }> {
    this.cancel();
    const operation = this.operation;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const abandoned = new Promise<never>((_, reject) => {
      this.cancelPending = () => reject(new AppError("CANCELED"));
      timer = setTimeout(() => {
        this.operation++;
        reject(new AppError("TIMEOUT"));
      }, 15000);
    });
    const work = async () => {
      let permission = await this.api.getForegroundPermissionsAsync();
      if (permission.status === "undetermined")
        permission = await this.api.requestForegroundPermissionsAsync();
      if (operation !== this.operation) throw new AppError("CANCELED");
      if (!permission.granted)
        throw new LocationDeniedError(permission.canAskAgain);
      if (!(await this.api.hasServicesEnabledAsync()))
        throw new AppError("LOCATION_UNAVAILABLE");
      if (operation !== this.operation) throw new AppError("CANCELED");
      const fix = await this.api.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      if (operation !== this.operation) throw new AppError("CANCELED");
      const coordinates: LonLat = [fix.coords.longitude, fix.coords.latitude];
      if (!validCoordinates(coordinates))
        throw new AppError("LOCATION_UNAVAILABLE");
      return {
        coordinates,
        approximate: (fix.coords.accuracy ?? Infinity) > 1000,
      };
    };
    try {
      return await Promise.race([work(), abandoned]);
    } finally {
      clearTimeout(timer);
      if (operation === this.operation) this.cancelPending = null;
    }
  }
}
