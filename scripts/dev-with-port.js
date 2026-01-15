const { spawn } = require('child_process');
const net = require('net');

/**
 * Check if a port is available
 */
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(false);
      } else {
        resolve(false);
      }
    });
    
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    
    server.listen(port);
  });
}

/**
 * Find the next available port starting from a given port
 */
async function findAvailablePort(startPort = 3000, maxAttempts = 10) {
  for (let i = 0; i < maxAttempts; i++) {
    const port = startPort + i;
    const available = await isPortAvailable(port);
    
    if (available) {
      return port;
    }
    
    console.log(`Port ${port} is in use, trying next port...`);
  }
  
  throw new Error(`Could not find an available port after ${maxAttempts} attempts`);
}

/**
 * Start Next.js dev server on an available port
 */
async function startDevServer() {
  try {
    const preferredPort = parseInt(process.env.PORT || '3000', 10);
    const port = await findAvailablePort(preferredPort);
    
    console.log(`\n🚀 Starting Next.js on port ${port}...\n`);
    
    // Start Next.js with the available port
    const nextProcess = spawn('next', ['dev', '--turbopack', '-p', port.toString()], {
      stdio: 'inherit',
      shell: true,
      env: { ...process.env, PORT: port.toString() }
    });
    
    nextProcess.on('error', (error) => {
      console.error('Failed to start Next.js:', error);
      process.exit(1);
    });
    
    nextProcess.on('close', (code) => {
      process.exit(code || 0);
    });
    
    // Handle termination signals
    process.on('SIGINT', () => {
      nextProcess.kill('SIGINT');
    });
    
    process.on('SIGTERM', () => {
      nextProcess.kill('SIGTERM');
    });
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

startDevServer();
