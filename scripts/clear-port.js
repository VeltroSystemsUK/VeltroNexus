import { execSync } from 'child_process';

const port = process.env.PORT || 5000;

console.log(`[Port Cleanup] Checking for processes on port ${port}...`);

try {
    // Find the PID of the process listening on the port
    const stdout = execSync(`netstat -ano | findstr LISTENING | findstr :${port}`).toString();
    const lines = stdout.split('\n');

    const pids = new Set();
    for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && !isNaN(pid)) {
            pids.add(pid);
        }
    }

    if (pids.size > 0) {
        console.log(`[Port Cleanup] Found ${pids.size} process(es): ${Array.from(pids).join(', ')}`);
        for (const pid of pids) {
            try {
                execSync(`taskkill /F /PID ${pid}`);
                console.log(`[Port Cleanup] Forcefully terminated PID ${pid}`);
            } catch (err) {
                console.error(`[Port Cleanup] Failed to kill PID ${pid}: ${err.message}`);
            }
        }
    } else {
        console.log(`[Port Cleanup] No processes found on port ${port}.`);
    }
} catch (error) {
    // findstr returns exit code 1 if no match found, which execSync throws as error
    if (error.status === 1) {
        console.log(`[Port Cleanup] Port ${port} is free.`);
    } else {
        console.error(`[Port Cleanup] Error: ${error.message}`);
    }
}
