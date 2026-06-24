#!/usr/bin/env python3
import os
import sys
import gi
import cairo

# Lock library versions
gi.require_version('Gtk', '3.0')
gi.require_version('GtkLayerShell', '0.1')
gi.require_version('Gdk', '3.0')
gi.require_version('WebKit2', '4.1')

from gi.repository import Gtk, Gdk, GtkLayerShell, WebKit2

# Handle WebKitGTK permission requests
def on_permission_decision(web_view, decision):
    # Auto-grant audio permission for visualizer input capture
    if isinstance(decision, WebKit2.UserMediaPermissionRequest):
        if decision.props.is_for_audio_device:
            decision.allow()
            return True
    return False

# State track for controls popup
menu_open = False
visualizer_height = 45

# Setup initial click-through window shape
def make_click_through(window):
    """Set initial input shape to empty region so it is click-through."""
    region = cairo.Region()
    window.input_shape_combine_region(region)

# Update clickable region for controls menu
def update_input_shape(window, allocation):
    """Update window input shape region so only gear button and menu capture clicks."""
    region = cairo.Region()
    width = allocation.width
    height = allocation.height

    # Bottom-right corner gear button is always clickable (40px wide, visualizer_height high)
    gear_rect = cairo.RectangleInt(width - 40, height - visualizer_height, 40, visualizer_height)
    region.union(gear_rect)

    if menu_open:
        # Floating popup controls menu (220x240 box) sitting above the visualizer bars
        menu_rect = cairo.RectangleInt(width - 230, height - (visualizer_height + 245), 220, 240)
        region.union(menu_rect)

    window.input_shape_combine_region(region)

# Handle window title update events
def on_title_changed(webview, pspec, window):
    """Handle JS-to-Python communication via window title changes."""
    global menu_open
    title = webview.get_title()
    if title:
        try:
            import json
            data = json.loads(title)
            action = data.get("action")
            if action == "menu-toggle":
                menu_open = bool(data.get("open", False))
                # Adjust Gtk window height dynamically sitting above visualizer height (240px menu + padding)
                target_height = (visualizer_height + 255) if menu_open else visualizer_height
                window.resize(window.get_size()[0], target_height)
                window.set_size_request(0, target_height)
                # Re-evaluate the input shape region
                window.queue_resize()
            elif action == "close":
                Gtk.main_quit()
        except Exception:
            pass

# Route WebKit recording stream to HDMI
def auto_route_audio(target_device):
    """Periodically check and route the WebKit audio stream to target HDMI monitor."""
    import subprocess
    import time
    print(f"🔊 Auto-routing daemon started. Target: {target_device}", flush=True)
    start_time = time.time()
    while time.time() - start_time < 20: # loop for 20 seconds
        time.sleep(0.5)
        try:
            output = subprocess.check_output(["pactl", "list", "source-outputs"], text=True)
            blocks = output.split("Source Output #")
            for block in blocks:
                if not block.strip():
                    continue
                lines = block.split("\n")
                source_output_id = lines[0].split()[0]
                
                is_webkit = False
                for line in lines:
                    if "application.name =" in line and "WebKitWebProcess" in line:
                        is_webkit = True
                
                if is_webkit:
                    print(f"🔊 Auto-routing WebKitWebProcess stream {source_output_id} to {target_device}...", flush=True)
                    subprocess.run(["pactl", "move-source-output", source_output_id, target_device], capture_output=True)
                    return
        except Exception:
            pass



def main():
    import argparse
    parser = argparse.ArgumentParser(description="Wayland desktop background audio visualizer.")
    parser.add_argument("--style", choices=["bars", "eq", "wave", "pulse"], default="bars", help="Visualization style")
    parser.add_argument("--height", type=int, default=45, help="Visualizer height in pixels")
    parser.add_argument("--device", default="alsa_output.pci-0000_01_00.1.hdmi-surround71.monitor", help="PulseAudio/PipeWire capture source device name")
    args = parser.parse_args()

    if args.device:
        os.environ["PULSE_SOURCE"] = args.device
        os.environ["PIPEWIRE_NODE"] = args.device

    window = Gtk.Window()
    window.set_title("Nix Audio Visualizer Background Component")

    # Enable transparent RGBA rendering visual
    screen = window.get_screen()
    visual = screen.get_rgba_visual()
    if visual:
        window.set_visual(visual)

    # Initialize Wayland layer-shell protocol
    GtkLayerShell.init_for_window(window)

    # Place on bottom layer (behind normal windows but above desktop wallpaper)
    GtkLayerShell.set_layer(window, GtkLayerShell.Layer.BOTTOM)
    
    # Anchor to bottom-left-right of screen
    GtkLayerShell.set_anchor(window, GtkLayerShell.Edge.BOTTOM, True)
    GtkLayerShell.set_anchor(window, GtkLayerShell.Edge.LEFT, True)
    GtkLayerShell.set_anchor(window, GtkLayerShell.Edge.RIGHT, True)
    GtkLayerShell.set_anchor(window, GtkLayerShell.Edge.TOP, False)
    
    # Disable keyboard focus grabs
    GtkLayerShell.set_keyboard_mode(window, GtkLayerShell.KeyboardMode.NONE)

    global visualizer_height
    visualizer_height = args.height

    # Start the background audio auto-routing daemon
    import threading
    t = threading.Thread(target=auto_route_audio, args=(args.device,), daemon=True)
    t.start()

    # Force a specific request size height
    window.set_size_request(0, args.height)

    # Instantiate WebView
    webview = WebKit2.WebView()
    
    # Enable WebAudio and MediaStream in WebKitGTK settings
    settings = webview.get_settings()
    settings.set_enable_write_console_messages_to_stdout(True)
    settings.set_enable_media_stream(True)
    
    # Transparent web view background
    bg_color = Gdk.RGBA()
    bg_color.red, bg_color.green, bg_color.blue, bg_color.alpha = 0.0, 0.0, 0.0, 0.0
    webview.set_background_color(bg_color)

    # Connect signals
    webview.connect("permission-request", on_permission_decision)
    webview.connect("notify::title", on_title_changed, window)
    window.connect("realize", make_click_through)
    window.connect("size-allocate", update_input_shape)
    window.connect("destroy", Gtk.main_quit)

    # Load local index.html with query parameters
    local_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "visualizer", "index.html"))
    webview.load_uri(f"file://{local_path}?style={args.style}&height={args.height}&device={args.device}")

    window.add(webview)
    window.show_all()
    Gtk.main()


if __name__ == "__main__":
    main()
