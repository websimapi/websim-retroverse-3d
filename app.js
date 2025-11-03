import { initHost } from './host.js';
import { initPlayer } from './player.js';
import { initWorld, createPlayer } from './world.js';
import { subscribeToGameState } from './database.js';

const statusEl = document.getElementById('status');
const roleEl = document.getElementById('role');
const hostViewEl = document.getElementById('host-view');
const playerViewEl = document.getElementById('player-view');
const dataDisplayEl = document.getElementById('data-display');
const uiContainerEl = document.getElementById('ui-container');

async function main() {
    initWorld(document.getElementById('bg'));

    try {
        const room = new WebsimSocket();
        await room.initialize();
        statusEl.textContent = 'Connected to Retroverse.';

        // A more robust way to wait for the initial game state.
        const waitForGameState = () => {
            console.log("Waiting for game state from database...");
            return new Promise((resolve) => {
                const unsubscribe = subscribeToGameState(room, (state) => {
                    // We wait for the first non-null state, which indicates the DB is synced.
                    if (state) {
                        console.log("Game state received:", state);
                        unsubscribe();
                        resolve(state);
                    }
                });
            });
        };

        const gameState = await waitForGameState();

        const [creator, currentUser] = await Promise.all([
            window.websim.getCreatedBy(),
            window.websim.getCurrentUser()
        ]);
        const isHost = creator.username === currentUser.username;

        // HOST INITIALIZATION
        if (isHost) {
            roleEl.textContent = `Role: HOST (${currentUser.username})`;
            uiContainerEl.style.display = 'block'; // Show for host
            hostViewEl.style.display = 'block';
            playerViewEl.style.display = 'none'; // Hide player view for host
            await initHost(room, dataDisplayEl, gameState);

            window.addEventListener('keydown', (event) => {
                if (event.key === '`' || event.key === '~') {
                    if (uiContainerEl.style.display === 'block') {
                        uiContainerEl.style.display = 'none';
                    } else {
                        uiContainerEl.style.display = 'block';
                    }
                }
            });
        } 
        // PLAYER INITIALIZATION
        else {
            roleEl.textContent = `Role: PLAYER (${currentUser.username})`;
            hostViewEl.style.display = 'none'; // Hide host view for player
            playerViewEl.style.display = 'block';
            initPlayer(room, creator.username);
        }

        // Common logic for both Host and Player to create their character
        // This now runs AFTER the host has initialized and potentially created a default state for the current player
        const finalWaitForPlayerState = () => {
             console.log("Waiting for definitive player state...");
            return new Promise((resolve) => {
                const unsubscribe = subscribeToGameState(room, (state) => {
                    // We wait for our own player data to exist in the state.
                    if (state && state.slot_1 && state.slot_1[currentUser.id]) {
                        console.log("Player state confirmed:", state.slot_1[currentUser.id]);
                        unsubscribe();
                        resolve(state.slot_1[currentUser.id]);
                    }
                });
            });
        };

        const myPlayerData = await finalWaitForPlayerState();
        
        let initialPosition = { x: 0, y: 0.5, z: 0 }; // Default position
        if (myPlayerData && myPlayerData.position) {
            console.log("Found last known position. Teleporting player.", myPlayerData.position);
            initialPosition = myPlayerData.position;
        } else {
            console.log("Player data found, but no position. Using default.");
        }
        
        // Create the player at the correct initial position.
        createPlayer(initialPosition);


    } catch (error) {
        console.error("Initialization failed:", error);
        statusEl.textContent = 'Error connecting to Retroverse.';
    }
}

main();