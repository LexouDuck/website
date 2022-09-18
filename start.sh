#!/bin/bash -e

open http://localhost:8000/pages/index.html
python3 -m http.server
