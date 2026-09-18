import http from 'http';
import fs from 'fs';
import path from 'path';

const PORT = parseInt(process.env.S3_MOCK_PORT || '9000', 10);
const DATA_DIR = path.join(process.cwd(), '.private-s3-data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const server = http.createServer(async (req, res) => {
  // S3 Presigned URL CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, HEAD, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Expose-Headers', 'ETag, Content-Length, Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const urlObj = new URL(req.url || '/', `http://${req.headers.host || 'localhost:9000'}`);
  // Path format: /bucket/key/path/to/file
  const pathname = decodeURIComponent(urlObj.pathname).replace(/^\/+/, '');
  if (!pathname) {
    res.writeHead(200, { 'Content-Type': 'application/xml' });
    res.end('<ListAllMyBucketsResult></ListAllMyBucketsResult>');
    return;
  }

  const parts = pathname.split('/');
  const bucket = parts[0];
  const objectKey = parts.slice(1).join('/');

  if (!objectKey) {
    // Bucket level operations
    if (req.method === 'HEAD' || req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/xml' });
      res.end(`<ListBucketResult><Name>${bucket}</Name></ListBucketResult>`);
      return;
    }
  }

  const filePath = path.join(DATA_DIR, bucket, objectKey);
  const metaPath = filePath + '.meta.json';

  // Ensure bucket dir exists
  const dirName = path.dirname(filePath);
  if (!fs.existsSync(dirName)) {
    fs.mkdirSync(dirName, { recursive: true });
  }

  if (req.method === 'PUT') {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const buffer = Buffer.concat(chunks);
      fs.writeFileSync(filePath, buffer);
      
      const meta = {
        contentType: req.headers['content-type'] || 'application/octet-stream',
        contentLength: buffer.length,
        etag: `"${Date.now()}"`,
      };
      fs.writeFileSync(metaPath, JSON.stringify(meta));

      res.writeHead(200, {
        'ETag': meta.etag,
        'Content-Length': '0',
      });
      res.end();
    });
    return;
  }

  if (req.method === 'HEAD') {
    if (!fs.existsSync(filePath)) {
      res.writeHead(404);
      res.end();
      return;
    }

    const stat = fs.statSync(filePath);
    let contentType = 'application/octet-stream';
    let etag = `"${stat.mtimeMs}"`;
    if (fs.existsSync(metaPath)) {
      try {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
        if (meta.contentType) contentType = meta.contentType;
        if (meta.etag) etag = meta.etag;
      } catch {}
    }

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': String(stat.size),
      'ETag': etag,
    });
    res.end();
    return;
  }

  if (req.method === 'GET') {
    if (!fs.existsSync(filePath)) {
      res.writeHead(404, { 'Content-Type': 'application/xml' });
      res.end('<Error><Code>NoSuchKey</Code><Message>The specified key does not exist.</Message></Error>');
      return;
    }

    const stat = fs.statSync(filePath);
    let contentType = 'application/octet-stream';
    if (fs.existsSync(metaPath)) {
      try {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
        if (meta.contentType) contentType = meta.contentType;
      } catch {}
    }

    const responseHeaders: Record<string, string> = {
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
    };

    const dispositionParam = urlObj.searchParams.get('response-content-disposition');
    if (dispositionParam) {
      responseHeaders['Content-Disposition'] = dispositionParam;
    }

    // Handle Range header (e.g. Range: bytes=0-31 for magic-byte validation)
    const rangeHeader = req.headers['range'];
    if (rangeHeader && rangeHeader.startsWith('bytes=')) {
      const parts = rangeHeader.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;

      if (start >= stat.size || end >= stat.size) {
        res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` });
        res.end();
        return;
      }

      responseHeaders['Content-Range'] = `bytes ${start}-${end}/${stat.size}`;
      responseHeaders['Content-Length'] = String(end - start + 1);
      res.writeHead(206, responseHeaders);

      const stream = fs.createReadStream(filePath, { start, end });
      stream.pipe(res);
      return;
    }

    responseHeaders['Content-Length'] = String(stat.size);
    res.writeHead(200, responseHeaders);
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  if (req.method === 'DELETE') {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    if (fs.existsSync(metaPath)) {
      fs.unlinkSync(metaPath);
    }
    res.writeHead(204);
    res.end();
    return;
  }

  res.writeHead(405);
  res.end();
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[Mock S3] Private S3 Emulator running at http://127.0.0.1:${PORT}`);
  console.log(`[Mock S3] Storage directory: ${DATA_DIR}`);
});
