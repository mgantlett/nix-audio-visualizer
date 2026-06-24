import subprocess
import sys

# Verify that desktop-visualizer.py accepts CLI arguments properly
def test_arg_parsing():
    print("Verifying --help argument output...")
    result = subprocess.run(
        [sys.executable, "desktop-visualizer.py", "--help"],
        capture_output=True,
        text=True
    )
    assert result.returncode == 0, f"Expected exit code 0, got {result.returncode}"
    assert "--style" in result.stdout, "Missing --style option"
    assert "--height" in result.stdout, "Missing --height option"
    assert "--device" in result.stdout, "Missing --device option"
    print("Argument verification successful.")

# Verify that the default parameters in desktop-visualizer.py are correct
def test_default_params():
    print("Verifying default arguments...")
    result = subprocess.run(
        [sys.executable, "desktop-visualizer.py", "--help"],
        capture_output=True,
        text=True
    )
    assert "--style" in result.stdout
    assert "bars" in result.stdout
    print("Default verification successful.")

if __name__ == "__main__":
    test_arg_parsing()
    test_default_params()
    print("All tests completed successfully!")
