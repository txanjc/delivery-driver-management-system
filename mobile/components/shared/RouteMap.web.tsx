import { Text } from "react-native";

import { Card, textStyles } from "@/components/shared/Screen";

type Coordinate = {
  latitude: number;
  longitude: number;
};

type RouteMapProps = {
  origin: Coordinate;
  destination?: Coordinate | null;
};

export function RouteMap(_props: RouteMapProps) {
  return (
    <Card>
      <Text style={textStyles.label}>Map Preview</Text>
      <Text style={textStyles.value}>Route maps are available in the iOS and Android application.</Text>
      <Text style={textStyles.body}>Use a physical device or simulator to preview native map routing.</Text>
    </Card>
  );
}
