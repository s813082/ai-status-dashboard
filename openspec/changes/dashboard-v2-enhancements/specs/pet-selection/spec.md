## ADDED Requirements

### Requirement: Project-bundled pet library

The system SHALL maintain a project-bundled pet library at `src/public/pets/library/<id>/`, where each pet folder contains a `spritesheet.webp` (8 columns × 9 rows, 192×208px per cell) and a `pet.json` with `id`, `displayName`, and `description`. The library SHALL be self-contained and SHALL NOT depend on the user's `~/.codex/pets` or `~/.petdex/pets` at runtime.

#### Scenario: Library listing endpoint

- **WHEN** a client requests `GET /api/pets`
- **THEN** the server SHALL scan `src/public/pets/library/*/pet.json` and return a JSON array of `{ id, displayName, description }`

### Requirement: Per-column pet selection persistence

The system SHALL persist the selected pet per column in `data/pet-config.json` as `{ claude, codex }`, defaulting to `{ claude: "clawd", codex: "boba" }` when the file is missing or unreadable. The current selection SHALL be included in `GET /api/status` as `petConfig`.

#### Scenario: Config read with default fallback

- **WHEN** a client requests `GET /api/config` and no `data/pet-config.json` exists
- **THEN** the server SHALL return `{ claude: "clawd", codex: "boba" }`

#### Scenario: Selection survives reload

- **GIVEN** a client has selected pet `agumon` for the codex column
- **WHEN** the page is reloaded
- **THEN** the codex column SHALL display `agumon` because the choice was persisted to `data/pet-config.json`

### Requirement: Pet selection endpoint with allowlist validation

The system SHALL accept `POST /api/select` with body `{ column, petId }`. The `column` SHALL be one of `claude` or `codex`, and `petId` SHALL exist in the `GET /api/pets` library listing; otherwise the server SHALL respond HTTP 400 and SHALL NOT write the config.

#### Scenario: Valid selection

- **WHEN** a client posts `{ column: "codex", petId: "agumon" }` and `agumon` exists in the library
- **THEN** the server SHALL write `data/pet-config.json` with codex set to `agumon` and respond `{ ok: true }`

#### Scenario: Invalid petId rejected

- **WHEN** a client posts `{ column: "codex", petId: "does-not-exist" }`
- **THEN** the server SHALL respond HTTP 400 and SHALL NOT modify `data/pet-config.json`

#### Scenario: Invalid column rejected

- **WHEN** a client posts `{ column: "gemini", petId: "boba" }`
- **THEN** the server SHALL respond HTTP 400 and SHALL NOT modify `data/pet-config.json`

### Requirement: In-page pet switching via gear panel

The dashboard SHALL provide a single top gear control that opens one panel containing a Claude section and a Codex section, each listing the library pets as thumbnails rendered from the sprite's first frame. Selecting a pet SHALL call `POST /api/select` and update that column's sprite in place. The sprite URL SHALL be keyed by pet id (`/pets/library/<id>/spritesheet.webp`) so switching pets does not display a browser-cached image.

#### Scenario: Switch updates the column

- **WHEN** the user opens the gear panel and clicks a different pet under the Codex section
- **THEN** the Codex column's pet SHALL change to the selected sprite without a full page reload

### Requirement: Pet library restock script

The system SHALL provide `npm run add-pet <slug>` that runs `npx petdex install <slug>` and copies the resulting `spritesheet.webp` and `pet.json` from `~/.codex/pets/<slug>` into `src/public/pets/library/<slug>/`, using only shell and introducing no new npm dependency.

#### Scenario: Restock adds to library

- **WHEN** the user runs `npm run add-pet <slug>` for an installable slug
- **THEN** `src/public/pets/library/<slug>/spritesheet.webp` SHALL exist and the pet SHALL appear in the `GET /api/pets` listing
