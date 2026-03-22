const supabase = require('../db');

// Creates a new room in the database
// Called by roomController when host clicks "Create Room"
async function createRoom({ name, hostId, episodeTitle }) {
  const { data: existing } = await supabase
    .from('rooms')
    .select('id')
    .eq('host_id', hostId)
    .eq('name', name)
    .single()

  if (existing) {
    throw new Error('You already have a room with this name')
  }
  // Step 1: insert the room row
  const { data: room, error: roomError } = await supabase
    .from('rooms')
    .insert({
      name,
      episode_title: episodeTitle,
      host_id: hostId,
      status: 'waiting',
    })
    .select()  // return the inserted row
    .single(); // we inserted one row, so return one object not an array

  if (roomError) {
    throw new Error(`Failed to create room: ${roomError.message}`);
  }

  // Step 2: add the host as a speaker in room_participants
  // This is why the host automatically becomes a speaker —
  // the backend decides this, not the frontend
  const { error: participantError } = await supabase
    .from('room_participants')
    .insert({
      room_id: room.id,
      user_id: hostId,
      role: 'speaker',
    });

  if (participantError) {
    throw new Error(`Failed to add host as participant: ${participantError.message}`);
  }

  return room;
}

// Gets a single room by its ID
// Used by the watch page to confirm the room exists
// Also used by the speaker page to get room name/status
async function getRoomById(roomId) {
  const { data: room, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', roomId)
    .single();

  if (error) {
    // If no row found, Supabase returns error code PGRST116
    // In that case we return null instead of throwing
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to get room: ${error.message}`);
  }

  return room;
}

// Updates the room status
// 'waiting' → 'live' when host starts recording
// 'live' → 'ended' when session finishes
async function updateRoomStatus({ roomId, status, hostId }) {
  // First verify the person requesting the update is actually the host
  const { data: room, error: fetchError } = await supabase
    .from('rooms')
    .select('host_id')
    .eq('id', roomId)
    .single();

  if (fetchError || !room) {
    throw new Error('Room not found');
  }

  if (room.host_id !== hostId) {
    throw new Error('Only the host can update room status');
  }

  const { data: updated, error } = await supabase
    .from('rooms')
    .update({ status })
    .eq('id', roomId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update room status: ${error.message}`);
  }

  return updated;
}

// Gets all rooms created by a specific user
// Used on the dashboard to show "Your rooms"
async function getRoomsByHost(hostId) {
  const { data: rooms, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('host_id', hostId)
    .order('created_at', { ascending: false }); // newest first

  if (error) {
    throw new Error(`Failed to get rooms: ${error.message}`);
  }

  return rooms;
}

module.exports = {
  createRoom,
  getRoomById,
  updateRoomStatus,
  getRoomsByHost,
};