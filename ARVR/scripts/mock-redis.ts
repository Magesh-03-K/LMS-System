import net from 'net';

const PORT = parseInt(process.env.REDIS_PORT || '6379', 10);

interface RedisValue {
  value: string;
  expiresAt?: number;
}

const store = new Map<string, RedisValue>();

function cleanExpired() {
  const now = Date.now();
  for (const [key, item] of store.entries()) {
    if (item.expiresAt && now > item.expiresAt) {
      store.delete(key);
    }
  }
}

setInterval(cleanExpired, 1000);

function parseResp(buffer: Buffer): string[][] {
  const text = buffer.toString('utf-8');
  const lines = text.split('\r\n');
  const commands: string[][] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line) {
      i++;
      continue;
    }

    if (line.startsWith('*')) {
      const numArgs = parseInt(line.slice(1), 10);
      i++;
      const currentCmd: string[] = [];
      for (let a = 0; a < numArgs; a++) {
        if (i < lines.length && lines[i].startsWith('$')) {
          i++; // skip length line
          if (i < lines.length) {
            currentCmd.push(lines[i]);
            i++;
          }
        }
      }
      if (currentCmd.length > 0) {
        commands.push(currentCmd);
      }
    } else {
      // Inline command (e.g. PING)
      const parts = line.trim().split(/\s+/);
      if (parts.length > 0 && parts[0]) {
        commands.push(parts);
      }
      i++;
    }
  }

  return commands;
}

function encodeResp(item: any): string {
  if (item === null || item === undefined) {
    return '$-1\r\n';
  }
  if (typeof item === 'number') {
    return `:${item}\r\n`;
  }
  if (typeof item === 'string') {
    return `$${Buffer.byteLength(item)}\r\n${item}\r\n`;
  }
  if (Array.isArray(item)) {
    let out = `*${item.length}\r\n`;
    for (const sub of item) {
      out += encodeResp(sub);
    }
    return out;
  }
  return '+OK\r\n';
}

const server = net.createServer((socket) => {
  let isMulti = false;
  let multiQueue: string[][] = [];

  socket.on('data', (data) => {
    cleanExpired();
    const commands = parseResp(data);

    for (const cmd of commands) {
      if (cmd.length === 0) continue;
      const name = cmd[0].toUpperCase();
      const args = cmd.slice(1);

      if (isMulti && name !== 'EXEC' && name !== 'DISCARD') {
        multiQueue.push(cmd);
        socket.write('+QUEUED\r\n');
        continue;
      }

      switch (name) {
        case 'PING':
          socket.write('+PONG\r\n');
          break;

        case 'COMMAND':
        case 'COMMAND|DOCS':
          socket.write('*0\r\n');
          break;

        case 'CLIENT':
        case 'SELECT':
          socket.write('+OK\r\n');
          break;

        case 'INFO':
          const infoStr = 'redis_version:7.2.0\r\nrole:master\r\n';
          socket.write(encodeResp(infoStr));
          break;

        case 'INCR': {
          const key = args[0];
          const entry = store.get(key);
          let current = entry ? parseInt(entry.value, 10) : 0;
          if (isNaN(current)) current = 0;
          current += 1;
          store.set(key, { value: String(current), expiresAt: entry?.expiresAt });
          socket.write(`:${current}\r\n`);
          break;
        }

        case 'GET': {
          const key = args[0];
          const entry = store.get(key);
          if (entry) {
            socket.write(encodeResp(entry.value));
          } else {
            socket.write('$-1\r\n');
          }
          break;
        }

        case 'SET': {
          const key = args[0];
          const value = args[1];
          let expiresAt: number | undefined = undefined;
          if (args[2]?.toUpperCase() === 'EX' && args[3]) {
            expiresAt = Date.now() + parseInt(args[3], 10) * 1000;
          }
          store.set(key, { value, expiresAt });
          socket.write('+OK\r\n');
          break;
        }

        case 'TTL': {
          const key = args[0];
          const entry = store.get(key);
          if (!entry) {
            socket.write(':-2\r\n');
          } else if (!entry.expiresAt) {
            socket.write(':-1\r\n');
          } else {
            const ttlSec = Math.max(1, Math.ceil((entry.expiresAt - Date.now()) / 1000));
            socket.write(`:${ttlSec}\r\n`);
          }
          break;
        }

        case 'EXPIRE': {
          const key = args[0];
          const sec = parseInt(args[1], 10);
          const entry = store.get(key);
          if (entry) {
            entry.expiresAt = Date.now() + sec * 1000;
            socket.write(':1\r\n');
          } else {
            socket.write(':0\r\n');
          }
          break;
        }

        case 'DEL': {
          let count = 0;
          for (const k of args) {
            if (store.delete(k)) count++;
          }
          socket.write(`:${count}\r\n`);
          break;
        }

        case 'MULTI':
          isMulti = true;
          multiQueue = [];
          socket.write('+OK\r\n');
          break;

        case 'DISCARD':
          isMulti = false;
          multiQueue = [];
          socket.write('+OK\r\n');
          break;

        case 'EXEC': {
          isMulti = false;
          let reply = `*${multiQueue.length}\r\n`;
          for (const qCmd of multiQueue) {
            const qName = qCmd[0].toUpperCase();
            const qArgs = qCmd.slice(1);
            if (qName === 'INCR') {
              const k = qArgs[0];
              const entry = store.get(k);
              let cur = entry ? parseInt(entry.value, 10) : 0;
              if (isNaN(cur)) cur = 0;
              cur += 1;
              store.set(k, { value: String(cur), expiresAt: entry?.expiresAt });
              reply += `:${cur}\r\n`;
            } else if (qName === 'TTL') {
              const k = qArgs[0];
              const entry = store.get(k);
              if (!entry) reply += ':-2\r\n';
              else if (!entry.expiresAt) reply += ':-1\r\n';
              else {
                const ttl = Math.max(1, Math.ceil((entry.expiresAt - Date.now()) / 1000));
                reply += `:${ttl}\r\n`;
              }
            } else if (qName === 'EXPIRE') {
              const k = qArgs[0];
              const sec = parseInt(qArgs[1], 10);
              const entry = store.get(k);
              if (entry) {
                entry.expiresAt = Date.now() + sec * 1000;
                reply += ':1\r\n';
              } else {
                reply += ':0\r\n';
              }
            } else {
              reply += '+OK\r\n';
            }
          }
          multiQueue = [];
          socket.write(reply);
          break;
        }

        default:
          socket.write('+OK\r\n');
          break;
      }
    }
  });

  socket.on('error', () => {});
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[Mock Redis] Distributed Redis emulator listening on 127.0.0.1:${PORT}`);
});
