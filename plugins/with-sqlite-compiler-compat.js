/**
 * SDK 56 / Xcode 27: ExpoSQLite's explicit Swift module scan can reuse Apple's
 * SQLite header graph and fail with missing exsqlite3 symbols or _Builtin_stdarg.
 * Use implicit modules for this pod only; this changes compilation, not SQLite
 * storage or app permissions. See docs/IMPLEMENTATION_NOTES.md.
 * Remove after validating the explicit-module path on an upgraded toolchain.
 */
const { withPodfile } = require("expo/config-plugins");
const marker = "# SPC Outlook: ExpoSQLite compiler compatibility";
/** Insert once in CocoaPods' existing post-install hook; fail if its shape changes. */
function patchPodfile(contents) {
  if (contents.includes(marker)) return contents;
  const hook = "post_install do |installer|";
  if (!contents.includes(hook)) {
    throw new Error("Could not find CocoaPods post_install hook for ExpoSQLite compatibility");
  }
  return contents.replace(hook, `${hook}
    ${marker}
    installer.pods_project.targets.each do |target|
      next unless target.name == 'ExpoSQLite'
      target.build_configurations.each do |config|
        config.build_settings['SWIFT_ENABLE_EXPLICIT_MODULES'] = 'NO'
      end
    end`);
}
module.exports = function withSQLiteCompilerCompat(config) {
  return withPodfile(config, (config) => {
    config.modResults.contents = patchPodfile(config.modResults.contents);
    return config;
  });
};
module.exports.patchPodfile = patchPodfile;
