# Repository Guidelines

## Project Structure & Module Organization

- `BackEnd/` contains the ASP.NET Core Minimal API, EF Core persistence, domain services, endpoint groups, configuration, and deployment files.
- `BackEnd.Tests/` contains xUnit tests for service and workflow behavior; test names describe the scenario under test.
- `FrontEnd/gestion-mesas-shop/` contains the React 19/Vite client. Shared utilities live in `src/shared/utils/`, feature-specific code in `src/features/`, and static assets in `public/` or `src/assets/`.
- `.env.example` documents the PostgreSQL connection variable used for local development. Do not commit real credentials or local database files.

## Build, Test, and Development Commands

Run commands from the directory containing the relevant project:

```powershell
dotnet run --project BackEnd/GestionMesas.Api.csproj --urls http://localhost:5000
dotnet test BackEnd.Tests/GestionMesas.Api.Tests.csproj
dotnet build BackEnd/GestionMesas.Api.csproj
cd FrontEnd/gestion-mesas-shop; npm install; npm run dev
npm run build
npm run lint
```

The API defaults to SQLite; set `ConnectionStrings__Restaurant` to use PostgreSQL. Set `VITE_API_URL` for a deployed frontend API endpoint.

## Coding Style & Naming Conventions

Use two spaces in JavaScript/JSX and four spaces in C#. Follow the existing ESLint configuration and run `npm run lint` before submitting frontend changes. Use PascalCase for React components and C# types, camelCase for JavaScript variables/functions, and descriptive service/endpoint names. Keep feature code near its feature and shared logic in `src/shared/`.

## Interface Copy

Use concise, functional Spanish in the interface. Do not add marketing slogans, promotional descriptions, or business catchphrases. Prefer clear labels, factual feature names, and instructions needed to complete the user's task.

## Testing Guidelines

Use xUnit for backend tests and run `dotnet test` from the repository root or against the test project. Name tests after the behavior or workflow they verify (for example, `PendingOrderWorkflowTests`). Add regression coverage for changed service, persistence, and order/shift-close behavior. The frontend currently has lint and production-build checks but no configured test runner.

## Commit & Pull Request Guidelines

Recent commits use short imperative summaries, sometimes in Spanish (for example, `agrega arqueo de caja, mejora proveedores`). Keep commits focused and concise. Pull requests should explain the user-visible and backend impact, list validation commands run, identify configuration or schema changes, and include screenshots for meaningful UI changes. Link related issues when available.

## Application Versioning

- Update the application version with each logical application update, including frontend or backend changes. Choose the increment based on the highest-impact change in that update; do not ask the user to choose routine version numbers.
- For stable releases, use a patch increment for bug fixes and small visual/usability adjustments, a minor increment for new functionality or substantial compatible improvements, and a major increment for incompatible changes.
- While stabilizing an existing beta release, fixes and small adjustments advance its prerelease counter (for example, `1.0.0-beta.1` to `1.0.0-beta.2`). New functionality or substantial compatible improvements target the next minor beta (for example, `1.1.0-beta.1`); incompatible changes target the next major beta (for example, `2.0.0-beta.1`). Reset the beta counter when changing the target release. Keep the beta suffix until a stable release is intentionally prepared and validated.
- `FrontEnd/gestion-mesas-shop/package.json` is the source of truth for the application version. Keep the root version and the root package version in `package-lock.json` synchronized. Use `npm version <version> --no-git-tag-version --ignore-scripts` from the frontend directory to update both files without creating a Git tag or commit.
- The visible version in `src/shared/components/AppVersion.jsx` reads package metadata automatically. Keep this single source of truth rather than hardcoding version labels elsewhere.
- Include the version change with the corresponding application changes before committing or pushing. Bump once per logical update, not per edited file or split commit; a request to push an already versioned update does not require another increment. Report the resulting version to the user.
- Documentation-only changes and discussions about versioning do not themselves require a version increment. This rule does not authorize automatic commits, pushes, tags, or deployments.

## Security & Configuration

Keep secrets in environment variables or local untracked configuration. Review database changes for both SQLite and PostgreSQL compatibility, and never commit `gestion-mesas.db`, passwords, tokens, or production URLs containing credentials.
