# LuxeStay 🏨✨
> **Premium Hotel Discovery, Finder & Booking Dashboard**

LuxeStay is a high-end, responsive single-page web application built with Vanilla HTML5, CSS3, and ES6+ JavaScript. It integrates with the Demo Hotels API to fetch real-time hotel records while extending functionalities with client-side filters, favorites toggles, interactive simulated booking, review submissions, and a local Admin control panel representing fully synchronized client-side CRUD (Create, Read, Update, Delete) capability.

---

## 🌟 Core Features

1. **Live API Integration**: Fetches verified premium hotels dynamically, with automatic fallbacks for local registries.
2. **Interactive Search & Filter Systems**:
   - Live query searches by hotel names, cities, or keywords.
   - Quick city filters using interactive chips.
   - Price range filters utilizing precise sliders.
   - Rating filters (All, 3.5+ ★, 4.0+ ★, 4.5+ ★).
3. **Advanced Client-Side Sorting**: Dynamically sort listings by Rating (High to Low) or Price (Low to High / High to Low) instantly.
4. **Hotel Details Portal (Modal)**:
   - Full photo gallery carousels with smooth slides and dots navigation.
   - Structured amenity badges.
   - Interactive Booking engine that validates check-in/out dates and computes billing totals (including 18% simulated GST) in real-time.
   - Live Review submissions and rating selectors.
5. **My Bookings Dashboard**: Review check-in dates, durations, guests count, billing history, and cancel active stays (stored persistently).
6. **Admin Control Panel (Simulated CRUD Overrides)**:
   - Create, edit, and delete hotel listings interactively.
   - Local overrides are stored in `localStorage` and blended with API results.
   - Overriding a remote API item masks it locally to show the edited copy, preserving server integrity.
7. **Premium Aesthetics (Light & Dark Modes)**: Curated variables supporting seamless dark-mode transitions, glassmorphic filters, and interactive scale micro-animations.

---

## 🛠️ Tech Stack & Dependencies

- **Core Structure**: HTML5 Semantic markup
- **Layout & Styles**: CSS3 Grid/Flexbox + Custom Variables (no external UI libraries, keeping performance high)
- **Logics**: Vanilla ES6+ JavaScript (compiled directly by the browser)
- **Iconographies**: [Bootstrap Icons CDN](https://icons.getbootstrap.com/)
- **Typographies**: [Google Fonts (Inter & Outfit)](https://fonts.google.com/)
- **Hosting / Local Server**: Any static directory host (e.g. Python Simple HTTP Server, VSCode Live Server)

---

## 📂 Project Directory Structure

```text
akg-intern/
├── index.html     # Application shell, layout structures & modals
├── styles.css     # CSS variable system, custom animations & grids
├── app.js         # State machine, API calls, event listeners & localStorage syncing
└── README.md      # Project documentations
```

---

## 🚀 How to Run Locally

Since this is a client-only static web app, running it is simple:

### Option 1: Python HTTP Server (Recommended)
Open your terminal inside the project directory and run:
```bash
# Python 3
python3 -m http.server 8000
```
Then visit `http://localhost:8000` in your web browser.

### Option 2: VS Code Live Server
1. Open the project folder in VS Code.
2. Click **Go Live** on the bottom right taskbar.

### Option 3: Double Click
Simply double-click the `index.html` file to launch it directly in your browser. (Note: Date-validation inputs might restrict some past values based on browser timezone settings).

---

## 📋 Coding Standards & Highlights

- **CSS custom variables**: Colors, box shadows, and transition rates are consolidated in `:root` to allow unified dark/light themes.
- **Debounced search inputs**: Typing updates filters smoothly, preventing stuttering or unnecessary reflows.
- **Clean Event Delegations**: Events are mounted properly on load, ensuring memory-leak-free lifecycle actions for modals.
- **Form Validations**: Built-in boundary checks for prices (₹500 - ₹50,000), ratings (1.0 - 5.0), and booking dates (no past check-ins).
