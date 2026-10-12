%% TEST_ZERO_TOOLBOX Verification script for zero-toolbox compatibility
clear; clc;

fprintf('Testing zero-toolbox skin_detector and gesture_detector...\n');

% Create synthetic test frame
testFrame = uint8(ones(480, 640, 3) * 40);
testFrame(100:350, 200:350, 1) = 210; % Skin tone R
testFrame(100:350, 200:350, 2) = 150; % Skin tone G
testFrame(100:350, 200:350, 3) = 130; % Skin tone B

% Run skin_detector
[mask, blob] = skin_detector(testFrame, 1000);
fprintf('  skin_detector: OK (Blob Area = %d)\n', blob.Area);

% Run gesture_detector
state = struct();
[gesture, pointer, fingers, info] = gesture_detector(mask, blob, state);
fprintf('  gesture_detector: OK (Gesture = %s, Coords = [%.1f, %.1f])\n', gesture, pointer(1), pointer(2));

fprintf('\n>>> ALL FUNCTIONS OPERATIONAL WITH ZERO TOOLBOX DEPENDENCIES! <<<\n');
