/** @type {import('jest').Config} */
module.exports = {
  collectCoverageFrom: ["src/**/*.ts"],
  coverageDirectory: "../coverage",
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: "src",
  testEnvironment: "node",
  testRegex: ".*\\.spec\\.ts$",
  transform: {
    "^.+\\.(t|j)s$": "ts-jest",
  },
  // @octokit/rest and @notionhq/client ship ESM-only builds; Jest (CJS)
  // must transform them instead of require()ing them raw, or any suite
  // importing the provider registry fails with "Must use import to load
  // ES Module". googleapis and @slack/web-api ship CJS and need no entry.
  transformIgnorePatterns: ["/node_modules/(?!(@octokit|@notionhq)/)"],
};
