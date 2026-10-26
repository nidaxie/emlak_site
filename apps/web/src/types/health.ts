export type HealthResponse = {
  status: 'ok';
  checks: {
    database: 'up';
    postgis: 'up';
  };
};
