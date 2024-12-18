// Copyright 2023 The MediaPipe Authors.

// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at

//      http://www.apache.org/licenses/LICENSE-2.0

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import {
    HandLandmarker,
    FilesetResolver
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0";

// import { WebSocketServer } from "ws";

// const client = new WebSocket("ws://localhost:8888");
const demosSection = document.getElementById("demos");

let handLandmarker = undefined;
let runningMode = "IMAGE";
let enableWebcamButton;
let webcamRunning = false;

// Before we can use HandLandmarker class we must wait for it to finish
// loading. Machine Learning models can be large and take a moment to
// get everything needed to run.
const createHandLandmarker = async () => {
    const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
    );
    handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
        delegate: "GPU"
    },
    runningMode: runningMode,
    numHands: 2
    });
    //demosSection.classList.remove("invisible");
};
createHandLandmarker();

/********************************************************************
// Demo 2: Continuously grab image from webcam stream and detect it.
********************************************************************/

const video = document.getElementById("webcam");
const canvasElement = document.getElementById(
    "output_canvas"
);
const canvasCtx = canvasElement.getContext("2d");

// Check if webcam access is supported.
const hasGetUserMedia = () => !!navigator.mediaDevices?.getUserMedia;

// If webcam supported, add event listener to button for when user
// wants to activate it.
if (hasGetUserMedia()) {
    enableWebcamButton = document.getElementById("webcamButton");
    enableWebcamButton.addEventListener("click", enableCam);
} else {
    console.warn("getUserMedia() is not supported by your browser");
}

// Enable the live webcam view and start detection.
function enableCam(event) {
    if (!handLandmarker) {
    console.log("Wait! objectDetector not loaded yet.");
    return;
    }

    if (webcamRunning === true) {
    webcamRunning = false;
    enableWebcamButton.innerText = "ENABLE PREDICTIONS";
    } else {
    webcamRunning = true;
    enableWebcamButton.innerText = "DISABLE PREDICTIONS";
    }

    // getUsermedia parameters.
    const constraints = {
    video: true
    };

    // Activate the webcam stream.
    navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
    video.srcObject = stream;
    video.addEventListener("loadeddata", predictWebcam);
    });
}

let lastVideoTime = -1;
let results = undefined;
console.log(video);

// 映射函数，限制范围并确保符合步长
const mapYToFrequency = (y, minFreq, maxFreq, step) => {
    const clampedY = Math.min(Math.max(y, 0), 1); // 限制 y 值到 [0, 1]
    const rawFreq = maxFreq - clampedY * (maxFreq - minFreq);
    return Math.round(rawFreq / step) * step; // 调整到符合步长
};

const mapDistanceToRange = (distance, minValue, maxValue, maxDistance) => {
    // 限制距离到 [0, maxDistance] 范围内
    const clampedDistance = Math.min(Math.max(distance, 0), maxDistance);
    // 映射到 [minValue, maxValue] 范围
    return minValue + (clampedDistance / maxDistance) * (maxValue - minValue);
};

const mapHeightDifferenceToDepth = (difference, maxDepth) => {
    return Math.max(0, Math.min(difference * 50, maxDepth)); // 放大系数50, 限制到maxDepth
};

// 假设最大可能手指距离是 0.2（根据实际情况调整）
const MAX_HAND_DISTANCE = 0.3;

let triggerActive = false; // 在 predictWebcam 函数外部定义全局状态变量
const pinchThreshold = 0.05; // 拇指与食指捏紧阈值

async function predictWebcam() {
    canvasElement.width = video.videoWidth;
    canvasElement.height = video.videoHeight;

    if (runningMode === "IMAGE") {
        runningMode = "VIDEO";
        await handLandmarker.setOptions({ runningMode: "VIDEO" });
    }

    let startTimeMs = performance.now();
    if (lastVideoTime !== video.currentTime) {
        lastVideoTime = video.currentTime;
        results = await handLandmarker.detectForVideo(video, startTimeMs);
    }

    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.save(); // 保存 canvas 的状态

    if (results && results.landmarks) {
        results.landmarks.forEach((landmarks, i) => {
            if (i === 0) {
                // 第一只手：原有控制逻辑
                const fingerTipY = landmarks[8]?.y || null;
                const thumbTip = landmarks[4];
                const indexTip = landmarks[8];

                if (fingerTipY !== null) {
                    const frequency = mapYToFrequency(fingerTipY, 20, 500, 0.1);
                    console.log("Hand 1: Mapped frequency:", frequency);

                    const paramName = "/tenorflow/settings/Voice/freq";
                    if (window.faustNode) {
                        window.faustNode.parameters.get(paramName).value = frequency;
                    }
                }

                if (thumbTip && indexTip) {
                    const dx = thumbTip.x - indexTip.x;
                    const dy = thumbTip.y - indexTip.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    if (distance < pinchThreshold && !triggerActive) {
                        triggerActive = true;
                        console.log("Hand 1: Trigger ON");
                        updateTrigger(1);
                    } else if (distance >= pinchThreshold && triggerActive) {
                        triggerActive = false;
                        console.log("Hand 1: Trigger OFF");
                        updateTrigger(0);
                    }
                }
            } else if (i === 1) {
                // 第二只手：Vibrato 控制逻辑
                const vibratoDepthParam = "/tenorflow/2/vibrato/VibratoDepth";
                const vibratoRateParam = "/tenorflow/2/vibrato/VibratoFreq";
                const firstHandLandmarks = results.landmarks[0];
                const secondHandLandmarks = results.landmarks[1];
                const firstHandIndexY = firstHandLandmarks[8]?.y || null; // 第一只手食指高度
                const secondHandIndexY = secondHandLandmarks[8]?.y || null; // 第二只手食指高度
                const thumbTip = landmarks[4];
                const indexTip = landmarks[8];

                if (firstHandIndexY !== null && secondHandIndexY !== null) {
                    const heightDifference = firstHandIndexY - secondHandIndexY;
        
                    // 如果第二只手高于第一只手，计算 VibratoDepth
                    const vibratoDepth = mapHeightDifferenceToDepth(heightDifference, 100);
                    if (window.faustNode) {
                        window.faustNode.parameters.get(vibratoDepthParam).value = vibratoDepth;
                    }
                }

                if (thumbTip && indexTip) {
                    const dx = thumbTip.x - indexTip.x;
                    const dy = thumbTip.y - indexTip.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    const vibratoRate = mapDistanceToRange(distance, 0, 20, MAX_HAND_DISTANCE);
                    console.log("Hand 2: Vibrato Frequency:", vibratoRate);

                    if (window.faustNode) {
                        window.faustNode.parameters.get(vibratoRateParam).value = vibratoRate;
                    }
                }
            }
        });
    } else {
        console.warn("No hands detected.");
    }

    if (webcamRunning) {
        window.requestAnimationFrame(predictWebcam);
    }
}

function updateTrigger(value) {
    const paramName = "/tenorflow/1/trigger";
    if (window.faustNode) {
        window.faustNode.setParamValue(paramName, value);
    }
}