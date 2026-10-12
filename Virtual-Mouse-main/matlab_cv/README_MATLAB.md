# MATLAB Computer Vision - Hand Gesture Virtual Mouse

This directory contains the computer vision pipeline implemented in **MATLAB** for the Hand Gesture Controlled Virtual Mouse project.

---

## 📁 Files Overview

| File | Description |
|------|-------------|
| **`main_virtual_mouse.m`** | Primary real-time computer vision loop with live dual-panel visualization and telemetry streaming. |
| **`gesture_detector.m`** | Feature extraction (convexity analysis, radial contour peaks, fingertip localization, and gesture classification). |
| **`skin_detector.m`** | Dual-color space segmentation (YCbCr + HSV) with morphological cleaning (closing, hole-filling, area filtering). |
| **`color_marker_detector.m`** | Noise-immune colored marker/cap tracker (Blue, Green, Red) for fingertip tracking in challenging lighting. |
| **`calibrate_color.m`** | Interactive calibration script: click on your hand to calculate personalized color thresholds. |
| **`test_connection.m`** | Connectivity verification script: tests round-trip HTTP latency with the Node.js backend. |

---

## 🛠️ Requirements & Toolboxes

To run the MATLAB computer vision pipeline, you will need:
1. **MATLAB** (R2020a or later recommended).
2. **Image Processing Toolbox** (for `rgb2ycbcr`, `bwareaopen`, `regionprops`, `bwboundaries`).
3. **MATLAB Support Package for USB Webcams** (Free Add-on in MATLAB Add-On Explorer) if using a physical webcam.

> **Note:** If no physical webcam is plugged in or detected, `main_virtual_mouse.m` automatically activates **Synthetic Demo Mode** so you can demonstrate and test the system without camera hardware!

---

## 🚀 Quick Start Guide

### Step 1: Start the Backend Server First
Ensure the backend is running so MATLAB can stream gesture coordinates:
```bash
# In your terminal / command prompt:
cd "Cv project\backend"
npm start
```
*(The backend runs on `http://localhost:8080`)*

### Step 2: Test Connectivity from MATLAB
In MATLAB, navigate to the `matlab_cv/` folder and run:
```matlab
test_connection
```
You should see:
```text
  SUCCESS: Server is ONLINE! (Latency: ~4 ms)
  Display Size: 1920 x 1080
  SUCCESS: Gesture acknowledged by backend!
```

### Step 3: Run the Main Computer Vision Loop
```matlab
main_virtual_mouse
```

---

## ✋ Supported Gestures

| Gesture | Hand Pose | Mouse Action |
|---------|-----------|--------------|
| **Move Cursor** | 1 Finger Extended (Index Finger) | Moves pointer smoothly across screen with EMA smoothing. |
| **Left Click** | 2 Fingers Extended close together (Index + Middle joined / pinched) | Single left click. |
| **Right Click** | 2 Fingers Spread Wide (V-sign) or 3 fingers | Single right click / Context menu. |
| **Scroll Up** | Open Palm moving upwards | Scrolls page / document up. |
| **Scroll Down** | Open Palm moving downwards | Scrolls page / document down. |
| **Drag & Drop** | Closed Fist | Holds left mouse button down for dragging. |

---

## ⌨️ Interactive Keyboard Controls

While `main_virtual_mouse` is running:
- **`Q`** or **`ESC`**: Safely stop and release the webcam.
- **`M`**: Switch between **Skin Color Segmentation** and **Colored Marker Tracking** modes on the fly.
- **`B`**: Toggle backend transmission ON / OFF.
