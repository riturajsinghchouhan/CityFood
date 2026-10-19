// lucide-react 0.555 brand icons (Facebook, Instagram, Twitter) that lucide-react-native 1.x
// no longer ships. Same 24x24 paths and props as the lucide components.
import Svg, { Line, Path, Rect } from "react-native-svg";

function Base({ size = 24, color = "currentColor", strokeWidth = 2, children, ...props }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {children}
    </Svg>
  );
}

export function Facebook(props) {
  return (
    <Base {...props}>
      <Path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </Base>
  );
}

export function Instagram(props) {
  return (
    <Base {...props}>
      <Rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <Path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <Line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </Base>
  );
}

// react-icons/fa6 FaLocationDot (solid, filled with the text color).
export function FaLocationDot({ size = 16, color = "#000", ...props }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 384 512" fill={color} {...props}>
      <Path d="M215.7 499.2C267 435 384 279.4 384 192C384 86 298 0 192 0S0 86 0 192c0 87.4 117 243 168.3 307.2c12.3 15.3 35.1 15.3 47.4 0zM192 128a64 64 0 1 1 0 128 64 64 0 1 1 0-128z" />
    </Svg>
  );
}

export function Twitter(props) {
  return (
    <Base {...props}>
      <Path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" />
    </Base>
  );
}
