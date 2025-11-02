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
    
    // Initialize host's own player data if it doesn't exist from a previous session
    const hostPeer = room.peers[room.clientId];
    if (hostPeer && !playersData[hostPeer.id]) {
         playersData[hostPeer.id] = {
            username: hostPeer.username || 'HOST',
            position: { x: 0, y: 0.5, z: 0 },
            timestamp: new Date().toISOString()
        };
    }
    
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
        const connectedUserIds = new Set(Object.values(room.peers).map(p => p.id));
        let updated = false;
        for (const userId in playersData) {
            if (!connectedUserIds.has(userId)) {
                console.log(`Player ${playersData[userId]?.username} (${userId}) disconnected. Removing from data.`);
                delete playersData[userId];
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


    // Main update loop for host - delayed slightly to allow initial state to settle
    setTimeout(() => {
        setInterval(() => {
            // Update host's own data
            const hostPlayer = getPlayer();
            const currentHostPeer = room.peers[room.clientId];
            if (hostPlayer && currentHostPeer) {
                playersData[currentHostPeer.id] = {
                    username: currentHostPeer.username || 'HOST',
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
    }, 500);


    // Listen for player messages
    room.onmessage = (event) => {
        const { data, clientId } = event;
        const { type, position } = data;
        const peer = room.peers[clientId];

        if (!peer) return;

        if (type === 'player_position_update') {
            playersData[peer.id] = {
                username: peer.username,
                position,
                timestamp: new Date().toISOString()
            };
        }
    };
}