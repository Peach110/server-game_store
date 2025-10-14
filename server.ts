import app from "./app";
import dotenv from "dotenv";
import os from "os";

dotenv.config();
const PORT = process.env.PORT || 3000;
// const port = 3000

var ip = "0.0.0.0";
var ips = os.networkInterfaces();
Object.keys(ips).forEach(function (_interface) {
    ips[_interface].forEach(function (_dev) {
        if (_dev.family === "IPv4" && !_dev.internal) ip = _dev.address;
    });
});

// app.listen(port, () => {
//     console.log(`Game store API listening at http://${ip}:${port}`);
// });
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
