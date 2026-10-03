// Small local preview server. No application build or runtime packages required.
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const types = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".svg": "image/svg+xml"
};

http.createServer((request, response) => {
    let pathname;
    try {
        pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    } catch {
        response.writeHead(400);
        response.end("Invalid path");
        return;
    }
    const file = path.resolve(root, `.${pathname === "/" ? "/index.html" : pathname}`);
    const relative = path.relative(root, file);
    // Serve only the frontend files, never repository metadata or dependencies.
    if (!["index.html", "style.css", "script.js", "assets/meal.svg"].includes(relative.split(path.sep).join("/"))) {
        response.writeHead(404);
        response.end("Not found");
        return;
    }
    fs.readFile(file, (error, data) => {
        response.writeHead(error ? 404 : 200, {
            "Content-Type": types[path.extname(file)] || "application/octet-stream",
            "Cache-Control": "no-store"
        });
        response.end(error ? "Not found" : data);
    });
}).listen(4174, "127.0.0.1", () => {
    console.log("JC Kainan preview: http://127.0.0.1:4174");
});
