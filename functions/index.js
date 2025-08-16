const functions = require('firebase-functions');
const { AccessToken } = require('livekit-server-sdk');
const fetch = require('node-fetch');

exports.getJoinToken = functions.https.onRequest((req, res) => {
  const { identity, roomName } = req.body;

  const at = new AccessToken(
    functions.config().livekit.key,
    functions.config().livekit.secret,
    { identity }
  );

  at.addGrant({ room: roomName, roomJoin: true });
  res.json({ token: at.toJwt() });
});

exports.onRoomEnd = functions.https.onRequest(async (req, res) => {
  const roomName = req.body.room?.name;

  // Call OpenAI to summarize
  const summary = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${functions.config().openai.key}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: `Summarize the call in ${roomName}` }]
    })
  }).then(r => r.json());

  console.log("Summary:", summary);

  // TODO: Delete the call record from Firestore
  res.sendStatus(200);
});
