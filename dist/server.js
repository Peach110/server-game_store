"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const app_1 = __importDefault(require("./app")); // ✅ import แบบ default
const dotenv_1 = __importDefault(require("dotenv"));
// import * as os from "os";
dotenv_1.default.config();
const PORT = process.env.PORT || 3000;
app_1.default.use(express_1.default.json());
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
app_1.default.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
});
//# sourceMappingURL=server.js.map