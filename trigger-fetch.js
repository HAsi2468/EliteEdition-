const http = require('http');

const req = http.request({
  hostname: '127.0.0.1',
  port: 3001,
  path: '/v1/products/fetchFromAPIS?dateRangeText=YESTERDAY',
  method: 'GET'
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Response:', data));
});

req.on('error', e => console.error('Error:', e));
req.end();
