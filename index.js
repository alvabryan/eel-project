const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const functions = require("firebase-functions");
const multer = require("multer");
const { startMetricsServer, restResponseTimeHistogram } = require("./utils/metrics.js");
const responseTime = require("response-time");

const app = express();

var multParse = multer();

app.use(cors({ origin: true }));
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST");
    res.header("Access-Control-Allow-Headers", "Origin, Content-Type, x-requested-with");
    next();
});

app.use(
    responseTime((req, res, time) => {
        if (req?.route?.path) {
            restResponseTimeHistogram.observe(
                {
                    method: req.method,
                    route: req.route.path,
                    status_code: res.statusCode,
                },
                time
            );
            console.log(time);
        }
    })
);

// IMPLEMENT FILE UPLOAD ROUTE
app.post("/image-upload", multParse.single('file'), (req, res) => {
    setTimeout(() => {
        console.log('File uploaded successfully:', req.file.originalname);
        res.send('File uploaded successfully: ' + req.file.originalname);
    }, Math.random()*1000);
});

// IMPLEMENT TEXT UPLOAD ROUTE
app.post("/text-upload", (req, res) => {
    // console.log(req.body);
    // res.send("Received");
    if (!req.body.data) {
        return res.status(400).send('No data was uploaded.');
    }

    console.log('Data uploaded successfully:', req.body.data);
    res.send('Data uploaded successfully: ' + req.body.data);
});

// IMPLEMENT MIDDLEWARE FOR ANALYSIS

// exports.app = functions.https.onRequest(app);
app.listen(3000, () => {
    console.log("Server listening on port 3000");
    startMetricsServer();
});