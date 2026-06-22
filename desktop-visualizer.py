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

def on_permission_decision(web_view, decision):
    # Auto-grant audio permission for visualizer input capture
    if decision.get_permission_type() == WebKit2.PermissionType.AUDIO_CAPTURE:
        decision.grant()
        return True
    return False

def make_click_through(window):
    # Use Cairo empty region to make window click-through
    region = cairo.Region()
    window.input_shape_combine_region(region)


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Wayland desktop background audio visualizer.")
    parser.add_argument("--style", choices=["bars", "eq", "wave", "pulse"], default="bars", help="Visualization style")
    parser.add_argument("--height", type=int, default=180, help="Visualizer height in pixels")
    args = parser.parse_args()

    window = Gtk.Window()
    window.set_title("Nix Audio Visualizer Background Component")

    # Enable transparent RGBA rendering visual
    screen = window.get_screen()
    visual = screen.get_rgba_visual()
    if visual:
        window.set_visual(visual)

    # Initialize Wayland layer-shell protocol
    GtkLayerShell.init_for_window(window)

    # Place on background layer (behind all windows and toolbars)
    GtkLayerShell.set_layer(window, GtkLayerShell.Layer.BACKGROUND)
    
    # Anchor to bottom-left-right of screen
    GtkLayerShell.set_anchor(window, GtkLayerShell.Edge.BOTTOM, True)
    GtkLayerShell.set_anchor(window, GtkLayerShell.Edge.LEFT, True)
    GtkLayerShell.set_anchor(window, GtkLayerShell.Edge.RIGHT, True)
    GtkLayerShell.set_anchor(window, GtkLayerShell.Edge.TOP, False)
    
    # Disable keyboard focus grabs
    GtkLayerShell.set_keyboard_mode(window, GtkLayerShell.KeyboardMode.NONE)

    # Force a specific request size height
    window.set_size_request(-1, args.height)

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
    window.connect("realize", make_click_through)
    window.connect("destroy", Gtk.main_quit)

    # Load local index.html with style query parameter
    local_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "visualizer", "index.html"))
    webview.load_uri(f"file://{local_path}?style={args.style}")

    window.add(webview)
    window.show_all()
    Gtk.main()


if __name__ == "__main__":
    main()
