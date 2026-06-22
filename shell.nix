{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = with pkgs; [
    python3
    python3Packages.pygobject3
    gtk3
    gtk-layer-shell
    webkitgtk_4_1
    wireplumber
    pavucontrol
  ];

  shellHook = ''
    echo "⚡ Nix Audio Visualizer Desktop Shell Loaded! ⚡"
    echo "Run: python3 desktop-visualizer.py"
  '';
}
