module.exports = {
  apps: [
    {
      name: 'pdv-print-worker',
      script: 'npm',
      args: 'run start',
      cwd: '/home/pi/pdv-marcos-kreps/print-worker',
      // index.ts derruba o processo de propósito a cada exceção/rejeição não
      // tratada, contando com o pm2 pra subir de novo. Com max_restarts: 50 o
      // pm2 desistia depois de 50 quedas e marcava o app como "errored" — uma
      // noite de Wi-Fi instável zerava o orçamento e a impressora ficava morta
      // até alguém entrar no Raspberry e rodar `pm2 restart` na mão.
      // O backoff exponencial evita o loop apertado que gastava esse orçamento.
      exp_backoff_restart_delay: 2000,
      max_restarts: 100000,
      min_uptime: '10s',
      watch: false,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
