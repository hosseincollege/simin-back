import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import sql from 'mssql';

type User = {
  id: number;
  name: string;
  username: string;
  passwordHash: string;
  role: string;
  createdAt: Date;
};

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly pool: sql.ConnectionPool;

  readonly user = {
    create: async ({ data }: { data: Pick<User, 'name' | 'username' | 'passwordHash'> }) => {
      const transaction = new sql.Transaction(this.pool);
      await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
      try {
        const request = new sql.Request(transaction);
        const existing = await request.query(`SELECT TOP (1) id FROM dbo.[User] WITH (UPDLOCK, HOLDLOCK)`);
        const role = existing.recordset.length === 0 ? 'admin' : 'user';
        const result = await new sql.Request(transaction)
          .input('name', sql.NVarChar(200), data.name)
          .input('username', sql.NVarChar(100), data.username)
          .input('passwordHash', sql.NVarChar(100), data.passwordHash)
          .input('role', sql.NVarChar(20), role)
          .query<Pick<User, 'id' | 'name' | 'username' | 'role'>>(`
            INSERT INTO dbo.[User] (name, username, passwordHash, role)
            OUTPUT INSERTED.id, INSERTED.name, INSERTED.username, INSERTED.role
            VALUES (@name, @username, @passwordHash, @role)
          `);
        await transaction.commit();
        return result.recordset[0];
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    },
    findUnique: async ({ where }: { where: { username: string } }) => {
      const result = await this.pool.request()
        .input('username', sql.NVarChar(100), where.username)
        .query<User>(`
          SELECT TOP (1) id, name, username, passwordHash, role, createdAt
          FROM dbo.[User]
          WHERE username = @username
        `);
      return result.recordset[0] ?? null;
    },
  };

  constructor() {
    const user = process.env['DB_USER'];
    const password = process.env['DB_PASSWORD'];
    if (!user || !password) {
      throw new Error('SQL Server is not configured. Copy .env.example to .env and set DB_USER and DB_PASSWORD.');
    }
    this.pool = new sql.ConnectionPool({
      server: process.env['DB_SERVER'] || 'localhost',
      port: Number(process.env['DB_PORT'] || 1433),
      database: process.env['DB_NAME'] || 'Simin',
      user,
      password,
      options: {
        encrypt: process.env['DB_ENCRYPT'] === 'true',
        trustServerCertificate: process.env['DB_TRUST_CERT'] !== 'false',
      },
    });
  }

  async onModuleInit() {
    await this.pool.connect();
    await this.pool.request().query(`
      IF OBJECT_ID(N'dbo.User', N'U') IS NULL
      BEGIN
        CREATE TABLE dbo.[User] (
          id INT IDENTITY(1,1) PRIMARY KEY,
          name NVARCHAR(200) NOT NULL,
          username NVARCHAR(100) NOT NULL UNIQUE,
          passwordHash NVARCHAR(100) NOT NULL,
          role NVARCHAR(20) NOT NULL DEFAULT N'user',
          createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
        );
      END;
    `);
  }

  async onModuleDestroy() {
    await this.pool.close();
  }
}
