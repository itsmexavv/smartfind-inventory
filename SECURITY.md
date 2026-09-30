# Local demo security and data notes

## Implemented

- Bind to the loopback interface; reject unexpected Host headers. In Codespaces, allow only the exact GitHub-provided forwarded hostname and its HTTPS Origin; keep port visibility private.
- JSON-only writes; reject foreign browser Origins and non-object JSON bodies.
- Bound request bodies, text fields, numbers, CSV imports and compiler execution.
- Parameterized SQL, foreign-key constraints and transaction rollback.
- Escape user-controlled text in the UI. Serve a same-origin content security policy.
- Neutralize leading spreadsheet formula characters in CSV text fields.
- Serve files only beneath `web/`; do not serve databases or repository source.
- Ignore default local databases and environment files in Git.
- Use synthetic seed data, not student or financial records belonging to real people.

## Remaining before any public deployment

There are no user accounts, roles, sessions, authentication, authorization, rate limits or production server. Host/Origin checks are not substitutes for these. Local processes can access the APIs.

Add an appropriate web framework/server, authenticated sessions, authorization per resource, CSRF protection for the selected session design, HTTPS, monitored backups, a migration system, deployment configuration and an abuse-handling strategy. Review the language interpreter's limits before allowing untrusted internet callers. Review accessibility route data with qualified people before any actual navigation use.

This document describes scope; it is not a security audit or a production-hardening claim.

Only index.html, guide.html, app.js, style.css, and icon.svg are served. Python source, tests, documentation, and databases are never served over HTTP. This repository exposes only its own app API.
