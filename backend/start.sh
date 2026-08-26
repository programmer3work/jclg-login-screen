#!/bin/bash
cd /home/ubuntu/jclg-login-screen/backend
exec .venv/bin/uvicorn main:app --host 0.0.0.0 --port 16000