#!/bin/bash
cd /home/ubuntu/jclg-login-screen/backend
exec .venv/bin/uvicorn main:app --host 127.0.0.1 --port 16000