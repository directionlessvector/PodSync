const supabase = require('../db');

// Gets the role of a specific user in a specific room
// Returns 'speaker', 'audience', or null if not in room
// This is the MOST IMPORTANT function — everything about role
// verification flows through here
async function getParticipantRole(roomId, userId) {
  const { data, error } = await supabase
    .from('room_participants')
    .select('role')
    .eq('room_id', roomId)
    .eq('user_id', userId)
    .single();

  if (error) {
    // PGRST116 means no row found — user has no role in this room
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to get participant role: ${error.message}`);
  }

  return data.role; // 'speaker' or 'audience'
}

// Adds a participant to a room.
// ignoreDuplicates: true — if row exists, keep existing role unchanged.
// Used for audience joins (never downgrade a speaker to audience).
async function addParticipant({ roomId, userId, role }) {
  const { error } = await supabase
    .from('room_participants')
    .upsert(
      { room_id: roomId, user_id: userId, role },
      { onConflict: 'room_id,user_id', ignoreDuplicates: true }
    )

  if (error) {
    throw new Error(`Failed to add participant: ${error.message}`)
  }
}

// Joins or upgrades a participant to speaker.
// ignoreDuplicates: false — intentionally overwrites audience → speaker.
// Used when someone opens the speaker link (the link is the authorization).
async function joinAsSpeaker({ roomId, userId }) {
  const { error } = await supabase
    .from('room_participants')
    .upsert(
      { room_id: roomId, user_id: userId, role: 'speaker' },
      { onConflict: 'room_id,user_id', ignoreDuplicates: false }
    )

  if (error) {
    throw new Error(`Failed to join as speaker: ${error.message}`)
  }
}

// Host invites a specific user to join as a co-speaker
// Looks them up by email, then inserts them as speaker
async function inviteSpeaker({ roomId, hostId, inviteeEmail }) {
  // Step 1: verify the person making this request is the host
  const { data: room, error: roomError } = await supabase
    .from('rooms')
    .select('host_id')
    .eq('id', roomId)
    .single();

  if (roomError || !room) {
    throw new Error('Room not found');
  }

  if (room.host_id !== hostId) {
    throw new Error('Only the host can invite speakers');
  }

  // Step 2: find the invitee by email in your users table
  const { data: invitee, error: userError } = await supabase
    .from('users')
    .select('id')
    .eq('email', inviteeEmail)
    .single();

  if (userError || !invitee) {
    throw new Error('No user found with that email address');
  }

  // Step 3: add them as a speaker
  // If they were already audience, this upgrades them to speaker
  const { error: insertError } = await supabase
    .from('room_participants')
    .upsert(
      {
        room_id: roomId,
        user_id: invitee.id,
        role: 'speaker',
      },
      {
        onConflict: 'room_id,user_id',
        ignoreDuplicates: false, // false = update existing row if found
      }
    );

  if (insertError) {
    throw new Error(`Failed to invite speaker: ${insertError.message}`);
  }

  return { success: true, userId: invitee.id };
}

// Gets all participants in a room with their roles
// Used to show who is in the room on the dashboard
async function getRoomParticipants(roomId) {
  const { data, error } = await supabase
    .from('room_participants')
    .select('user_id, role, joined_at')
    .eq('room_id', roomId);

  if (error) {
    throw new Error(`Failed to get participants: ${error.message}`);
  }

  return data;
}

module.exports = {
  getParticipantRole,
  addParticipant,
  joinAsSpeaker,
  inviteSpeaker,
  getRoomParticipants,
};