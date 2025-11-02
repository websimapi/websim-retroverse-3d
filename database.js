import { PLAYER_DATA_SLOT, WORLD_DATA_SLOT } from './shared.js';
const COLLECTION_NAME = 'retroverse_state_v1';

export async function getGameStateRecord(room) {
    // This might be empty on first load until the collection is synced.
    const records = room.collection(COLLECTION_NAME).getList();
    if (records.length > 0) {
        return records[0];
    }
    return null;
}

export async function initializeDatabase(room) {
    let records = room.collection(COLLECTION_NAME).getList();
    
    // It can take a moment for the list to populate from the network.
    // A simple retry loop can handle initial empty state.
    for (let i = 0; i < 5 && records.length === 0; i++) {
        await new Promise(resolve => setTimeout(resolve, 500));
        records = room.collection(COLLECTION_NAME).getList();
    }

    if (records.length === 0) {
        console.log("No game state found, creating one...");
        const initialState = {};
        for (let i = 0; i < 10; i++) {
            initialState[`slot_${i}`] = {};
        }
        try {
            const newRecord = await room.collection(COLLECTION_NAME).create(initialState);
            console.log("Game state created:", newRecord);
            return newRecord;
        } catch (e) {
            console.error("Failed to create game state:", e);
            // It's possible another client created it in the meantime. Re-fetch.
            return await getGameStateRecord(room);
        }
    } else {
        console.log("Game state found:", records[0]);
        return records[0];
    }
}

export async function updateSlot(room, recordId, slotIndex, data) {
    if (slotIndex < 0 || slotIndex >= 10) {
        console.error(`Invalid slot index: ${slotIndex}`);
        return;
    }
    const payload = {
        [`slot_${slotIndex}`]: data
    };
    try {
        await room.collection(COLLECTION_NAME).update(recordId, payload);
    } catch (e) {
        console.error(`Failed to update slot ${slotIndex}:`, e);
    }
}

export async function updatePlayersData(room, recordId, playersData) {
    await updateSlot(room, recordId, PLAYER_DATA_SLOT, playersData);
}

export async function updateWorldData(room, recordId, worldData) {
    await updateSlot(room, recordId, WORLD_DATA_SLOT, worldData);
}


export function subscribeToGameState(room, callback) {
    return room.collection(COLLECTION_NAME).subscribe(records => {
        if (records.length > 0) {
            callback(records[0]);
        } else {
            callback(null);
        }
    });
}