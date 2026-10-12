function [binaryMask, markerProps] = color_marker_detector(rgbImg, targetColor, minArea)
% COLOR_MARKER_DETECTOR Zero-Toolbox Colored Marker Tracker in Base MATLAB
% Fully independent of Image Processing Toolbox.
%
% Inputs:
%   rgbImg      - Input RGB frame (uint8)
%   targetColor - 'blue', 'green', 'red', or 'yellow' (default: 'blue')
%   minArea     - Minimum pixel area for noise filtering (default: 200)
%
% Outputs:
%   binaryMask  - Binary mask for tracked marker
%   markerProps - Struct array of detected markers (Area, Centroid, BoundingBox)

    if nargin < 2, targetColor = 'blue'; end
    if nargin < 3, minArea = 200; end

    R = double(rgbImg(:,:,1));
    G = double(rgbImg(:,:,2));
    B = double(rgbImg(:,:,3));

    switch lower(targetColor)
        case 'blue'
            % Distinct blue color threshold
            rawMask = (B > 95) & (B > 1.25 * R) & (B > 1.20 * G);
        case 'green'
            % Distinct green color threshold
            rawMask = (G > 95) & (G > 1.25 * R) & (G > 1.25 * B);
        case 'red'
            % Distinct red color threshold
            rawMask = (R > 110) & (R > 1.35 * G) & (R > 1.35 * B);
        case 'yellow'
            % Distinct yellow: high R and G, low B
            rawMask = (R > 110) & (G > 100) & (B < 0.70 * min(R, G));
        otherwise
            rawMask = (B > 95) & (B > 1.25 * R) & (B > 1.20 * G);
    end

    % Fast morphological cleaning with base conv2
    k = ones(5, 5);
    dilated = conv2(double(rawMask), k, 'same') > 0;
    eroded  = conv2(double(dilated), k, 'same') >= 20;
    binaryMask = eroded;

    markerProps = [];
    [yIdx, xIdx] = find(binaryMask);

    if length(yIdx) >= minArea
        centroid = [mean(xIdx), mean(yIdx)];
        minX = min(xIdx); maxX = max(xIdx);
        minY = min(yIdx); maxY = max(yIdx);
        bbox = [minX, minY, max(1, maxX - minX), max(1, maxY - minY)];

        marker = struct();
        marker.Area = length(xIdx);
        marker.Centroid = centroid;
        marker.BoundingBox = bbox;
        marker.TopPoint = [centroid(1), minY];
        marker.InX = xIdx;
        marker.InY = yIdx;

        markerProps = [marker];
    end
end
