function [gesture, pointerCoord, fingerCount, stateInfo] = gesture_detector(binaryMask, largestBlob, prevState)
% GESTURE_DETECTOR High-Accuracy Hand Gesture Classifier
% Uses horizontal slice histogram clustering (histcounts) & elevation geometry.
% Fully compatible with base MATLAB (zero external toolboxes).
%
% Gestures Supported:
%   - MOVE:        1 finger extended (Index finger pointing)
%   - LEFT_CLICK:  2 fingers joined together (Index + Middle touching / pinched)
%   - RIGHT_CLICK: 2 fingers spread in a V-sign (Peace sign) or 3 fingers
%   - SCROLL_UP:   Open hand swept upward
%   - SCROLL_DOWN: Open hand swept downward
%   - DRAG:        Closed fist (all fingers curled)

    gesture = 'MOVE';
    pointerCoord = [0, 0];
    fingerCount = 1;
    stateInfo = struct('numClusters', 1, 'spanRatio', 0, 'elevation', 0);

    if isempty(largestBlob) || largestBlob.Area < 1000
        gesture = 'IDLE';
        fingerCount = 0;
        return;
    end

    centroid = largestBlob.Centroid;
    bbox = largestBlob.BoundingBox;
    handW = max(20, bbox(3));
    handH = max(20, bbox(4));
    stateInfo.centroid = centroid;

    inX = largestBlob.InX;
    inY = largestBlob.InY;
    topPoint = largestBlob.TopPoint;
    pointerCoord = topPoint;

    % 1. Fist / Drag Detection (Curled fingers vs extended fingers)
    % Elevation of top-most point above the centroid
    topElevation = (centroid(2) - topPoint(2)) / handW;
    stateInfo.elevation = topElevation;

    % Area fill density inside bounding box
    bboxArea = handW * handH;
    density = largestBlob.Area / max(1, bboxArea);

    if topElevation < 0.25 || (density > 0.68 && topElevation < 0.32)
        % Fingers are curled down -> Closed Fist -> DRAG
        gesture = 'DRAG';
        pointerCoord = centroid;
        fingerCount = 0;
        return;
    end

    % 2. Analyze the upper 30% of the hand for finger peaks
    minY = bbox(2);
    bandCutoff = minY + 0.30 * handH;
    bandIdx = find(inY <= bandCutoff);

    if isempty(bandIdx) || length(bandIdx) < 20
        gesture = 'MOVE';
        pointerCoord = topPoint;
        return;
    end

    bandX = inX(bandIdx);
    minBandX = min(bandX);
    maxBandX = max(bandX);
    span = maxBandX - minBandX;
    spanRatio = span / handW;
    stateInfo.spanRatio = spanRatio;

    % 3. Finger cluster counting using 14-bin histogram
    numBins = 14;
    binEdges = linspace(minBandX, maxBandX, numBins + 1);
    counts = histcounts(bandX, binEdges);

    % Threshold active bins (ignore spurious edge noise)
    maxCount = max(counts);
    activeBins = counts >= max(3, 0.20 * maxCount);

    % Count contiguous finger clusters (transitions from 0 to 1)
    diffBins = diff([0, activeBins, 0]);
    numClusters = sum(diffBins == 1);
    stateInfo.numClusters = numClusters;

    % 4. Vertical velocity for scrolling (Open Palm motion)
    dY_motion = 0;
    if isfield(prevState, 'prevCentroid') && ~isempty(prevState.prevCentroid)
        dY_motion = centroid(2) - prevState.prevCentroid(2);
    end

    % 5. Gesture Classification Rules:
    
    % --- SCROLL GESTURES (Open Palm: wide span or 3+ clusters) ---
    if spanRatio >= 0.65 || numClusters >= 3
        fingerCount = 5;
        if dY_motion < -4.0
            gesture = 'SCROLL_UP';
        elseif dY_motion > 4.0
            gesture = 'SCROLL_DOWN';
        else
            gesture = 'MOVE';
        end
        return;
    end

    % --- RIGHT CLICK (V-sign / Peace sign: 2 separate clusters with gap) ---
    if numClusters == 2 && spanRatio >= 0.35 && spanRatio < 0.65
        gesture = 'RIGHT_CLICK';
        fingerCount = 2;
        return;
    end

    % --- LEFT CLICK (Index + Middle touching / pinched) ---
    if (numClusters == 1 && spanRatio >= 0.28 && spanRatio < 0.50) || ...
       (numClusters == 2 && spanRatio < 0.35)
        gesture = 'LEFT_CLICK';
        fingerCount = 2;
        return;
    end

    % --- MOVE CURSOR (Single Index Finger pointing) ---
    if numClusters == 1 && spanRatio < 0.28
        gesture = 'MOVE';
        fingerCount = 1;
        return;
    end

    % Default fallback: Move pointer
    gesture = 'MOVE';
    fingerCount = 1;
end
