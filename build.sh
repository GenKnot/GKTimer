#!/bin/bash

echo "Building GKTimer for all platforms..."

# Install dependencies
echo "Installing frontend dependencies..."
npm install

# Build for macOS (Intel)
echo "Building for macOS (Intel)..."
cargo tauri build --target x86_64-apple-darwin

# Build for macOS (Apple Silicon)
echo "Building for macOS (Apple Silicon)..."
cargo tauri build --target aarch64-apple-darwin

# Build for Windows
echo "Building for Windows..."
cargo tauri build --target x86_64-pc-windows-msvc

# Build for Linux
echo "Building for Linux..."
cargo tauri build --target x86_64-unknown-linux-gnu

echo "Build complete! Check src-tauri/target/*/release/bundle/ for installers"
