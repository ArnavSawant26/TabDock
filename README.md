# ⚓ TabDock

> A sleek, macOS Dock-inspired fullscreen tab manager for Google Chrome with fluid magnification, dynamic edge repositioning, and seamless tab synchronization.

---

## ✨ Overview

**TabDock** transforms how you navigate and manage your open browser tabs. Designed with a modern glassmorphic aesthetic and fluid spring-like magnification, TabDock injects a non-intrusive, isolated dock into any web page.

Move seamlessly between tabs, create new ones, close background tabs, and snap the dock to your preferred screen edge (**Left**, **Bottom**, or **Right**) on the fly.

---

## 🚀 Key Features

- 🌊 **macOS-Style Fluid Magnification**  
  Smooth parabolic scaling on hover that dynamically magnifies tab icons and titles based on pointer proximity with zero stutter.
  
- 🔄 **Dynamic Multi-Edge Repositioning**  
  Grab the drag handle to effortlessly snap the dock to the **Left**, **Bottom**, or **Right** edge of your screen. Automatically adapts between vertical and horizontal dock layouts.

- 🛡️ **Isolated Shadow DOM Architecture**  
  Completely contained within an isolated Shadow Root (`#fullscreen-tab-manager-root`) preventing any style leakage or conflict with host web pages.

- ⚡ **Real-Time Tab Synchronization**  
  Powered by a lightweight Manifest V3 background service worker that reacts instantly to tab events (`created`, `removed`, `activated`, `updated`, `moved`).

- 🎛️ **Custom Interactive Scroll Track**  
  Custom-built, responsive scroll track and thumb slider that provides precise navigation even with dozens of open tabs.

- ➕ **One-Click Quick Actions**  
  Quickly create new tabs (`+` button) or dismiss tabs directly from their floating close controls.

- 🎨 **Modern Glassmorphic UI**  
  Dark frosted glass backdrop, subtle borders, luminous active tab indicators, and micro-interactions.

---

## 🛠️ Installation & Setup

### Prerequisites
- Google Chrome, Brave, Microsoft Edge, or any Chromium-based browser supporting Manifest V3.

### Steps to Install Locally

1. **Clone the repository**
   ```bash
   git clone https://github.com/ArnavSawant26/TabDock.git
   ```

2. **Open Extension Management in Chrome**
   - Navigate to `chrome://extensions/` in your browser address bar.
   - Enable **Developer mode** toggle in the top-right corner.

3. **Load Unpacked Extension**
   - Click the **"Load unpacked"** button in the top-left corner.
   - Select the `TabDock` root folder (where `manifest.json` is located).

4. **Start Using TabDock**
   - Open any website (e.g. `https://github.com` or `https://google.com`).
   - Move your mouse cursor to the configured screen edge (Left by default) to reveal the dock!

---

## 🎮 Controls & Usage

| Action | How to Trigger |
| :--- | :--- |
| **Reveal Dock** | Hover your cursor against the configured screen edge |
| **Switch Tab** | Click on any tab icon / title in the dock |
| **Close Tab** | Click the close button (`✕`) on the magnified tab |
| **New Tab** | Click the `+` button at the end of the dock |
| **Reposition Dock** | Click and drag the grip handle to Left, Bottom, or Right screen edges |
| **Scroll Tabs** | Use the mouse wheel over the dock or drag the custom scroll slider |

---

## 📂 Project Structure

```
TabDock/
├── manifest.json       # Chrome Extension Manifest V3 configuration
├── background.js       # Service worker handling tab state & Chrome APIs
├── content.js          # Injects isolated Shadow DOM container into pages
├── ui.html             # Modular dock markup template
├── ui.css              # Glassmorphic styles, animations, and edge layouts
├── ui.js               # Physics-based magnification, dragging & UI controller
└── README.md           # Project documentation
```

---

## 🛠️ Built With

- **HTML5 & Vanilla JavaScript (ES6+)**
- **Vanilla CSS3** (Custom Properties, Glassmorphism & Flexbox)
- **Chrome Extensions API (Manifest V3)** (Tabs, Storage, Runtime Messaging)
- **Shadow DOM API**

---

## 👤 Author & Credits

All design, architecture, and development by:

- **Arnav Sawant**  
  GitHub: [@ArnavSawant26](https://github.com/ArnavSawant26)

---

## 📄 License

This project is created and maintained by **Arnav Sawant**. All rights reserved.
