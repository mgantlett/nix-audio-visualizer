#!/usr/bin/env bash
run_lint() {
    echo "Running workspace syntax validation..."
    python3 -m py_compile desktop-visualizer.py test_visualizer.py || exit 1
    echo "Syntax validation successful!"
}
