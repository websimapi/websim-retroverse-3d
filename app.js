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

        // Determine initial position from the fetched game state
        let initialPosition = { x: 0, y: 0.5, z: 0 }; // Default position
        if (gameState && gameState.slot_1 && gameState.slot_1[currentUser.id]) {
            const myPlayerData = gameState.slot_1[currentUser.id];
            if (myPlayerData && myPlayerData.position) {
                console.log("Found last known position. Teleporting player.", myPlayerData.position);
                initialPosition = myPlayerData.position;
            } else {
                console.log("Player data found, but no position. Using default.");
            }
        } else {
            console.log("No previous game state found for this player. Using default.");
        }
        
        // Create the player at the correct initial position.
        createPlayer(initialPosition);


        const isHost = creator.username === currentUser.username;

        if (isHost) {
            roleEl.textContent = `Role: HOST (${currentUser.username})`;
            uiContainerEl.style.display = 'block'; // Show for host
            hostViewEl.style.display = 'block';
            playerViewEl.style.display = 'none'; // Hide player view for host
            initHost(room, dataDisplayEl, gameState);

            window.addEventListener('keydown', (event) => {
                if (event.key === '`' || event.key === '~') {
                    if (uiContainerEl.style.display === 'block') {
                        uiContainerEl.style.display = 'none';
                    } else {
                        uiContainerEl.style.display = 'block';
                    }
                }
            });
        } else {
            roleEl.textContent = `Role: PLAYER (${currentUser.username})`;
            hostViewEl.style.display = 'none'; // Hide host view for player
            playerViewEl.style.display = 'block';
            initPlayer(room, creator.username);
        }

    } catch (error) {
        console.error("Initialization failed:", error);
        statusEl.textContent = 'Error connecting to Retroverse.';
    }
}

main();