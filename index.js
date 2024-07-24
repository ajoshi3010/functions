const functions=require("firebase-functions");
const admin=require("firebase-admin");
const twilio=require("twilio");
const serviceAccount=require("./serviceAccountKey.json");
const {accountSid, authToken, twilioPhone}=require("./config");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db=admin.firestore();
const client=twilio(accountSid, authToken);

exports.addContact=functions.https.onRequest(async (req, res) => {
  const {name, phone}=req.body;
  try {
    await db.collection("inWork").add({name, phone});
    res.json({success: true});
  } catch (error) {
    res.json({success: false, error: error.message});
  }
});

exports.markReady=functions.https.onRequest(async (req, res) => {
  const {id, name, phone}=req.body;
  try {
    await db.collection("inWork").doc(id).delete();
    await db.collection("readyForDelivery").add({name, phone});

    await client.messages.create({
      body: "Your clothes are ready for delivery.",
      from: twilioPhone,
      to: phone,
    });

    res.json({success: true});
  } catch (error) {
    res.json({success: false, error: error.message});
  }
});

exports.markDelivered=functions.https.onRequest(async (req, res) => {
  const {id, name, phone}=req.body;
  try {
    await db.collection("readyForDelivery").doc(id).delete();
    await db.collection("history").add({name, phone,
      status: "delivered", timestamp: new Date()});

    await client.messages.create({
      body: "Your clothes have been delivered.",
      from: twilioPhone,
      to: phone,
    });

    res.json({success: true});
  } catch (error) {
    res.json({success: false, error: error.message});
  }
});

exports.status=functions.https.onRequest(async (req, res) => {
  try {
    const inWork=await db.collection("inWork").get();
    const readyForDelivery=await db.collection("readyForDelivery").get();
    const history=await db.collection("history").get();

    const inWorkData=inWork.docs.map((doc) => ({id: doc.id, ...doc.data()}));
    const readyForDeliveryData = readyForDelivery.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    const historyData=history.docs.map((doc) => ({id: doc.id, ...doc.data()}));

    res.json({inWork: inWorkData, readyForDelivery: readyForDeliveryData,
      history: historyData});
  } catch (error) {
    res.json({success: false, error: error.message});
  }
});
