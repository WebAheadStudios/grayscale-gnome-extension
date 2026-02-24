#!/bin/bash
# Build script for GNOME Shell Grayscale Toggle Extension

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="$PROJECT_ROOT/build"
DIST_DIR="$PROJECT_ROOT/dist"
EXTENSION_UUID="grayscale-toggle@luiz.dev"

echo "Building GNOME Shell Grayscale Toggle Extension..."
echo "Project root: $PROJECT_ROOT"

# Clean previous builds
echo "Cleaning previous builds..."
rm -rf "$BUILD_DIR" "$DIST_DIR"
mkdir -p "$BUILD_DIR" "$DIST_DIR"

# Copy source files
echo "Copying source files..."
cp -r "$PROJECT_ROOT/src/"* "$BUILD_DIR/"

# Compile GSettings schema
echo "Compiling GSettings schema..."
mkdir -p "$BUILD_DIR/schemas"
cp "$PROJECT_ROOT/schemas/"*.gschema.xml "$BUILD_DIR/schemas/"

if command -v glib-compile-schemas &> /dev/null; then
    glib-compile-schemas "$BUILD_DIR/schemas"
    echo "GSettings schema compiled successfully"
else
    echo "Warning: glib-compile-schemas not found. Schema will be compiled during installation."
fi

# Process translations (if any exist)
echo "Processing translations..."
if [ -d "$PROJECT_ROOT/po" ] && [ "$(ls -A "$PROJECT_ROOT/po"/*.po 2>/dev/null)" ]; then
    mkdir -p "$BUILD_DIR/locale"
    for po_file in "$PROJECT_ROOT/po/"*.po; do
        if [ -f "$po_file" ]; then
            lang=$(basename "$po_file" .po)
            mkdir -p "$BUILD_DIR/locale/$lang/LC_MESSAGES"
            
            if command -v msgfmt &> /dev/null; then
                msgfmt "$po_file" -o "$BUILD_DIR/locale/$lang/LC_MESSAGES/grayscale-toggle.mo"
                echo "Compiled translation for $lang"
            else
                echo "Warning: msgfmt not found. Skipping $lang translation."
            fi
        fi
    done
else
    echo "No translation files found, skipping..."
fi

# Validate metadata.json
echo "Validating metadata..."
if command -v python3 &> /dev/null; then
    if python3 -m json.tool "$BUILD_DIR/metadata.json" > /dev/null; then
        echo "metadata.json is valid"
    else
        echo "Error: Invalid metadata.json"
        exit 1
    fi
else
    echo "Warning: python3 not found. Skipping metadata validation."
fi

# Run pre-build validation
echo "Running pre-build validation..."

# Check for TypeScript compilation (if applicable)
if command -v tsc &> /dev/null && [ -f "$PROJECT_ROOT/tsconfig.json" ]; then
    echo "Running TypeScript validation..."
    tsc --noEmit --project "$PROJECT_ROOT" || echo "Warning: TypeScript validation failed"
fi

# Check JavaScript syntax
if command -v node &> /dev/null; then
    echo "Checking JavaScript syntax..."
    for js_file in "$BUILD_DIR"/*.js; do
        if [ -f "$js_file" ]; then
            node -c "$js_file" || {
                echo "Error: Syntax error in $(basename "$js_file")"
                exit 1
            }
        fi
    done
    echo "JavaScript syntax check passed"
fi

# Create distribution package
echo "Creating distribution package..."
cd "$BUILD_DIR"

# Create zip package
zip -r "$DIST_DIR/${EXTENSION_UUID}.zip" . -x "*.DS_Store" "*/.*"

echo ""
echo "Build completed successfully!"
echo "Package location: $DIST_DIR/${EXTENSION_UUID}.zip"
echo ""

# Display package contents
echo "Package contents:"
unzip -l "$DIST_DIR/${EXTENSION_UUID}.zip"

echo ""
echo "Installation instructions:"
echo "1. Install: bash install.sh"
echo "2. Or manually: unzip -o '$DIST_DIR/${EXTENSION_UUID}.zip' -d '\$HOME/.local/share/gnome-shell/extensions/$EXTENSION_UUID/'"
echo "3. Enable: gnome-extensions enable $EXTENSION_UUID"
echo "4. Restart GNOME Shell: Alt+F2, type 'r', press Enter (X11) or log out/in (Wayland)"