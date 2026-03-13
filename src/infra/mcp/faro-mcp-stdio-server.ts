import net from "node:net";

const host = process.env.FARO_MCP_HOST;
const port = Number(process.env.FARO_MCP_PORT);
const token = process.env.FARO_MCP_TOKEN;

if (!host || !Number.isInteger(port) || !token) {
  process.stderr.write("Missing FARO_MCP_HOST, FARO_MCP_PORT, or FARO_MCP_TOKEN.\n");
  process.exit(1);
}

const socket = net.createConnection({
  host,
  port,
});

socket.setEncoding("utf8");
socket.on("connect", () => {
  socket.write(`${JSON.stringify({ token })}\n`);

  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk: string) => {
    socket.write(chunk);
  });
});
socket.on("data", (chunk: string) => {
  process.stdout.write(chunk);
});
socket.on("error", (error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
socket.on("close", () => {
  process.exit();
});

process.stdin.on("end", () => {
  socket.end();
});
