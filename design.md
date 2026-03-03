# UI Design Specification: Google Play Console "Create Internal Testing Release" Page

**Purpose**  
This Markdown document provides a complete, pixel-accurate design specification for a coding agent (React, Tailwind, Next.js, or any frontend stack) to recreate the exact look, feel, layout, colors, typography, spacing, and interactive states of the uploaded screenshot.

**Target**  
- Desktop-first (1024px+ viewport)  
- Light theme only (Google Material Design 3 inspired)  
- Fully responsive sidebar collapse on mobile (optional but recommended)

---

## 1. Overall Layout & Structure
┌──────────────────────────────────────────────────────────────┐
│ Header (fixed, 64px)                                         │
├──────────────────────┬───────────────────────────────────────┤
│ Sidebar (fixed 280px)│ Main Content Area (flex-1, scrollable)│
│                      │                                       │
│                      │ • Page title + progress steps         │
│                      │ • App Integrity section               │
│                      │ • App Bundles upload zone             │
│                      │ • Uploaded file + error banner        │
│                      │ • Release Details (placeholder)       │
│                      │ • Bottom action bar (fixed on scroll) │
└──────────────────────┴───────────────────────────────────────┘


- **Container max-width**: 1200px (centered)  
- **Padding**: Main content → 32px top, 40px left/right  
- **Sidebar width**: 280px (fixed)  
- **Gap between sections**: 32px vertical

---

## 2. Color Palette (Exact Hex Codes)

| Role                  | Hex       | Usage |
|-----------------------|-----------|-------|
| **Primary Blue**      | `#1A73E8` | Links, active nav, step circles, "Next" button, hover states |
| **Active Sidebar BG** | `#E8F0FE` | Highlighted menu item ("Internal testing") |
| **Success Green**     | `#34A853` | Checkmarks in App Integrity |
| **Error Red**         | `#D93025` | Error icon, error text, border on failed upload |
| **Text Primary**      | `#202124` | Headings, body text |
| **Text Secondary**    | `#5F6368` | Subtitles, labels, helper text |
| **Text Muted**        | `#9AA0A6` | Disabled buttons, grayed text |
| **Border / Divider**  | `#DADCE0` | All borders, section dividers |
| **Background**        | `#FFFFFF` | Main content |
| **Sidebar BG**        | `#F8F9FA` | Left navigation |
| **Header BG**         | `#FFFFFF` | Top bar with subtle shadow |
| **Upload Zone Border**| `#DADCE0` (dashed) | Drag & drop area |

**Button States**  
- Primary (Next): `#1A73E8` → hover `#185ABC`  
- Secondary (Save as draft): `#F8F9FA` border `#DADCE0`  
- Disabled: `#9AA0A6` background, `#FFFFFF` text

---

## 3. Typography (Google Roboto)

- **Font Family**: `Roboto, system-ui, sans-serif`  
- **Base Font Size**: 14px  
- **Line Height**: 1.4  

**Hierarchy**

| Element              | Size   | Weight | Color       | Example |
|----------------------|--------|--------|-------------|---------|
| Page Title           | 28px   | 500    | `#202124`   | "Create internal testing release" |
| Section Heading      | 20px   | 500    | `#202124`   | "App integrity", "App bundles" |
| Subtitle / Helper    | 14px   | 400    | `#5F6368`   | "Internal testing releases are available to up to 100 testers..." |
| Nav Menu Items       | 14px   | 500    | `#3C4043`   | Sidebar items |
| Active Nav           | 14px   | 500    | `#1A73E8`   | "Internal testing" |
| Button Text          | 14px   | 500    | -           | "Upload", "Next" |
| Error Text           | 12px   | 400    | `#D93025`   | Manifest conflict message |
| Small Labels         | 12px   | 400    | `#5F6368`   | "Drop app bundles here to upload" |

**Google Play Console font weights**  
- Regular: 400  
- Medium: 500  
- Bold: 700 (only for very prominent text)

---

## 4. Component Breakdown

### 4.1 Header (64px)
- Left: Google Play Console logo + "All apps" pill button (white with blue border)
- Right: Notifications bell icon + "Bookworm" avatar with dropdown arrow
- Bottom border: 1px solid `#DADCE0`

### 4.2 Left Sidebar
- Logo area collapsed to icon when needed
- Menu items (exactly as in screenshot):
  - Dashboard
  - Statistics
  - Publishing overview
  - **Test and release** (expanded, light blue background)
    - Latest releases and bundles
    - Production
    - **Testing** → Internal testing (highlighted `#E8F0FE`)
    - Pre-launch report
    - Internal app sharing
  - Pre-registration
  - App integrity
  - Advanced settings
- Active item styling: background `#E8F0FE`, left blue bar 4px `#1A73E8`

### 4.3 Progress Steps
- Two steps horizontally:
  1. Blue filled circle + "Create release" (active)
  2. Gray outline circle + "Preview and confirm"
- Thin gray line connecting them

### 4.4 App Integrity Section
- Two green checkmarks with text:
  - "Automatic protection is on"
  - "Releases signed by Google Play"
- Blue links below: "Manage integrity protection" | "Change signing key"

### 4.5 App Bundles Upload Zone (Critical)
- Large dashed border box (height 240px)
- Centered illustration: gray document stack icon
- Text: "Drop app bundles here to upload"
- Two buttons side-by-side:
  - "Upload" (blue primary, with upload icon)
  - "Add from library" (blue outline)
- Accepted file type hint: `.aab`

### 4.6 Uploaded File Row
- Filename: `application-d7dc34ce-b19a-4c86-b5e6-79eb793f5e72.aab`
- Red error icon (⚠) on left
- Red error banner below with two lines:
  1. "Remove conflicts from the manifest before uploading. The following content provider authorities are in use by other developers: ..."
  2. "You need to use a different package name because 'com.bookworm.app' already exists in Google Play."
- Small "×" remove button on far right

### 4.7 Bottom Action Bar (Sticky)
- Right-aligned:
  - "Discard changes" (text button)
  - "Save as draft" (outlined button)
  - "Next" (primary blue button, disabled state possible)

---

## 5. Spacing & Shadows

- **Section vertical spacing**: 32px
- **Internal padding**: 24px (cards/sections)
- **Upload zone internal padding**: 40px
- **Shadow**: Subtle `0 1px 3px rgba(0,0,0,0.1)` on header and upload zone hover
- **Border radius**: 8px (Google standard)

---

## 6. Interactive States (Required)

- **Drag & Drop Zone**:
  - Default: dashed `#DADCE0`
  - Hover: dashed `#1A73E8`, background `#F8F9FA`
  - Active drag: solid blue border, blue background tint
- **Uploaded File**:
  - Error state: red left border + red icon
  - Hover: lighter red background
- **Sidebar Hover**: background `#F1F3F4`
- **Buttons**:
  - Hover scale 1.02 (subtle)
  - Focus ring: 2px `#1A73E8` outline

---

## 7. Implementation Notes for Coding Agent

1. Use Tailwind CSS classes that map exactly to the hex codes above.
2. Font: Import `Roboto` from Google Fonts or use system fallback.
3. Upload component: Use `react-dropzone` or native HTML5 drag-drop with visual feedback.
4. Error banner: Render as red alert box (use the exact text from screenshot for realism).
5. Make sidebar collapsible (hamburger on < 1024px).
6. "Next" button should be disabled until a valid `.aab` is uploaded and errors cleared.

---

**Deliverable Expectation**  
Recreate the page **pixel-perfect** to the uploaded screenshot using the exact colors, fonts, spacing, and layout defined above.  

Copy-paste this entire Markdown into a file named `google-play-console-internal-testing-ui-spec.md` and hand it to your developer.

**Ready to implement!** 🚀