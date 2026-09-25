/** SDK 56 / Xcode 27 compatibility shim. See docs/IMPLEMENTATION_NOTES.md.
 * UIKit requires a scene-owned window on iOS 27. Keep the pinned Expo family,
 * forwarding single-scene lifecycle/link events to its existing app delegate.
 * Remove after upgrading to Expo's built-in scene support. */
const { withAppDelegate, withInfoPlist } = require("expo/config-plugins");
module.exports = function withSceneLifecycle(config) {
  config = withInfoPlist(config, (cfg) => {
    cfg.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: "Default Configuration",
            UISceneDelegateClassName: "$(PRODUCT_MODULE_NAME).SPCSceneDelegate",
          },
        ],
      },
    };
    return cfg;
  });
  return withAppDelegate(config, (cfg) => {
    if (cfg.modResults.contents.includes("class SPCSceneDelegate")) return cfg;
    const block =
      /#if os\(iOS\) \|\| os\(tvOS\)\s+window = UIWindow\(frame: UIScreen.main.bounds\)[\s\S]*?launchOptions: launchOptions\)\s+#endif/;
    if (!block.test(cfg.modResults.contents))
      throw Error("Review SDK 56 scene shim: AppDelegate template changed.");
    cfg.modResults.contents =
      cfg.modResults.contents.replace(
        block,
        "// UIWindow and React startup are owned by SPCSceneDelegate.",
      ) +
      `

// Single-window scene bridge for Expo 56; required by the Xcode 27 SDK.
class SPCSceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?
  private var app: AppDelegate? { UIApplication.shared.delegate as? AppDelegate }

  func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
    guard let scene = scene as? UIWindowScene, let app = app, let factory = app.reactNativeFactory else { return }
    let window = UIWindow(windowScene: scene)
    self.window = window
    app.window = window
    var launch: [UIApplication.LaunchOptionsKey: Any] = [:]
    if let url = connectionOptions.urlContexts.first?.url { launch[.url] = url }
    factory.startReactNative(withModuleName: "main", in: window, launchOptions: launch)
    for activity in connectionOptions.userActivities { self.scene(scene, continue: activity) }
  }
  func scene(_ scene: UIScene, openURLContexts contexts: Set<UIOpenURLContext>) {
    for context in contexts {
      _ = app?.application(UIApplication.shared, open: context.url, options: [.sourceApplication: context.options.sourceApplication ?? "", .openInPlace: context.options.openInPlace])
    }
  }
  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    _ = app?.application(UIApplication.shared, continue: userActivity, restorationHandler: { _ in })
  }
  func sceneDidBecomeActive(_ scene: UIScene) { app?.applicationDidBecomeActive(UIApplication.shared) }
  func sceneWillResignActive(_ scene: UIScene) { app?.applicationWillResignActive(UIApplication.shared) }
  func sceneDidEnterBackground(_ scene: UIScene) { app?.applicationDidEnterBackground(UIApplication.shared) }
  func sceneWillEnterForeground(_ scene: UIScene) { app?.applicationWillEnterForeground(UIApplication.shared) }
}
`;
    return cfg;
  });
};
