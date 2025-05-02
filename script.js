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
let cardTaken = false;

// --- Firestore Interaction Functions (Refactored for Rooms) ---

/**
 * Initializes a game room in Firestore if it doesn't exist.
 * Creates a shuffled deck, deals hands, and sets initial state.
 * @param {string} roomCode - The unique identifier for the game room.
 * @returns {boolean} True if the room was newly created, false otherwise.
 */
async function initializeGameRoom(roomCode) {
    unhighlightStacks(); // Unhighlight stacks on load
    flipAllCardsToBack(); // Flip all cards to back on load
    unhighlightCards("player-1"); // Unhighlight player 1 cards on load
    unhighlightCards("player-2"); // Unhighlight player 2 cards on load
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
        gameState: "startphase",
        caboPressed: {
            player1: false,
            player2: false
        },
        previewCard: null // <-- Add this line
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
 * Takes and removes the top card from the draw stack for a specific room.
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
 * Takes and removes the top card from the discard stack for a specific room.
 * @param {string} roomCode - The unique identifier for the game room.
 * @returns {Promise<number|null>} The card value or null if error/empty.
 */
async function takeFromDiscardStack(roomCode) {
    if (!roomCode) {
        console.error("takeFromDiscardStack: roomCode is required.");
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
        let discardStack = roomData.discardStack || [];

        if (discardStack.length === 0) {
            console.log(`Room ${roomCode}: disCard stack is empty.`);
            // TODO: Implement reshuffling discard pile into deck if needed
            return null;
        }

        const firstCard = discardStack.pop(); // Take the top (newest) card

        await updateDoc(roomRef, { discardStack: discardStack }); // Update the stack in Firestore
        console.log(`Room ${roomCode}: Took card ${firstCard}. Remaining stack size: ${discardStack.length}`);
        return firstCard; // Return the removed card
    } catch (error) {
        console.error(`Room ${roomCode}: Error taking card from card stack:`, error);
        return null;
    }
}
/*
    * Adds a card to the discard stack for a specific room.
    * @param {string} roomCode - The unique identifier for the game room.
    * @param {number} card - The card value to add.
*/
async function addCardToDiscardStack(roomCode, card) {
    if (!roomCode) {
        console.error("addCardToDiscardStack: roomCode is required.");
        return;
    }
    if (card === null || card === undefined) {
        console.error("addCardToDiscardStack: Invalid card value provided.");
        return;
    }
    const roomRef = doc(db, 'gameRooms', roomCode);

    try {
        const roomSnap = await getDoc(roomRef); // Get current data to avoid overwriting
        if (!roomSnap.exists()) {
            console.error(`addCardToDiscardStack: Room ${roomCode} does not exist.`);
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
 * Updates the display of a player's cards based on provided hand data.
 * @param {string} playerRole - 'player-1' or 'player-2'.
 * @param {Array} playerHandData - The array representing the player's hand.
 * @param {boolean} revealAll - If true, show card faces; otherwise, show backs.
 */
// --- REMOVED roomCode parameter, ADDED playerHandData parameter ---
function displayPlayerCards(playerRole, playerHandData, revealAll = false) {
    if (!playerRole) {
        console.error("displayPlayerCards: playerRole is required.");
        return;
    }

    // --- REMOVED Firestore fetching logic ---

    // Validate the provided hand data
    if (!playerHandData || !Array.isArray(playerHandData) || playerHandData.length !== 4) {
        console.error(`displayPlayerCards: Invalid or incomplete hand data provided for ${playerRole}.`, playerHandData);
        // Optionally show empty slots or default backs
        const playerCardSlotsOnError = document.querySelectorAll(`.player.${playerRole} .card-slot img`);
        playerCardSlotsOnError.forEach((imgElement) => {
            imgElement.src = "karten/back.png"; // Default to back on error
            imgElement.setAttribute("data-card", "");
        });
        return;
    }

    // Select the card slots for the current player
    const playerCardSlots = document.querySelectorAll(`.player.${playerRole} .card-slot img`);

    if (playerCardSlots.length !== 4) {
        console.error(`displayPlayerCards: Found ${playerCardSlots.length} card slots for ${playerRole}, expected 4.`);
        return;
    }

    // Show card faces if revealAll, otherwise show backs
    playerCardSlots.forEach((imgElement, index) => {
        const cardValue = playerHandData[index];
        if (revealAll) {
            // Ensure cardValue is valid before setting src
            if (cardValue !== null && cardValue !== undefined) {
                imgElement.src = `karten/${cardValue}.png`;
            } else {
                // Handle null/undefined cards if they can occur in the hand
                imgElement.src = "karten/empty.png"; // Or back.png if preferred
            }
        } else {
            imgElement.src = "karten/back.png";
        }
        // Store the actual card value in data attribute regardless of reveal state
        imgElement.setAttribute("data-card", (cardValue !== null && cardValue !== undefined) ? cardValue : "");
    });

    // console.log(`displayPlayerCards: Updated cards for ${playerRole}. RevealAll: ${revealAll}`);
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
        updatePhaseIndicator(gameState); // <-- Add this line

        // Enable or disable CABO button based on game state and player turn
        const btnCabo = document.getElementById('btnCabo');
        if (btnCabo) {
            if (
                gameState === "startphase" ||
                (gameState === "player1Turn" && currentPlayerRole === "player-1") ||
                (gameState === "player2Turn" && currentPlayerRole === "player-2")
            ) {
                btnCabo.disabled = false;
            } else {
                btnCabo.disabled = true;
            }
        }

        console.log(`Room ${roomCode}: gameState changed to "${gameState}".`);

        // Call specific functions based on the gameState value
        switch (gameState) {
            case "startphase":
                console.log("Calling handleStartPhase...");
                clearStackClickHandlers();
                unhighlightCards("player-1");
                unhighlightCards("player-2");
                unhighlightStacks();
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
function listenToDiscardStack(roomCode) {
    const roomRef = doc(db, 'gameRooms', roomCode);
    onSnapshot(roomRef, (docSnap) => {
        if (!docSnap.exists()) {
            console.error(`Room ${roomCode} does not exist. Cannot listen to discard stack.`);
            return;
        }
        const roomData = docSnap.data();
        if ('discardStack' in roomData) {
            updateDiscardStackDisplay(roomCode);
        }
    });
}

function listenToAnimationEvents(roomCode) {
    const roomRef = doc(db, 'gameRooms', roomCode);
    let lastHandledTimestamp = 0;
    onSnapshot(roomRef, (docSnap) => {
        if (!docSnap.exists()) return;
        const data = docSnap.data();
        const anim = data.lastAnimation;
        if (!anim || anim.timestamp === lastHandledTimestamp) return;
        lastHandledTimestamp = anim.timestamp;

        // Find DOM elements
        let fromElem = null, toElem = null; // Initialize to null
        if (anim.from === "draw-stack") fromElem = document.querySelector('#draw-stack img');
        if (anim.from === "discard-stack") fromElem = document.querySelector('#discard-stack img');
        if (anim.from === "preview-card-img") fromElem = document.getElementById('preview-card-img');
        if (anim.from.startsWith("player-")) fromElem = document.querySelector(`#${anim.from} img`);

        // --- FIXED: Correctly check anim.to for preview-card-img ---
        if (anim.to === "preview-card-img") toElem = document.getElementById('preview-card-img');
        else if (anim.to === "discard-stack-img") toElem = document.querySelector('#discard-stack img');
        else if (anim.to.startsWith("player-")) toElem = document.querySelector(`#${anim.to} img`);

        // --- Add logging if elements are not found ---
        if (!fromElem) {
            console.error(`Animation Listener: Could not find 'from' element for selector: ${anim.from}`);
            return; // Stop if element not found
        }
        if (!toElem) {
            console.error(`Animation Listener: Could not find 'to' element for selector: ${anim.to}`);
            return; // Stop if element not found
        }

        // Determine card image to show
        let cardImgSrc = `karten/${anim.card}.png`;
        let showBackForOpponent = currentPlayerRole !== anim.player;

        const animationType = anim.type || "";
        const forceBackFlag = anim.forceBack || false;

        // Trigger the animation locally
        triggerCardAnimationLocal({
            fromElem,
            toElem,
            cardImgSrc,
            showBackForOpponent,
            type: animationType,
            forceBack: forceBackFlag
        });
    });
}
function listenToPreviewCard(roomCode) {
    const roomRef = doc(db, 'gameRooms', roomCode);
    onSnapshot(roomRef, (docSnap) => {
        if (!docSnap.exists()) return;
        const data = docSnap.data();
        const previewCard = data.previewCard;
        const gameState = data.gameState;
        const caboCaller = data.caboCaller; // Get the cabo caller

        // --- FIXED: Determine if it's this player's turn, including caboCalled state ---
        let isMyTurn = false;
        if (
            (gameState === "player1Turn" && currentPlayerRole === "player-1") ||
            (gameState === "player2Turn" && currentPlayerRole === "player-2") ||
            // --- Add this condition for caboCalled state ---
            (gameState === "caboCalled" && caboCaller !== currentPlayerRole)
        ) {
            isMyTurn = true;
        }

        // Show back.png if not your turn and a card is present, else show face or empty
        if (previewCard === null || previewCard === undefined) {
            showPreviewCard(null); // Show empty if null/undefined
        } else if (isMyTurn) {
            showPreviewCard(previewCard, false); // Show face if it's my turn (or my final turn in caboCalled)
        } else {
            showPreviewCard(previewCard, true); // Show back if it's not my turn
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
// --- Update handlePlayer1Turn and handlePlayer2Turn to enforce correct turn flow ---
async function handlePlayer1Turn(caboMode = false) {
    flipAllCardsToBack();
    clearStackClickHandlers(); // Prevent other player from interacting

    if (currentPlayerRole === "player-1") {
        highlightStacks();
        const drawStack = document.getElementById('draw-stack');
        const discardStack = document.getElementById('discard-stack');

        if (drawStack) {
            drawStack.onclick = async () => {
                if (cardTaken) return;
                cardTaken = true; // Set immediately on click
                const takenCard = await takeFromCardStack(currentRoomCode);

                if (takenCard !== null && takenCard !== undefined) {
                    clearStackClickHandlers(currentRoomCode);
                    unhighlightStacks();
                    highlightDiscardStack(); // Highlight discard stack for player 1
                    await triggerCardAnimation({
                        from: "draw-stack",
                        to: "preview-card-img",
                        card: takenCard,
                        player: "player-1",
                        type: "draw"
                    });
                    await setPreviewCard(currentRoomCode, takenCard);

                    highlightCards("player-1");
                    await enableSwitchOrDiscard(takenCard, "player-1", async () => {
                        unhighlightCards("player-1");
                        unhighlightStacks();
                        cardTaken = false; // Reset only after action is complete
                        if (caboMode) {
                            await setGameState("scoring");
                        } else {
                            setGameState("player2Turn");
                        }
                    }, "draw", caboMode);
                } else {
                    cardTaken = false;
                }
            };
        }
        if (discardStack) {
            discardStack.onclick = async () => {
                if (cardTaken) return;
                cardTaken = true; // Set immediately on click
                const takenCard = await takeFromDiscardStack(currentRoomCode);
                if (takenCard !== null && takenCard !== undefined) {
                    clearStackClickHandlers(currentRoomCode);
                    unhighlightStacks();
                    await triggerCardAnimation({
                        from: "discard-stack",
                        to: "preview-card-img",
                        card: takenCard,
                        player: "player-1",
                        type: "take-discard"
                    });
                    await setPreviewCard(currentRoomCode, takenCard);
                    updateDiscardStackDisplay(currentRoomCode);
                    highlightCards("player-1");
                    await enableSwitchOrDiscard(takenCard, "player-1", async () => {
                        unhighlightCards("player-1");
                        unhighlightStacks();
                        cardTaken = false; // Reset only after action is complete
                        if (caboMode) {
                            await setGameState("scoring");
                        } else {
                            setGameState("player2Turn");
                        }
                    }, "discard", caboMode);
                } else {
                    cardTaken = false;
                }
            };
        }
    }
}

async function handlePlayer2Turn(caboMode = false) {
    flipAllCardsToBack();
    clearStackClickHandlers(); // Prevent other player from interacting

    if (currentPlayerRole === "player-2") {
        highlightStacks();
        const drawStack = document.getElementById('draw-stack');
        const discardStack = document.getElementById('discard-stack');

        if (drawStack) {
            drawStack.onclick = async () => {
                if (cardTaken) return;
                cardTaken = true; // Set immediately on click
                const takenCard = await takeFromCardStack(currentRoomCode);

                if (takenCard !== null && takenCard !== undefined) {
                    clearStackClickHandlers(currentRoomCode);
                    unhighlightStacks();
                    highlightDiscardStack(); // Highlight discard stack for player 2
                    await triggerCardAnimation({
                        from: "draw-stack",
                        to: "preview-card-img",
                        card: takenCard,
                        player: "player-2",
                        type: "draw"
                    });
                    await setPreviewCard(currentRoomCode, takenCard);

                    highlightCards("player-2");
                    await enableSwitchOrDiscard(takenCard, "player-2", async () => {
                        unhighlightCards("player-2");
                        unhighlightStacks();
                        cardTaken = false; // Reset only after action is complete
                        if (caboMode) {
                            await setGameState("scoring");
                        } else {
                            setGameState("player1Turn");
                        }
                    }, "draw", caboMode);
                } else {
                    cardTaken = false;
                }
            };
        }
        if (discardStack) {
            discardStack.onclick = async () => {
                if (cardTaken) return;
                cardTaken = true; // Set immediately on click
                const takenCard = await takeFromDiscardStack(currentRoomCode);
                if (takenCard !== null && takenCard !== undefined) {
                    clearStackClickHandlers(currentRoomCode);
                    unhighlightStacks();
                    await triggerCardAnimation({
                        from: "discard-stack",
                        to: "preview-card-img",
                        card: takenCard,
                        player: "player-2",
                        type: "take-discard"
                    });
                    await setPreviewCard(currentRoomCode, takenCard);
                    updateDiscardStackDisplay(currentRoomCode);
                    highlightCards("player-2");
                    await enableSwitchOrDiscard(takenCard, "player-2", async () => {
                        unhighlightCards("player-2");
                        unhighlightStacks();
                        cardTaken = false; // Reset only after action is complete
                        if (caboMode) {
                            await setGameState("scoring");
                        } else {
                            setGameState("player1Turn");
                        }
                    }, "discard", caboMode);
                } else {
                    cardTaken = false;
                }
            };
        }
    }
}

async function handleCaboCalled() {
    const roomRef = doc(db, 'gameRooms', currentRoomCode);
    const roomSnap = await getDoc(roomRef);
    if (!roomSnap.exists()) return;
    const roomData = roomSnap.data();

    const caboCaller = roomData.caboCaller;
    let nextPlayer = null;

    if (caboCaller === "player-1") {
        nextPlayer = "player-2";
    } else if (caboCaller === "player-2") {
        nextPlayer = "player-1";
    } else {
        console.error("No caboCaller set!");
        return;
    }

    // Only allow the non-caller to play
    if (currentPlayerRole === nextPlayer) {
        // Give the non-caller their final turn
        if (nextPlayer === "player-1") {
            await handlePlayer1Turn(true); // Pass a flag for cabo mode
        } else {
            await handlePlayer2Turn(true);
        }
    }
}

async function handleScoringPhase() {
    // --- Delay to allow Firestore propagation ---
    await new Promise(resolve => setTimeout(resolve, 500)); // Keep or adjust delay as needed

    const roomRef = doc(db, 'gameRooms', currentRoomCode);
    let roomData;

    try {
        const roomSnap = await getDoc(roomRef);
        if (!roomSnap.exists()) {
            console.error("Scoring Phase: Room does not exist!");
            return;
        }
        roomData = roomSnap.data();

        // --- Ensure we have valid hand data ---
        if (!roomData.player1Hand || !roomData.player2Hand || roomData.player1Hand.length !== 4 || roomData.player2Hand.length !== 4) {
            console.error("Scoring Phase: Invalid hand data found!", roomData);
            showScoreOverlay("Error", "Error", "Invalid hand data during scoring.");
            return;
        }

        // --- Direct DOM Manipulation to Reveal Cards ---
        console.log("Scoring Phase: Directly revealing cards...");

        // Reveal Player 1 Cards
        const player1Slots = document.querySelectorAll('.player.player-1 .card-slot img');
        if (player1Slots.length === 4) {
            roomData.player1Hand.forEach((cardValue, index) => {
                if (player1Slots[index]) {
                    if (cardValue !== null && cardValue !== undefined) {
                        player1Slots[index].src = `karten/${cardValue}.png`;
                    } else {
                        player1Slots[index].src = 'karten/empty.png'; // Or back.png
                    }
                }
            });
        } else {
            console.error("Scoring Phase: Could not find all card slots for Player 1.");
        }

        // Reveal Player 2 Cards
        const player2Slots = document.querySelectorAll('.player.player-2 .card-slot img');
        if (player2Slots.length === 4) {
            roomData.player2Hand.forEach((cardValue, index) => {
                if (player2Slots[index]) {
                    if (cardValue !== null && cardValue !== undefined) {
                        player2Slots[index].src = `karten/${cardValue}.png`;
                    } else {
                        player2Slots[index].src = 'karten/empty.png'; // Or back.png
                    }
                }
            });
        } else {
            console.error("Scoring Phase: Could not find all card slots for Player 2.");
        }
        // --- End of Direct DOM Manipulation ---


        // Disable all interactions except reset
        clearStackClickHandlers();
        const drawStackElem = document.getElementById('draw-stack');
        const discardStackElem = document.getElementById('discard-stack');
        if (drawStackElem) drawStackElem.style.pointerEvents = 'none';
        if (discardStackElem) discardStackElem.style.pointerEvents = 'none';
        document.querySelectorAll('.card-slot img').forEach(img => {
            img.style.pointerEvents = 'none';
            img.onclick = null;
        });
         const previewImg = document.getElementById('preview-card-img');
         if (previewImg) {
              previewImg.style.pointerEvents = 'none';
              previewImg.onclick = null;
         }


        // Calculate scores based on the fetched player hands
        const player1Score = calculateScore(roomData.player1Hand);
        const player2Score = calculateScore(roomData.player2Hand);

        // Determine winner
        let winnerText = "";
        if (player1Score < player2Score) {
            winnerText = "Player 1 wins! 🎉";
        } else if (player2Score < player1Score) {
            winnerText = "Player 2 wins! 🎉";
        } else {
            winnerText = "It's a tie!";
        }

        // Show overlay with scores and winner
        showScoreOverlay(player1Score, player2Score, winnerText);

        // Launch confetti effect
        launchConfetti();

    } catch (error) {
        console.error("Error during Scoring Phase:", error);
        showScoreOverlay("Error", "Error", "An error occurred during scoring.");
    }
}

function calculateScore(playerHand) {
    // If playerHand is not an array or has wrong length, return 0
    if (!Array.isArray(playerHand) || playerHand.length !== 4) {
        return 0;
    }
    // Sum up the values of the cards in the hand
    return playerHand.reduce((sum, card) => sum + (typeof card === "number" ? card : 0), 0);
}

/**
 * --- Helper function to allow only switch or discard after taking a card ---
 */
async function enableSwitchOrDiscard(takenCard, player, onComplete, source, caboMode = false) {
    // Remove stack click handlers to prevent taking another card
    clearStackClickHandlers();

    // Enable switching out with a hand card
    const playerHandKey = player === "player-1" ? "player1Hand" : "player2Hand";
    const roomRef = doc(db, 'gameRooms', currentRoomCode);

    const playerCardSlots = document.querySelectorAll(`.player.${player} .card-slot img`);
    playerCardSlots.forEach((cardSlot) => {
        cardSlot.onclick = async () => {
            // Extract the card index from the ID, e.g., "player-1-card-4"
            const idMatch = cardSlot.parentElement.id.match(/card(\d)$/);
            if (!idMatch) {
                console.error("Could not determine card index from ID:", cardSlot.parentElement.id);
                return;
            }
            const cardIndex = parseInt(idMatch[1], 10) - 1;

            // --- Animation: preview to hand slot (real-time for both players) ---
            clearStackClickHandlers(currentRoomCode);
            unhighlightStacks();
            await triggerCardAnimation({
                from: "preview-card-img",
                to: `${player}-card${cardIndex + 1}`,
                card: takenCard,
                player: player,
                type: "preview-to-hand"
            });

            // Fetch latest hand/discard
            const roomSnap = await getDoc(roomRef);
            const roomData = roomSnap.data();
            const playerHand = [...roomData[playerHandKey]];
            let discardStack = Array.isArray(roomData.discardStack) ? [...roomData.discardStack] : [];

            const currentCard = playerHand[cardIndex];
            playerHand[cardIndex] = takenCard;
            
            discardStack.push(currentCard);

            await updateDoc(roomRef, {
                [playerHandKey]: playerHand,
                discardStack: discardStack
            });
        // Animate the old card flying from the hand slot to the discard stack
        clearStackClickHandlers(); // Prevent further clicks
        await triggerCardAnimation({
            from: `${player}-card${cardIndex + 1}`,
            to: "discard-stack-img",
            card: currentCard, // the card that was replaced
            player: player,
            type: "hand-to-discard"
        });
            await clearPreviewCard();
            await updateDiscardStackDisplay(currentRoomCode);
            displayPlayerCards(player, playerHand, caboMode);

            // Remove hand card click handlers after action
            playerCardSlots.forEach(slot => slot.onclick = null);

            unhighlightCards(player);
            unhighlightStacks();

            if (onComplete) onComplete();
        };
    });

    // Highlight player cards always
    highlightCards(player);

    // If the card was drawn from the draw stack, allow discarding by clicking the discard stack
    if (source === "draw") {
        // Only highlight the discard stack (not the draw stack)
        unhighlightStacks();
        highlightDiscardStack();

        const discardStackElem = document.getElementById('discard-stack');
        if (discardStackElem) {
            discardStackElem.onclick = async () => {
                // Fetch latest discard stack
                const roomSnap = await getDoc(roomRef);
                let discardStack = Array.isArray(roomSnap.data().discardStack) ? [...roomSnap.data().discardStack] : [];
                discardStack.push(takenCard);
                clearStackClickHandlers(currentRoomCode); // Prevent further clicks
                await triggerCardAnimation({
                    from: "preview-card-img",
                    to: "discard-stack-img",
                    card: takenCard,
                    player: player,
                    type: "discard-preview"
                });
                await updateDoc(roomRef, { discardStack: discardStack });
                await clearPreviewCard();
                await updateDiscardStackDisplay(currentRoomCode);

                // Remove hand card click handlers after action
                playerCardSlots.forEach(slot => slot.onclick = null);

                unhighlightCards(player);
                unhighlightStacks();

                // --- EXTRA ACTION LOGIC ---
                if (takenCard === 7 || takenCard === 8) {
                    peek(player, onComplete); // Only call onComplete after peek is finished
                    // Do NOT call onComplete() here!
                } else if (takenCard === 9 || takenCard === 10) {
                    spy(player, onComplete); // Only call onComplete after spy is finished
                    // Do NOT call onComplete() here!
                } else if (takenCard === 11 || takenCard === 12) {
                    swap(player, onComplete); // Only call onComplete after swap is finished
                    // Do NOT call onComplete() here!
                } else {
                    if (onComplete) onComplete();
                }
            };
        }
    } else {
        // If from discard stack, do not allow discarding the preview card, and do not highlight discard stack
        unhighlightDiscardStack();
    }

    // Remove preview card border highlight in all cases
    const previewImg = document.getElementById('preview-card-img');
    if (previewImg) {
        previewImg.style.border = '';
        previewImg.onclick = null;
    }
}

//EXTRA ACTIONS

function peek(player = currentPlayerRole, onComplete) {
    const playerHandKey = player === "player-1" ? "player1Hand" : "player2Hand";
    const roomRef = doc(db, 'gameRooms', currentRoomCode);

    const playerCardSlots = document.querySelectorAll(`.player.${player} .card-slot img`);
    let revealedIndex = null;

    // Highlight all cards at the start of peek
    highlightCards(player);

    playerCardSlots.forEach((cardSlot, idx) => {
        cardSlot.onclick = async () => {
            // Only allow one card to be revealed at a time
            if (revealedIndex !== null && revealedIndex !== idx) return;

            if (revealedIndex === null) {
                // Reveal the card face
                const roomSnap = await getDoc(roomRef);
                const roomData = roomSnap.data();
                const playerHand = roomData[playerHandKey];
                cardSlot.src = `karten/${playerHand[idx]}.png`;
                revealedIndex = idx;

                // Remove all click handlers except for the revealed card
                playerCardSlots.forEach((slot, i) => {
                    if (i !== idx) {
                        slot.onclick = null;
                        slot.style.border = ''; // Remove highlight from other cards
                        slot.style.borderRadius = ''; // Remove border radius
                    } else {
                        slot.style.border = '2px solid red';
                        slot.style.borderRadius = '5px';
                    }
                });
            } else {
                // Hide the card again (flip to back), unhighlight, remove handlers
                cardSlot.src = "karten/back.png";
                unhighlightCards(player);
                playerCardSlots.forEach(slot => slot.onclick = null);

                // End turn: pass to next player or scoring depending on game state
                if (onComplete) onComplete();
            }
        };
    });
}

function spy(player = currentPlayerRole, onComplete) {
    // Determine opponent
    const opponent = player === "player-1" ? "player-2" : "player-1";
    const opponentHandKey = opponent === "player-1" ? "player1Hand" : "player2Hand";
    const roomRef = doc(db, 'gameRooms', currentRoomCode);

    const opponentCardSlots = document.querySelectorAll(`.player.${opponent} .card-slot img`);
    let revealedIndex = null;

    // Highlight all opponent cards at the start of spy
    highlightCards(opponent);

    opponentCardSlots.forEach((cardSlot, idx) => {
        cardSlot.onclick = async () => {
            // Only allow one card to be revealed at a time
            if (revealedIndex !== null && revealedIndex !== idx) return;

            if (revealedIndex === null) {
                // Reveal the card face
                const roomSnap = await getDoc(roomRef);
                const roomData = roomSnap.data();
                const opponentHand = roomData[opponentHandKey];
                cardSlot.src = `karten/${opponentHand[idx]}.png`;
                revealedIndex = idx;

                // Remove all click handlers except for the revealed card
                opponentCardSlots.forEach((slot, i) => {
                    if (i !== idx) {
                        slot.onclick = null;
                        slot.style.border = ''; // Remove highlight from other cards
                        slot.style.borderRadius = ''; // Remove border radius
                    } else {
                        slot.style.border = '2px solid blue';
                        slot.style.borderRadius = '5px';
                    }
                });
            } else {
                // Hide the card again (flip to back), unhighlight, remove handlers
                cardSlot.src = "karten/back.png";
                unhighlightCards(opponent);
                opponentCardSlots.forEach(slot => slot.onclick = null);

                // End turn: pass to next player or scoring depending on game state
                if (onComplete) onComplete();
            }
        };
    });
}

function swap(player = currentPlayerRole, onComplete) {
    const opponent = player === "player-1" ? "player-2" : "player-1";
    const playerHandKey = player === "player-1" ? "player1Hand" : "player2Hand";
    const opponentHandKey = opponent === "player-1" ? "player1Hand" : "player2Hand";
    const roomRef = doc(db, 'gameRooms', currentRoomCode);

    const playerCardSlots = document.querySelectorAll(`.player.${player} .card-slot img`);
    const opponentCardSlots = document.querySelectorAll(`.player.${opponent} .card-slot img`);

    // Step 1: Highlight only own cards for selection
    highlightCards(player);

    playerCardSlots.forEach((cardSlot) => {
        cardSlot.onclick = async () => {
            // Extract the card index from the parent ID, e.g., "player-1-card4"
            const idMatch = cardSlot.parentElement.id.match(/card(\d)$/);
            if (!idMatch) {
                console.error("Could not determine card index from ID:", cardSlot.parentElement.id);
                return;
            }
            const playerIdx = parseInt(idMatch[1], 10) - 1;

            // Only allow one selection
            playerCardSlots.forEach((slot) => {
                slot.onclick = null;
                slot.style.border = '';
                slot.style.borderRadius = '';
            });
            cardSlot.style.border = '2px solid orange';
            cardSlot.style.borderRadius = '5px';

            // Step 2: Now highlight and allow selection of opponent's card
            highlightCards(opponent);

            opponentCardSlots.forEach((oppSlot) => {
                oppSlot.onclick = async () => {
                    const oppIdMatch = oppSlot.parentElement.id.match(/card(\d)$/);
                    if (!oppIdMatch) {
                        console.error("Could not determine opponent card index from ID:", oppSlot.parentElement.id);
                        return;
                    }
                    const oppIdx = parseInt(oppIdMatch[1], 10) - 1;

                    // Only allow one selection
                    opponentCardSlots.forEach((slot) => {
                        slot.onclick = null;
                        slot.style.border = '';
                        slot.style.borderRadius = '';
                    });
                    oppSlot.style.border = '2px solid orange';
                    oppSlot.style.borderRadius = '5px';

                    // Remove highlights and handlers
                    unhighlightCards(player);
                    unhighlightCards(opponent);

                    // Animate the swap: both cards move, both show back.png for both players
                    await triggerCardAnimation({
                        from: `${player}-card${playerIdx + 1}`,
                        to: `${opponent}-card${oppIdx + 1}`,
                        card: 0,
                        player: player,
                        type: "swap",
                        forceBack: true
                    });
                    await triggerCardAnimation({
                        from: `${opponent}-card${oppIdx + 1}`,
                        to: `${player}-card${playerIdx + 1}`,
                        card: 0,
                        player: player,
                        type: "swap",
                        forceBack: true
                    });

                    // Swap the cards in Firestore
                    const roomSnap = await getDoc(roomRef);
                    const roomData = roomSnap.data();
                    const playerHand = [...roomData[playerHandKey]];
                    const opponentHand = [...roomData[opponentHandKey]];

                    // Swap the selected cards
                    const temp = playerHand[playerIdx];
                    playerHand[playerIdx] = opponentHand[oppIdx];
                    opponentHand[oppIdx] = temp;

                    await updateDoc(roomRef, {
                        [playerHandKey]: playerHand,
                        [opponentHandKey]: opponentHand
                    });

                    // Update UI
                    displayPlayerCards(player, playerHand, false);
                    displayPlayerCards(opponent, opponentHand, false);

                    // End turn
                    if (onComplete) onComplete();
                };
            });
        };
    });
}

function showPreviewCard(cardValue, forceBack = false) {
    const previewImg = document.getElementById('preview-card-img');
    if (!previewImg) return;
    if (cardValue === null || cardValue === undefined) {
        previewImg.src = 'karten/empty.png';
        previewImg.setAttribute('data-card', 'empty');
    } else {
        previewImg.src = forceBack ? 'karten/back.png' : `karten/${cardValue}.png`;
        previewImg.setAttribute('data-card', cardValue);
    }
}

async function clearPreviewCard() {
    await setPreviewCard(currentRoomCode, null);
    
}

function highlightStacks(){
    document.getElementById('discard-stack').style.border = '2px dashed green'; // Highlight stacks for Player 1
    document.getElementById('discard-stack').style.borderRadius = '10px'; // Highlight stacks for Player 1

    document.getElementById('draw-stack').style.border = '2px dashed blue'; // Highlight stacks for Player 1
    document.getElementById('draw-stack').style.borderRadius = '10px'; // Highlight stacks for Player 1
}
function unhighlightStacks(){
    document.getElementById('discard-stack').style.border = ''; // Unhighlight stacks for Player 1
    document.getElementById('draw-stack').style.border = ''; // Unhighlight stacks for Player 1
    document.getElementById('draw-stack').style.borderRadius = ''; // Unhighlight stacks for Player 1
    document.getElementById('discard-stack').style.borderRadius = ''; // Unhighlight stacks for Player 1
}
function highlightDiscardStack() {
        const discardStack = document.getElementById('discard-stack');
        discardStack.style.border = '2px dashed green'; // Highlight discard stack
}
function unhighlightDiscardStack() {
        const discardStack = document.getElementById('discard-stack');
        discardStack.style.border = ''; // Unhighlight discard stack
}
function highlightCards(player){
    const playerCardSlots = document.querySelectorAll(`.player.${player} .card-slot img`);
    playerCardSlots.forEach((img) => {
        img.style.border = '2px solid red'; // Highlight the card
        img.style.borderRadius = '5px';     // Add border radius
    });
}
function unhighlightCards(player){
    const playerCardSlots = document.querySelectorAll(`.player.${player} .card-slot img`);
    playerCardSlots.forEach((img) => {
        img.style.border = ''; // Remove highlight from the card
        img.style.borderRadius = ''; // Remove border radius
    });
}
function flipAllCardsToBack() {
    const allPlayerCards = document.querySelectorAll('.player .card-slot img');
    allPlayerCards.forEach(img => {
        img.src = 'karten/back.png';
    });
}
async function setPreviewCard(roomCode, cardValue) {
    if (!roomCode) return;
    const roomRef = doc(db, 'gameRooms', roomCode);
    await updateDoc(roomRef, { previewCard: cardValue });
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
        document.getElementById('phase-indicator').classList.add('rotated');
    } else {
        document.getElementById('phase-indicator').classList.remove('rotated');
    }
    updateDiscardStackDisplay(currentRoomCode); // Initial display

    // --- Attack Realtime Firebase Listeners ---
    listenToDiscardStack(currentRoomCode);      // Real-time updates
    listenToAnimationEvents(currentRoomCode); // Listen for animation events
    listenToPreviewCard(currentRoomCode); // Listen for preview card changes
    // --- Attach Event Listeners ---
    const btnCabo = document.getElementById('btnCabo');
    if (btnCabo) {
        btnCabo.onclick = async () => {
            const roomRef = doc(db, 'gameRooms', currentRoomCode);
            const firestoreKey = mapPlayerRoleToFirestoreKey(currentPlayerRole);
            if (!firestoreKey) return;

            const roomSnap = await getDoc(roomRef);
            if (!roomSnap.exists()) return;
            const roomData = roomSnap.data();

            // --- Startphase: Mark CABO pressed, transition if both pressed ---
            if (roomData.gameState === "startphase") {
                await updateDoc(roomRef, {
                    [`caboPressed.${firestoreKey}`]: true
                });
                // Check if both pressed
                const updatedSnap = await getDoc(roomRef);
                const caboPressed = updatedSnap.data().caboPressed || {};
                if (caboPressed.player1 && caboPressed.player2) {
                    await setGameState("player1Turn");
                }
                return;
            }

            // --- Turn phases: Only active player can call CABO, transition to caboCalled ---
            if (
                (roomData.gameState === "player1Turn" && currentPlayerRole === "player-1") ||
                (roomData.gameState === "player2Turn" && currentPlayerRole === "player-2")
            ) {
                await updateDoc(roomRef, {
                    gameState: "caboCalled",
                    caboCaller: currentPlayerRole // "player-1" or "player-2"
                });
                unhighlightStacks(); // <-- Add this line
                console.log("Game state updated to 'caboCalled'.");
                return;
            }
        };
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
                cardTaken = false; // Reset cardTaken state
                updateDiscardStackDisplay(currentRoomCode); // Update discard stack display after reset
                const currentGameState = (await getDoc(doc(db, 'gameRooms', currentRoomCode))).data().gameState;
                
            }
        });
    }

    // --- Listen to gameState changes ---
    listenToGameState(currentRoomCode);

    // --- Display Player Cards ---
    try {
        const initialRoomSnap = await getDoc(doc(db, 'gameRooms', currentRoomCode));
        if (initialRoomSnap.exists()) {
            const initialRoomData = initialRoomSnap.data();
            const initialHand = (currentPlayerRole === 'player-1') ? initialRoomData.player1Hand : initialRoomData.player2Hand;
            // Display own cards initially (usually hidden, unless scoring state on load)
            displayPlayerCards(currentPlayerRole, initialHand, initialRoomData.gameState === 'scoring');

            // Display opponent's cards as backs
            const opponentRole = (currentPlayerRole === 'player-1') ? 'player-2' : 'player-1';
            const opponentHand = (opponentRole === 'player-1') ? initialRoomData.player1Hand : initialRoomData.player2Hand;
            if (opponentHand) { // Check if opponent hand exists
                 displayPlayerCards(opponentRole, opponentHand, false); // Always show opponent back initially
            } else {
                 // Handle case where opponent hand might not exist yet (unlikely but safe)
                 displayPlayerCards(opponentRole, [null,null,null,null], false);
            }

        } else {
             console.warn("Room not found on initial load, cards might not display until reset/created.");
             // Display empty/back cards if room doesn't exist
             displayPlayerCards(currentPlayerRole, [null,null,null,null], false);
             const opponentRole = (currentPlayerRole === 'player-1') ? 'player-2' : 'player-1';
             displayPlayerCards(opponentRole, [null,null,null,null], false);
        }
    } catch (error) {
         console.error("Error fetching initial room state for card display:", error);
         // Display empty/back cards on error
         displayPlayerCards(currentPlayerRole, [null,null,null,null], false);
         const opponentRole = (currentPlayerRole === 'player-1') ? 'player-2' : 'player-1';
         displayPlayerCards(opponentRole, [null,null,null,null], false);
    }
    

    console.log("Game initialization complete.");
   
});
function showScoreOverlay(score1, score2, winnerText) {
    let overlay = document.getElementById('score-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'score-overlay';
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100vw';
        overlay.style.height = '100vh';
        overlay.style.background = 'rgba(0,0,0,0.7)';
        overlay.style.display = 'flex';
        overlay.style.flexDirection = 'column';
        overlay.style.justifyContent = 'center';
        overlay.style.alignItems = 'center';
        overlay.style.zIndex = '9999';
        overlay.style.color = '#fff';
        overlay.style.fontSize = '2rem';
        overlay.innerHTML = `
            <div style="background:#222;padding:32px 48px;border-radius:20px;text-align:center;">
                <div style="font-size:2.2rem;margin-bottom:16px;">Scoring</div>
                <div style="margin-bottom:12px;">Player 1 Score: <b>${score1}</b></div>
                <div style="margin-bottom:12px;">Player 2 Score: <b>${score2}</b></div>
                <div style="font-size:2rem;margin-bottom:18px;">${winnerText}</div>
                <button id="close-score-overlay" style="font-size:1.2rem;padding:8px 24px;border-radius:8px;border:none;background:#f9f871;color:#8b0000;font-weight:bold;cursor:pointer;">Close</button>
            </div>
        `;
        document.body.appendChild(overlay);
        document.getElementById('close-score-overlay').onclick = () => {
            overlay.remove();
        };
    }
}

// Simple confetti effect using canvas
function launchConfetti() {
    if (document.getElementById('confetti-canvas')) return; // Prevent multiple

    const canvas = document.createElement('canvas');
    canvas.id = 'confetti-canvas';
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    canvas.style.pointerEvents = 'none';
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    const confetti = [];
    const colors = ['#f9f871', '#db7d3d', '#8b0000', '#fff', '#00cfff', '#ff00c8'];

    for (let i = 0; i < 120; i++) {
        confetti.push({
            x: Math.random() * canvas.width,
            y: Math.random() * -canvas.height,
            r: Math.random() * 8 + 4,
            d: Math.random() * 40 + 10,
            color: colors[Math.floor(Math.random() * colors.length)],
            tilt: Math.random() * 10 - 10
        });
    }

    let angle = 0;
    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        angle += 0.01;
        for (let i = 0; i < confetti.length; i++) {
            let c = confetti[i];
            ctx.beginPath();
            ctx.lineWidth = c.r;
            ctx.strokeStyle = c.color;
            ctx.moveTo(c.x + c.tilt + Math.sin(angle + i), c.y);
            ctx.lineTo(c.x + c.tilt, c.y + c.d);
            ctx.stroke();
        }
        update();
        requestAnimationFrame(draw);
    }
    function update() {
        for (let i = 0; i < confetti.length; i++) {
            let c = confetti[i];
            c.y += Math.cos(angle + i) + 1 + c.r / 2;
            c.x += Math.sin(angle) * 2;
            if (c.y > canvas.height) {
                c.x = Math.random() * canvas.width;
                c.y = -10;
            }
        }
    }
    draw();

    setTimeout(() => {
        canvas.remove();
    }, 4000);
}
function clearStackClickHandlers() {
    const drawStack = document.getElementById('draw-stack');
    const discardStack = document.getElementById('discard-stack');
    if (drawStack) drawStack.onclick = null;
    if (discardStack) discardStack.onclick = null;
}
function updatePhaseIndicator(gameState) {
    const indicator = document.getElementById('phase-indicator');
    if (!indicator) return;
    let text = "Phase: ";
    switch (gameState) {
        case "startphase":
            text += "Start Phase";
            break;
        case "player1Turn":
            text += "Player 1's Turn";
            break;
        case "player2Turn":
            text += "Player 2's Turn";
            break;
        case "caboCalled":
            text += "CABO Called";
            break;
        case "scoring":
            text += "Scoring";
            break;
        default:
            text += gameState;
    }
    indicator.textContent = text;
}

/**
 * Triggers a real-time card animation for both players.
 * @param {Object} opts
 * @param {string} opts.from - Animation source (e.g. "draw-stack", "discard-stack", "preview-card-img", or "player-1-card1")
 * @param {string} opts.to - Animation destination (same format as above)
 * @param {number} opts.card - Card value (number)
 * @param {string} opts.player - "player-1" or "player-2" (the acting player)
 * @param {string} [opts.type] - Optional, e.g. "draw", "discard", "swap"
 * @returns {Promise<void>}
 */
async function triggerCardAnimation({from, to, card, player, type = "", forceBack = false}) {
    const roomRef = doc(db, 'gameRooms', currentRoomCode);
    const timestamp = Date.now();

    // Write the animation event to Firestore
    await updateDoc(roomRef, {
        lastAnimation: {
            type,
            from,
            to,
            card,
            player,
            timestamp,
            forceBack  // Make sure this is included
        }
    });

    // Wait for the animation event to be handled locally
    await new Promise(resolve => {
        let unsub = onSnapshot(roomRef, (docSnap) => {
            const data = docSnap.data();
            const anim = data.lastAnimation;
            if (
                anim &&
                anim.timestamp === timestamp &&
                anim.from === from &&
                anim.to === to &&
                anim.card === card &&
                anim.player === player
            ) {
                // Find DOM elements
                let fromElem, toElem;
                if (from === "draw-stack") fromElem = document.querySelector('#draw-stack img');
                if (from === "discard-stack") fromElem = document.querySelector('#discard-stack img');
                if (from === "preview-card-img") fromElem = document.getElementById('preview-card-img');
                if (from.startsWith("player-")) fromElem = document.querySelector(`#${from} img`);
                if (to === "preview-card-img") toElem = document.getElementById('preview-card-img');
                if (to === "discard-stack-img") toElem = document.querySelector('#discard-stack img');
                if (to.startsWith("player-")) toElem = document.querySelector(`#${to} img`);

                // Determine card image to show
                let cardImgSrc = `karten/${anim.card}.png`;
                let showBackForOpponent = currentPlayerRole !== anim.player;

                
                unsub();
                resolve();
            }
        });
    });
}

async function triggerCardAnimationLocal({
    fromElem,
    toElem,
    cardImgSrc,
    showBackForOpponent = false,
    type = "",
    forceBack = false
}) {
    const animLayer = document.getElementById('animation-layer');
    if (!fromElem || !toElem || !animLayer) {
        console.warn("Animation aborted: Missing elements or layer.", { fromElem, toElem, animLayer });
        return;
    }

    const fromRect = fromElem.getBoundingClientRect();
    const toRect = toElem.getBoundingClientRect();

    const animCard = document.createElement('img');

    const useBack = forceBack || type === "swap" || showBackForOpponent;
    animCard.src = useBack ? 'karten/back.png' : cardImgSrc;

    animCard.className = 'animated-card';
    animCard.style.position = 'fixed';
    animCard.style.left = `${fromRect.left}px`;
    animCard.style.top = `${fromRect.top}px`;
    animCard.style.width = `${fromRect.width}px`;
    animCard.style.height = `${fromRect.height}px`;
    animCard.style.transition = 'all 1.5s cubic-bezier(.5,1.2,.5,1), transform 1.5s cubic-bezier(.5,1.2,.5,1)';
    animCard.style.zIndex = '100000';
    animCard.style.pointerEvents = 'none';
    animCard.style.transform = 'scale(1)';

    let restoreToElemSrc = null;
    let restoreFromElemSrc = null;

    // --- Logic to temporarily hide elements remains the same ---
    if (type === "swap") {
        if (fromElem) { restoreFromElemSrc = fromElem.src; fromElem.src = 'karten/back.png'; }
        if (toElem) { restoreToElemSrc = toElem.src; toElem.src = 'karten/back.png'; }
    } else if (toElem.id === "preview-card-img" && !showBackForOpponent) {
        restoreToElemSrc = toElem.src; toElem.src = 'karten/back.png';
    } else if (toElem.closest('.card-slot') && !showBackForOpponent) {
        restoreToElemSrc = toElem.src; toElem.src = 'karten/back.png';
    }

    animLayer.appendChild(animCard);
    void animCard.offsetWidth; // Force reflow

    // Move and enlarge
    animCard.style.left = `${toRect.left}px`;
    animCard.style.top = `${toRect.top}px`;
    animCard.style.width = `${toRect.width}px`;
    animCard.style.height = `${toRect.height}px`;
    animCard.style.transform = 'scale(1.2)';

    await new Promise(resolve => setTimeout(resolve, 1200)); // Wait for move

    // Shrink
    animCard.style.transform = 'scale(1)';
    animCard.style.transition = 'transform 0.3s cubic-bezier(.7,0,1,1)';

    await new Promise(resolve => setTimeout(resolve, 300)); // Wait for shrink

    // --- Remove animCard ---
    if (animLayer.contains(animCard)) {
        animLayer.removeChild(animCard);
    }

    // --- Fetch gameState HERE before restoring ---
    let currentGameState = null;
    try {
        const roomRef = doc(db, 'gameRooms', currentRoomCode);
        const roomSnap = await getDoc(roomRef);
        if (roomSnap.exists()) {
            currentGameState = roomSnap.data().gameState;
        }
    } catch (fetchError) {
        console.error("Error fetching gameState in triggerCardAnimationLocal:", fetchError);
        currentGameState = null; // Fallback
    }
    // --- End of Fetch ---


    // --- FIXED: Restore the original images ONLY if NOT in scoring phase ---
    try {
        // Only restore the source element if NOT in scoring phase
        if (currentGameState !== "scoring" && restoreFromElemSrc !== null && fromElem) { // <<< ADDED gameState check
            fromElem.src = restoreFromElemSrc;
        }

        // Only restore the target element if NOT in scoring phase
        if (currentGameState !== "scoring" && restoreToElemSrc !== null && toElem) { // <<< Existing gameState check
            if (toElem.id !== "preview-card-img") {
                 toElem.src = restoreToElemSrc;
            }
        }
    } catch (error) {
        console.error("Error restoring element src after animation:", error);
    }
}