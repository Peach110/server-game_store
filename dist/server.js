"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const dotenv_1 = __importDefault(require("dotenv"));
const os_1 = __importDefault(require("os"));
dotenv_1.default.config();
const PORT = process.env.PORT || 3000;
// const port = 3000
var ip = "0.0.0.0";
var ips = os_1.default.networkInterfaces();
Object.keys(ips).forEach(function (_interface) {
    ips[_interface].forEach(function (_dev) {
        if (_dev.family === "IPv4" && !_dev.internal)
            ip = _dev.address;
    });
});
// app.listen(port, () => {
//     console.log(`Game store API listening at http://${ip}:${port}`);
// });
app_1.default.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
});
//# sourceMappingURL=server.js.map