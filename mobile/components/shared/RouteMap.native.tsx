import { StyleSheet, View } from "react-native";
import MapView, { Marker } from "react-native-maps";

type Coordinate = {
  latitude: number;
  longitude: number;
};

type RouteMapProps = {
  origin: Coordinate;
  destination?: Coordinate | null;
};

export function RouteMap({ origin, destination }: RouteMapProps) {
  return (
    <View style={styles.mapFrame}>
      <MapView
        initialRegion={{
          ...origin,
          latitudeDelta: 0.08,
          longitudeDelta: 0.08,
        }}
        style={styles.map}
      >
        <Marker coordinate={origin} title="Pickup" />
        {destination ? <Marker coordinate={destination} title="Drop-off" /> : null}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  mapFrame: {
    borderRadius: 8,
    height: 360,
    overflow: "hidden",
  },
  map: {
    flex: 1,
  },
});
