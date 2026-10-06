const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
// Expo SQLite imports this versioned, read-only asset on first use.
config.resolver.assetExts.push("sqlite");

module.exports = config;
