const express = require("express");
const { spawn } = require("child_process");
const adjustScanOutput = require("./adjustScanOutput");
const app = express();

// Simple endpoint: /scan?domain=example.com
app.get("/scan", (req, res) => {
  const domain = req.query.domain || "netstar.ai";

  const py = spawn("python3", ["score_engine.py", "-t", domain]);

  let output = "";
  let error = "";

  py.stdout.on("data", (data) => output += data.toString());
  py.stderr.on("data", (data) => error += data.toString());

  py.on("close", (code) => {
    if (code !== 0) {
      return res.status(500).json({ error });
    }

    try {
      const raw = JSON.parse(output);
      const adjusted = adjustScanOutput(raw);
      res.json(adjusted);
    } catch (err) {
      res.status(500).json({ error: "Invalid JSON from Python" });
    }
    //res.send(output); // return python script output
  });
});

app.listen(3000, () => console.log("Server running on port 3000"));
