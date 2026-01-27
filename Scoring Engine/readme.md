# Scoring Engine

## Current Functionality
As of December 8th, this code can do the following:
* Uses `curl` to call NetSTAR endpoints (cert, dns, hval, mail, method, rdap)
* Gives each category a score using telemetry from the endpoints and based off of the scoring matrix document
* Puts all the cateogory scores through the scoring engine (using harmonic mean) to get final score
* Presents the final scores and url in JSON
* If -v added, presents deductions, runtime, and other error information

What it is missing:
* Exceptions are needed for when data is missing
* The WHOIS Pattern scoring has mostly been implemented. Just missing registrar grading
* All scoring needs to be reviewed and finetuned 
* Adding in gates for the specified tools (once grading is migrated to tool format)
These functionalities will be included next

## How to use the Code
Use `python scoring_main.py -h` to get the basic flag info

if run without a target URL, it will default to netstar.ai

run `python scoring_main.py -t [TARGET URL]` to test against target URL
* If the cert scan fails, running it again may work

run `python scoring_main.py -v` to get additional information on the execution of curl commands, reasons for score deductions, and runtime information

