{ pkgs ? import <nixpkgs> {} }:

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
    echo "⚡ Nix Audio Visualizer Desktop Shell (with ADO-Core support) Loaded! ⚡"
    echo "Run: ./bin/start-visualizer"
  '';


}
