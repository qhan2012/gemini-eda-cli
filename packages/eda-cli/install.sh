#!/bin/bash

# Installation script for gemini-eda-v0_1
# This script builds and installs the EDA CLI globally

set -e

echo "Building Gemini EDA CLI..."

# Build the package
npm run build

echo "Installing globally..."

# Install globally
npm install -g .

echo "Installation complete!"
echo ""
echo "You can now run: gemini-eda-v0_1"
echo ""
echo "Example usage:"
echo "  gemini-eda-v0_1"
echo "  # Then inside the REPL:"
echo "  gemini-eda › /eda:recipe:init"
echo "  gemini-eda › /eda:run recipes/synth_resyn2.ys --seed 1"


