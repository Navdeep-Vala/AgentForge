#!/bin/bash
set -e
cd "$(dirname "$0")"

echo "🔨 Building AgentForge sandbox image..."
docker build -t agentforge-sandbox:latest .

# Verify Chrome works
echo "✅ Verifying Chrome installation..."
docker run --rm agentforge-sandbox:latest chromium --version

echo "✅ Sandbox image built successfully!"
