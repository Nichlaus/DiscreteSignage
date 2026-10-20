# Project working agreement

- Work in short milestones with a clear outcome and relevant validation.
- Commit and push completed milestones to the configured GitHub repository.
- Existing Reutos projects are read-only references, not deployment targets.
- Keep implementation modular and minimal; do not add speculative infrastructure.
- Firebase authorization is a release gate. Add emulator tests with any rule grants.
- Validate tenant, location, role, input, and entitlement on privileged backend actions.
- Never trust a client-provided payment status, price, role, or trial end date.
- Do not deploy during routine scaffolding or testing.
- Keep status documentation honest about what is implemented, tested, and deployed.
- Do not copy credentials or customer data from reference projects.
- Maintain `docs/ADMIN_PORTAL.md` with every feature's platform-admin controls,
  operational limits, diagnostics, and recovery actions as that feature is built.
  Distinguish planned controls from implemented ones; business owners are not platform admins.
