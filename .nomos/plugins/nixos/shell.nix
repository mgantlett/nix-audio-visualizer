# NixOS Shell Environment Configuration
# This file provisions the required dependencies for the audio visualizer.
# It ensures a reproducible development environment across all systems.
{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = with pkgs; [
    shellcheck
    sqlite
    jq
    git
    curl
    nodejs
    bc
    parallel
    go
  ];

  shellHook = ''
    echo "⚡ Welcome to the Nomos development shell! ⚡"
    echo "Loaded dependencies: shellcheck, sqlite, jq, git, curl, nodejs, bc, parallel"
  '';
}
