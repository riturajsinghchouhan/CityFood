// Data providers in dependency order. LocationProvider sits above ProfileProvider because
// setDefaultAddress switches the delivery location (the web did this through window events).
import { ThemeProvider } from "../theme/ThemeContext";
import { AppSettingsProvider } from "./AppSettingsContext";
import { AuthProvider } from "./AuthContext";
import { CartProvider } from "./CartContext";
import { LocationProvider } from "./LocationContext";
import { OrdersProvider } from "./OrdersContext";
import { ProfileProvider } from "./ProfileContext";
import { SearchOverlayProvider } from "./SearchOverlayContext";
import { UserNotificationProvider } from "./UserNotificationContext";

export function AppProviders({ children }) {
  return (
    <AuthProvider>
      <ThemeProvider>
        <AppSettingsProvider>
          <LocationProvider>
            <ProfileProvider>
              <CartProvider>
                <OrdersProvider>
                  <UserNotificationProvider>
                    <SearchOverlayProvider>{children}</SearchOverlayProvider>
                  </UserNotificationProvider>
                </OrdersProvider>
              </CartProvider>
            </ProfileProvider>
          </LocationProvider>
        </AppSettingsProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
