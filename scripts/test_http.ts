import http from 'node:http';

const req = http.get('http://127.0.0.1:5173/', (res) => {
  let data = '';
  res.on('data', (chunk) => (data += chunk));
  res.on('end', () => {
    console.log('HTTP Status:', res.statusCode);
    console.log('HTML snippet:', data.slice(0, 300));
  });
});
req.on('error', (e) => console.error('Error:', e));
