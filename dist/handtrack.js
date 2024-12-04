const video = document.getElementById("video");
const slider = document.getElementById("time-slider");
const timeValue = document.getElementById("time-value");

// 设置 Handtrack.js 模型
const modelParams = {
    flipHorizontal: true,  // 是否水平翻转视频
    maxNumBoxes: 2,        // 最多检测 2 只手
    iouThreshold: 0.5,     // 交并比阈值
    scoreThreshold: 0.2,   // 置信度阈值
};

let model;

// 加载 Handtrack.js 模型
handTrack.load(modelParams).then((loadedModel) => {
    model = loadedModel;
    startVideo();
});

// 开始视频流
function startVideo() {
    handTrack.startVideo(video).then((status) => {
        if (status) {
            detectHands();
        } else {
            console.log("无法启动视频流");
        }
    });
}

// 识别手势
function detectHands() {
    model.detect(video).then((predictions) => {
        if (predictions.length >= 2) {
            // 获取两只手的坐标
            const hand1 = predictions[0].bbox;
            const hand2 = predictions[1].bbox;

            // 计算两只手之间的距离
            const distance = calculateDistance(hand1, hand2);

            // 更新滑条
            updateSlider(distance);
        }

        // 不断进行检测
        requestAnimationFrame(detectHands);
    });
}

// 计算两只手之间的距离
function calculateDistance(hand1, hand2) {
    const x1 = (hand1[0] + hand1[2]) / 2;
    const y1 = (hand1[1] + hand1[3]) / 2;
    const x2 = (hand2[0] + hand2[2]) / 2;
    const y2 = (hand2[1] + hand2[3]) / 2;

    // 计算欧几里得距离
    const dist = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    return dist;
}

// 更新滑条的位置
function updateSlider(distance) {
    const maxDistance = 400;  // 最大距离，可以根据实际情况调整
    const sliderValue = Math.min((distance / maxDistance) * 5, 5);  // 映射到滑条范围（0-5）

    slider.value = sliderValue;
    timeValue.innerText = sliderValue.toFixed(1);  // 更新显示的时间值
}