#!/usr/bin/env python3
import os
import sys
import json
import subprocess
import socket
import threading
import warnings
warnings.filterwarnings("ignore", category=DeprecationWarning)
import gi
import cairo

# Lock library versions
gi.require_version('Gtk', '3.0')
gi.require_version('GtkLayerShell', '0.1')
gi.require_version('Gdk', '3.0')
gi.require_version('WebKit2', '4.1')
try:
    gi.require_version('Playerctl', '2.0')
except Exception:
    pass

from gi.repository import Gtk, Gdk, GtkLayerShell, WebKit2, GLib, Gio

# Handle WebKitGTK permission requests
def on_permission_decision(web_view, decision):
    # Auto-grant audio permission for visualizer input capture
    if isinstance(decision, WebKit2.UserMediaPermissionRequest):
        if decision.props.is_for_audio_device:
            decision.allow()
            return True
    return False

def inhibit_sleep():
    """Inhibit the screensaver via DBus while the visualizer is running."""
    try:
        bus = Gio.bus_get_sync(Gio.BusType.SESSION, None)
        proxy = Gio.DBusProxy.new_sync(
            bus, Gio.DBusProxyFlags.NONE, None,
            "org.freedesktop.ScreenSaver",
            "/org/freedesktop/ScreenSaver",
            "org.freedesktop.ScreenSaver", None
        )
        cookie = proxy.call_sync("Inhibit", GLib.Variant("(ss)", ("Nix Audio Visualizer", "Visualizer is running")), Gio.DBusCallFlags.NONE, -1, None)
        print(f"Screensaver inhibited (cookie: {cookie.unpack()[0]})")
    except Exception as e:
        print(f"Failed to inhibit screensaver via DBus: {e}")

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

def handle_media_control(cmd):
    """Handle media control commands."""
    if cmd == "prev":
        cmd = "previous"
    if cmd not in ["play-pause", "next", "previous", "play", "pause"]:
        return
        
    try:
        from gi.repository import Playerctl
        players = Playerctl.list_players()
        if not players:
            return
            
        target_name = next((p for p in players if "chromium" in p.name or "chrome" in p.name), players[0])
        player = Playerctl.Player.new_from_name(target_name)
        
        if cmd == "play":
            player.play()
        elif cmd == "pause":
            player.pause()
        elif cmd == "play-pause":
            player.play_pause()
        elif cmd == "next":
            player.next()
        elif cmd == "previous":
            player.previous()
    except Exception:
        try:
            subprocess.run(["playerctl", cmd], capture_output=True)
        except Exception:
            pass

def _handle_menu_toggle(data, window):
    global menu_open, menu_height
    menu_open = bool(data.get("open", False))
    menu_height = int(data.get("menuHeight", 250))
    GtkLayerShell.set_layer(window, GtkLayerShell.Layer.TOP if menu_open else GtkLayerShell.Layer.BOTTOM)
    if visualizer_position in ["top", "bottom"]:
        target_height = (visualizer_height + menu_height + 15) if menu_open else visualizer_height
        window.set_size_request(0, target_height)
        window.resize(window.get_size()[0], target_height)
    window.queue_resize()

def _handle_menu_resize(data, window):
    global menu_open, menu_height
    menu_height = int(data.get("menuHeight", 250))
    if menu_open and visualizer_position in ["bottom", "top"]:
        target_height = (visualizer_height + menu_height + 15)
        window.resize(window.get_size()[0], target_height)
        window.set_size_request(0, target_height)
    window.queue_resize()

# Handle window title update events
def on_title_changed(webview, pspec, window):
    """Handle JS-to-Python communication via window title changes."""
    title = webview.get_title()
    if not title: return
    try:
        data = json.loads(title)
        action = data.get("action")
        if action == "menu-toggle": _handle_menu_toggle(data, window)
        elif action == "menu-resize": _handle_menu_resize(data, window)
        elif action == "close": Gtk.main_quit()
        elif action == "media-control": handle_media_control(data.get("command"))
    except Exception: pass

# Route WebKit recording stream to HDMI
def _check_and_route_block(block, target_device):
    if not block.strip(): return False
    lines = block.split("\n")
    source_output_id = lines[0].split()[0]
    is_webkit = any("application.name =" in line and "WebKitWebProcess" in line for line in lines)
    if is_webkit:
        print(f"🔊 Auto-routing WebKitWebProcess stream {source_output_id} to {target_device}...", flush=True)
        import subprocess
        subprocess.run(["pactl", "move-source-output", source_output_id, target_device], capture_output=True)
        return True
    return False

def auto_route_audio(target_device):
    """Periodically check and route the WebKit audio stream to target HDMI monitor."""
    import subprocess, time
    print(f"🔊 Auto-routing daemon started. Target: {target_device}", flush=True)
    start_time = time.time()
    while time.time() - start_time < 20: # loop for 20 seconds
        time.sleep(0.5)
        try:
            output = subprocess.check_output(["pactl", "list", "source-outputs"], text=True)
            if any(_check_and_route_block(b, target_device) for b in output.split("Source Output #")): return
        except Exception:
            pass

# Retrieve active player metadata via playerctl MPRIS API
def get_mpris_metadata():
    """Retrieve metadata (title, artist, album, art url, status, length, position) from active chromium/chrome media players via MPRIS."""
    try:
        from gi.repository import Playerctl
        players = Playerctl.list_players()
        if not players: return None
        target_name = next((p for p in players if "chromium" in p.name or "chrome" in p.name), players[0])
            
        player = Playerctl.Player.new_from_name(target_name)
        
        title = player.get_title() or ""
        artist = player.get_artist() or ""
        album = player.get_album() or ""
        art_url = player.print_metadata_prop("mpris:artUrl") or ""
        playback_status = str(player.get_playback_status())
        
        status_str = "Stopped"
        if "PLAYING" in playback_status.upper():
            status_str = "Playing"
        elif "PAUSED" in playback_status.upper():
            status_str = "Paused"
            
        length = 0
        try:
            length = int(player.print_metadata_prop("mpris:length") or 0)
        except Exception:
            pass
            
        position = 0
        try:
            position = player.get_position()
        except Exception:
            pass
            
        return {
            "title": title,
            "artist": artist,
            "album": album,
            "artUrl": art_url,
            "status": status_str,
            "length": length,
            "position": position
        }
    except Exception: return _get_fallback_metadata()

def _get_fallback_metadata():
    try:
        output = subprocess.check_output(["playerctl", "-l"], text=True).strip().split()
        if not output: return None
        target = next((p for p in output if "chromium" in p or "chrome" in p), output[0])
        
        title = subprocess.check_output(["playerctl", "-p", target, "metadata", "title"], text=True).strip()
        artist = subprocess.check_output(["playerctl", "-p", target, "metadata", "artist"], text=True).strip()
        album = subprocess.check_output(["playerctl", "-p", target, "metadata", "album"], text=True).strip()
        art_url = subprocess.check_output(["playerctl", "-p", target, "metadata", "mpris:artUrl"], text=True).strip()
        status = subprocess.check_output(["playerctl", "-p", target, "status"], text=True).strip()
        
        length = 0
        try: length = int(subprocess.check_output(["playerctl", "-p", target, "metadata", "mpris:length"], text=True).strip())
        except: pass
        
        position = 0
        try: position = int(subprocess.check_output(["playerctl", "-p", target, "position"], text=True).strip()) * 1000000
        except: pass
            
        return {
            "title": title, "artist": artist, "album": album, "artUrl": art_url,
            "status": status, "length": length, "position": position
        }
    except Exception:
        return None

# Safely execute javascript code avoiding WebKit deprecation warnings
def run_js(webview, js_code):
    """Safely execute javascript code avoiding deprecation warnings in WebKit."""
    try: webview.evaluate_javascript(js_code, -1, None, None, None, None); return
    except Exception: pass
    try: webview.evaluate_javascript(js_code, -1, None, None, None); return
    except Exception: pass
    try: webview.run_javascript(js_code, None, None, None); return
    except Exception: pass

# Push current MPRIS metadata updates to visualizer web frame
def update_mpris_metadata(webview):
    """Serialize MPRIS metadata and inject it into the WebKit WebView via window.onMetadataUpdate callback."""
    metadata = get_mpris_metadata()
    if metadata:
        js_code = f"if (window.onMetadataUpdate) {{ window.onMetadataUpdate({json.dumps(metadata)}); }}"
    else:
        js_code = "if (window.onMetadataUpdate) {{ window.onMetadataUpdate(null); }}"
    
    run_js(webview, js_code)
    return True

# Helper to determine user-specific socket file path for Wayland IPC
def get_socket_path():
    """Return user-specific UNIX socket path for remote command dispatching."""
    return f"/tmp/nix-audio-visualizer-{os.getuid()}.sock"

# Dispatch received remote command to main WebView javascript execution context
def handle_ipc_command(command, webview, window):
    """Parse remote commands and dynamically inject the matching window control function."""
    js_code = None
    if command == "toggle-menu":
        js_code = "if (typeof toggleMenu === 'function') { toggleMenu(); }"
    elif command == "toggle-hud":
        js_code = "if (window.toggleHudGlobal) { window.toggleHudGlobal(); }"
    elif command == "cycle-style-forward":
        js_code = "if (window.cycleStyle) { window.cycleStyle(true); }"
    elif command == "cycle-style-backward":
        js_code = "if (window.cycleStyle) { window.cycleStyle(false); }"
    elif command == "cycle-theme-forward":
        js_code = "if (window.cycleTheme) { window.cycleTheme(true); }"
    elif command == "cycle-theme-backward":
        js_code = "if (window.cycleTheme) { window.cycleTheme(false); }"
    elif command == "gain-up":
        js_code = "if (window.adjustGain) { window.adjustGain(true); }"
    elif command == "gain-down":
        js_code = "if (window.adjustGain) { window.adjustGain(false); }"
        
    if js_code:
        run_js(webview, js_code)

# Listen on the local UNIX socket and dispatch incoming hotkey commands
def listen_ipc(webview, window):
    """Start local socket server listening to command triggers from visualizer controller CLI."""
    socket_path = get_socket_path()
    if os.path.exists(socket_path):
        try:
            os.remove(socket_path)
        except Exception:
            pass
    try:
        server = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        server.bind(socket_path)
        server.listen(1)
        while True:
            conn, _ = server.accept()
            data = conn.recv(1024).decode('utf-8').strip()
            if data: GLib.idle_add(handle_ipc_command, data, webview, window)
            conn.close()
    except Exception as e:
        pass


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Wayland desktop background audio visualizer.")
    parser.add_argument("--style", default="bars", help="Visualization style")
    parser.add_argument("--height", type=int, default=45, help="Visualizer height/width in pixels")
    parser.add_argument("--device", default="alsa_output.pci-0000_01_00.1.hdmi-surround71.monitor", help="PulseAudio/PipeWire capture source device name")
    parser.add_argument("--position", choices=["bottom", "top", "left", "right", "fullscreen"], default="bottom", help="Screen edge position")
    parser.add_argument("--send", help="Send command to running visualizer instance (e.g. toggle-menu, toggle-hud)")
    args = parser.parse_args()

    if args.send:
        socket_path = f"/tmp/nix-audio-visualizer-{os.getuid()}.sock"
        try:
            client = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
            client.connect(socket_path)
            client.sendall(args.send.encode('utf-8'))
            client.close()
            sys.exit(0)
        except Exception as e:
            print(f"Error: Visualizer daemon is not running or socket connection failed ({e}).", file=sys.stderr)
            sys.exit(1)

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
        window.set_size_request(args.height, 0)
    elif args.position == "right":
        GtkLayerShell.set_anchor(window, GtkLayerShell.Edge.RIGHT, True)
        GtkLayerShell.set_anchor(window, GtkLayerShell.Edge.TOP, True)
        GtkLayerShell.set_anchor(window, GtkLayerShell.Edge.BOTTOM, True)
        GtkLayerShell.set_anchor(window, GtkLayerShell.Edge.LEFT, False)
        window.set_size_request(args.height, 0)
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
    
    # Allow loading local ES6 modules via file:// scheme
    settings.set_allow_file_access_from_file_urls(True)
    settings.set_allow_universal_access_from_file_urls(True)
    
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

    # Start the MPRIS metadata update polling loop (every 1 second)
    GLib.timeout_add(1000, update_mpris_metadata, webview)

    # Start IPC server thread for global keyboard shortcuts
    ipc_thread = threading.Thread(target=listen_ipc, args=(webview, window), daemon=True)
    ipc_thread.start()

    window.add(webview)
    window.show_all()
    inhibit_sleep()
    Gtk.main()


if __name__ == "__main__":
    main()
