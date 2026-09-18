module.exports = {
  apps: [
    {
      name: "frontend",
      script: "npm.cmd",
      args: "run dev",
      cwd: "./apps/web",
      exec_mode: "fork"
    },
    {
      name: "backend",
      script: "npm.cmd",
      args: "run dev",
      cwd: "./apps/api",
      exec_mode: "fork"
    }
  ]
};
