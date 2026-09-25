module.exports = function (api) {
  api.cache(true);
  // SDK 56's native build opts out of Hermes V1. Its Babel default does not:
  // explicitly lower classes for the legacy runtime as well as pinning hermesc.
  return {
    presets: [
      [
        require.resolve("babel-preset-expo", {
          paths: [require.resolve("expo/package.json")],
        }),
        {
          native: { unstable_transformProfile: "hermes-v0" },
        },
      ],
    ],
  };
};
