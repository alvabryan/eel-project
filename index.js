// Importing necessary modules
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const client = require("prom-client");
const multer = require("multer");
const responseTime = require("response-time");
const Sentiment = require('sentiment');

// PORT server is running on
const PORT = 3001;

// Importing TensorFlow and MobileNet for image classification
const mobilenet = require('@tensorflow-models/mobilenet');
const tfnode = require('@tensorflow/tfjs-node');

// Initialize multer for file parsing
var multParse = multer();

// Setting up Prometheus metrics for HTTP request duration
const restResponseTimeHistogram = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds.',
    labelNames: ["method", "route", "status_code"],
    buckets: [0.000001, 0.00001, 0.0001,0.001,0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10], // Buckets in seconds
})

// Collect default metrics for monitoring
const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics();

// Initialize Express application
const app = express();

// Middleware setup for CORS, body parsing, and URL encoding
app.use(cors({ origin: true }));
app.use(bodyParser.json({limit: '50mb'}));
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST");
    res.header("Access-Control-Allow-Headers", "Origin, Content-Type, x-requested-with");
    next();
});

// Middleware for logging response time and observing it via Prometheus histogram
app.use(
    responseTime((req, res, time) => {
        time = time / 1000;
        if (req?.route?.path && req.route.path !== '/metrics') {
            restResponseTimeHistogram.observe(
                { method: req.method, route: req.route.path, status_code: res.statusCode },
                time
            );
            // Additional logging for image upload route
            if (req.route.path === '/image-upload') {
                const restReq = { responseTime: time, method: req.method, path: req.route.path, reqFilename: req.file.originalname };
                console.log(restReq);
            } else {
                const restReq = { responseTime: time, method: req.method, path: req.route.path, reqData: req.body.data };
                console.log(restReq);
            }
        }
    })
);

// Function for classifying images using MobileNet model
const imageClassification = async image => {
    const mobilenetModel = await mobilenet.load();
    const predictions = await mobilenetModel.classify(image);
    return predictions;
}

// Endpoint for image upload and classification
app.post("/image-upload", multParse.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).send("Please upload a valid image");
        }

        const file = req.file.buffer; // Assuming the file buffer is available here

        // Decode the image using TensorFlow
        let tfimage;
        try {
            tfimage = tfnode.node.decodeImage(file);
        } catch (error) {
            console.error("Error decoding image:", error);
            return res.status(500).send("Error processing the image");
        }

        // Classify the image
        let predictions;
        try {
            predictions = await imageClassification(tfimage);
        } catch (error) {
            console.error("Error classifying image:", error);
            return res.send("Error classifying the image");
        }

        // Format the predictions
        let predictionText = '\nPredictions:\n';
        predictions.forEach((pred) => {
            predictionText += `${pred.className}: ${(pred.probability * 100).toFixed(2)}%\n`;
        });

        console.log('File processed successfully: ' + req.file.originalname + predictionText);
        res.send('File processed successfully: ' + req.file.originalname + predictionText);

    } catch (error) {
        console.error("Server error:", error);
        res.status(500).send("An error occurred on the server");
    }
});

// Endpoint for text upload and sentiment analysis
app.post("/text-upload", (req, res) => {
    if (!req.body.data) {
        return res.status(400).send('No data was uploaded.');
    }

    var sentiment = new Sentiment();
    var result = sentiment.analyze(req.body.data.sentence);
    res.send('Data processed successfully: ' + req.body.data + '\n' + 'Sentiment Score: ' + result.score);
});

// Endpoint for text upload and sentiment analysis
app.post("/csv-row-process", (req, res) => {
    if (!req.body.data) {
        return res.status(400).send('No data was uploaded.');
    }

    var data = req.body.data;
    var fahrenheit = data.AvgTemperature * 9 / 5 + 32;
    var celsius = data.AvgTemperature;
    res.send('Data processed successfully: ' + req.body.data + '\n' + 'Fahrenheit: ' + fahrenheit + '\n' + 'Celsius: ' + celsius);
});

// Endpoint to serve Prometheus metrics
app.get("/metrics", async (req, res) => {
    res.set("Content-Type", client.register.contentType);
    return res.send(await client.register.metrics());
});

// Start the server on PORT
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
