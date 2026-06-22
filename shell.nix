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
    glibcLocales
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
    echo "Run: python3 desktop-visualizer.py"
  '';


}
