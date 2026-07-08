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

from gi.repository import Gtk, Gdk, GtkLayerShell, WebKit2, GLib

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
menu_height = 250

# Setup initial click-through window shape
visualizer_position = "bottom"
menu_height = 250

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

    if visualizer_position == "left":
        gear_rect = cairo.RectangleInt(visualizer_height - 40, height - visualizer_height, 40, visualizer_height)
        region.union(gear_rect)
        if menu_open:
            menu_rect = cairo.RectangleInt(10, height - (visualizer_height + menu_height + 10), 220, menu_height)
            region.union(menu_rect)
    elif visualizer_position == "right":
        gear_rect = cairo.RectangleInt(width - 40, height - visualizer_height, 40, visualizer_height)
        region.union(gear_rect)
        if menu_open:
            menu_rect = cairo.RectangleInt(width - 230, height - (visualizer_height + menu_height + 10), 220, menu_height)
            region.union(menu_rect)
    elif visualizer_position == "top":
        gear_rect = cairo.RectangleInt(width - 40, 0, 40, visualizer_height)
        region.union(gear_rect)
        if menu_open:
            menu_rect = cairo.RectangleInt(width - 230, visualizer_height + 10, 220, menu_height)
            region.union(menu_rect)
    elif visualizer_position == "fullscreen":
        gear_rect = cairo.RectangleInt(width - 40, height - 45, 40, 45)
        region.union(gear_rect)
        if menu_open:
            menu_rect = cairo.RectangleInt(width - 230, height - (45 + menu_height + 10), 220, menu_height)
            region.union(menu_rect)
    else:  # bottom
        gear_rect = cairo.RectangleInt(width - 40, height - visualizer_height, 40, visualizer_height)
        region.union(gear_rect)
        if menu_open:
            menu_rect = cairo.RectangleInt(width - 230, height - (visualizer_height + menu_height + 10), 220, menu_height)
            region.union(menu_rect)

    window.input_shape_combine_region(region)

# Handle window title update events
def on_title_changed(webview, pspec, window):
    """Handle JS-to-Python communication via window title changes."""
    global menu_open, menu_height
    title = webview.get_title()
    if title:
        try:
            import json
            data = json.loads(title)
            action = data.get("action")
            if action == "menu-toggle":
                menu_open = bool(data.get("open", False))
                menu_height = int(data.get("menuHeight", 250))
                # Adjust Gtk window height dynamically only for bottom and top positions
                if visualizer_position in ["bottom", "top"]:
                    target_height = (visualizer_height + menu_height + 15) if menu_open else visualizer_height
                    window.resize(window.get_size()[0], target_height)
                    window.set_size_request(0, target_height)
                # Re-evaluate the input shape region
                window.queue_resize()
            elif action == "menu-resize":
                menu_height = int(data.get("menuHeight", 250))
                if menu_open:
                    if visualizer_position in ["bottom", "top"]:
                        target_height = (visualizer_height + menu_height + 15)
                        window.resize(window.get_size()[0], target_height)
                        window.set_size_request(0, target_height)
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
    parser.add_argument("--style", choices=["bars", "eq", "wave", "pulse", "vu", "waterfall", "ribbon", "particles"], default="bars", help="Visualization style")
    parser.add_argument("--height", type=int, default=45, help="Visualizer height/width in pixels")
    parser.add_argument("--device", default="alsa_output.pci-0000_01_00.1.hdmi-surround71.monitor", help="PulseAudio/PipeWire capture source device name")
    parser.add_argument("--position", choices=["bottom", "top", "left", "right", "fullscreen"], default="bottom", help="Screen edge position")
    args = parser.parse_args()

    if args.device:
        os.environ["PULSE_SOURCE"] = args.device
        os.environ["PIPEWIRE_NODE"] = args.device

    window = Gtk.Window()
    window.set_title("Nix Audio Visualizer Background Component")

    # Force transparent window background via GTK CSS provider
    css_provider = Gtk.CssProvider()
    css_provider.load_from_data(b"window { background: transparent; }")
    window.get_style_context().add_provider(css_provider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION)

    # Enable transparent RGBA rendering visual
    screen = window.get_screen()
    visual = screen.get_rgba_visual()
    if visual:
        window.set_visual(visual)

    # Initialize Wayland layer-shell protocol
    GtkLayerShell.init_for_window(window)

    # Place on bottom layer (behind normal windows but above desktop wallpaper)
    GtkLayerShell.set_layer(window, GtkLayerShell.Layer.BOTTOM)
    
    global visualizer_position, visualizer_height
    visualizer_position = args.position
    visualizer_height = args.height

    # Anchor and size request based on position
    if args.position == "bottom":
        GtkLayerShell.set_anchor(window, GtkLayerShell.Edge.BOTTOM, True)
        GtkLayerShell.set_anchor(window, GtkLayerShell.Edge.LEFT, True)
        GtkLayerShell.set_anchor(window, GtkLayerShell.Edge.RIGHT, True)
        GtkLayerShell.set_anchor(window, GtkLayerShell.Edge.TOP, False)
        window.set_size_request(0, args.height)
    elif args.position == "top":
        GtkLayerShell.set_anchor(window, GtkLayerShell.Edge.TOP, True)
        GtkLayerShell.set_anchor(window, GtkLayerShell.Edge.LEFT, True)
        GtkLayerShell.set_anchor(window, GtkLayerShell.Edge.RIGHT, True)
        GtkLayerShell.set_anchor(window, GtkLayerShell.Edge.BOTTOM, False)
        window.set_size_request(0, args.height)
    elif args.position == "left":
        GtkLayerShell.set_anchor(window, GtkLayerShell.Edge.LEFT, True)
        GtkLayerShell.set_anchor(window, GtkLayerShell.Edge.TOP, True)
        GtkLayerShell.set_anchor(window, GtkLayerShell.Edge.BOTTOM, True)
        GtkLayerShell.set_anchor(window, GtkLayerShell.Edge.RIGHT, False)
        window.set_size_request(250, 0)
    elif args.position == "right":
        GtkLayerShell.set_anchor(window, GtkLayerShell.Edge.RIGHT, True)
        GtkLayerShell.set_anchor(window, GtkLayerShell.Edge.TOP, True)
        GtkLayerShell.set_anchor(window, GtkLayerShell.Edge.BOTTOM, True)
        GtkLayerShell.set_anchor(window, GtkLayerShell.Edge.LEFT, False)
        window.set_size_request(250, 0)
    elif args.position == "fullscreen":
        GtkLayerShell.set_anchor(window, GtkLayerShell.Edge.LEFT, True)
        GtkLayerShell.set_anchor(window, GtkLayerShell.Edge.RIGHT, True)
        GtkLayerShell.set_anchor(window, GtkLayerShell.Edge.TOP, True)
        GtkLayerShell.set_anchor(window, GtkLayerShell.Edge.BOTTOM, True)
    
    # Enable keyboard focus grabs on demand
    GtkLayerShell.set_keyboard_mode(window, GtkLayerShell.KeyboardMode.ON_DEMAND)

    # Start the background audio auto-routing daemon
    import threading
    t = threading.Thread(target=auto_route_audio, args=(args.device,), daemon=True)
    t.start()

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
    webview.load_uri(f"file://{local_path}?style={args.style}&height={args.height}&device={args.device}&position={args.position}")

    window.add(webview)
    window.show_all()
    Gtk.main()


if __name__ == "__main__":
    main()
