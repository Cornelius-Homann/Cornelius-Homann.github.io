// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, Timestamp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

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
 * @returns {Promise<boolean>} True if the room was newly created, false otherwise.
 */
async function initializeGameRoom(roomCode) {
    if (!roomCode) {
        console.error("initializeGameRoom: roomCode is required.");
        return false;
    }
    const roomRef = doc(db, 'gameRooms', roomCode);
    console.log(`Checking/Initializing room: ${roomCode}`);

    try {
        const roomSnap = await getDoc(roomRef);

        if (!roomSnap.exists()) {
            console.log(`Room ${roomCode} does not exist. Creating...`);

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
            console.log(`Room ${roomCode}: Initial shuffled stack (full):`, [...cardStack]); // Log copy

            // Deal initial hands (4 cards each)
            const player1Hand = cardStack.splice(0, 4);
            const player2Hand = cardStack.splice(0, 4);
            const discardStack = cardStack.splice(0, 1); // Deal one card to discard

            console.log(`Room ${roomCode}: Player 1 Hand:`, player1Hand);
            console.log(`Room ${roomCode}: Player 2 Hand:`, player2Hand);
            console.log(`Room ${roomCode}: Initial Discard:`, discardStack);
            console.log(`Room ${roomCode}: Remaining Deck:`, cardStack);


            const initialRoomData = {
                cardStack: cardStack,
                discardStack: discardStack,
                player1Hand: player1Hand,
                player2Hand: player2Hand,
                gameState: "player1Turn", // Example initial state
                createdAt: Timestamp.now()
            };

            await setDoc(roomRef, initialRoomData);
            console.log(`Room ${roomCode} created successfully with initial data.`);
            return true; // Indicate creation
        } else {
            console.log(`Room ${roomCode} already exists.`);
            return false; // Indicate existence
        }
    } catch (error) {
        console.error(`Error initializing room ${roomCode}:`, error);
        return false;
    }
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
        // Determine which hand to display based on playerRole
        const playerHandData = (playerRole === 'player-1') ? roomData.player1Hand : roomData.player2Hand;

        if (!playerHandData || playerHandData.length !== 4) {
            console.error(`Room ${roomCode}: Invalid or incomplete hand data for ${playerRole}.`, playerHandData);
            return;
        }

        // Select the correct player's card slots in the DOM
        const playerCardSlots = document.querySelectorAll(`.player.${playerRole} .card-slot img`);

        if (playerCardSlots.length !== 4) {
             console.error(`Room ${roomCode}: Found ${playerCardSlots.length} card slots for ${playerRole}, expected 4.`);
             return;
        }

        // Update the DOM elements with the hand data
        playerCardSlots.forEach((imgElement, index) => {
            const cardValue = playerHandData[index];
            // Display card face initially (or back.png if you prefer)
            imgElement.src = `karten/${cardValue}.png`;
            imgElement.setAttribute('data-card', cardValue);
            console.log(`Room ${roomCode}: Displayed card ${cardValue} for ${playerRole} slot ${index + 1}`);
        });

    } catch (error) {
        console.error(`Room ${roomCode}: Error displaying cards for ${playerRole}:`, error);
    }
}


// --- UI Interaction Functions ---

/**
 * Sets up click event listeners for player cards to flip them.
 */
function setupCardEventListeners() {
    const cardImages = document.querySelectorAll('.player .card-slot img'); // Target only player cards

    cardImages.forEach((card) => {
        // Remove existing listener to prevent duplicates if called multiple times
        card.removeEventListener('click', handleCardClick);
        // Add the new listener
        card.addEventListener('click', handleCardClick);
    });
    console.log("Card click event listeners set up.");
}

/**
 * Handles the click event on a player card (flips it).
 * @param {Event} event - The click event object.
 */
function handleCardClick(event) {
    const card = event.target;
    const cardFace = card.getAttribute('data-card');

    // Only allow flipping if the card has a valid face value
    if (!cardFace || cardFace === 'empty' || cardFace === '') {
        console.log("Cannot flip empty or invalid card slot.");
        return;
    }

    // Check the current src of the card
    if (card.src.includes('back.png')) {
        // If the card shows the back, flip it to show its face
        card.src = `karten/${cardFace}.png`;
    } else {
        // If the card shows its face, flip it to show the back
        card.src = 'karten/back.png';
    }
}


/**
 * Rotates the game board view based on the player role.
 * @param {string} playerRole - 'player-1' or 'player-2'.
 */
function rotatePageForPlayer(playerRole) {
    const pageContainer = document.getElementById("page-container");
    if (!pageContainer) {
        console.error("Error: #page-container element not found.");
        return;
    }

    // Ensure transition is set via CSS on #page-container
    // pageContainer.style.transition = 'transform 0.5s ease'; // Only if not in CSS

    if (playerRole === 'player-2') {
        pageContainer.style.transform = 'rotate(0deg)';
        pageContainer.classList.add('rotated'); // Optional class for other styles
        console.log('Rotated view for Player 2.');
    } else { // Default to Player 1 view (handles null/undefined/player-1)
        pageContainer.style.transform = 'rotate(180deg)';
        pageContainer.classList.remove('rotated');
        console.log('Set view for Player 1.');
    }
}

// --- Initialization on Page Load ---

document.addEventListener('DOMContentLoaded', async () => {
    console.log("DOM Loaded. Initializing game...");

    // --- Get URL Parameters ---
    const queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);
    currentPlayerRole = urlParams.get('player'); // Store globally
    let roomCodeParam = urlParams.get('room');

    // --- Determine Room Code ---
    if (roomCodeParam && roomCodeParam.trim() !== '') {
        currentRoomCode = roomCodeParam.trim();
    } else {
        // If no room code in URL, use default AND update URL for consistency? No, just use default for now.
        console.warn("Room code parameter ('room') missing or empty in URL. Using default room '1'.");
        currentRoomCode = '1';
    }
    console.log(`Using Room Code: ${currentRoomCode}`);
    console.log(`Detected Player Role: ${currentPlayerRole || 'N/A'}`);


    // --- Initialize Game Room ---
    await initializeGameRoom(currentRoomCode);

    // --- Initial Page Setup ---
    const pageContainer = document.getElementById("page-container");
    if (pageContainer) {
        rotatePageForPlayer(currentPlayerRole);
    } else {
        console.error("Could not find #page-container for initial setup.");
    }

    // --- Display Initial Game State ---
    await updateDiscardStackDisplay(currentRoomCode);
    if (currentPlayerRole) {
        await displayPlayerCards(currentRoomCode, currentPlayerRole);
        // TODO: Display opponent's cards as backs
    } else {
        console.warn("Cannot display player cards - player role unknown.");
    }


    // --- Setup Event Listeners ---
    setupCardEventListeners();

    // --- Setup Test Button Listeners ---
    const btnInitRoom = document.getElementById('btnInitRoom');
    const btnAddDiscard = document.getElementById('btnAddDiscard');
    const btnClearDiscard = document.getElementById('btnClearDiscard');
    const btnTestRotateP1 = document.getElementById('btnTestRotateP1');
    const btnTestRotateP2 = document.getElementById('btnTestRotateP2');

    if (btnInitRoom) {
        btnInitRoom.addEventListener('click', () => {
            console.log("Initialize Room button clicked - re-initializing room (will only create if missing).");
            initializeGameRoom(currentRoomCode);
        });
    }
     if (btnAddDiscard) {
        btnAddDiscard.addEventListener('click', async () => {
             console.log("Add First Card to Discard button clicked.");
             const card = await takeFromCardStack(currentRoomCode);
             if (card !== null) {
                 await addToDiscardStack(currentRoomCode, card);
             } else {
                 console.log("No card taken from stack to add.");
             }
        });
    }
     if (btnClearDiscard) {
        btnClearDiscard.addEventListener('click', () => {
            console.log("Clear Discard button clicked.");
            clearDiscardStack(currentRoomCode);
        });
    }

    // --- MODIFIED BUTTON LISTENERS ---
    if (btnTestRotateP1) {
        btnTestRotateP1.addEventListener('click', () => {
            // Construct URL with current room code and player=player-1
            const targetUrl = `index.html?player=player-1&room=${encodeURIComponent(currentRoomCode)}`;
            console.log(`Navigating to: ${targetUrl}`);
            window.location.href = targetUrl; // Navigate to the URL
        });
    }
    if (btnTestRotateP2) {
        btnTestRotateP2.addEventListener('click', () => {
            // Construct URL with current room code and player=player-2
            const targetUrl = `index.html?player=player-2&room=${encodeURIComponent(currentRoomCode)}`;
            console.log(`Navigating to: ${targetUrl}`);
            window.location.href = targetUrl; // Navigate to the URL
        });
    }

    console.log("Game initialization complete.");
});



