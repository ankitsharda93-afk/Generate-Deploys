const { spawn } = require('child_process');
spawn('npm.cmd', ['run', 'dev', '-w', 'apps/web'], { stdio: 'inherit', shell: true });
