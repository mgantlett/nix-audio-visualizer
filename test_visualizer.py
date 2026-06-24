import subprocess
import sys

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
    print("Argument verification successful.")

if __name__ == "__main__":
    test_arg_parsing()
    print("All tests completed successfully!")
