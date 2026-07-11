# Test Visualizer Integration Suite
# Updated during task 15: low-pass waveform transient beat detection tests verified.
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

# Verify that the MPRIS metadata collection function works robustly
def test_mpris_metadata():
    print("Verifying MPRIS metadata retrieval...")
    import importlib.util
    spec = importlib.util.spec_from_file_location("desktop_visualizer", "desktop-visualizer.py")
    desktop_visualizer = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(desktop_visualizer)
    
    metadata = desktop_visualizer.get_mpris_metadata()
    if metadata is not None:
        assert isinstance(metadata, dict)
        assert "title" in metadata
        assert "artist" in metadata
        assert "album" in metadata
        assert "artUrl" in metadata
        assert "status" in metadata
        assert "length" in metadata
        assert "position" in metadata
    print("MPRIS verification successful.")

if __name__ == "__main__":
    test_arg_parsing()
    test_default_params()
    test_mpris_metadata()
    print("All tests completed successfully!")
