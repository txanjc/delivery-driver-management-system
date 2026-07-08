"use client";

import { useEffect, useRef, useState } from "react";

import { getGoogleMapsConfigurationError, loadGoogleMapsLibraries } from "@/lib/google-maps-client";

export type SelectedPlace = {
  formattedAddress: string;
  placeId: string;
  latitude: number;
  longitude: number;
};

type PlacesAddressInputProps = {
  id: string;
  label: string;
  value: string;
  required?: boolean;
  className: string;
  onTextChange: (value: string) => void;
  onPlaceSelect: (place: SelectedPlace) => void;
};

const placeFields: Array<keyof google.maps.places.Place> = ["displayName", "formattedAddress", "id", "location"];

function validationInputClass(className: string) {
  return `${className} pointer-events-none absolute inset-0 -z-10 opacity-0`;
}

export function PlacesAddressInput({
  id,
  label,
  value,
  required = false,
  className,
  onTextChange,
  onPlaceSelect,
}: PlacesAddressInputProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const autocompleteRef = useRef<google.maps.places.PlaceAutocompleteElement | null>(null);
  const valueRef = useRef(value);
  const onTextChangeRef = useRef(onTextChange);
  const onPlaceSelectRef = useRef(onPlaceSelect);
  const configurationError = getGoogleMapsConfigurationError();
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(!configurationError);

  useEffect(() => {
    valueRef.current = value;
    onTextChangeRef.current = onTextChange;
    onPlaceSelectRef.current = onPlaceSelect;
  }, [onPlaceSelect, onTextChange, value]);

  useEffect(() => {
    if (configurationError) {
      queueMicrotask(() => setStatus(configurationError));
      return;
    }

    let cancelled = false;
    const mount = mountRef.current;
    const cleanupListeners: Array<() => void> = [];

    async function initializeAutocomplete() {
      if (!mount || autocompleteRef.current) return;

      try {
        setLoading(true);
        const libraries = await loadGoogleMapsLibraries();
        if (cancelled || autocompleteRef.current) return;

        const autocomplete = new libraries.places.PlaceAutocompleteElement({
          description: label,
          noInputIcon: true,
          placeholder: "",
          requestedRegion: "us",
        });

        autocomplete.value = valueRef.current;
        autocomplete.id = id;
        autocomplete.className = "deliver-eaze-place-autocomplete";
        autocomplete.setAttribute("aria-label", label);
        autocomplete.setAttribute("aria-required", String(required));
        if (required) autocomplete.setAttribute("required", "");

        const handleInput = () => {
          setStatus("");
          onTextChangeRef.current(autocomplete.value);
        };

        const handleSelect = async (event: google.maps.places.PlacePredictionSelectEvent) => {
          try {
            const place = event.placePrediction.toPlace();
            await place.fetchFields({ fields: placeFields });
            const location = place.location;
            const formattedAddress = place.formattedAddress;

            if (!formattedAddress || !place.id || !location) {
              setStatus("Select a valid address result.");
              return;
            }

            setStatus("");
            onPlaceSelectRef.current({
              formattedAddress,
              latitude: location.lat(),
              longitude: location.lng(),
              placeId: place.id,
            });
          } catch {
            setStatus("Address details are unavailable.");
          }
        };

        const handleError = () => setStatus("Address suggestions are unavailable.");
        const handleSelectListener: EventListener = (event) => {
          void handleSelect(event as google.maps.places.PlacePredictionSelectEvent);
        };

        autocomplete.addEventListener("input", handleInput);
        autocomplete.addEventListener("gmp-select", handleSelectListener);
        autocomplete.addEventListener("gmp-error", handleError);
        cleanupListeners.push(() => autocomplete.removeEventListener("input", handleInput));
        cleanupListeners.push(() => autocomplete.removeEventListener("gmp-select", handleSelectListener));
        cleanupListeners.push(() => autocomplete.removeEventListener("gmp-error", handleError));
        mount.replaceChildren(autocomplete);
        autocompleteRef.current = autocomplete;
        setLoading(false);
      } catch {
        if (!cancelled) {
          setLoading(false);
          setStatus("Address suggestions are unavailable.");
        }
      }
    }

    void initializeAutocomplete();

    return () => {
      cancelled = true;
      const autocomplete = autocompleteRef.current;
      if (autocomplete) {
        cleanupListeners.forEach((cleanup) => cleanup());
        autocomplete.remove();
      }
      autocompleteRef.current = null;
      mount?.replaceChildren();
    };
  }, [configurationError, id, label, required]);

  useEffect(() => {
    const autocomplete = autocompleteRef.current;
    if (autocomplete && autocomplete.value !== value) {
      autocomplete.value = value;
    }
  }, [value]);

  useEffect(() => {
    const autocomplete = autocompleteRef.current;
    if (autocomplete) {
      autocomplete.setAttribute("aria-describedby", status ? `${id}-status` : "");
    }
  }, [id, status]);

  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <div className="relative mt-1.5">
        <input
          aria-hidden="true"
          className={validationInputClass(className)}
          onChange={() => undefined}
          required={required}
          tabIndex={-1}
          type="text"
          value={value}
        />
        <div ref={mountRef} />
        {loading ? <span className="block h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-400">Loading address search...</span> : null}
      </div>
      {status ? (
        <p className="mt-1 text-[10px] leading-4 text-slate-400" id={`${id}-status`}>
          {status}
        </p>
      ) : null}
    </label>
  );
}
