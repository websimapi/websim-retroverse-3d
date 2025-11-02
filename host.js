import { initializeDatabase, subscribeToGameState, updatePlayersData, updateWorldData } from './database.js';
import { getPlayer } from './world.js';

const UPDATE_INTERVAL = 200; // 5 times per second

export async function initHost(room, dataDisplayEl) {
    console.log("Initializing Host...");
    const gameStateRecord = await initializeDatabase(room);
    if (!gameStateRecord) {
        dataDisplayEl.textContent = "Error: Could not initialize or find game state record.";
        return;
    }

    const recordId = gameStateRecord.id;
    // Use a deep copy to prevent race conditions with the subscribe callback
    let playersData = JSON.parse(JSON.stringify(gameStateRecord.slot_1 || {}));
    
    // Initialize world data if it doesn't exist
    if (!gameStateRecord.slot_0 || gameStateRecord.slot_0.seed === undefined) {
        await updateWorldData(room, recordId, { seed: 0 });
    }

    subscribeToGameState(room, (state) => {
        if (state) {
            dataDisplayEl.textContent = JSON.stringify(state, null, 2);
        } else {
            dataDisplayEl.textContent = "Waiting for game state...";
        }
    });

    function cleanDisconnectedPlayers() {
        const connectedClientIds = Object.keys(room.peers);
        let updated = false;
        for (const clientId in playersData) {
            if (!connectedClientIds.includes(clientId)) {
                console.log(`Player ${playersData[clientId]?.username} (${clientId}) disconnected. Removing from data.`);
                delete playersData[clientId];
                updated = true;
            }
        }
        if (updated) {
            updatePlayersData(room, recordId, playersData);
        }
    }
    
    room.subscribePresence(() => {
        cleanDisconnectedPlayers();
    });
    cleanDisconnectedPlayers();


    // Main update loop for host
    setInterval(() => {
        // Update host's own data
        const hostPlayer = getPlayer();
        if (hostPlayer) {
            playersData[room.clientId] = {
                username: room.peers[room.clientId]?.username || 'HOST',
                position: {
                    x: hostPlayer.position.x,
                    y: hostPlayer.position.y,
                    z: hostPlayer.position.z,
                },
                timestamp: new Date().toISOString()
            };
        }

        // Persist the collected player data
        updatePlayersData(room, recordId, playersData);

    }, UPDATE_INTERVAL);

    // Listen for player messages
    room.onmessage = (event) => {
        const { data, clientId } = event;
        const { type, position } = data;

        if (clientId === room.clientId) return;

        if (type === 'player_position_update') {
            playersData[clientId] = {
                username: room.peers[clientId]?.username,
                position,
                timestamp: new Date().toISOString()
            };
        }
    };
}