const express = require("express");
const admin = require("firebase-admin");

const app = express();
app.use(express.json());

// 🔐 Firebase init (SAFE)
let serviceAccount;

try {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT) {
    throw new Error("Missing GOOGLE_SERVICE_ACCOUNT");
  }

  serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);

} catch (e) {
  console.error("❌ Invalid GOOGLE_SERVICE_ACCOUNT JSON");
  console.error(e.message);
  process.exit(1);
}

// 🔥 Prevent multiple init error
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

// ✅ Health check (Render keeps service alive)
app.get("/", (req, res) => {
  res.send("✅ Auto Task Approval System Running");
});

// 🔥 AUTO APPROVAL SYSTEM (SAFE LOOP)
setInterval(async () => {
  try {
    console.log("🔄 Checking tasks...");

    const controlDoc = await db
      .collection("app_controls")
      .doc("auto_approval")
      .get();

    if (!controlDoc.exists || !controlDoc.data().enabled) {
      console.log("⛔ Auto approval OFF");
      return;
    }

    const snapshot = await db
      .collection("task_submissions")
      .where("status", "==", "pending")
      .get();

    if (snapshot.empty) {
      console.log("📭 No pending tasks");
      return;
    }

    // ✅ FIXED LOOP (IMPORTANT)
    for (const doc of snapshot.docs) {
      const data = doc.data();

      try {
        if (data.screenshots && data.screenshots.length > 0) {
          await doc.ref.update({
            status: "approve",
            approvedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          console.log(✅ Approved: ${doc.id});
        } else {
          await doc.ref.update({
            status: "reject",
            rejectedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          console.log(❌ Rejected: ${doc.id});
        }
      } catch (err) {
        console.error("❌ Update error:", err.message);
      }
    }

  } catch (err) {
    console.error("🔥 System error:", err.message);
  }
}, 30000);

// 🌐 PORT (Render required)
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(🚀 Server running on port ${PORT});
});
