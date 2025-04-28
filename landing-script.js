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



// Rules content (Markdown converted to HTML for both languages)
const rulesDe = `
<h2>🎯 Ziel des Spiels</h2>
<p>Am Ende die <b>niedrigste Gesamtsumme</b> an Kartenwerten auf der Hand haben.</p>
<h2>🃏 Spielaufbau</h2>
<ul>
<li>Jeder Spieler erhält <b>4 Handkarten</b> (verdeckt, nur die eigenen sichtbar).</li>
<li>Links und rechts neben den Handkarten gibt es je <b>2 Strafkarten-Slots</b> („Punish-Slots“) 🟧, die zu Beginn leer sind.</li>
<li>In der Mitte liegen: ein <b>Nachziehstapel</b> (Draw Stack) 🟦 und ein <b>Ablagestapel</b> (Discard Stack) 🟫.</li>
</ul>
<h2>🔄 Spielablauf</h2>
<ol>
<li><b>Startphase:</b> Beide Spieler dürfen zwei ihrer Handkarten ansehen 👀.</li>
<li>Danach wechseln sich die Spieler ab.</li>
<li>Im Zug kannst du:
  <ul>
    <li>Eine Karte vom Nachzieh- oder Ablagestapel nehmen und wie gewohnt tauschen, abwerfen oder Spezialaktionen nutzen.</li>
    <li><b>Jederzeit</b> (außer in der Wertungsphase) versuchen, eine deiner Handkarten auf den Ablagestapel zu werfen („Throw“), wenn sie <b>denselben Wert wie die oberste Karte</b> des Ablagestapels hat.
      <ul>
        <li>✔️ <b>Gleich:</b> Karte wird entfernt und auf den Ablagestapel gelegt.</li>
        <li>❌ <b>Ungleich:</b> Du erhältst eine <b>Strafkarte</b> vom Nachziehstapel, die in einen freien Punish-Slot gelegt wird.</li>
        <li>⚠️ <b>Schon 2 Strafkarten:</b> Versuchst du erneut zu werfen, wird automatisch <b>„Cabo“</b> für dich gedrückt und du kannst keine weiteren Karten werfen.</li>
      </ul>
    </li>
  </ul>
</li>
<li>Sobald ein Spieler <b>„Cabo“</b> ruft (oder automatisch durch 2 Strafkarten), hat der andere Spieler noch einen letzten Zug, dann folgt die Wertung.</li>
</ol>
<h2>✨ Spezialkarten</h2>
<table>
<tr><th>Karte</th><th>Aktion</th></tr>
<tr><td>7/8</td><td>👁️ Peek – Eigene Karte ansehen</td></tr>
<tr><td>9/10</td><td>🕵️ Spy – Karte des Gegners ansehen</td></tr>
<tr><td>11/12</td><td>🔄 Swap – Eigene mit gegnerischer Karte tauschen</td></tr>
</table>
<h2>🏆 Wertung</h2>
<ul>
<li>Am Ende werden alle Handkarten (und ggf. Strafkarten) aufgedeckt und die Werte addiert.</li>
<li><b>Der Spieler mit der niedrigeren Gesamtsumme gewinnt!</b> 🥇</li>
</ul>
`;

const rulesEn = `
<h2>🎯 Objective</h2>
<p>Have the <b>lowest total card value</b> in your hand at the end of the game.</p>
<h2>🃏 Setup</h2>
<ul>
<li>Each player receives <b>4 hand cards</b> (face down, only visible to themselves).</li>
<li>There are <b>2 punishment card slots</b> (“punish slots”) 🟧 to the left and right of each player’s hand, initially empty.</li>
<li>In the center: a <b>draw pile</b> 🟦 and a <b>discard pile</b> 🟫.</li>
</ul>
<h2>🔄 Gameplay</h2>
<ol>
<li><b>Start phase:</b> Both players may look at two of their hand cards 👀.</li>
<li>Players then take turns.</li>
<li>On your turn, you may:
  <ul>
    <li>Draw a card from the draw or discard pile and perform the usual swap, discard, or special actions.</li>
    <li><b>At any time</b> (except during scoring), attempt to throw one of your hand cards onto the discard pile (“Throw”) if it <b>matches the value of the top discard</b>.
      <ul>
        <li>✔️ <b>Match:</b> The card is removed from your hand and placed on the discard pile.</li>
        <li>❌ <b>No match:</b> You receive a <b>punishment card</b> from the draw pile, placed in an empty punish slot.</li>
        <li>⚠️ <b>Already 2 punishment cards:</b> If you try to throw again, <b>“Cabo”</b> is automatically called for you and you cannot throw further cards.</li>
      </ul>
    </li>
  </ul>
</li>
<li>When a player calls <b>“Cabo”</b> (or it is called automatically due to 2 punishment cards), the other player gets one final turn, then scoring occurs.</li>
</ol>
<h2>✨ Special Cards</h2>
<table>
<tr><th>Card</th><th>Action</th></tr>
<tr><td>7/8</td><td>👁️ Peek – Look at one of your own cards</td></tr>
<tr><td>9/10</td><td>🕵️ Spy – Look at one of your opponent’s cards</td></tr>
<tr><td>11/12</td><td>🔄 Swap – Swap one of your cards with one of your opponent’s</td></tr>
</table>
<h2>🏆 Scoring</h2>
<ul>
<li>At the end, all hand cards (and any punishment cards) are revealed and summed.</li>
<li><b>The player with the lower total wins!</b> 🥇</li>
</ul>
`;

// Modal logic
document.addEventListener('DOMContentLoaded', () => {
    // ...existing code...

    // Rules modal logic
    const rulesBtn = document.getElementById('rulesBtn');
    const rulesModal = document.getElementById('rulesModal');
    const closeRules = document.getElementById('closeRules');
    const rulesContent = document.getElementById('rulesContent');
    const langDe = document.getElementById('langDe');
    const langEn = document.getElementById('langEn');

    let currentLang = 'de';

    function showRules(lang) {
        rulesContent.innerHTML = lang === 'en' ? rulesEn : rulesDe;
        currentLang = lang;
    }

    if (rulesBtn && rulesModal && closeRules && rulesContent && langDe && langEn) {
        rulesBtn.onclick = () => {
            rulesModal.style.display = 'flex';
            showRules(currentLang);
        };
        closeRules.onclick = () => {
            rulesModal.style.display = 'none';
        };
        langDe.onclick = () => showRules('de');
        langEn.onclick = () => showRules('en');
        // Close modal on outside click
        window.onclick = function(event) {
            if (event.target === rulesModal) {
                rulesModal.style.display = 'none';
            }
        };
    }
});