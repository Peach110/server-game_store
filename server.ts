import express, { Response } from "express";
import app from "./app"; // ✅ import แบบ default
import dotenv from "dotenv";
// import * as os from "os";

dotenv.config();
const PORT = process.env.PORT || 3000;

app.use(express.json());



// const ip: string = (() => {
//     let address = "0.0.0.0";
//     const interfaces = os.networkInterfaces();

//     Object.keys(interfaces).forEach((interfaceName) => {
//         interfaces[interfaceName]?.forEach((interfaceInfo) => {
//             if (interfaceInfo.family === "IPv4" && !interfaceInfo.internal) {
//                 address = interfaceInfo.address;
//             }
//         });
//     });

//     return address;
// })();

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});