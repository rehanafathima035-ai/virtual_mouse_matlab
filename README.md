# 🖱️ Virtual Mouse Using Computer Vision & Hand Gestures

**Control your computer with hand gestures — no physical mouse required!** ✋

A computer vision-based virtual mouse project that explores touchless computer interaction using hand gestures. It combines a web-based interface, a backend for mouse control, and MATLAB computer vision scripts to support gesture-based interaction.

## ✨ Features

* ✋ **Hand Gesture Recognition** — Detect and interpret supported hand gestures.
* 🖱️ **Virtual Mouse Control** — Interact with the computer using supported hand movements.
* 🎯 **Color Marker Detection** — MATLAB scripts for detecting colored markers.
* 🎨 **Skin Detection** — Includes a MATLAB skin-detection module.
* 🖥️ **Interactive Web Interface** — A frontend built with HTML, CSS, and JavaScript.
* ⚙️ **Backend Integration** — A Node.js backend for handling application functionality.
* 🔧 **Native Mouse Driver** — Includes a C# mouse-driver implementation and a Windows executable.

*Available gestures and controls depend on the current implementation.*

## 🛠️ Tech Stack

| Technology    | Purpose                                       |
| ------------- | --------------------------------------------- |
| HTML          | Web interface structure                       |
| CSS           | Interface styling                             |
| JavaScript    | Frontend interaction and application logic    |
| Node.js       | Backend runtime                               |
| MATLAB        | Computer vision and gesture-detection scripts |
| C#            | Native mouse-driver implementation            |
| Windows Batch | Startup and execution scripts                 |

## 📂 Project Structure

```text
Virtual-Mouse-main/
├── backend/
│   ├── native_driver/
│   │   ├── MouseDriver.cs
│   │   ├── MouseDriver.exe
│   │   └── build_driver.bat
│   ├── mouseController.js
│   ├── package.json
│   ├── package-lock.json
│   └── server.js
├── frontend/
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   ├── app.js
│   │   ├── visualizer.js
│   │   └── web_cv_fallback.js
│   └── index.html
├── matlab_cv/
│   ├── README_MATLAB.md
│   ├── calibrate_color.m
│   ├── color_marker_detector.m
│   ├── gesture_detector.m
│   ├── main_virtual_mouse.m
│   ├── skin_detector.m
│   ├── test_connection.m
│   └── test_zero_toolbox.m
├── run_matlab_mouse.bat
├── start_project.bat
└── README.md
```

## 🚀 Getting Started

### Prerequisites

Before running the project, ensure you have the required software installed:

* Windows operating system
* [Node.js and npm](https://nodejs.org/)
* MATLAB, if you intend to use the MATLAB-based computer vision modules
* A webcam, if required by the selected detection mode

### Installation

**1. Clone the repository**

```bash
git clone https://github.com/rehanafathima035-ai/virtual_mouse_matlab.git
```

**2. Navigate to the project directory**

```bash
cd virtual_mouse_matlab
```

**3. Install backend dependencies**

```bash
cd backend
npm install
```

**4. Return to the project root**

```bash
cd ..
```

**5. Start the application**

Run the provided Windows startup script:

```bat
start_project.bat
```

Alternatively, if you specifically want to use the MATLAB-based mouse implementation, inspect the instructions in `matlab_cv/README_MATLAB.md` and follow the appropriate setup steps for that mode.

> **Note:** The startup script may launch multiple components. Check its contents and the project's documentation before running it. If the application fails to start, verify that the required runtimes and dependencies are installed.

## 🎮 How It Works

1. **Capture:** The system obtains visual input from a supported camera or detection source.
2. **Detect:** Computer vision modules identify relevant hand features, skin regions, or color markers.
3. **Recognize:** The gesture-detection logic interprets supported hand movements.
4. **Process:** The backend handles the corresponding application or mouse-control operations.
5. **Interact:** The system translates supported gestures into computer interaction.

The exact processing pipeline depends on the selected operating mode.

## 🧪 MATLAB Computer Vision Modules

The `matlab_cv/` directory contains scripts for:

* Color calibration.
* Color marker detection.
* Gesture detection.
* Skin detection.
* Virtual mouse operation.
* Connection testing.

Refer to `matlab_cv/README_MATLAB.md` for additional MATLAB-specific instructions.

## 🔐 Safety & Permissions

This project includes functionality intended to control mouse input on Windows.

* Review the source code before running native executables.
* Run only software you trust.
* Avoid running executables obtained from untrusted sources.
* Do not commit API keys, credentials, or other sensitive information.

## 🔮 Future Improvements

Potential enhancements include:

* More robust hand tracking under different lighting conditions.
* Improved gesture recognition accuracy.
* Smoother cursor movement and reduced jitter.
* Additional configurable gestures.
* Adjustable sensitivity and calibration settings.
* Better cross-platform support.

## 🎯 Project Objective

The goal of this project is to explore computer vision, hand-gesture recognition, and alternative human-computer interaction methods by building a virtual mouse that can translate supported hand movements into mouse actions.

## 👩‍💻 Author

**Rehana Fathima**

GitHub: [@rehanafathima035-ai](https://github.com/rehanafathima035-ai)

---

⭐ If you find this project interesting, consider giving the repository a star!
