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

// 使用食指指尖的 y 坐标控制频率
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
        results = handLandmarker.detectForVideo(video, startTimeMs);
    }

    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    if (results && results.landmarks) {
        for (const landmarks of results.landmarks) {
            // 获取食指指尖的 y 坐标
            const fingerTipY = landmarks[8]?.y || null;
            if (fingerTipY !== null) {
                console.log("Index finger tip Y:", fingerTipY);

                // 映射 y 坐标到频率范围
                const minFreq = 20; // 最低频率
                const maxFreq = 500; // 最高频率
                const step = 0.1;   // 步长
                const frequency = mapYToFrequency(
                    fingerTipY, // 直接使用 y 值
                    minFreq,
                    maxFreq,
                    step
                );
                console.log("Mapped frequency:", frequency);

                // 更新 tenorflow 的 freq 参数
                const paramName = "tenorflow/settings/Voice/freq";
                if (window.faustNode) {
                    if(window.faustNode.parameters.get("tenorflow/settings/Voice/freq")){
                        console.log(window.faustNode.parameters.get("tenorflow/settings/Voice/freq"))
                        // window.faustNode.parameters.get(paramName).value = frequency;
                    }
                }
            } else {
                console.log("No index finger detected.");
            }
        }
    }

    if (webcamRunning === true) {
        window.requestAnimationFrame(predictWebcam);
    }
}


/*
Object.keys(json).forEach((hand) => {
    const pointsArray = Object.values(Object.values(json)[hand]);
    for (let i = 0;i<pointsArray.length;i++) {
      const point = pointsArray[i];
      max.outlet(+hand, i, point["x"], point["y"], point["z"]);
      // max.post(+hand, i, point["x"], point["y"], point["z"]);
    }
});
*/
