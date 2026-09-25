import { Alert, Linking } from "react-native";
import { AppButton } from "./AppButton";
/** Opens only the fixed source URLs supplied by app configuration. */
export function ExternalLink({ label, url }: { label: string; url: string }) {
  return (
    <AppButton
      label={label}
      onPress={() => {
        void Linking.openURL(url).catch(() =>
          Alert.alert(
            "Unable to open link",
            "Please try again when a browser is available.",
          ),
        );
      }}
    />
  );
}
