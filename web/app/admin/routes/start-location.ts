export type StartLocationSource = "company_default" | "route_override";

export type StartLocation = {
  address: string;
  latitude: number | null;
  longitude: number | null;
  name: string;
  placeId: string;
  source: StartLocationSource;
};

export type CompanySettingsLocation = {
  operating_address: string | null;
  operating_latitude: number | string | null;
  operating_location_name: string | null;
  operating_longitude: number | string | null;
  operating_place_id: string | null;
};

function text(value: string | null) {
  return value?.trim() ?? "";
}

function coordinate(value: number | string | null) {
  if (value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function hasValidCoordinates(latitude: number | null, longitude: number | null) {
  return latitude !== null && longitude !== null && Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

export function isValidStartLocation(location: StartLocation | null) {
  return location !== null && hasValidCoordinates(location.latitude, location.longitude);
}

export function companyDefaultStartLocation(settings: CompanySettingsLocation | null): StartLocation | null {
  if (!settings) return null;
  const name = text(settings.operating_location_name) || text(settings.operating_address);
  const address = text(settings.operating_address) || name;
  const latitude = coordinate(settings.operating_latitude);
  const longitude = coordinate(settings.operating_longitude);
  if (!name || !hasValidCoordinates(latitude, longitude)) return null;
  return { name, address, placeId: text(settings.operating_place_id), latitude, longitude, source: "company_default" };
}
