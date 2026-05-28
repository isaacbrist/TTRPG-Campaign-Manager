// Used by both Next.js/Turbopack (next/babel preset) and Jest (env.test presets).
// next/babel provides TypeScript + React support for the production build.
// Jest uses the env.test block which adds @babel/preset-env for Node compat.
module.exports = {
  presets: ["next/babel"],
  env: {
    test: {
      presets: [
        ["@babel/preset-env", { targets: { node: "current" } }],
        ["@babel/preset-react", { runtime: "automatic" }],
        "@babel/preset-typescript",
      ],
    },
  },
};
