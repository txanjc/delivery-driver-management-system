export type NavigationCoordinate = {
  latitude: number;
  longitude: number;
};

export type NavigationTarget = "pickup" | "dropoff";

export type NavigationStep = {
  distanceMeters: number | null;
  end: NavigationCoordinate | null;
  instruction: string | null;
  maneuver: string | null;
};

export type DriverNavigation = {
  distanceMeters: number | null;
  durationSeconds: number | null;
  encodedPolyline: string | null;
  steps: NavigationStep[];
};
