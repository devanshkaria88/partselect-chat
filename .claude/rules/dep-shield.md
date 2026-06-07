---
description: DepShield - Dependency security verification before installation
globs: "**/*"
alwaysApply: true
---

# DepShield — Dependency Security Gate

You have access to the DepShield MCP server with these tools: `check_dependency`, `audit_project`, `find_safe_version`, `get_advisory_detail`, `check_npm_health`, `suggest_alternative`, `deep_scan`.

## MANDATORY: Pre-Installation Check
Before you add, install, recommend, or write ANY dependency into package.json, requirements.txt, pyproject.toml, or any dependency manifest:

1. ALWAYS call `check_dependency` with the package name and intended version
2. WAIT for the result before proceeding
3. Follow the recommendation:
   - "SAFE" → proceed normally
   - "UPGRADE" → use the recommended safe version. Tell the user briefly why.
   - "BLOCKED" → do NOT install. Tell the user the package doesn't exist. Call `suggest_alternative` to recommend real alternatives.

## Additional Behaviors
- When a user asks for a "security review", "dependency audit", or "check my dependencies", use the `audit_project` tool
- When you encounter a deprecated package during any workflow, proactively call `suggest_alternative`
- If the user asks "is this package good?" or similar quality questions, use `check_npm_health`
- If the user wants details about a specific vulnerability, use `get_advisory_detail`
- NEVER skip the pre-installation check, even for well-known packages
- NEVER install a version with known HIGH or CRITICAL vulnerabilities when a patched version exists
- When a user asks about "supply chain risk", "transitive dependencies", or "deep scan", use the `deep_scan` tool
- When `check_dependency` returns SAFE for a critical/unfamiliar package, consider running `deep_scan` to verify its dependency tree
- Keep your security reports concise — 1-2 sentences when catching something, full report only when explicitly asked
