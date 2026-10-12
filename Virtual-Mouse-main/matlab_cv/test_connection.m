%% TEST_CONNECTION Test MATLAB communication with Node.js backend server
clear; clc;

backendUrl = 'http://localhost:8080/api/status';
gestureUrl = 'http://localhost:8080/api/gesture';

fprintf('====================================================\n');
fprintf('  MATLAB <-> Virtual Mouse Backend Connectivity Test\n');
fprintf('====================================================\n\n');

% 1. Check Server Status
fprintf('[1/2] Connecting to %s ...\n', backendUrl);
options = weboptions('Timeout', 3, 'ContentType', 'json');

try
    t1 = tic;
    statusResponse = webread(backendUrl, options);
    latencyMs = toc(t1) * 1000;
    
    fprintf('  SUCCESS: Server is ONLINE! (Latency: %.1f ms)\n', latencyMs);
    fprintf('  Display Size: %d x %d\n', statusResponse.screenWidth, statusResponse.screenHeight);
    fprintf('  Mouse Control Enabled: %d\n', statusResponse.mouseEnabled);
    fprintf('  Connected Clients: %d\n\n', statusResponse.connectedClients);
catch ME
    fprintf('  FAILED: Could not reach backend server at %s.\n', backendUrl);
    fprintf('  Error details: %s\n\n', ME.message);
    fprintf('  Make sure to start the backend first by running:\n');
    fprintf('    cd backend\n    node server.js\n');
    return;
end

% 2. Send Sample Gesture Event
fprintf('[2/2] Sending test gesture to %s ...\n', gestureUrl);
testData = struct(...
    'gesture', 'MOVE', ...
    'x', 0.50, ...
    'y', 0.50, ...
    'confidence', 0.99, ...
    'fps', 30, ...
    'source', 'MATLAB_TEST_SCRIPT');

postOptions = weboptions(...
    'MediaType', 'application/json', ...
    'Timeout', 3, ...
    'ContentType', 'json');

try
    t2 = tic;
    postResponse = webwrite(gestureUrl, testData, postOptions);
    postLatency = toc(t2) * 1000;
    
    fprintf('  SUCCESS: Gesture acknowledged by backend! (Latency: %.1f ms)\n', postLatency);
    fprintf('  Target Cursor Position: [%d, %d]\n', postResponse.position.x, postResponse.position.y);
    fprintf('\nAll systems operational! You can now run main_virtual_mouse.m\n');
catch ME
    fprintf('  FAILED to send gesture: %s\n', ME.message);
end
