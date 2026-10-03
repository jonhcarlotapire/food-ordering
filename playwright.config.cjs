const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
    testDir: "./tests",
    fullyParallel: true,
    reporter: "list",
    use: {
        baseURL: "http://127.0.0.1:4174",
        channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
        trace: "retain-on-failure"
    },
    webServer: {
        command: "node tests/server.cjs",
        url: "http://127.0.0.1:4174",
        reuseExistingServer: !process.env.CI
    }
});
