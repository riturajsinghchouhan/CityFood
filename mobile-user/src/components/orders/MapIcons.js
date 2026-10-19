// SVG icons from constants/mapIcons.js and DeliveryTrackingMap.jsx.
import Svg, { Circle, G, Path } from "react-native-svg";

const PIN_PATH =
  "M12 2C8.13 2 5 5.13 5 9c0 4.17 4.42 9.92 6.24 12.11.4.48 1.08.48 1.52 0C14.58 18.92 19 13.17 19 9c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5 14.5 7.62 14.5 9 13.38 11.5 12 11.5z";

const BIKE_PATH =
  "M19 7c0-1.1-.9-2-2-2h-3v2h3v2.65l-2.13 1.52c-.31.22-.5.57-.5.95V13h-4.4a2 2 0 00-1.92 1.45L6 20H2v2h4.5c1.07 0 1.97-.85 1.97-1.97V20l.4-1.2h3.13l.4 1.2c.4 1.2 1.5 2 2.77 2h.3c1.07 0 1.97-.85 1.97-1.97V20l-.4-1.2H14.1l-.33-1H18v-2h-2.17l-.67-2H18c1.1 0 2-.9 2-2V7h-1zM7 18h-.5C5.67 18 5 17.33 5 16.5S5.67 15 6.5 15H7v3zm8.5 0h-.5V15h.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5z";

export function RiderBikeIcon({ size = 60 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 60 60">
      <Circle cx="30" cy="30" r="28" fill="white" stroke="#ff8100" strokeWidth={4} />
      <G transform="translate(15, 15) scale(1.2)">
        <Path d={BIKE_PATH} fill="#ff8100" />
      </G>
    </Svg>
  );
}

// `withDoors`: the mapIcons.js variant (used on the tracking cards) has the extra white bars.
export function RestaurantPinIcon({ size = 48, withDoors = false }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="#FF6B35">
      <Path d={PIN_PATH} fill="#FF6B35" />
      <Circle cx="12" cy="9" r="3" fill="#FFFFFF" />
      {withDoors ? <Path d="M8 16h2v6H8zm6 0h2v6h-2z" fill="#FFFFFF" /> : null}
    </Svg>
  );
}

export function CustomerPinIcon({ size = 48 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="#00BC7D">
      <Path d={PIN_PATH} fill="#00BC7D" />
      <Circle cx="12" cy="9" r="3" fill="#FFFFFF" />
    </Svg>
  );
}
