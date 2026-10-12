function [binaryMask, largestBlob] = skin_detector(rgbImg, minArea)
% SKIN_DETECTOR Zero-Toolbox Hand Skin Segmentation using Base MATLAB Matrix Math
% Works on ALL MATLAB installations without requiring Image Processing Toolbox.
%
% Inputs:
%   rgbImg   - Input RGB image (uint8, e.g. 480x640x3)
%   minArea  - Minimum pixel area threshold for noise rejection (default: 1500)
%
% Outputs:
%   binaryMask  - Processed binary mask (logical 2D matrix)
%   largestBlob - Struct with Area, Centroid, BoundingBox, TopPoint

    if nargin < 2
        minArea = 1500;
    end

    [H, W, ~] = size(rgbImg);

    % Convert channels to double
    R = double(rgbImg(:,:,1));
    G = double(rgbImg(:,:,2));
    B = double(rgbImg(:,:,3));

    % 1. PURE BASE MATLAB YCbCr Conversion (ITU-R BT.601 standard matrix)
    % Cr = 0.500000*R - 0.418688*G - 0.081312*B + 128
    % Cb = -0.168736*R - 0.331264*G + 0.500000*B + 128
    Cr = 0.500000 * R - 0.418688 * G - 0.081312 * B + 128;
    Cb = -0.168736 * R - 0.331264 * G + 0.500000 * B + 128;

    % Chai-Ngan Skin Color Model in YCbCr
    ycbcrSkin = (Cr >= 133 & Cr <= 178) & (Cb >= 85 & Cb <= 135);

    % 2. Kovac et al. RGB Color Space Skin Heuristic
    rgbSkin = (R > 80) & (G > 35) & (B > 20) & ...
              (R > G) & (R > B) & ...
              ((R - min(G, B)) > 12) & ...
              (abs(R - G) > 12);

    % Fusion mask
    rawMask = ycbcrSkin & rgbSkin;
    if sum(rawMask(:)) < minArea
        rawMask = ycbcrSkin | rgbSkin;
    end

    % 3. Fast Morphological Cleaning using Base MATLAB 2D Convolution (conv2)
    % Replaces strel, imclose, imfill, and bwareaopen without any toolbox!
    kClose = ones(7, 7);
    % Dilation
    dilated = conv2(double(rawMask), kClose, 'same') > 0;
    % Erosion
    eroded = conv2(double(dilated), kClose, 'same') >= 45;

    % Clean binary mask
    binaryMask = eroded;

    % 4. Fast Largest Hand Region Extraction in Pure Base MATLAB
    largestBlob = [];
    [yIdx, xIdx] = find(binaryMask);

    if length(yIdx) < minArea
        return;
    end

    % Reject background noise outliers using median and Interquartile Range (IQR)
    medX = median(xIdx);
    medY = median(yIdx);
    iqrX = max(40, iqr(xIdx));
    iqrY = max(40, iqr(yIdx));

    inliers = (abs(xIdx - medX) <= 2.2 * iqrX) & (abs(yIdx - medY) <= 2.2 * iqrY);
    inX = xIdx(inliers);
    inY = yIdx(inliers);

    if length(inX) < minArea
        return;
    end

    % Create isolated clean hand mask
    cleanMask = false(H, W);
    linearIdx = sub2ind([H, W], inY, inX);
    cleanMask(linearIdx) = true;
    binaryMask = cleanMask;

    % Compute Blob Properties
    centroid = [mean(inX), mean(inY)];
    minX = min(inX); maxX = max(inX);
    minY = min(inY); maxY = max(inY);
    bbox = [minX, minY, max(1, maxX - minX), max(1, maxY - minY)];

    % Top-most fingertip point (minimum Y coordinate)
    % To be robust against noise, take the top 2% highest points and average X
    sortedY = sort(inY, 'ascend');
    cutoffY = sortedY(min(length(sortedY), max(5, round(length(sortedY) * 0.02))));
    topIndices = find(inY <= cutoffY);
    topX = mean(inX(topIndices));
    topY = mean(inY(topIndices));

    largestBlob = struct();
    largestBlob.Area = length(inX);
    largestBlob.Centroid = centroid;
    largestBlob.BoundingBox = bbox;
    largestBlob.TopPoint = [topX, topY];
    largestBlob.InX = inX;
    largestBlob.InY = inY;
end
