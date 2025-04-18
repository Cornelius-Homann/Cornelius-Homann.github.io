// Select the rotating ball element
const rotatingBall = document.querySelector('.rotating-ball');

// Add a click event listener to toggle the animation
rotatingBall.addEventListener('click', () => {
    if (rotatingBall.style.animationPlayState === 'paused') {
        rotatingBall.style.animationPlayState = 'running';
    } else {
        rotatingBall.style.animationPlayState = 'paused';
    }
});