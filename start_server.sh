#!/bin/bash
cd "$(dirname "$0")"
export PORT=8080
exec python3 server.py
