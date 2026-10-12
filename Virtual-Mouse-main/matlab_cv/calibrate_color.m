%% CALIBRATE_COLOR Interactive Color Threshold Calibration Tool
% Base MATLAB implementation - Zero Toolbox Dependencies

clear; clc; close all;

fprintf('====================================================\n');
fprintf('  MATLAB Virtual Mouse - Color Calibration Tool\n');
fprintf('====================================================\n\n');

% Initialize Webcam
try
    cams = webcamlist;
    if isempty(cams)
        error('No webcams detected.');
    end
    cam = webcam(1);
    cam.Resolution = '640x480';
    fprintf('Webcam [%s] initialized.\n', cams{1});
    isSynthetic = false;
catch
    fprintf('Webcam not detected. Generating synthetic test sample...\n');
    isSynthetic = true;
end

% Capture reference frame
if ~isSynthetic
    fig = figure('Name', 'Color Calibration - Capture Sample', 'NumberTitle', 'off');
    hImg = image(zeros(480, 640, 3, 'uint8'));
    axis image off;
    title('Hold hand still in center of camera and press SPACEBAR to capture sample');
    
    captured = false;
    set(fig, 'KeyPressFcn', @(src, event) assignin('base', 'captured', true));
    
    while ~captured && ishandle(fig)
        frame = snapshot(cam);
        frame = fliplr(frame);
        set(hImg, 'CData', frame);
        drawnow;
    end
    
    if ~ishandle(fig)
        clear cam;
        return;
    end
    close(fig);
else
    frame = 128 * ones(480, 640, 3, 'uint8');
    frame(150:350, 200:440, 1) = 210; % Skin tone synth
    frame(150:350, 200:440, 2) = 160;
    frame(150:350, 200:440, 3) = 140;
end

% Prompt user to click on skin / marker
calibFig = figure('Name', 'Click Hand / Marker to Sample Color', 'NumberTitle', 'off');
image(frame);
axis image off;
title('Click on your palm or fingertip marker (1-2 points), then press Enter');
[clickX, clickY] = getpts(calibFig);
close(calibFig);

if isempty(clickX)
    fprintf('No points clicked. Using default Chai-Ngan thresholds.\n');
    if ~isSynthetic, clear cam; end
    return;
end

% Extract color values around clicked points
radius = 10;
[H_img, W_img, ~] = size(frame);
sampleYCrCb = [];

R = double(frame(:,:,1));
G = double(frame(:,:,2));
B = double(frame(:,:,3));

% Pure base MATLAB ITU-R BT.601 conversion
Cr = 0.500000 * R - 0.418688 * G - 0.081312 * B + 128;
Cb = -0.168736 * R - 0.331264 * G + 0.500000 * B + 128;

for i = 1:length(clickX)
    cx = round(clickX(i));
    cy = round(clickY(i));
    
    rY = max(1, cy-radius):min(H_img, cy+radius);
    rX = max(1, cx-radius):min(W_img, cx+radius);
    
    patchCr = Cr(rY, rX);
    patchCb = Cb(rY, rX);
    
    sampleYCrCb = [sampleYCrCb; [patchCr(:), patchCb(:)]]; %#ok<AGROW>
end

meanCr = mean(sampleYCrCb(:, 1));
stdCr  = std(sampleYCrCb(:, 1));
meanCb = mean(sampleYCrCb(:, 2));
stdCb  = std(sampleYCrCb(:, 2));

minCr = round(max(0, meanCr - 2.5 * stdCr));
maxCr = round(min(255, meanCr + 2.5 * stdCr));
minCb = round(max(0, meanCb - 2.5 * stdCb));
maxCb = round(min(255, meanCb + 2.5 * stdCb));

fprintf('\n=== CALIBRATION RESULTS ===\n');
fprintf('Recommended YCbCr Thresholds:\n');
fprintf('  Cr: [%d, %d]\n', minCr, maxCr);
fprintf('  Cb: [%d, %d]\n', minCb, maxCb);

if ~isSynthetic
    clear cam;
end
