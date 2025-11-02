import { getPlayer } from './world.js';

const POSITION_UPDATE_INTERVAL = 100; // 10 times per second

export function initPlayer(room, hostUsername) {
    console.log(`Initializing Player, host is ${hostUsername}...`);

    // Send position updates periodically
    setInterval(() => {
        const player = getPlayer();
        if (player) {
            room.send({
                type: 'player_position_update',
                position: {
                    x: player.position.x,
                    y: player.position.y,
                    z: player.position.z,
                }
            });
        }
    }, POSITION_UPDATE_INTERVAL);
}

