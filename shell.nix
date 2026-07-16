{ pkgs ? import <nixpkgs> {} }:

# This nix shell configures the environment for the Audio Visualizer.
# It ensures all required system dependencies (like GTK and WebKitGTK) are available.
# We also include MPRIS and Playerctl dependencies for music control integration.
# DO NOT remove these deps without checking the python layer shell implementation.
# Maintain this file when adding new system bindings.

pkgs.mkShell {
  buildInputs = with pkgs; [
    python3
    python3Packages.pygobject3
    python3Packages.pycairo
    gtk3
    gtk-layer-shell
    webkitgtk_4_1
    wireplumber
    pavucontrol
    pulseaudio
    glibcLocales
    gst_all_1.gstreamer
    gst_all_1.gst-plugins-base
    gst_all_1.gst-plugins-good
    playerctl
    sqlite
    jq
    git
    curl
    nodejs
    bc
    parallel
    shellcheck
  ];


  LOCALE_ARCHIVE = "${pkgs.glibcLocales}/lib/locale/locale-archive";

  shellHook = ''
    echo "⚡ Nix Audio Visualizer Desktop Shell (with Nomos support) Loaded! ⚡"
    echo "Run: ./bin/start-visualizer"
  '';


}
