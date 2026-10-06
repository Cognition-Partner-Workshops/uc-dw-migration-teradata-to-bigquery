process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';
process.env.DATABASE_URL ??= 'postgresql://test:test@127.0.0.1:1/test';
delete process.env.AWS_SECRETS_MANAGER_SECRET_ID;
