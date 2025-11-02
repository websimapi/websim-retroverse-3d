import { initHost } from './host.js';
import { initPlayer } from './player.js';
import { initWorld, setPlayerPosition } from './world.js';
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

        // Function to wait for the game state to be available.
        const waitForGameState = () => {
            return new Promise((resolve) => {
                const unsubscribe = subscribeToGameState(room, (state) => {
                    if (state) {
                        console.log("Game state received:", state);
                        unsubscribe();
                        resolve(state);
                    } else {
                        console.log("Waiting for game state from database...");
                    }
                });
            });
        };

        const gameState = await waitForGameState();

        const [creator, currentUser] = await Promise.all([
            window.websim.getCreatedBy(),
            window.websim.getCurrentUser()
        ]);

        // Use the fetched state to set the initial player position
        if (gameState && gameState.slot_1) {
            const myPlayerData = gameState.slot_1[currentUser.id];
            if (myPlayerData && myPlayerData.position) {
                console.log("Found last known position. Teleporting player.", myPlayerData.position);
                setPlayerPosition(myPlayerData.position);
            } else {
                console.log("No previous position found for this player. Starting at default location.");
            }
        } else {
            console.log("Game state or player data slot not found. Starting at default location.");
        }


        const isHost = creator.username === currentUser.username;

        if (isHost) {
            roleEl.textContent = `Role: HOST (${currentUser.username})`;
            uiContainerEl.style.display = 'block'; // Show for host
            hostViewEl.style.display = 'block';
            playerViewEl.style.display = 'none'; // Hide player view for host
            initHost(room, dataDisplayEl);

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