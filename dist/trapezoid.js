// trapezoid.js

function setup() {
    // 创建一个画布，你可以调整尺寸以更好地适应你的页面布局
    let canvas = createCanvas(windowWidth / 2, windowHeight);
    canvas.parent('trapezoid');  // 确保画布插入到正确的容器
    /** @type {HTMLDivElement} */
    const buttonContainer = document.getElementById("vowel");
    /** @type {HTMLButtonElement[]} */
    const [buttonA, buttonI] = buttonContainer.children;
    buttonA.style.marginLeft = "250px";
    buttonA.style.marginTop = "450px";
}
  
function draw() {
  // 设置背景色
  background(145, 212, 234);

  // 绘制一个梯形
  fill(81, 246, 166); // 设置梯形颜色
  quad(50, 100, 450, 100, 430, 450, 250, 450);
}
  