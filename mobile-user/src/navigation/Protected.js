// ProtectedRoute requiredRole="user": unauthenticated users go to login with `from`.
import { Redirect, usePathname } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../theme/ThemeContext";

export default function Protected({ children }) {
  const { ready, isAuthenticated } = useAuth();
  const { colors } = useTheme();
  const pathname = usePathname();
  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (!isAuthenticated) {
    return <Redirect href={{ pathname: "/login", params: { from: pathname } }} />;
  }
  return children;
}

// Wrap a screen component: export default withProtected(Screen).
export function withProtected(Component) {
  function ProtectedScreen(props) {
    return (
      <Protected>
        <Component {...props} />
      </Protected>
    );
  }
  ProtectedScreen.displayName = `Protected(${Component.displayName || Component.name || "Screen"})`;
  return ProtectedScreen;
}
