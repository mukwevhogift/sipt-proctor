# Bookworm — Technical System Design Document

**Version:** 1.0  
**Date:** March 2026  
**Author:** Architecture Team  
**Status:** Draft for Review

---

## 1. Overview & Goals

### 1.1 App Purpose

Bookworm is a native Android application that serves as an all-in-one reading and book management platform. It enables users to build, organize, and interact with a personal digital library — importing books from multiple sources (PDF, EPUB, camera scanning), reading them with a rich in-app reader, annotating content, and managing their collection with metadata, covers, and categorization.

### 1.2 Target Users

| Segment | Needs |
|---------|-------|
| **Students** | Textbook/PDF management, highlighting, bookmarks, offline access |
| **Casual readers** | Simple library, reading progress tracking, night mode |
| **Book collectors** | Cover scanning, metadata enrichment, categorization & tagging |
| **Researchers** | Annotation export, full-text search across library, citation support |

### 1.3 Key Business & User Goals

- **User goal:** A single app to store, read, and annotate all their books offline with zero friction.
- **Business goal:** Acquire 50K+ users in Year 1 via free tier; monetize through a premium subscription (cloud sync, unlimited library, advanced reader features) and one-time IAPs.
- **Platform goal:** Full Google Play compliance — clean AAB publishing, Play App Signing, no content-provider conflicts, valid licensing checks.

### 1.4 High-Level Success Metrics

| Metric | Target |
|--------|--------|
| Cold launch to interactive | < 2 seconds |
| Crash-free sessions | > 99.5% |
| 30-day retention | > 40% |
| Average reading session | > 12 minutes |
| Play Store rating | ≥ 4.3 stars |

---

## 2. Functional & Non-Functional Requirements

### 2.1 Core Features (Must-Have — MVP)

1. **Library management** — Add, remove, categorize, search, sort books.
2. **Book import** — Pick files via SAF (PDF, EPUB), scan physical covers via camera, download from supported sources.
3. **In-app reader** — PDF renderer + EPUB reflowable renderer with adjustable font, theme (light/dark/sepia), brightness.
4. **Annotations** — Highlights (multi-color), bookmarks, margin notes.
5. **Reading progress** — Per-book progress tracking, "Continue Reading" quick access.
6. **Cover management** — Auto-extract from file metadata; manual override via image picker / camera.
7. **Offline-first** — Full functionality without network.
8. **License verification** — Google Play licensing check for premium features.
9. **File sharing** — Expose files to other apps via a registered `ContentProvider`.

### 2.2 Nice-to-Have (Post-MVP)

- Cloud sync (cross-device library & annotations via Firebase/Supabase)
- Text-to-speech reader
- Community bookshelves & sharing
- Reading statistics dashboard (pages/day, streaks)
- Goodreads / Open Library API integration for metadata enrichment
- Widget: "Currently Reading" home-screen widget

### 2.3 Non-Functional Requirements

| Requirement | Specification |
|-------------|---------------|
| **Offline support** | 100% core functionality offline; sync when connected |
| **Performance** | Cold start < 2s; page turn < 100ms; library scroll 60 fps |
| **Storage** | Efficient: thumbnails ≤ 100 KB each; DB < 5 MB for 1K books |
| **Security** | No plaintext tokens; encrypted premium content; scoped storage compliance |
| **Accessibility** | TalkBack support; minimum touch target 48 dp; dynamic font scaling |
| **Scalability** | Support libraries of 10,000+ books without UI jank |
| **Compatibility** | Android 8.0+ (API 26); target SDK 35 |

---

## 3. High-Level Architecture

### 3.1 Layered Architecture (Clean Architecture)

```
┌─────────────────────────────────────────────────────┐
│                  Presentation Layer                   │
│  Jetpack Compose UI  ·  ViewModels  ·  Navigation    │
├─────────────────────────────────────────────────────┤
│                    Domain Layer                       │
│  Use Cases  ·  Repository Interfaces  ·  Models      │
├─────────────────────────────────────────────────────┤
│                     Data Layer                        │
│  Room DB  ·  File System (SAF)  ·  ContentProviders  │
│  Preferences DataStore  ·  Remote APIs (optional)    │
└─────────────────────────────────────────────────────┘
```

### 3.2 Client-Server Split

Bookworm is **offline-first**. The client is the source of truth for all local data.

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Local DB** | Room (SQLite) | Books, annotations, reading state |
| **Local files** | Internal storage + SAF | Book files (PDF/EPUB), cover images |
| **Remote (optional)** | Firebase / Supabase | Cloud sync, user auth, backup |
| **Licensing** | Google Play Licensing Library | Verify premium purchases |
| **Analytics** | Firebase Analytics + Crashlytics | Usage tracking, crash reporting |

### 3.3 Android Component Map

| Android Component | Usage |
|-------------------|-------|
| **Single Activity** | `MainActivity` hosts Compose NavHost — all screens are composables |
| **Compose Navigation** | Type-safe routes: `Library`, `Reader(bookId)`, `Scanner`, `Settings` |
| **`BookFileProvider`** | `ContentProvider` subclass exposing book files for sharing with other apps. Authority: `com.bookworm.app.FileProvider` |
| **`ImagePickerFileProvider`** | `FileProvider` for camera capture temp files. Authority: `com.bookworm.app.ImagePickerFileProvider` |
| **`LicenseContentProvider`** | PairIP license-check provider. Authority: `com.bookworm.app.com.pairip.licensecheck.LicenseContentProvider` |
| **`StartupInitializer`** | AndroidX Startup for eager singleton init. Authority: `com.bookworm.app.androidx.startup` |
| **`CropperFileProvider`** | Temp file provider for image cropping. Authority: `com.bookworm.app.cropper.fileprovider` |
| **`WorkManager`** | Background jobs: thumbnail generation, metadata extraction, cloud sync |
| **`ForegroundService`** | TTS playback (post-MVP) |

> **Critical note on ContentProvider authorities:** Every authority above must be globally unique on a device. The package name `com.bookworm.app` prefixes all authorities to prevent conflicts with other apps on the Play Store. If a conflict is detected during AAB upload, the offending authority must be renamed or made configurable via `${applicationId}` placeholder in the manifest.

---

## 4. Key Components & Modules

### 4.1 UI Layer (Presentation)

```
com.bookworm.app.ui/
├── NavGraph.kt                 // Compose Navigation host
├── theme/
│   ├── Theme.kt                // Material 3 dynamic color
│   ├── Type.kt                 // Roboto / custom type scale
│   └── Color.kt
├── screens/
│   ├── library/
│   │   ├── LibraryScreen.kt    // Grid/list toggle, search, filters
│   │   └── LibraryViewModel.kt
│   ├── reader/
│   │   ├── ReaderScreen.kt     // PDF & EPUB rendering canvas
│   │   ├── ReaderViewModel.kt
│   │   └── AnnotationOverlay.kt
│   ├── scanner/
│   │   ├── ScannerScreen.kt    // CameraX preview + capture
│   │   └── ScannerViewModel.kt
│   ├── detail/
│   │   ├── BookDetailScreen.kt // Metadata, cover, progress
│   │   └── BookDetailViewModel.kt
│   └── settings/
│       ├── SettingsScreen.kt
│       └── SettingsViewModel.kt
└── components/
    ├── BookCard.kt             // Reusable grid/list item
    ├── ProgressBar.kt
    ├── SearchBar.kt
    └── EmptyState.kt
```

### 4.2 Domain Layer

```
com.bookworm.app.domain/
├── model/
│   ├── Book.kt
│   ├── Annotation.kt           // Highlight, Bookmark, Note
│   ├── ReadingSession.kt
│   └── LicenseStatus.kt
├── usecase/
│   ├── AddBookUseCase.kt       // Import file → extract metadata → save
│   ├── ReadBookUseCase.kt      // Open file, track position
│   ├── ScanCoverUseCase.kt     // Camera → crop → save as cover
│   ├── SearchLibraryUseCase.kt // Full-text search across titles/authors
│   ├── ExportAnnotationsUseCase.kt
│   └── CheckLicenseUseCase.kt  // Verify Play license → unlock premium
└── repository/
    ├── BookRepository.kt        // Interface
    ├── AnnotationRepository.kt  // Interface
    └── SettingsRepository.kt    // Interface
```

### 4.3 Data Layer

```
com.bookworm.app.data/
├── local/
│   ├── BookwormDatabase.kt      // Room database (version-migrated)
│   ├── dao/
│   │   ├── BookDao.kt
│   │   ├── AnnotationDao.kt
│   │   └── ReadingSessionDao.kt
│   ├── entity/
│   │   ├── BookEntity.kt
│   │   ├── AnnotationEntity.kt
│   │   └── ReadingSessionEntity.kt
│   └── mapper/
│       └── EntityMappers.kt     // Entity ↔ Domain model
├── file/
│   ├── BookFileManager.kt       // Save/load/delete book files
│   ├── CoverImageManager.kt     // Thumbnail generation & caching
│   └── EpubParser.kt            // OPF/NCX metadata extraction
├── provider/
│   ├── BookFileProvider.kt
│   ├── ImagePickerFileProvider.kt
│   └── CropperFileProvider.kt
├── remote/                       // Post-MVP
│   ├── SyncService.kt
│   └── api/
│       └── BookwormApi.kt
├── preferences/
│   └── UserPreferences.kt       // DataStore (theme, sort order, etc.)
└── repository/
    ├── BookRepositoryImpl.kt
    ├── AnnotationRepositoryImpl.kt
    └── SettingsRepositoryImpl.kt
```

### 4.4 External Integrations

| Integration | Library / API | Purpose |
|-------------|---------------|---------|
| PDF rendering | `AndroidPdfViewer` or `PdfRenderer` (framework) | Display PDF pages |
| EPUB rendering | Custom WebView-based or `Readium` SDK | Reflowable EPUB |
| Camera/Scanning | CameraX + ML Kit (text recognition) | Cover/barcode scanning |
| Image picking | `ActivityResultContracts.PickVisualMedia` | Cover image selection |
| Image cropping | `uCrop` or `Android-Image-Cropper` | Crop cover images |
| License check | Google Play Licensing (PairIP) | Verify premium entitlement |
| Analytics | Firebase Analytics | User behavior tracking |
| Crash reporting | Firebase Crashlytics | Stability monitoring |
| Metadata | Open Library API / Google Books API | Auto-fill title, author, ISBN |

---

## 5. Data Model & Storage

### 5.1 Room Database Schema

```sql
-- books table
CREATE TABLE books (
    id              TEXT PRIMARY KEY,    -- UUID
    title           TEXT NOT NULL,
    author          TEXT,
    isbn            TEXT,
    description     TEXT,
    cover_path      TEXT,               -- Relative path to cover image
    file_path       TEXT NOT NULL,      -- Relative path to book file
    file_format     TEXT NOT NULL,      -- 'PDF' | 'EPUB'
    file_size_bytes INTEGER NOT NULL,
    page_count      INTEGER,
    current_page    INTEGER DEFAULT 0,
    progress        REAL DEFAULT 0.0,   -- 0.0 to 1.0
    category        TEXT,
    tags            TEXT,               -- JSON array
    is_favorite     INTEGER DEFAULT 0,
    added_at        INTEGER NOT NULL,   -- epoch millis
    last_read_at    INTEGER,
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL
);

-- annotations table
CREATE TABLE annotations (
    id              TEXT PRIMARY KEY,
    book_id         TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    type            TEXT NOT NULL,      -- 'HIGHLIGHT' | 'BOOKMARK' | 'NOTE'
    page            INTEGER NOT NULL,
    position_start  INTEGER,            -- Character offset (EPUB)
    position_end    INTEGER,
    content         TEXT,               -- Note text or highlighted text
    color           TEXT DEFAULT '#FFEB3B',  -- Highlight color hex
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL
);

CREATE INDEX idx_annotations_book ON annotations(book_id);

-- reading_sessions table
CREATE TABLE reading_sessions (
    id              TEXT PRIMARY KEY,
    book_id         TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    start_page      INTEGER NOT NULL,
    end_page        INTEGER NOT NULL,
    duration_sec    INTEGER NOT NULL,
    started_at      INTEGER NOT NULL,
    ended_at        INTEGER NOT NULL
);

CREATE INDEX idx_sessions_book ON reading_sessions(book_id);
```

### 5.2 File Storage Strategy

```
/data/data/com.bookworm.app/          (internal — private)
├── databases/
│   └── bookworm.db
├── files/
│   ├── books/                          (imported book files)
│   │   ├── {uuid}.pdf
│   │   └── {uuid}.epub
│   └── covers/                         (generated thumbnails)
│       ├── {uuid}_thumb.webp           (200×300, ~80 KB)
│       └── {uuid}_full.webp            (original aspect, ~300 KB)
└── cache/
    ├── reader_cache/                   (decoded PDF pages)
    └── crop_temp/                      (transient cropping files)
```

- **Internal storage** for all book files — no `READ_EXTERNAL_STORAGE` needed for stored files.
- **SAF (Storage Access Framework)** for initial file import — user picks a file, app copies it internally.
- **Cover images** stored as WebP for size efficiency (60–70% smaller than JPEG at equivalent quality).
- **Cache eviction**: Reader page cache limited to 50 MB; LRU eviction via `DiskLruCache`.

---

## 6. Important Flows

### 6.1 Book Import Flow

```
User taps "Add Book"
       │
       ▼
┌─────────────────┐
│ SAF File Picker  │  ← ActivityResultContracts.OpenDocument
│ (PDF / EPUB)     │    mimeTypes: application/pdf, application/epub+zip
└────────┬────────┘
         │ URI returned
         ▼
┌─────────────────────┐
│ Copy file to         │  ← BookFileManager.importFile(uri)
│ internal storage     │    Generates UUID filename
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│ Extract metadata     │  ← PDF: PdfRenderer (title, page count)
│                      │    EPUB: EpubParser (OPF metadata)
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│ Generate cover       │  ← PDF: render page 1 as bitmap
│ thumbnail (WebP)     │    EPUB: extract <cover> from OPF
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│ (Optional) Enrich    │  ← Google Books API / Open Library
│ metadata via API     │    Match by title or ISBN
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│ Insert BookEntity    │  ← BookDao.insert(entity)
│ into Room DB         │
└─────────────────────┘
         │
         ▼
    Library UI updates (StateFlow)
```

### 6.2 Reading Session Flow

```
User taps book → ReaderScreen(bookId)
       │
       ▼
ViewModel loads Book from Room
       │
       ▼
Open file: BookFileManager.getFile(book.filePath)
       │
       ├── PDF → PdfRenderer / AndroidPdfViewer
       └── EPUB → WebView with Readium/custom renderer
       │
       ▼
User reads (page turns tracked)
       │                           ┌──────────────────┐
       ├── Highlight selected  ──→ │ AnnotationDao     │
       ├── Bookmark added      ──→ │   .insert(...)    │
       └── Note created        ──→ │                   │
       │                           └──────────────────┘
       ▼
User exits / app backgrounded
       │
       ▼
Save ReadingSession (duration, pages read)
Update Book.currentPage + Book.progress
       │
       ▼
(Post-MVP) Queue sync job via WorkManager
```

### 6.3 License Verification Flow

```
App cold start
       │
       ▼
CheckLicenseUseCase.invoke()
       │
       ▼
┌─────────────────────────┐
│ Google Play Licensing    │
│ Library (PairIP)         │
│ LicenseChecker.check()  │
└────────┬────────────────┘
         │
    ┌────┴────┐
    ▼         ▼
 LICENSED   NOT_LICENSED
    │         │
    ▼         ▼
 Unlock     Lock premium
 premium    features +
 features   show upgrade
             prompt
    │         │
    └────┬────┘
         ▼
Cache result in DataStore
(Re-check every 24h or on Play Store update)
```

### 6.4 ContentProvider Conflict Resolution

The Play Console error indicates authority conflicts:

```
Conflicting authorities (from AAB upload error):
  - com.bookworm.app.FileSystemFileProvider
  - com.bookworm.app.ImagePickerFileProvider
  - com.bookworm.app.com.pairip.licensecheck.LicenseContentProvider
  - com.bookworm.app.androidx.startup
  - com.bookworm.app.cropper.fileprovider
```

**Resolution strategy:**

1. **Use `${applicationId}` placeholder** in all `<provider android:authorities>` declarations in `AndroidManifest.xml`:
   ```xml
   <provider
       android:name=".provider.BookFileProvider"
       android:authorities="${applicationId}.FileProvider"
       android:exported="false"
       android:grantUriPermissions="true" />
   ```
2. **Verify uniqueness** — each authority must not collide with any other app on the Play Store. Since `applicationId` is unique per app, prefixing guarantees uniqueness.
3. **Third-party libraries** (PairIP, AndroidX Startup, uCrop) auto-prefix with `${applicationId}` if configured correctly in their manifest merge rules.
4. **If conflict persists** — override the library's authority in `AndroidManifest.xml` using `tools:replace="android:authorities"`.
5. **Change package name** from `com.bookworm.app` if another developer already owns it on Google Play (as indicated by the upload error).

---

## 7. Security & Privacy

### 7.1 Permissions

| Permission | When | Justification |
|------------|------|---------------|
| `CAMERA` | Scanner feature | Cover scanning, barcode reading |
| `INTERNET` | Metadata enrichment, sync, analytics | Optional — app works offline |
| `POST_NOTIFICATIONS` (API 33+) | Reading reminders | User-triggered opt-in |

**No storage permissions required** — SAF handles file imports; internal storage holds all app data.

### 7.2 Data Security

- **Premium content encryption**: AES-256 for DRM-protected files stored on device.
- **Tokens**: Auth tokens (if cloud sync enabled) stored in `EncryptedSharedPreferences`.
- **Database**: Room DB is in internal storage (sandboxed); no external access without root.
- **Exported components**: All `ContentProvider`s set `android:exported="false"` unless explicitly needed for sharing (in which case `grantUriPermissions` is scoped).

### 7.3 Play Store Compliance

- **Target SDK 35** — compliant with latest Play Store requirements.
- **Scoped storage** — no legacy `READ/WRITE_EXTERNAL_STORAGE` on Android 11+.
- **App Bundle** — signed by Google Play (Play App Signing enrolled).
- **Data Safety section** — declares: local data (books, annotations) stays on device; analytics data collected (anonymized); no data sold.
- **Content rating** — IARC questionnaire completed (likely "Everyone").

---

## 8. Error Handling & Resilience

### 8.1 Offline Behavior

Since Bookworm is offline-first, network failure **never blocks core functionality**:

| Scenario | Behavior |
|----------|----------|
| No network + reading | Works fully |
| No network + metadata enrichment | Skip silently; user can retry later |
| No network + cloud sync | Queue sync job; WorkManager retries with exponential backoff |
| No network + license check | Use cached license status (valid for 24h) |

### 8.2 Crash Reporting

- **Firebase Crashlytics** integrated for real-time crash aggregation.
- **ANR detection** — Crashlytics captures Application Not Responding traces.
- **Non-fatal logging** — caught exceptions (file parse errors, network timeouts) logged as non-fatal events for monitoring.
- **Release health dashboard** — monitored post-launch; hotfix threshold: crash-free rate < 99%.

### 8.3 Graceful Degradation

| Failure | Fallback |
|---------|----------|
| Cover extraction fails | Show generic book icon + title text |
| EPUB parsing error | Display error card with "Unsupported format" + suggestion to re-import |
| PDF page render OOM | Downscale render quality; show toast |
| Database migration crash | Fallback to destructive migration on debug; versioned migration on release |
| File missing from disk | Mark book as "unavailable"; prompt re-import |

---

## 9. Future Scalability & Evolution

### 9.1 Planned Features (Roadmap)

| Phase | Feature | Effort |
|-------|---------|--------|
| **v1.1** | Reading statistics dashboard | Medium |
| **v1.2** | Cloud sync (Firebase) | Large |
| **v1.3** | Text-to-speech reader | Medium |
| **v2.0** | Community bookshelves | Large |
| **v2.1** | Desktop companion (KMP/Web) | XL |
| **v2.2** | AI-powered book recommendations | Medium |

### 9.2 Tech Debt & Refactor Areas

- **PDF rendering**: Framework `PdfRenderer` is limited (no text selection). Plan migration to `PdfiumAndroid` or `PSPDFKit` (licensed) for v1.2.
- **EPUB engine**: Custom WebView renderer may need replacement with Readium for full EPUB 3.x compliance.
- **Module extraction**: Move domain layer to a Kotlin Multiplatform module if desktop/web clients are planned.
- **Testing coverage**: Target 80%+ unit test coverage before v1.2; currently estimated ~60% at launch.

---

## 10. Tech Stack Summary

| Category | Technology |
|----------|-----------|
| **Language** | Kotlin 2.0 |
| **UI** | Jetpack Compose + Material 3 |
| **Navigation** | Compose Navigation (type-safe) |
| **DI** | Hilt (Dagger under the hood) |
| **Database** | Room (SQLite) |
| **Preferences** | DataStore (Proto/Preferences) |
| **Image loading** | Coil 3 (Compose native) |
| **Camera** | CameraX |
| **PDF** | AndroidPdfViewer / PdfRenderer |
| **EPUB** | Custom WebView / Readium |
| **Background work** | WorkManager |
| **Analytics** | Firebase Analytics |
| **Crash reporting** | Firebase Crashlytics |
| **Licensing** | Google Play Licensing (PairIP) |
| **Networking** | Ktor Client (for API calls) |
| **Serialization** | Kotlinx Serialization |
| **Testing** | JUnit 5, Turbine (Flow), Compose UI Test, MockK |
| **CI/CD** | GitHub Actions → Fastlane → Play Console (Internal Testing → Production) |
| **Min SDK** | 26 (Android 8.0) |
| **Target SDK** | 35 (Android 15) |
| **Build** | Gradle 8.x + AGP 8.x, Kotlin DSL |

---

## Appendix A: Manifest ContentProvider Declarations

```xml
<!-- BookFileProvider — share book files with other apps -->
<provider
    android:name="androidx.core.content.FileProvider"
    android:authorities="${applicationId}.FileSystemFileProvider"
    android:exported="false"
    android:grantUriPermissions="true">
    <meta-data
        android:name="android.support.FILE_PROVIDER_PATHS"
        android:resource="@xml/file_paths" />
</provider>

<!-- ImagePickerFileProvider — camera temp files -->
<provider
    android:name="androidx.core.content.FileProvider"
    android:authorities="${applicationId}.ImagePickerFileProvider"
    android:exported="false"
    android:grantUriPermissions="true">
    <meta-data
        android:name="android.support.FILE_PROVIDER_PATHS"
        android:resource="@xml/image_picker_paths" />
</provider>

<!-- AndroidX Startup Initializer -->
<provider
    android:name="androidx.startup.InitializationProvider"
    android:authorities="${applicationId}.androidx.startup"
    android:exported="false"
    tools:node="merge" />

<!-- Image Cropper FileProvider -->
<provider
    android:name="androidx.core.content.FileProvider"
    android:authorities="${applicationId}.cropper.fileprovider"
    android:exported="false"
    android:grantUriPermissions="true">
    <meta-data
        android:name="android.support.FILE_PROVIDER_PATHS"
        android:resource="@xml/cropper_paths" />
</provider>

<!-- PairIP License Check provider -->
<provider
    android:name="com.pairip.licensecheck.LicenseContentProvider"
    android:authorities="${applicationId}.com.pairip.licensecheck.LicenseContentProvider"
    android:exported="false" />
```

## Appendix B: Dependency Graph (Simplified)

```
:app
 ├── :feature:library
 ├── :feature:reader
 ├── :feature:scanner
 ├── :feature:settings
 ├── :core:domain
 ├── :core:data
 │     ├── :core:database (Room)
 │     ├── :core:filemanager
 │     └── :core:network (Ktor)
 ├── :core:ui (shared composables, theme)
 └── :core:common (utilities, extensions)
```

---

*End of Technical System Design Document*


---


--- SEPARATOR FOR NON-TECHNICAL VERSION ---


---


# Bookworm — How It Works (The Simple Version)

**A friendly guide to how Bookworm is built, why it's reliable, and where it's headed.**

---

## What Is Bookworm?

Bookworm is a **reading app for Android phones and tablets**. Think of it as your personal digital bookshelf — a single place to keep all your books (PDFs, eBooks), read them comfortably, highlight your favorite passages, and never lose your place.

Whether you're a student juggling textbooks, a casual reader with a growing digital library, or a collector who likes everything organized — Bookworm is designed for you.

---

## What Can You Do With It?

Here's what Bookworm lets you do, in plain English:

- **Build your library** — Add books from your phone's files, or scan a physical book's cover with your camera to get started.
- **Read anything** — Open PDFs and eBooks right inside the app. Adjust the font size, switch to dark mode for nighttime reading, and pick your favorite reading theme.
- **Never lose your spot** — Bookworm remembers exactly where you stopped. Just tap "Continue Reading" and you're back.
- **Highlight and make notes** — Found an important paragraph? Highlight it in any color. Want to jot down a thought? Add a sticky note right there.
- **Stay organized** — Tag your books, add them to categories, search across your entire collection in seconds.

---

## How Is It Built? (Without the Jargon)

Imagine Bookworm as a **three-layer cake**:

### Layer 1: What You See (The Look)
> *The frosting and decoration*

This is every screen you interact with — the library grid, the reading page, the settings menu. We use Google's latest design system so everything looks clean, modern, and feels native to your Android device.

### Layer 2: The Brain (The Logic)
> *The cake itself*

Behind every button tap, there's logic that decides what happens. "Add this book to the library." "Save that highlight." "Remember page 47." This layer keeps things organized so the app stays fast and doesn't get confused even with thousands of books.

### Layer 3: The Filing Cabinet (The Storage)
> *The cake stand*

All your books, notes, and reading progress are stored safely in a private database on your phone. Think of it as a locked filing cabinet that only Bookworm can access. No one else — not other apps, not websites — can peek inside.

---

## Why Does It Work Offline?

**Because we designed it that way from Day 1.**

Everything important lives on your phone:
- Your books? Stored locally.
- Your highlights? Saved locally.
- Your reading progress? Yep, local.

You don't need Wi-Fi or data to read, annotate, or organize. The internet is only used for optional things — like automatically finding a book's author and description, or syncing your library to the cloud (a future feature).

> **Simple analogy:** It's like carrying a real bookshelf with you. You don't need an internet connection to open a physical book, and Bookworm works the same way.

---

## How Do We Keep It Fast?

Nobody likes a slow app. Here's what we do:

- **Opens in under 2 seconds** — We load only what you need, when you need it. Your library thumbnails are small, optimized images.
- **Smooth scrolling** — Even with 10,000 books, the library scrolls like butter. We use smart loading that only draws what's on screen.
- **Quick page turns** — Pages are pre-loaded in the background so the next page is ready before you swipe.
- **Small footprint** — Cover images are compressed to a fraction of their original size without losing quality. The app's private database stays tiny.

---

## How Do We Keep It Safe & Private?

Your reading habits are personal. Here's how we respect that:

- **Your data stays on your device.** We don't upload your books, notes, or reading history anywhere unless you explicitly choose to use cloud sync (a future premium feature).
- **No unnecessary permissions.** We only ask for camera access (for scanning covers) and internet (for optional features). We never ask to access all your files — you pick exactly which book to import each time.
- **Paid features are locked securely.** If you buy premium features, a secure check with Google Play confirms your purchase. Think of it as a **digital receipt** the app verifies each time.
- **We follow all of Google's rules.** The app meets every Google Play Store requirement for privacy, security, and data handling.

---

## What Could Go Wrong? (And How We Prevent It)

Every app can hit bumps. Here's how Bookworm handles them gracefully:

| What might happen | What Bookworm does |
|---|---|
| You open a corrupted file | Shows a friendly message: "This file couldn't be opened" — no crash |
| Your phone runs low on storage | Automatically cleans up temporary reading caches first |
| A book cover can't be found | Shows a clean placeholder with the book's title instead |
| The app crashes (rare!) | An automatic report is sent (anonymously) so we can fix it fast |
| No internet when you try to sync | Queues the sync for later and retries automatically |

> **Our target:** 99.5% of all app sessions should be crash-free. That means for every 200 times you open the app, a crash happens at most once — and we work to make even that disappear.

---

## What About the Google Play Store?

Publishing an app to the Google Play Store is like getting a product on a store shelf — there are rules to follow. Here are the key ones we handle:

- **Unique identity** — Every app needs a unique name in Google's system. We ensure Bookworm's identity doesn't clash with anyone else's.
- **Google signs our app** — When you download Bookworm, Google puts its own seal of approval on the file, guaranteeing it hasn't been tampered with.
- **Internal testing first** — Before any update reaches real users, we test it with a small group of up to 100 people. This catches bugs early.
- **Automatic protection** — Google Play adds extra security layers to prevent piracy and tampering.

---

## What's Coming Next?

We're building Bookworm one step at a time. Here's the roadmap:

### Now (Version 1.0)
✅ Library management, reading, highlights, bookmarks, scanning, offline-first

### Soon (Version 1.1 – 1.3)
- **Reading stats** — See how many pages you read per day, track streaks, challenge yourself.
- **Cloud backup** — Sync your library across devices. Start reading on your phone, continue on your tablet.
- **Listen to your books** — A built-in text-to-speech reader for when your eyes need a break.

### Later (Version 2.0+)
- **Share bookshelves with friends** — Create community libraries, recommend books.
- **Smart recommendations** — AI-powered suggestions: "Based on what you've read, you might love…"
- **Desktop companion** — Access your library from a computer.

---

## Why This Matters

### For Users
- **One app for everything** — No need for separate PDF readers, eBook apps, and note-taking tools.
- **Your books, your way** — Organize, annotate, and read exactly how you want.
- **Works everywhere** — On the bus, on a plane, in a cabin with no Wi-Fi. Always works.

### For the Business
- **Growing market** — Digital reading is expanding: 50%+ of readers now use mobile apps.
- **Clear monetization** — Free core experience with premium subscription for power users (cloud sync, TTS, advanced stats).
- **Defensible tech** — Offline-first architecture and a rich annotation system create switching costs — once your highlights are in Bookworm, you'll want to stay.
- **Play Store ready** — Built to pass Google's review process on the first try, every time.

---

> **In one sentence:** Bookworm is a fast, private, offline-first reading app that turns your phone into the best digital bookshelf you've ever had — and it's built to grow with you.

---

*End of Non-Technical Summary*
