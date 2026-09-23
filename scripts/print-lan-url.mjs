// Prints the addresses a phone on the same Wi-Fi can use to open the app.
import os from "node:os";

const port = process.env.PORT || "3000";
const addresses = Object.values(os.networkInterfaces())
  .flat()
  .filter((a) => a && a.family === "IPv4" && !a.internal)
  .map((a) => a.address);

console.log("\n  Wardrobe");
console.log(`  • On this computer:  http://localhost:${port}`);
if (addresses.length === 0) console.log("  • No network address found — connect this computer to Wi-Fi to use your phone.");
for (const ip of addresses) console.log(`  • On your phone:     http://${ip}:${port}   (same Wi-Fi)`);
console.log("");
