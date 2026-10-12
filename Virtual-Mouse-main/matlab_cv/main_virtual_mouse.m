%% MAIN_VIRTUAL_MOUSE
% 
%  PREFORMATTED
%  TEXT
% 
% Real-Time Hand Gesture Controlled Virtual Mouse using Computer Vision
%
% Architecture:
%   Webcam -> Frame Acquisition -> Preprocessing (Mirror & Color Space Conversion)
%          -> Hand Segmentation (YCbCr / HSV or Colored Marker)
%          -> Morphological Cleaning (Closing, Hole Filling, Area Opening)
%          -> Feature Extraction (Centroid, Extrema, Radial Contour Peaks, Convexity)
%          -> Gesture Classifier (Move, Left Click, Right Click, Scroll, Drag)
%          -> Telemetry Streaming to Node.js Backend & OS Virtual Mouse Driver

clear; clc; close all;

%% ========================== CONFIGURATION ==========================
CONFIG = struct();
CONFIG.BACKEND_URL     = 'http://localhost:8080/api/gesture';
CONFIG.ENABLE_BACKEND  = true;          % Stream to Node.js backend
CONFIG.DIRECT_JAVA_OS  = false;         % Fallback direct Java Robot OS mouse control
CONFIG.MODE            = 'SKIN';         % 'SKIN' or 'MARKER' or 'DEMO'
CONFIG.MARKER_COLOR    = 'blue';        % For MARKER mode: 'blue', 'green', 'red'
CONFIG.WIDTH           = 640;
CONFIG.HEIGHT          = 480;
CONFIG.MIN_HAND_AREA   = 2500;
CONFIG.SMOOTH_ALPHA    = 0.35;          % EMA coordinate smoothing
CONFIG.SEND_INTERVAL   = 0.030;         % Max ~33 updates/sec to backend

fprintf('=======================================================\n');
fprintf('     MATLAB HAND GESTURE VIRTUAL MOUSE SYSTEM\n');
fprintf('=======================================================\n');
fprintf('Mode: %s | Backend: %s\n', CONFIG.MODE, CONFIG.BACKEND_URL);

%% ======================== CAMERA INITIALIZATION ====================
cam = [];
isDemoMode = false;

try
    availableCams = webcamlist;
    if isempty(availableCams)
        warning('No physical webcam detected on system. Falling back to synthetic DEMO mode.');
        isDemoMode = true;
    else
        fprintf('Connecting to webcam: %s ...\n', availableCams{1});
        cam = webcam(1);
        % Set resolution if supported
        resList = cam.AvailableResolutions;
        if any(strcmp(resList, '640x480'))
            cam.Resolution = '640x480';
        end
        fprintf('Webcam ready.\n');
    end
catch ME
    fprintf('Webcam initialization failed: %s\nFalling back to synthetic DEMO mode.\n', ME.message);
    isDemoMode = true;
end

%% ==================== OPTIONAL JAVA OS MOUSE DRIVER ================
robot = [];
screenDim = [1920, 1080];
if CONFIG.DIRECT_JAVA_OS
    try
        import java.awt.Robot;
        import java.awt.event.*;
        import java.awt.Toolkit;
        robot = Robot();
        toolkit = Toolkit.getDefaultToolkit();
        screenDim = [toolkit.getScreenSize().width, toolkit.getScreenSize().height];
        fprintf('Java AWT Robot initialized. Display: %dx%d\n', screenDim(1), screenDim(2));
    catch ME
        warning('Failed to initialize Java AWT Robot: %s', ME.message);
    end
end

%% ===================== CREATE VISUALIZATION GUI ====================
fig = figure('Name', 'MATLAB Computer Vision - Hand Gesture Virtual Mouse', ...
             'NumberTitle', 'off', ...
             'Color', [0.1, 0.12, 0.15], ...
             'Position', [100, 100, 1080, 520], ...
             'MenuBar', 'none', ...
             'ToolBar', 'none');

% Left Subplot: Live Camera Stream with Tracking Overlay
ax1 = subplot(1, 2, 1, 'Parent', fig);
hImgRaw = image(zeros(CONFIG.HEIGHT, CONFIG.WIDTH, 3, 'uint8'), 'Parent', ax1);
axis(ax1, 'image');
set(ax1, 'XTick', [], 'YTick', []);
hold(ax1, 'on');
hPointer = plot(ax1, 0, 0, 'go', 'MarkerSize', 14, 'LineWidth', 2.5);
hTrail   = plot(ax1, 0, 0, 'c-', 'LineWidth', 1.8);
hCentroid= plot(ax1, 0, 0, 'mx', 'MarkerSize', 10, 'LineWidth', 2);
hBBox    = rectangle(ax1, 'Position', [0,0,1,1], 'EdgeColor', 'y', 'LineWidth', 1.5, 'Visible', 'off');
hold(ax1, 'off');
title(ax1, 'Live Camera Stream & Fingertip Tracking', 'Color', [0.9, 0.9, 0.9], 'FontSize', 12, 'FontWeight', 'bold');

% Right Subplot: Processed Binary Segmentation Mask
ax2 = subplot(1, 2, 2, 'Parent', fig);
hImgMask = imagesc(zeros(CONFIG.HEIGHT, CONFIG.WIDTH), 'Parent', ax2);
axis(ax2, 'image');
colormap(ax2, gray);
set(ax2, 'XTick', [], 'YTick', []);
title(ax2, 'Segmented Binary Mask (Pure Base MATLAB)', 'Color', [0.9, 0.9, 0.9], 'FontSize', 12, 'FontWeight', 'bold');

% HUD overlay text
hHud = uicontrol('Parent', fig, 'Style', 'text', ...
    'Units', 'normalized', 'Position', [0.03, 0.02, 0.94, 0.08], ...
    'BackgroundColor', [0.05, 0.07, 0.09], 'ForegroundColor', [0.2, 0.9, 0.4], ...
    'FontName', 'Courier', 'FontSize', 11, 'FontWeight', 'bold', ...
    'String', 'Initializing tracking pipeline...');

% Web request options
webOpts = weboptions('MediaType', 'application/json', 'Timeout', 0.15, 'ContentType', 'json');
imgBridgeOpts = weboptions('Timeout', 0.15, 'ContentType', 'image');

%% ==================== TRACKING STATE VARIABLES =====================
state = struct();
state.prevCentroid   = [];
state.lastClickTime  = 0;
state.smoothedX      = 0.5;
state.smoothedY      = 0.5;
state.trailHistory   = zeros(15, 2);
state.trailCount     = 0;
state.lastSendTime   = tic;
state.fpsTimer       = tic;
state.frameCount     = 0;
state.fps            = 30;

isRunning = true;
set(fig, 'CloseRequestFcn', @(src, ev) evalin('base', 'isRunning = false; closereq;'));
set(fig, 'KeyPressFcn', @keyHandler);

syntheticAngle = 0;

fprintf('\nTracking active. Controls:\n');
fprintf('  [Q] or Close Window - Exit gracefully\n');
fprintf('  [M] - Toggle between Skin and Color Marker mode\n');
fprintf('  [B] - Toggle Backend transmission\n\n');

%% ========================== MAIN LOOP ==============================
while isRunning && ishandle(fig)
    loopStart = tic;

    % 1. Acquire Frame
    if ~isDemoMode && ~isempty(cam)
        try
            frame = snapshot(cam);
        catch
            frame = zeros(CONFIG.HEIGHT, CONFIG.WIDTH, 3, 'uint8');
        end
        % Horizontal mirror (natural mirror movement)
        frame = fliplr(frame);
    else
        % Try reading live camera frame from Backend HTTP camera bridge
        gotBridgeFrame = false;
        try
            frame = webread('http://localhost:8080/api/frame.jpg', imgBridgeOpts);
            if ~isempty(frame) && size(frame, 1) > 10
                gotBridgeFrame = true;
            end
        catch
        end

        if ~gotBridgeFrame
            % Generate synthetic animated frame for testing/demo
            frame = generateSyntheticHand(syntheticAngle, CONFIG.WIDTH, CONFIG.HEIGHT);
            syntheticAngle = syntheticAngle + 0.04;
        end
    end

    % 2. Segment Hand or Marker
    if strcmp(CONFIG.MODE, 'MARKER')
        [binaryMask, markers] = color_marker_detector(frame, CONFIG.MARKER_COLOR, 200);
        largestBlob = [];
        if ~isempty(markers)
            largestBlob = markers(1);
        end
    else
        [binaryMask, largestBlob] = skin_detector(frame, CONFIG.MIN_HAND_AREA);
    end

    % 3. Classify Gesture & Extract Tracking Coordinates
    [gesture, pointerPx, fingerCount, diagInfo] = gesture_detector(binaryMask, largestBlob, state);

    % 4. Coordinate Smoothing & Normalization (0.0 to 1.0)
    hasTarget = ~isempty(largestBlob) && (pointerPx(1) > 0 || pointerPx(2) > 0);
    if hasTarget
        rawNormX = pointerPx(1) / CONFIG.WIDTH;
        rawNormY = pointerPx(2) / CONFIG.HEIGHT;

        % Exponential Moving Average
        state.smoothedX = CONFIG.SMOOTH_ALPHA * rawNormX + (1 - CONFIG.SMOOTH_ALPHA) * state.smoothedX;
        state.smoothedY = CONFIG.SMOOTH_ALPHA * rawNormY + (1 - CONFIG.SMOOTH_ALPHA) * state.smoothedY;

        % Trail buffer
        state.trailCount = min(15, state.trailCount + 1);
        state.trailHistory = [pointerPx; state.trailHistory(1:end-1, :)];

        state.prevCentroid = largestBlob.Centroid;
    end

    % 5. Send Telemetry to Node.js Backend
    if CONFIG.ENABLE_BACKEND && hasTarget && (toc(state.lastSendTime) >= CONFIG.SEND_INTERVAL)
        state.lastSendTime = tic;
        payload = struct(...
            'gesture', gesture, ...
            'x', state.smoothedX, ...
            'y', state.smoothedY, ...
            'confidence', 0.95, ...
            'fps', state.fps, ...
            'source', 'MATLAB_CV');

        try
            % Non-blocking HTTP request
            webwrite(CONFIG.BACKEND_URL, payload, webOpts);
        catch
            % Backend might be offline; continue without freezing
        end
    end

    % 6. Optional Direct Java OS Mouse Fallback
    if CONFIG.DIRECT_JAVA_OS && ~isempty(robot) && hasTarget
        try
            screenX = round(state.smoothedX * screenDim(1));
            screenY = round(state.smoothedY * screenDim(2));
            robot.mouseMove(screenX, screenY);

            if strcmp(gesture, 'LEFT_CLICK') && (toc(state.fpsTimer) - state.lastClickTime > 0.4)
                robot.mousePress(java.awt.event.InputEvent.BUTTON1_DOWN_MASK);
                robot.mouseRelease(java.awt.event.InputEvent.BUTTON1_DOWN_MASK);
                state.lastClickTime = toc(state.fpsTimer);
            elseif strcmp(gesture, 'RIGHT_CLICK') && (toc(state.fpsTimer) - state.lastClickTime > 0.4)
                robot.mousePress(java.awt.event.InputEvent.BUTTON3_DOWN_MASK);
                robot.mouseRelease(java.awt.event.InputEvent.BUTTON3_DOWN_MASK);
                state.lastClickTime = toc(state.fpsTimer);
            end
        catch
        end
    end

    % 7. Calculate Real-Time FPS
    state.frameCount = state.frameCount + 1;
    if toc(state.fpsTimer) >= 1.0
        state.fps = state.frameCount / toc(state.fpsTimer);
        state.frameCount = 0;
        state.fpsTimer = tic;
    end

    % 8. Update GUI Displays
    if ishandle(fig)
        set(hImgRaw, 'CData', frame);
        set(hImgMask, 'CData', binaryMask);

        if hasTarget
            set(hPointer, 'XData', pointerPx(1), 'YData', pointerPx(2), 'Visible', 'on');
            validTrail = state.trailHistory(1:state.trailCount, :);
            set(hTrail, 'XData', validTrail(:, 1), 'YData', validTrail(:, 2), 'Visible', 'on');

            if isfield(diagInfo, 'centroid') && diagInfo.centroid(1) > 0
                set(hCentroid, 'XData', diagInfo.centroid(1), 'YData', diagInfo.centroid(2), 'Visible', 'on');
            end

            if isfield(largestBlob, 'BoundingBox') && ~isempty(largestBlob.BoundingBox)
                set(hBBox, 'Position', largestBlob.BoundingBox, 'Visible', 'on');
            end
        else
            set(hPointer, 'Visible', 'off');
            set(hTrail, 'Visible', 'off');
            set(hCentroid, 'Visible', 'off');
            set(hBBox, 'Visible', 'off');
        end

        hudStr = sprintf('FPS: %4.1f | GESTURE: %-11s | FINGERS: %d | COORDS: (%.2f, %.2f) | MODE: %s', ...
            state.fps, gesture, fingerCount, state.smoothedX, state.smoothedY, CONFIG.MODE);
        set(hHud, 'String', hudStr);

        drawnow limitrate;
    end
end

%% ========================== CLEANUP ================================
fprintf('\nClosing session and releasing resources...\n');
if ~isempty(cam)
    clear cam;
end
fprintf('Session complete.\n');

%% ========================== HELPER FUNCTIONS =======================
function keyHandler(src, ev)
    global CONFIG isRunning; %#ok<GVMIS>
    if strcmp(ev.Key, 'q') || strcmp(ev.Key, 'escape')
        isRunning = false;
    elseif strcmp(ev.Key, 'm')
        if strcmp(CONFIG.MODE, 'SKIN')
            CONFIG.MODE = 'MARKER';
        else
            CONFIG.MODE = 'SKIN';
        end
        fprintf('Mode switched to: %s\n', CONFIG.MODE);
    elseif strcmp(ev.Key, 'b')
        CONFIG.ENABLE_BACKEND = ~CONFIG.ENABLE_BACKEND;
        fprintf('Backend transmission enabled: %d\n', CONFIG.ENABLE_BACKEND);
    end
end

function frame = generateSyntheticHand(t, W, H)
    % Generates a smooth, realistic moving hand silhouette in synthetic demo mode
    frame = 35 * ones(H, W, 3, 'uint8');
    cx = round(W * (0.5 + 0.28 * cos(t)));
    cy = round(H * (0.5 + 0.20 * sin(2 * t)));

    [xx, yy] = meshgrid(1:W, 1:H);
    palmDist = sqrt((xx - cx).^2 + (yy - cy).^2);

    % Palm region
    palmMask = palmDist <= 55;

    % Extended Index Finger pointing upwards
    fingerMask = (abs(xx - cx) <= 12) & (yy <= cy) & (yy >= cy - 85);

    handTotal = palmMask | fingerMask;

    % Skin tone color
    frame(repmat(handTotal, [1, 1, 3])) = 200;
    frame(:,:,2) = frame(:,:,2) - uint8(handTotal * 60);
    frame(:,:,3) = frame(:,:,3) - uint8(handTotal * 80);
end
