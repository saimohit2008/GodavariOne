# Godavari One — Mobile Application

**Native companion mobile application for the Godavari One digital platform.**

Built with **React Native and Expo SDK 53**, this cross-platform application provides pilgrims, tourists, and local residents with fast, offline-tolerant access to sacred ghats, crowd indicators, verified accommodation, and emergency hotlines during Godavari Pushkaralu 2027 and daily regional visits.

---

## 1. Technology & Architecture

- **Framework:** React Native 0.79 with Expo SDK 53
- **Navigation:** Expo Router v4 (typed file-based routing with tab bar and native stack modals)
- **Language:** TypeScript (strict mode)
- **Storage:**
  - `Expo SecureStore`: Hardware-backed keychain storage for sensitive authentication tokens
  - `@react-native-async-storage/async-storage`: Fast persistent storage for user favorites, offline caches, and language preferences
- **Hardware Integrations:**
  - `expo-camera`: Camera QR scanning for digital priority pass verification
  - `expo-location`: Proximity calculations to nearest ghats and medical facilities
- **Offline Assets:** Bundled fallback image assets in `assets/uploads/` providing zero-network display matching backend `/uploads/` paths

---

## 2. Prerequisites

- **Node.js:** v20.x or v22.x LTS
- **Package Manager:** `npm` (v10+)
- **Expo CLI:** Bundled with local dependencies (run via `npx expo`)
- **For Android Development:** Android Studio with an Android Virtual Device (AVD) running Android 10+ (API level 29+) or a physical Android device
- **For iOS Development:** macOS with Xcode 15+ and iOS Simulator installed

---

## 3. Installation & Setup

1. **Navigate to the mobile directory:**
   ```bash
   cd mobile
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure the API endpoint:**
   Copy the example environment template:
   ```bash
   cp .env.example .env
   ```
   *See [API Connectivity Configuration](#4-api-connectivity-configuration) below for selecting the correct URL for your device.*

---

## 4. API Connectivity Configuration

The mobile app communicates with the unified Godavari One backend at `/api/v1`. Configure `EXPO_PUBLIC_API_URL` in `mobile/.env`:

| Development Environment | Recommended `EXPO_PUBLIC_API_URL` | Notes |
| :--- | :--- | :--- |
| **Web Browser / iOS Simulator** | `http://localhost:3000/api/v1` | Shares `localhost` with host machine |
| **Android Emulator** | `http://10.0.2.2:3000/api/v1` | Standard Android Studio host loopback alias |
| **Physical Phone (Wi-Fi)** | `http://<YOUR_COMPUTER_LAN_IP>:3000/api/v1` | Computer and phone must be on the same Wi-Fi subnet |
| **Production Server** | `https://godavari.one/api/v1` | Production SSL backend |

> [!NOTE]
> Ensure the Godavari One backend web server is running (`npm run dev` in the root project directory) before launching the mobile application.

---

## 5. Development Commands

| Command | Purpose |
| :--- | :--- |
| `npm run start` | Start the Expo Metro development bundler |
| `npm run android` | Launch on connected Android device or running emulator |
| `npm run ios` | Launch on iOS Simulator (macOS only) |
| `npm run web` | Run mobile UI in desktop web browser |
| `npm run lint` | Run ESLint checks across mobile codebase |
| `npx tsc --noEmit` | Validate mobile TypeScript types |

---

## 6. Android Development

1. **Emulator Setup:** Launch an Android emulator from Android Studio.
2. **Start Bundler:** Run `npm run android`. Metro will compile the bundle and install the Expo development client on the emulator.
3. **Physical Device Testing:**
   - Connect your Android device via USB with USB Debugging enabled, or install the development build APK.
   - Configure `EXPO_PUBLIC_API_URL` with your computer's local Wi-Fi IPv4 address (e.g., `http://192.168.x.x:3000/api/v1`).
   - Ensure your computer firewall permits inbound traffic on port `3000`.

---

## 7. iOS Development (macOS Only)

1. **Simulator Setup:** Open Xcode and ensure an iOS Simulator runtime is installed.
2. **Start Bundler:** Run `npm run ios`. Metro will boot the simulator and install the client.
3. **Location & Camera Testing:** Use the Simulator features menu to simulate GPS locations in Rajahmundry (e.g., Latitude `17.0005`, Longitude `81.7800`).

---

## 8. Build Configuration (EAS)

The application includes configured EAS Build profiles in `eas.json`:

- **`development`:** Builds a development client APK enabling native debugging and live reload on physical devices.
- **`preview`:** Produces an internal distribution APK for testing without the Expo development server.
- **`production`:** Builds an optimized Android App Bundle (`.aab`) ready for Google Play Store release.

To trigger an EAS build (requires an active EAS account):
```bash
npx eas build --profile development --platform android
```

---

## 9. Security & Best Practices

- **Never Commit Secrets:** Do not commit `.env`, keystores (`*.jks`), provisioning profiles, or production signing keys.
- **Authentication:** All authentication tokens are stored strictly in `Expo SecureStore`, never in plain `AsyncStorage`.
- **Permissions:** Location and Camera permissions are declared in `app.json` with clear pilgrim usage descriptions and are requested just-in-time.

---

## 10. Related Platform Resources

- **Main Platform Repository:** [Godavari One Web Platform](../README.md)
- **API Documentation:** Sourced from the root Next.js project endpoints.

---

## 11. License

This mobile application is part of the Godavari One project. No open-source or commercial license has yet been assigned. All rights are reserved pending official designation.
