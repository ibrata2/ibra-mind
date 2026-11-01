# Backend implementation and security status

## Current architecture

- Identity and token refresh use Supabase Auth (email/password, confirmation and recovery). Google OAuth is exposed through Supabase Auth using the owner's OAuth application; desktop callbacks use the app's ibramind://auth deep link.
- Project rows and revision rows are in Postgres with RLS. The policies compare each row's owner_id with auth.uid() for every read/write path.
- The app receives only the owner's Supabase URL and public/publishable key. It never accepts a service-role key.
- AI provider keys are handled separately by Electron main-process IPC and protected with Windows safeStorage where available. Supabase Auth sessions are also persisted in an encrypted main-process file (Windows DPAPI-backed Electron safeStorage); prior renderer-local sessions are moved to encrypted storage at first use. The renderer receives redacted provider records.
- Cloud project files are manually uploaded over HTTPS and restored as a new local project. Automatic sync, conflict resolution, live editing, team sharing, scheduled jobs and cloud backups are not implemented.

## OAuth setup

1. Create and own the Supabase project and Google OAuth client. Do not reuse another developer's credentials.
2. Enable Google in Supabase Auth and supply the owner's client ID and secret there; the app never stores those secrets.
3. Add ibramind://auth to Supabase's allowed redirect URLs. For the web deployment, add its HTTPS origin. Apply the same redirect allowlist in the Google client configuration as required by Supabase.
4. Use only the identity/profile scopes needed for sign-in. Live desktop and web callback verification is pending the owner's project configuration.

## Database and authorization

- Migration: supabase/migrations/001_cloud_projects.sql.
- Tables: ibra_projects, ibra_project_versions.
- RLS is enabled on both tables. Project row policies restrict all operations to the authenticated owner; version policies restrict reads and inserts to that owner.
- save_ibra_project is SECURITY INVOKER, requires an authenticated UID, has an empty search path, and is executable only by authenticated.
- Second-user isolation, live migration execution, backup/restore and failure-path checks remain pending because no user-owned Supabase project is connected in this workspace.

## Security checklist

- [x] No committed API credentials; .env.example contains placeholders and .gitignore excludes environment files.
- [x] AI provider secrets do not enter renderer code; Windows uses Electron safeStorage and masks values in settings.
- [x] Desktop Supabase session tokens are encrypted at rest with Electron safeStorage and are bound to their Supabase storage key.
- [ ] Web sessions still use Supabase JS browser storage; an HTTP-only cookie BFF has not been built.
- [x] Supabase client receives only public/publishable keys. Never use a service-role key in the client.
- [x] Cloud tables use RLS and owner-scoped queries.
- [x] File upload parsing enforces supported formats and size limits; errors are sanitized for AI provider calls.
- [x] Production dependency audit reports zero known vulnerabilities (npm audit --omit=dev).
- [ ] Verify two-user RLS isolation and live account flows in the owner's Supabase project.
- [ ] Add rate limits for app-specific AI proxy requests. There is no owned server proxy in the current local-first build; provider limits apply directly.
- [ ] Add account deletion and session revocation controls.
- [ ] Publish a privacy policy naming Supabase and the selected AI providers as data processors.
- [ ] Verify OAuth provider configuration and encrypted-session persistence on a real Windows installation.

## Required owner configuration

The owner must create the Supabase project, configure Google OAuth if wanted, apply the migration, and provide the project URL plus public/publishable key through Settings. No live secret or account is stored in this repository.
