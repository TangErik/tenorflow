const draggable = document.getElementById('draggable');
draggable.addEventListener('mousedown', (e) => {
const handleMousemove = (e) => {
draggable.style.left = e.clientX + "px";
draggable.style.top = e.clientY + "px";
};
const handleMouseup = (e) => {
window.removeEventListener('mousemove', handleMousemove);
window.removeEventListener('mouseup', handleMouseup);
}
window.addEventListener('mousemove', handleMousemove);
window.addEventListener('mouseup', handleMouseup);
});