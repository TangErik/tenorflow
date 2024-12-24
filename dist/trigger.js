let gamepadIndex = null;

// 映射方案
const buttonMapping = {
    0: "e-button",    // A 按钮
    1: "ə-button",    // B 按钮
    2: "i-button",    // X 按钮
    3: "aa-button",   // Y 按钮
    4: "u-button",    // L1 按钮
    5: "o-button",    // R1 按钮
    6: "ɤ-button",    // L2 按钮
    7: "a-button",    // R2 按钮
    8: "ɛ-button",    // Start 按钮
    9: "ɔ-button",    // Back 按钮
    10: "ɐ-button",   // 左摇杆按压
    11: "ʌ-button",   // 右摇杆按压
    12: "ø-button",   // D-pad 上
    13: "ɘ-button",   // D-pad 下
    14: "œ-button",   // D-pad 左
    15: "ɞ-button",   // D-pad 右
};

// 检测手柄是否连接
window.addEventListener("gamepadconnected", (event) => {
    gamepadIndex = event.gamepad.index;
    console.log(`Gamepad connected: ${event.gamepad.id}`);
    startGamepadListening();
});

// 检测手柄是否断开
window.addEventListener("gamepaddisconnected", () => {
    console.log("Gamepad disconnected");
    gamepadIndex = null;
});

// 手柄输入监听逻辑
function startGamepadListening() {
    if (gamepadIndex === null) return;

    function checkGamepadInput() {
        const gamepad = navigator.getGamepads()[gamepadIndex];
        if (gamepad) {
            gamepad.buttons.forEach((button, index) => {
                if (button.pressed && buttonMapping[index]) {
                    const buttonId = buttonMapping[index];
                    const webButton = document.getElementById(buttonId);

                    if (webButton) {
                        console.log(`Triggering button: ${buttonId}`);
                        webButton.click(); // 模拟点击网页按钮
                    }
                }
            });
        }
        requestAnimationFrame(checkGamepadInput);
    }

    requestAnimationFrame(checkGamepadInput);
}

// 为网页按钮绑定简单的点击事件（可按需扩展）
Object.keys(buttonMapping).forEach((key) => {
    const buttonId = buttonMapping[key];
    const webButton = document.getElementById(buttonId);
    if (webButton) {
        webButton.addEventListener("click", () => {
            console.log(`${buttonId} triggered`);
        });
    }
});
