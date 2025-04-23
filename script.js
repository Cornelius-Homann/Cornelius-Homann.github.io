// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

// Firebase configuration
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

// Fetch a number from a specific document

// Write a new number to Firestore


// Function to fetch the card stack from Firestore
async function fetchCardStack() {
    const cardStackRef = doc(db, 'gameData', 'cardStack'); // Reference to the card stack document
    const cardStackSnap = await getDoc(cardStackRef); // Fetch the document

    if (cardStackSnap.exists()) {
        const data = cardStackSnap.data();
        const cardStack = data.cards; // Assuming the field is called "cards"
        console.log('Fetched card stack:', cardStack);
        return cardStack; // Return the card stack
    } else {
        console.log('No card stack found!');
        return [];
    }
}

// Function to upload a randomized card stack to Firestore
async function uploadRandomizedCardStack() {
    const cardStackRef = doc(db, 'gameData', 'cardStack'); // Reference to the card stack document

    // Create the card stack with the specified structure
    let cardStack = [
        ...Array(2).fill(0), // 2x 0
        ...Array(4).fill(1), ...Array(4).fill(2), ...Array(4).fill(3), ...Array(4).fill(4),
        ...Array(4).fill(5), ...Array(4).fill(6), ...Array(4).fill(7), ...Array(4).fill(8),
        ...Array(4).fill(9), ...Array(4).fill(10), ...Array(4).fill(11), ...Array(4).fill(12),
        ...Array(2).fill(13) // 2x 13
    ];

    // Print the original card stack
    console.log('Original card stack:', cardStack);

    // Randomize the card stack
    cardStack = cardStack.sort(() => Math.random() - 0.5);

    // Print the randomized card stack
    console.log('Randomized card stack:', cardStack);

    try {
        // Upload the randomized card stack to Firestore
        await setDoc(cardStackRef, { cards: cardStack });
        console.log('Randomized card stack uploaded successfully:', cardStack);
    } catch (error) {
        console.error('Error uploading card stack:', error);
    }
}

// Function to add a card to the discard stack in Firestore
async function addToDiscardStack(card) {
    const discardStackRef = doc(db, 'gameData', 'discardStack'); // Reference to the discard stack document

    try {
        // Fetch the current discard stack
        const discardStackSnap = await getDoc(discardStackRef);
        let discardStack = discardStackSnap.exists() ? discardStackSnap.data().cards : [];

        // Add the card to the discard stack
        discardStack.push(card);

        // Update the discard stack in Firestore
        await setDoc(discardStackRef, { cards: discardStack });
        console.log(`Added card ${card} to discard stack:`, discardStack);

        // Update the discard stack display
        await updateDiscardStackDisplay();
    } catch (error) {
        console.error('Error adding card to discard stack:', error);
    }
}

// Function to take and remove the first card from the card stack in Firestore
async function takeFromCardStack() {
    const cardStackRef = doc(db, 'gameData', 'cardStack'); // Reference to the card stack document

    try {
        // Fetch the current card stack
        const cardStackSnap = await getDoc(cardStackRef);
        if (!cardStackSnap.exists()) {
            console.log('Card stack is empty or does not exist.');
            return null;
        }

        let cardStack = cardStackSnap.data().cards;

        // Take the first card from the card stack
        const firstCard = cardStack.shift();

        // Update the card stack in Firestore
        await setDoc(cardStackRef, { cards: cardStack });
        console.log(`Removed card ${firstCard} from card stack:`, cardStack);

        return firstCard; // Return the removed card
    } catch (error) {
        console.error('Error taking card from card stack:', error);
        return null;
    }
}

// Function to add the first card from the card stack to the discard stack
async function addFirstCardToDiscardStack() {
    try {
        // Take the first card from the card stack
        const firstCard = await takeFromCardStack();
        if (firstCard === null) {
            console.log('No card to add to the discard stack.');
            return;
        }

        // Add the card to the discard stack
        await addToDiscardStack(firstCard);
        console.log(`Added card ${firstCard} to the discard stack.`);
    } catch (error) {
        console.error('Error adding the first card to the discard stack:', error);
    }
}

// Function to clear the discard stack in Firestore
async function clearDiscardStack() {
    const discardStackRef = doc(db, 'gameData', 'discardStack'); // Reference to the discard stack document

    try {
        // Clear the discard stack by setting it to an empty array
        await setDoc(discardStackRef, { cards: [] });
        console.log('Discard stack cleared.');

        // Update the discard stack display to show the default card
        await updateDiscardStackDisplay();
    } catch (error) {
        console.error('Error clearing the discard stack:', error);
    }
}

// Function to update the discard stack display
async function updateDiscardStackDisplay() {
    const discardStackRef = doc(db, 'gameData', 'discardStack'); // Reference to the discard stack document

    try {
        // Fetch the current discard stack
        const discardStackSnap = await getDoc(discardStackRef);
        const discardStackImg = document.querySelector('#discard-stack img');

        if (discardStackSnap.exists()) {
            const discardStack = discardStackSnap.data().cards;

            // Check if the discard stack is empty
            if (!Array.isArray(discardStack) || discardStack.length === 0) {
                // Set the discard stack to display the empty image
                discardStackImg.src = 'karten/empty.png';
                discardStackImg.setAttribute('data-card', 'empty');
                console.log('Discard stack is empty.');
            } else {
                // Get the latest card (last element in the array)
                const latestCard = discardStack[discardStack.length - 1];

                // Update the discard stack image
                discardStackImg.src = `karten/${latestCard}.png`;
                discardStackImg.setAttribute('data-card', latestCard);
                console.log(`Updated discard stack display to show card: ${latestCard}`);
            }
        } else {
            // If the discard stack document does not exist, treat it as empty
            discardStackImg.src = 'karten/empty.png';
            discardStackImg.setAttribute('data-card', 'empty');
            console.log('Discard stack document does not exist.');
        }
    } catch (error) {
        console.error('Error updating discard stack display:', error);
    }
}

// Function to set up event listeners for all card divs
function setupCardEventListeners() {
    // Select all card divs with the class "card-slot"
    const cardDivs = document.querySelectorAll('.card-slot img');

    // Add a click event listener to each card
    cardDivs.forEach((card) => {
        card.addEventListener('click', () => {
            // Check the current src of the card
            if (card.src.includes('back.png')) {
                // If the card shows the back, flip it to show its face
                const cardFace = card.getAttribute('data-card'); // Get the card's face value from data-card
                card.src = `karten/${cardFace}.png`; // Set the src to the card's face
            } else {
                // If the card shows its face, flip it to show the back
                card.src = 'karten/back.png';
            }
        });
    });
}

// Call the setup function on page load
document.addEventListener('DOMContentLoaded', async () => {
    setupCardEventListeners();
    await updateDiscardStackDisplay(); // Update discard stack display on page load
    
});

// Attach functions to the global window object
window.fetchCardStack = fetchCardStack;
window.uploadRandomizedCardStack = uploadRandomizedCardStack;
window.addToDiscardStack = addToDiscardStack;
window.takeFromCardStack = takeFromCardStack;
window.addFirstCardToDiscardStack = addFirstCardToDiscardStack;
window.clearDiscardStack = clearDiscardStack;
window.updateDiscardStackDisplay = updateDiscardStackDisplay;




