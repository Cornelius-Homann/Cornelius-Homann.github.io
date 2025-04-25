// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

// Firebase configuration (Keep your actual config here)
const firebaseConfig = {
    apiKey: "AIzaSyD6d3XpQRiZS6ZX2d_8soi8XfUyCzGt4R4",
    authDomain: "cornelius-cabo.firebaseapp.com",
    databaseURL: "https://cornelius-cabo-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "cornelius-cabo",
    storageBucket: "cornelius-cabo.firebasestorage.app",
    messagingSenderId: "817971372989",
    appId: "1:817971372989:web:3d94b5a5ff3ca225fce8d4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- Global Variable ---
let currentRoomCode = '1'; // Default room code, will be updated from URL
let currentPlayerRole = null; // Store the current player's role globally

// --- Firestore Interaction Functions (Refactored for Rooms) ---

/**
 * Initializes a game room in Firestore if it doesn't exist.
 * Creates a shuffled deck, deals hands, and sets initial state.
 * @param {string} roomCode - The unique identifier for the game room.
 * @returns {boolean} True if the room was newly created, false otherwise.
 */
async function initializeGameRoom(roomCode) {
    unhighlightStacks(); // Unhighlight stacks on load
    if (!roomCode) {
        console.error("initializeGameRoom: roomCode is required.");
        return false;
    }
    const roomRef = doc(db, 'gameRooms', roomCode);
    console.log(`Checking/Initializing room: ${roomCode}`);

    try {
        const roomSnap = await getDoc(roomRef);

        // Determine if the room needs to be created or reset
        const isNewRoom = !roomSnap.exists();
        console.log(`Room ${roomCode} ${isNewRoom ? "does not exist. Creating..." : "already exists. Resetting room..."}`);

        // Create or reset the room data
        const roomData = generateRoomData();
        await setDoc(roomRef, roomData);
        console.log(`Room ${roomCode} ${isNewRoom ? "created" : "reset"} successfully.`);
        return isNewRoom; // Return true if the room was newly created, false otherwise
    } catch (error) {
        console.error(`Error initializing room ${roomCode}:`, error);
        return false;
    }
}

/**
 * Generates the initial or reset data for a game room.
 * @returns {Object} The room data object.
 */
function generateRoomData() {
    // Create the initial card stack
    let cardStack = [
        ...Array(2).fill(0), ...Array(4).fill(1), ...Array(4).fill(2),
        ...Array(4).fill(3), ...Array(4).fill(4), ...Array(4).fill(5),
        ...Array(4).fill(6), ...Array(4).fill(7), ...Array(4).fill(8),
        ...Array(4).fill(9), ...Array(4).fill(10), ...Array(4).fill(11),
        ...Array(4).fill(12), ...Array(2).fill(13)
    ];

    // Shuffle the card stack
    cardStack = cardStack.sort(() => Math.random() - 0.5);

    // Deal initial hands (4 cards each)
    const player1Hand = cardStack.splice(0, 4);
    const player2Hand = cardStack.splice(0, 4);
    const discardStack = cardStack.splice(0, 1); // Deal one card to discard

    console.log("Generated Room Data:");
    console.log("Player 1 Hand:", player1Hand);
    console.log("Player 2 Hand:", player2Hand);
    console.log("Initial Discard:", discardStack);
    console.log("Remaining Deck:", cardStack);
    updateDiscardStackDisplay(currentRoomCode); // Update UI
    return {
        cardStack: cardStack,
        discardStack: discardStack,
        player1Hand: player1Hand,
        player2Hand: player2Hand,
        gameState: "startphase", // Start with the start phase
        caboPressed: {
            player1: false,
            player2: false
        }
    };
}

/**
 * Fetches the current card stack for a specific room.
 * @param {string} roomCode - The unique identifier for the game room.
 * @returns {Promise<Array|null>} The card stack array or null if error/not found.
 */
async function fetchCardStack(roomCode) {
    if (!roomCode) {
        console.error("fetchCardStack: roomCode is required.");
        return null;
    }
    const roomRef = doc(db, 'gameRooms', roomCode);
    try {
        const roomSnap = await getDoc(roomRef);
        if (roomSnap.exists()) {
            const data = roomSnap.data();
            console.log(`Room ${roomCode}: Fetched card stack:`, data.cardStack);
            return data.cardStack || []; // Return stack or empty array
        } else {
            console.log(`Room ${roomCode}: No room document found!`);
            return null;
        }
    } catch (error) {
        console.error(`Room ${roomCode}: Error fetching card stack:`, error);
        return null;
    }
}


/**
 * Adds a card to the discard stack for a specific room.
 * @param {string} roomCode - The unique identifier for the game room.
 * @param {number} card - The card value to add.
 */
async function addToDiscardStack(roomCode, card) {
    if (!roomCode) {
        console.error("addToDiscardStack: roomCode is required.");
        return;
    }
     if (card === null || card === undefined) {
        console.error("addToDiscardStack: Invalid card value provided.");
        return;
    }
    const roomRef = doc(db, 'gameRooms', roomCode);

    try {
        const roomSnap = await getDoc(roomRef); // Get current data to avoid overwriting
        if (!roomSnap.exists()) {
             console.error(`addToDiscardStack: Room ${roomCode} does not exist.`);
             return;
        }
        let currentDiscardStack = roomSnap.data().discardStack || [];
        currentDiscardStack.push(card);

        await updateDoc(roomRef, { discardStack: currentDiscardStack }); // Update only the discard stack
        console.log(`Room ${roomCode}: Added card ${card} to discard stack:`, currentDiscardStack);
        await updateDiscardStackDisplay(roomCode); // Update UI
    } catch (error) {
        console.error(`Room ${roomCode}: Error adding card to discard stack:`, error);
    }
}

/**
 * Takes and removes the top card from the card stack for a specific room.
 * @param {string} roomCode - The unique identifier for the game room.
 * @returns {Promise<number|null>} The card value or null if error/empty.
 */
async function takeFromCardStack(roomCode) {
    if (!roomCode) {
        console.error("takeFromCardStack: roomCode is required.");
        return null;
    }
    const roomRef = doc(db, 'gameRooms', roomCode);

    try {
        const roomSnap = await getDoc(roomRef);
        if (!roomSnap.exists()) {
            console.log(`Room ${roomCode}: Room document does not exist.`);
            return null;
        }

        let roomData = roomSnap.data();
        let cardStack = roomData.cardStack || [];

        if (cardStack.length === 0) {
            console.log(`Room ${roomCode}: Card stack is empty.`);
            // TODO: Implement reshuffling discard pile into deck if needed
            return null;
        }

        const firstCard = cardStack.shift(); // Take the top card

        await updateDoc(roomRef, { cardStack: cardStack }); // Update the stack in Firestore
        console.log(`Room ${roomCode}: Took card ${firstCard}. Remaining stack size: ${cardStack.length}`);
        return firstCard; // Return the removed card
    } catch (error) {
        console.error(`Room ${roomCode}: Error taking card from card stack:`, error);
        return null;
    }
}

/**
 * Clears the discard stack for a specific room.
 * @param {string} roomCode - The unique identifier for the game room.
 */
async function clearDiscardStack(roomCode) {
     if (!roomCode) {
        console.error("clearDiscardStack: roomCode is required.");
        return;
    }
    const roomRef = doc(db, 'gameRooms', roomCode);

    try {
        await updateDoc(roomRef, { discardStack: [] }); // Set discard stack to empty array
        console.log(`Room ${roomCode}: Discard stack cleared.`);
        await updateDiscardStackDisplay(roomCode); // Update UI
    } catch (error) {
        console.error(`Room ${roomCode}: Error clearing the discard stack:`, error);
    }
}

/**
 * Updates the discard stack image display based on the latest card for a specific room.
 * @param {string} roomCode - The unique identifier for the game room.
 */
async function updateDiscardStackDisplay(roomCode) {
    const discardStackImg = document.querySelector('#discard-stack img');
    if (!discardStackImg) {
        console.error("Could not find discard stack image element.");
        return;
    }
     if (!roomCode) {
        console.error("updateDiscardStackDisplay: roomCode is required.");
        discardStackImg.src = 'karten/empty.png'; // Show empty on error
        discardStackImg.setAttribute('data-card', 'empty');
        return;
    }
    const roomRef = doc(db, 'gameRooms', roomCode);

    try {
        const roomSnap = await getDoc(roomRef);
        let discardStack = [];

        if (roomSnap.exists()) {
            discardStack = roomSnap.data().discardStack || [];
        } else {
             console.log(`Room ${roomCode}: Document does not exist for display update.`);
             // Treat as empty if room doesn't exist yet
        }

        if (!Array.isArray(discardStack) || discardStack.length === 0) {
            discardStackImg.src = 'karten/empty.png';
            discardStackImg.setAttribute('data-card', 'empty');
            console.log(`Room ${roomCode}: Discard stack is empty or not found.`);
        } else {
            const latestCard = discardStack[discardStack.length - 1];
            discardStackImg.src = `karten/${latestCard}.png`;
            discardStackImg.setAttribute('data-card', latestCard);
            console.log(`Room ${roomCode}: Updated discard stack display to show card: ${latestCard}`);
        }
    } catch (error) {
        console.error(`Room ${roomCode}: Error updating discard stack display:`, error);
        discardStackImg.src = 'karten/empty.png'; // Show empty on error
        discardStackImg.setAttribute('data-card', 'empty');
    }
}

/**
 * Sets up the initial display of player cards based on Firestore data.
 * @param {string} roomCode - The unique identifier for the game room.
 * @param {string} playerRole - 'player-1' or 'player-2'.
 */
async function displayPlayerCards(roomCode, playerRole) {
    if (!roomCode || !playerRole) {
        console.error("displayPlayerCards: roomCode and playerRole are required.");
        return;
    }

    const roomRef = doc(db, 'gameRooms', roomCode);

    try {
        const roomSnap = await getDoc(roomRef);
        if (!roomSnap.exists()) {
            console.error(`Room ${roomCode}: Cannot display cards, room not found.`);
            return;
        }

        const roomData = roomSnap.data();
        const playerHandData = (playerRole === 'player-1') ? roomData.player1Hand : roomData.player2Hand;

        if (!playerHandData || playerHandData.length !== 4) {
            console.error(`Room ${roomCode}: Invalid or incomplete hand data for ${playerRole}.`, playerHandData);
            return;
        }

        // Select the card slots for the current player
        const playerCardSlots = document.querySelectorAll(`.player.${playerRole} .card-slot img`);

        if (playerCardSlots.length !== 4) {
            console.error(`Room ${roomCode}: Found ${playerCardSlots.length} card slots for ${playerRole}, expected 4.`);
            return;
        }

        // Initialize all cards as back.png
        playerCardSlots.forEach((imgElement, index) => {
            imgElement.src = "karten/back.png"; // Set to back of the card
            imgElement.setAttribute("data-card", playerHandData[index]); // Store the card value for flipping
        });

        console.log(`Room ${roomCode}: Initialized cards for ${playerRole}.`);
    } catch (error) {
        console.error(`Room ${roomCode}: Error displaying cards for ${playerRole}:`, error);
    }
}



/**
 * Sets the gameState variable for the current room in Firestore.
 * @param {string} newGameState - The new game state to set (e.g., "player1Turn", "player2Turn", "caboCalled").
 * @returns {Promise<void>}
 */
async function setGameState(newGameState) {
    if (!currentRoomCode || !newGameState) {
        console.error("setGameState: currentRoomCode and newGameState are required.");
        return;
    }

    const roomRef = doc(db, 'gameRooms', currentRoomCode);

    try {
        const roomSnap = await getDoc(roomRef);

        if (!roomSnap.exists()) {
            console.error(`Room ${currentRoomCode} does not exist. Cannot set gameState.`);
            alert(`Room ${currentRoomCode} does not exist. Please initialize the room first.`);
            return;
        }

        await updateDoc(roomRef, { gameState: newGameState });
        console.log(`Room ${currentRoomCode}: gameState updated to "${newGameState}".`);
    } catch (error) {
        console.error(`Error setting gameState for room ${currentRoomCode}:`, error);
    }
}

/**
 * Listens for changes to the gameState variable in Firestore and triggers functions based on its value.
 * @param {string} roomCode - The unique identifier for the game room.
 */
function listenToGameState(roomCode) {
    const roomRef = doc(db, 'gameRooms', roomCode);

    onSnapshot(roomRef, (docSnap) => {
        if (!docSnap.exists()) {
            console.error(`Room ${roomCode} does not exist. Cannot listen to gameState.`);
            return;
        }

        const roomData = docSnap.data();
        const gameState = roomData.gameState;

        console.log(`Room ${roomCode}: gameState changed to "${gameState}".`);

        // Call specific functions based on the gameState value
        switch (gameState) {
            case "startphase":
                console.log("Calling handleStartPhase...");
                handleStartPhase();
                break;
            case "player1Turn":
                handlePlayer1Turn();
                break;
            case "player2Turn":
                handlePlayer2Turn();
                break;
            case "caboCalled":
                handleCaboCalled();
                break;
            case "scoring":
                handleScoringPhase();
                break;
            default:
                console.warn(`Unknown gameState: "${gameState}"`);
        }
    });
}

async function handleStartPhase() {
    console.log("Start phase initiated.");

    const roomRef = doc(db, 'gameRooms', currentRoomCode);
    const roomSnap = await getDoc(roomRef);

    if (!roomSnap.exists()) {
        console.error(`Room ${currentRoomCode} does not exist. Cannot start phase.`);
        return;
    }

    const roomData = roomSnap.data();
    console.log("Room Data:", roomData);

    // Check if the phase is already completed
    if (roomData.gameState !== "startphase") {
        console.warn(`Room ${currentRoomCode}: Not in start phase. Current phase: ${roomData.gameState}`);
        return;
    }

    // Reveal the two bottom cards for the current player
    const playerHandKey = currentPlayerRole === "player-1" ? "player1Hand" : "player2Hand";
    const hand = roomData[playerHandKey];
    console.log(`Hand for ${currentPlayerRole}:`, hand);

    if (!hand || hand.length < 4) {
        console.error(`Room ${currentRoomCode}: Invalid or incomplete hand data for ${currentPlayerRole}.`, hand);
        return;
    }

    // Select the specific card slots for the current player
    const cardSlot3 = document.querySelector(`#${currentPlayerRole}-card3 img`);
    const cardSlot4 = document.querySelector(`#${currentPlayerRole}-card4 img`);
    console.log("Card Slot 3:", cardSlot3);
    console.log("Card Slot 4:", cardSlot4);

    if (cardSlot3 && cardSlot4) {
        // Reveal the last two cards (bottom cards)
        cardSlot3.src = `karten/${hand[2]}.png`; // Show third card face
        cardSlot4.src = `karten/${hand[3]}.png`; // Show fourth card face
        console.log(`Revealed bottom cards for ${currentPlayerRole}: ${hand[2]}, ${hand[3]}`);
    } else {
        console.error(`Card slots for ${currentPlayerRole} not found.`);
    }
}
async function handlePlayer1Turn() {
    flipAllCardsToBack();


    if (currentPlayerRole === "player-1") {
        console.log("Player 1's turn. Highlighting stacks.");
        // Highlight stacks for Player 1
        highlightStacks(); // Highlight stacks for Player 1
    }
}


function highlightStacks(){
    document.getElementById('discard-stack').style.border = '2px dashed green'; // Highlight stacks for Player 1
    document.getElementById('draw-stack').style.border = '2px dashed blue'; // Highlight stacks for Player 1
}
function unhighlightStacks(){
    document.getElementById('discard-stack').style.border = ''; // Unhighlight stacks for Player 1
    document.getElementById('draw-stack').style.border = ''; // Unhighlight stacks for Player 1
}
function flipAllCardsToBack() {
    const allPlayerCards = document.querySelectorAll('.player .card-slot img');
    allPlayerCards.forEach(img => {
        img.src = 'karten/back.png';
    });
}


// Map currentPlayerRole to Firestore keys
function mapPlayerRoleToFirestoreKey(playerRole) {
    if (playerRole === "player-1") return "player1";
    if (playerRole === "player-2") return "player2";
    console.error(`Invalid player role: ${playerRole}`);
    return null;
}

document.addEventListener('DOMContentLoaded', async () => {
    console.log("DOM Loaded. Initializing game...");
    
    unhighlightStacks(); // Unhighlight stacks on load
    // --- Get URL Parameters ---
    const queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);
    currentPlayerRole = urlParams.get('player'); // Store globally
    let roomCodeParam = urlParams.get('room');

    // --- Determine Room Code ---
    if (roomCodeParam && roomCodeParam.trim() !== '') {
        currentRoomCode = roomCodeParam.trim();
    } else {
        console.warn("Room code parameter ('room') missing or empty in URL. Using default room '1'.");
        currentRoomCode = '1';
    }
    console.log(`Using Room Code: ${currentRoomCode}`);
    console.log(`Detected Player Role: ${currentPlayerRole || 'N/A'}`);

    // --- Rotate ---
    if (currentPlayerRole === 'player-1') {
        console.log("Player 1 joined.");
        document.getElementById('page-container').style.transform = 'rotate(180deg)'; // Rotate for Player 1
        document.getElementById('stacks').style.transform = 'rotate(180deg)'; // Rotate stacks for Player 1
    } else {
        console.log("Player 2 joined.");
    }
    updateDiscardStackDisplay(currentRoomCode); // Update discard stack display on load

    // --- Attach Event Listeners ---
    const btnCabo = document.getElementById('btnCabo');
    if (btnCabo) {
        if (listenToGameState(currentRoomCode) !== "startphase") {
        btnCabo.disabled = false; // Ensure the button is enabled
        btnCabo.addEventListener('click', async () => {
            console.log('CABO button clicked');
            try {
                const firestoreKey = mapPlayerRoleToFirestoreKey(currentPlayerRole);
                console.log(`Firestore Key for ${currentPlayerRole}: ${firestoreKey}`);
                if (!firestoreKey) return;

                const roomRef = doc(db, 'gameRooms', currentRoomCode);

                // Update the caboPressed field for the current player
                await updateDoc(roomRef, {
                    [`caboPressed.${firestoreKey}`]: true
                });
                console.log(`${currentPlayerRole} pressed CABO`);

                // Fetch the current caboPressed state
                const roomSnap = await getDoc(roomRef);
                if (roomSnap.exists()) {
                    const caboPressed = roomSnap.data().caboPressed || {};
                    console.log("Current caboPressed state:", caboPressed);

                    // Check if both players have pressed CABO
                    if (caboPressed.player1 && caboPressed.player2) {
                        console.log("Both players pressed CABO. Transitioning to player1Turn.");
                        await setGameState("player1Turn"); // Transition to player1Turn
                    }
                } else {
                    console.error(`Room ${currentRoomCode} does not exist.`);
                }
            } catch (error) {
                console.error('Error updating CABO state:', error);
            }
        });
    }
    } else {
        console.error('CABO button not found');
    }

    const btnResetRoom = document.getElementById('btnResetRoom');
    if (btnResetRoom) {
        btnResetRoom.addEventListener('click', async () => {
            console.log('Reset Room button clicked');
            if (confirm('Are you sure you want to reset the room?')) {
                await initializeGameRoom(currentRoomCode);
                console.log('Room reset successfully');
                updateDiscardStackDisplay(currentRoomCode); // Update discard stack display after reset
            }
        });
    }

    // --- Listen to gameState changes ---
    listenToGameState(currentRoomCode);

    // --- Display Player Cards ---
    await displayPlayerCards(currentRoomCode, currentPlayerRole);

    console.log("Game initialization complete.");
   
});



