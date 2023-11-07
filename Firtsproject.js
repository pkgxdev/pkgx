const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.write('<h1>My Test Project</h1>');
  res.write('<p>Email: catsmile91@gmail.com</p>');
  res.write('<p>Twitter: <a href="https://twitter.com/catsmileaja">@catsmileaja</a></p>');
  res.write('<p>Discord: th3mi</p>');
  res.end();
});

const port = 3000;

server.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}/`);
});
