// Function to handle button clicks
function joinGame(player, gameCode) {
    if (!gameCode) {
        alert("Please enter a valid game code!");
        return;
    }
    // Redirect to index.html with player and game code as URL parameters
    const url = `cabo-game.html?player=${encodeURIComponent(player)}&room=${encodeURIComponent(gameCode)}`;
    window.location.href = url;
}

// Attach event listeners to buttons
document.addEventListener('DOMContentLoaded', () => {
    const joinPlayerOneButton = document.getElementById('joinPlayerOne');
    const joinPlayerTwoButton = document.getElementById('joinPlayerTwo');
    const gameCodeInput = document.getElementById('gameCode');

    if (joinPlayerOneButton && joinPlayerTwoButton && gameCodeInput) {
        joinPlayerOneButton.addEventListener('click', () => {
            joinGame('player-1', gameCodeInput.value);
        });

        joinPlayerTwoButton.addEventListener('click', () => {
            joinGame('player-2', gameCodeInput.value);
        });
    } else {
        // Keep this error log as it's useful if the HTML structure changes
        console.error("Could not find required elements (buttons or game code input)!"); 
    }
});