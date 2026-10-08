#!/bin/sh
set -e
node --test tests/
node tests/simulation.js
