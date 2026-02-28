const express = require("express");
const admin = require("firebase-admin");

const app = express();
app.use(express.json());

/*
====================================
FIREBASE SERVICE ACCOUNT
====================================
Render ENV Variable:
GOOGLE_SERVICE_ACCOUNT
*/

const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

/*
====================================
NETWORK CALLBACK ENDPOINT
====================================
Network callback URL example:

https://your-render-service.onrender.com/callback
*/

app.post("/callback", async (req, res) => {

  try {

    const { transactionId, status, payout } = req.body;

    if (!transactionId) {
      return res.status(400).send("transactionId missing");
    }

    const snapshot = await db
      .collection("task_submissions")
      .where("transactionId", "==", transactionId)
      .get();

    if (snapshot.empty) {
      return res.status(404).send("submission not found");
    }

    const docRef = snapshot.docs[0].ref;

    await docRef.update({
      networkStatus: status,
      networkPayout: payout || 0,
      networkUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.send("callback received");

  } catch (error) {

    console.error(error);
    res.status(500).send("server error");

  }

});


/*
====================================
AUTO APPROVAL SYSTEM
====================================
Runs every 30 seconds
*/

setInterval(async () => {

  try {

    const controlDoc = await db
      .collection("app_controls")
      .doc("auto_approval")
      .get();

    if (!controlDoc.exists) return;

    const enabled = controlDoc.data().enabled;

    if (!enabled) return;

    const snapshot = await db
      .collection("task_submissions")
      .where("status", "==", "pending")
      .get();

    snapshot.forEach(async (doc) => {

      const data = doc.data();

      if (data.networkStatus === "approved") {

        await doc.ref.update({
          status: "approve",
          approvedAt: admin.firestore.FieldValue.serverTimestamp()
        });

      }

      if (data.networkStatus === "reject") {

        await doc.ref.update({
          status: "reject",
          rejectedAt: admin.firestore.FieldValue.serverTimestamp()
        });

      }

    });

  } catch (error) {

    console.error("Auto system error:", error);

  }

}, 30000);


/*
====================================
SERVER START
====================================
*/

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(Server running on port ${PORT});
});
