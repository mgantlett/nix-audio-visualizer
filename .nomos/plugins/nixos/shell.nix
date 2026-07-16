{ pkgs ? import <nixpkgs> {} }:

# Nomos NixOS plugin shell environment.
# Provides core utilities for the agent to interface with the local system.
# Includes shellcheck for linting, sqlite for db caching, jq for json parsing.

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
