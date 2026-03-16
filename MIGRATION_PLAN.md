# Project Restructuring Migration Plan

**Goal:** Reorganize the codebase to improve clarity and make the project easier to maintain.

**Status:** ✅ **COMPLETE** - Migration completed on 2026-03-16

---

## What Was Done

The following minimal changes were implemented to improve project organization:

### 1. Created New Directories
```bash
mkdir -p data src/converters/scripts src/shared
```

### 2. Moved Data Files
- Moved `books/*.json` → `data/`
- Removed empty `books/` directory

### 3. Moved Shell Scripts
- Moved `samplefiles/*.sh` → `src/converters/scripts/`
- Scripts remain in `samplefiles/` for reference (service account templates)

### 4. Moved Logger to Shared
- Moved `src/utils/logger.ts` → `src/shared/logger.ts`

### 5. Renamed bot to discord
- Renamed `src/bot/` → `src/discord/`

### 6. Moved Converters
- Moved `src/utils/mp3Converter.ts` → `src/converters/mp3Converter.ts`
- Moved `src/utils/ebookConverter.ts` → `src/converters/ebookConverter.ts`
- Removed empty `src/utils/` directory

### 7. Updated All Import Paths
- Logger imports: `../utils/logger` → `../shared/logger`
- Bot imports: `../bot/` → `../discord/`
- Converter imports: `../utils/` → `../converters/`
- Script paths: `samplefiles/` → `src/converters/scripts/`

### 8. Updated Documentation
- Updated `CLAUDE.md` with new structure
- Updated `README.md` with new file paths
- Updated `project_files.md` with new locations

---

## New Structure

```
src/
├── index.ts                        # Main entry point
├── config/                         # Configuration
│   ├── env.ts
│   └── bluesky-accounts.ts
├── clients/                        # External service clients
│   ├── mam/
│   ├── deluge/
│   ├── nzb/
│   ├── google/
│   └── bluesky/
├── converters/                     # File conversion (NEW)
│   ├── mp3Converter.ts
│   ├── ebookConverter.ts
│   └── scripts/
│       ├── mp3tom4b.sh
│       ├── ebookconvert.sh
│       └── albumzipper.sh
├── discord/                        # Discord bot (renamed from bot/)
│   ├── index.ts
│   ├── commands/
│   ├── utils.ts
│   ├── uploadUtils.ts
│   ├── emailUtils.ts
│   ├── ollamautils.ts
│   ├── personalities.ts
│   ├── agenticutils.ts
│   ├── badjokes.ts
│   ├── presenceUtils.ts
│   └── garfieldMessages.ts
├── api/                            # Express HTTP API
│   ├── index.ts
│   ├── routes/
│   └── clients/
├── shared/                         # Shared utilities (NEW)
│   └── logger.ts
└── data/                           # Data files (NEW)
    ├── bible.json
    └── biblersv.json
```

---

## Verification

All changes verified with:
```bash
npm run build
```

Compilation successful with no errors.

---

**Created:** 2026-03-15
**Completed:** 2026-03-16
**Status:** ✅ Complete