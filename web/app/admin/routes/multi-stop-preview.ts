import type { StartLocation } from "./start-location";

export type OptimizedStop = {
  deliveryId: string;
  sequence: number;
  estimatedArrivalTime: string | null;
  serviceDurationSeconds: number;
};

export type OptimizationPreview = {
  previewId: string;
  optimizedStops: OptimizedStop[];
  encodedPolyline: string;
  skippedShipmentIds: string[];
  metrics: {
    totalDistanceMeters: number;
    totalDurationSeconds: number;
    estimatedCompletionTime: string;
  };
  context: {
    selectedDeliveryIds: string[];
    selectedDriverId: string;
    selectedScheduleId: string;
    selectedVehicleId: string;
    routeDate: string;
    startLocation: StartLocation;
    returnToDepot: boolean;
    departureTime: string;
    shiftEndTime: string;
  };
};

export type PreviewDeliveryDetail = {
  id: string;
  number: string;
  customer: string;
  address: string;
  status: string;
};
