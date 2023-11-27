const express = require("express");
const client = require("prom-client");
const log = require("./logger.js");

const app = express();

const restResponseTimeHistogram = new client.Histogram({
    name: 'http_request_duration_milliseconds',
    help: 'Duration of HTTP requests in milliseconds.',
    labelNames: ["method", "route", "status_code"],
    buckets: [50000,25000,15000,10000,9000,8000,7000,6000,5000,4000,3000,2000,1000],
});

function startMetricsServer() {
    const collectDefaultMetrics = client.collectDefaultMetrics;

    collectDefaultMetrics();

    app.get("/metrics", async (req, res) => {
        res.set("Content-Type", client.register.contentType);

        return res.send(await client.register.metrics());
    });

    app.listen(9100, () => {
        log.info("Metrics server started at http://localhost:9100");
    });
}

module.exports = {
    startMetricsServer, restResponseTimeHistogram
};