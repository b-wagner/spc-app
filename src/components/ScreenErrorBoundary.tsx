import { Component, type PropsWithChildren } from "react";
import { Text, View } from "react-native";
import { AppButton } from "./AppButton";
import { styles } from "@/theme/tokens";
/** Isolates React render failures. Native renderer crashes still need native diagnostics. */
export class ScreenErrorBoundary extends Component<
  PropsWithChildren<{ map?: boolean }>,
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <View style={[styles.card, { flex: 1, justifyContent: "center" }]}>
        <Text style={styles.body}>
          {this.props.map
            ? "The map could not be displayed. Forecast text remains available."
            : "Something went wrong while displaying this screen."}
        </Text>
        <AppButton
          label="Retry"
          onPress={() => this.setState({ failed: false })}
        />
      </View>
    ) : (
      this.props.children
    );
  }
}
