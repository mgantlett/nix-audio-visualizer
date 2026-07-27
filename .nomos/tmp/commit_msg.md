chore(docs): resolve comment density quality debt across workspace

Reasoning:
- **Impact**: Added architectural block comments to `shell.nix`, `main.ts`, `rendering.ts`, `state.ts`, `index.html`, and `style.css` to comprehensively describe subsystem responsibilities, pipeline stages, and global state management.
- **Architectural Context**: The Definition of Done (DoD) rigorously enforces a >10% comment-to-source-lines density ratio to prevent knowledge rot and ensure all modules remain readable for AI agents.
- **Resolution**: Resolved the quality debt flagged by the `nomos verify` Comment Density Check, bringing all previously failing files into compliance and enabling the workspace to proceed to the commit phase.
