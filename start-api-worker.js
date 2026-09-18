const { spawn } = require('child_process');
spawn('npm.cmd', ['run', 'dev', '-w', 'apps/api'], { stdio: 'inherit', shell: true });
