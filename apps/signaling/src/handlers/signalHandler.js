const { sendTo } = require('../state/roomRegistry');

function handleSignal(fromUserId, event, message) {
  const targetUserId = message?.payload?.targetUserId;

  if (!targetUserId) {
    console.warn(`signal handler: missing targetUserId from ${fromUserId}`);
    return;
  }

  sendTo(targetUserId, {
    event,
    fromUserId,
    payload: message.payload
  });

  console.log(`signal - event=${event}, fromUserId=${fromUserId}, targetUserId=${targetUserId}`);
}

module.exports = { handleSignal };
