import { Redirect } from "expo-router";

// Debug screen removed for production — redirect to home.
export default function OneSignalDebugScreen() {
  return <Redirect href="/" />;
}
