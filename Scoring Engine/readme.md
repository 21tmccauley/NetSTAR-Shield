# Scoring Engine

## Current Functionality
As of November 11th, this code can do the following:
* Uses `curl` to call NetSTAR endpoints (cert, dns, hval, mail, method, rdap)
* Gives each endpoint a score based off of scoring matrix document
* Puts all the endpoints through the scoring engine (using harmonic mean) to get final score
* Presents the deductions and final aggregate score

What it is missing:
* The information from each endpoint is not separated into the specific tools they correlate with
* Exceptions are needed for when data is missing
* Research into the cert endpoint's reliability is needed (most prone to timeout)
These functionalities will be included next

## How to use the Code
Use `python score_engine.py -h` to get the basic flag info

if run without a target URL, it will default to netstar.ai

run `python score_engine.py -t [TARGET URL]` to test against target URL
* If the cert scan fails, running it again may work

