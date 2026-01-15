const express = require("express");
const { spawn } = require("child_process");
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
    res.send(output); // return python script output
  });
});

app.listen(3000, () => console.log("Server running on port 3000"));
