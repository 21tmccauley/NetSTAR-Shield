# Scoring Engine

## Current Functionality
As of December 8th, this code can do the following:
* Uses `curl` to call NetSTAR endpoints (cert, dns, hval, mail, method, rdap)
* Gives each category a score using telemetry from the endpoints and based off of the scoring matrix document
* Puts all the cateogory scores through the scoring engine (using harmonic mean) to get final score
* Presents the deductions and final scores

What it is missing:
* Exceptions are needed for when data is missing
* The WHOIS Pattern scoring has not been implemented
* All scoring needs to be reviewed and finetuned 
* Adding in gates for the specified tools (once grading is migrated to tool format)
* Bug Fix: Final score printing to screen creates duplicates
These functionalities will be included next

## How to use the Code
Use `python scoring_main.py -h` to get the basic flag info

if run without a target URL, it will default to netstar.ai

run `python scoring_main.py -t [TARGET URL]` to test against target URL
* If the cert scan fails, running it again may work
