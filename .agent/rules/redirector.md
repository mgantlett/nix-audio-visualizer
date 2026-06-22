# GLOBAL AGENT PROTOCOL (Redirector)

## 0. 🟢 CONTEXT SENSING

**PRIME DIRECTIVE**: Check your environment before acting.

1.  **IF** file `.agent/tmp/.context-prompt.md` exists in the current root:
    - **ABANDON** global rules.
    - **READ & OBEY** the local `.agent/tmp/.context-prompt.md` exclusively.
    - This is the "Holy Ghost" task-specific Source of Truth for this session.

2.  **ELSE IF** file `.agent/rules/AGENT.md` exists in the current root:
    - **ABANDON** global rules.
    - **READ & OBEY** the local `.agent/rules/AGENT.md` exclusively.
    - This is your Source of Truth for this project.

3.  **ELSE** (Standard Mode):
    - Follow standard Global Protocol (or insert your generic preferences here).
    - Maintain stateless best practices.
