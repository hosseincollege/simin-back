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

type WorkshopRow = {
  id: number;
  ownerId: number;
  title: string;
  category: string;
  province: string;
  location: string;
  description: string;
  requiredCapital: number;
  status: string;
  reviewNote?: string | null;
  reviewedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function workshopRecord(row: WorkshopRow) {
  return {
    id: row.id,
    owner_id: row.ownerId,
    title: row.title,
    category: row.category,
    province: row.province,
    location: row.location,
    description: row.description,
    required_capital: Number(row.requiredCapital),
    status: row.status,
    review_note: row.reviewNote,
    reviewed_at: row.reviewedAt,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

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

  readonly workshop = {
    create: async ({ ownerId, data }: { ownerId: number; data: { title: string; category: string; province: string; location: string; description: string; requiredCapital: number } }) => {
      const result = await this.pool.request()
        .input('ownerId', sql.Int, ownerId)
        .input('title', sql.NVarChar(200), data.title)
        .input('category', sql.NVarChar(100), data.category)
        .input('province', sql.NVarChar(100), data.province)
        .input('location', sql.NVarChar(200), data.location)
        .input('description', sql.NVarChar(sql.MAX), data.description)
        .input('requiredCapital', sql.Decimal(19, 0), data.requiredCapital)
        .query<WorkshopRow>(`
          INSERT INTO dbo.Workshop (ownerId, title, category, province, location, description, requiredCapital)
          OUTPUT INSERTED.id, INSERTED.ownerId, INSERTED.title, INSERTED.category, INSERTED.province,
            INSERTED.location, INSERTED.description, INSERTED.requiredCapital, INSERTED.status,
            INSERTED.reviewNote, INSERTED.reviewedAt, INSERTED.createdAt, INSERTED.updatedAt
          VALUES (@ownerId, @title, @category, @province, @location, @description, @requiredCapital)
        `);
      const row = result.recordset[0];
      await this.recordReviewEvent({ workshopId: row.id, actorId: ownerId, action: 'created' });
      return workshopRecord(row);
    },
    findPublished: async () => {
      const result = await this.pool.request().query<WorkshopRow>(`
        SELECT id, ownerId, title, category, province, location, description, requiredCapital, status, reviewNote, reviewedAt, createdAt, updatedAt
        FROM dbo.Workshop WHERE status = N'published' ORDER BY createdAt DESC
      `);
      return result.recordset.map(workshopRecord);
    },
    findByOwner: async (ownerId: number) => {
      const result = await this.pool.request().input('ownerId', sql.Int, ownerId).query<WorkshopRow>(`
        SELECT id, ownerId, title, category, province, location, description, requiredCapital, status, reviewNote, reviewedAt, createdAt, updatedAt
        FROM dbo.Workshop WHERE ownerId = @ownerId ORDER BY updatedAt DESC
      `);
      return result.recordset.map(workshopRecord);
    },
    findPendingReview: async () => {
      const result = await this.pool.request().query<WorkshopRow>(`
        SELECT id, ownerId, title, category, province, location, description, requiredCapital,
          status, reviewNote, reviewedAt, createdAt, updatedAt
        FROM dbo.Workshop WHERE status = N'submitted' ORDER BY updatedAt ASC
      `);
      return result.recordset.map(workshopRecord);
    },
    findOwned: async (id: number, ownerId: number) => {
      const result = await this.pool.request().input('id', sql.Int, id).input('ownerId', sql.Int, ownerId).query<WorkshopRow>(`
        SELECT id, ownerId, title, category, province, location, description, requiredCapital, status, reviewNote, reviewedAt, createdAt, updatedAt
        FROM dbo.Workshop WHERE id = @id AND ownerId = @ownerId
      `);
      return result.recordset[0] ? workshopRecord(result.recordset[0]) : null;
    },
    findPublishedById: async (id: number) => {
      const result = await this.pool.request().input('id', sql.Int, id).query<WorkshopRow>(`
        SELECT id, ownerId, title, category, province, location, description, requiredCapital, status, reviewNote, reviewedAt, createdAt, updatedAt
        FROM dbo.Workshop WHERE id = @id AND status = N'published'
      `);
      return result.recordset[0] ? workshopRecord(result.recordset[0]) : null;
    },
    updateOwned: async ({ id, ownerId, data }: { id: number; ownerId: number; data: { title: string; category: string; province: string; location: string; description: string; requiredCapital: number } }) => {
      const result = await this.pool.request()
        .input('id', sql.Int, id).input('ownerId', sql.Int, ownerId)
        .input('title', sql.NVarChar(200), data.title)
        .input('category', sql.NVarChar(100), data.category)
        .input('province', sql.NVarChar(100), data.province)
        .input('location', sql.NVarChar(200), data.location)
        .input('description', sql.NVarChar(sql.MAX), data.description)
        .input('requiredCapital', sql.Decimal(19, 0), data.requiredCapital)
        .query<WorkshopRow>(`
          UPDATE dbo.Workshop SET title=@title, category=@category, province=@province, location=@location,
            description=@description, requiredCapital=@requiredCapital, updatedAt=SYSUTCDATETIME()
          OUTPUT INSERTED.id, INSERTED.ownerId, INSERTED.title, INSERTED.category, INSERTED.province,
            INSERTED.location, INSERTED.description, INSERTED.requiredCapital, INSERTED.status,
            INSERTED.reviewNote, INSERTED.reviewedAt,
            INSERTED.createdAt, INSERTED.updatedAt
          WHERE id=@id AND ownerId=@ownerId AND status IN (N'draft', N'revision')
        `);
      const row = result.recordset[0];
      if (row) await this.recordReviewEvent({ workshopId: id, actorId: ownerId, action: 'updated' });
      return row ? workshopRecord(row) : null;
    },
    publish: async (id: number, actorId: number) => {
      const result = await this.pool.request().input('id', sql.Int, id).query<WorkshopRow>(`
        UPDATE dbo.Workshop SET status=N'published', reviewNote=NULL, reviewedAt=SYSUTCDATETIME(), updatedAt=SYSUTCDATETIME()
        OUTPUT INSERTED.id, INSERTED.ownerId, INSERTED.title, INSERTED.category, INSERTED.province,
          INSERTED.location, INSERTED.description, INSERTED.requiredCapital, INSERTED.status,
          INSERTED.reviewNote, INSERTED.reviewedAt, INSERTED.createdAt, INSERTED.updatedAt
        WHERE id=@id AND status=N'submitted'
      `);
      const row = result.recordset[0];
      if (row) await this.recordReviewEvent({ workshopId: id, actorId, action: 'published' });
      return row ? workshopRecord(row) : null;
    },
    requestRevision: async (id: number, actorId: number, note: string) => {
      const result = await this.pool.request().input('id', sql.Int, id)
        .input('note', sql.NVarChar(1000), note).query<WorkshopRow>(`
          UPDATE dbo.Workshop SET status=N'revision', reviewNote=@note,
            reviewedAt=SYSUTCDATETIME(), updatedAt=SYSUTCDATETIME()
          OUTPUT INSERTED.id, INSERTED.ownerId, INSERTED.title, INSERTED.category, INSERTED.province,
            INSERTED.location, INSERTED.description, INSERTED.requiredCapital, INSERTED.status,
            INSERTED.reviewNote, INSERTED.reviewedAt, INSERTED.createdAt, INSERTED.updatedAt
          WHERE id=@id AND status=N'submitted'
        `);
      const row = result.recordset[0];
      if (row) await this.recordReviewEvent({ workshopId: id, actorId, action: 'revision_requested', note });
      return row ? workshopRecord(row) : null;
    },
    submitForReview: async (id: number, ownerId: number) => {
      const result = await this.pool.request().input('id', sql.Int, id).input('ownerId', sql.Int, ownerId).query<WorkshopRow>(`
        UPDATE dbo.Workshop SET status=N'submitted', reviewNote=NULL, reviewedAt=NULL, updatedAt=SYSUTCDATETIME()
        OUTPUT INSERTED.id, INSERTED.ownerId, INSERTED.title, INSERTED.category, INSERTED.province,
          INSERTED.location, INSERTED.description, INSERTED.requiredCapital, INSERTED.status,
          INSERTED.reviewNote, INSERTED.reviewedAt, INSERTED.createdAt, INSERTED.updatedAt
        WHERE id=@id AND ownerId=@ownerId AND status IN (N'draft', N'revision')
      `);
      const row = result.recordset[0];
      if (row) await this.recordReviewEvent({ workshopId: id, actorId: ownerId, action: 'submitted' });
      return row ? workshopRecord(row) : null;
    },
    findReviewHistory: async (id: number) => {
      const result = await this.pool.request().input('id', sql.Int, id).query(`
        SELECT e.id, e.action, e.note, e.createdAt, u.name AS actorName, u.role AS actorRole
        FROM dbo.WorkshopReviewEvent e
        INNER JOIN dbo.[User] u ON u.id=e.actorId
        WHERE e.workshopId=@id ORDER BY e.createdAt DESC, e.id DESC
      `);
      return result.recordset.map((row) => ({
        id: row.id, action: row.action, note: row.note, created_at: row.createdAt,
        actor_name: row.actorName, actor_role: row.actorRole,
      }));
    },
  };

  private async recordReviewEvent(event: { workshopId: number; actorId: number; action: string; note?: string }) {
    await this.pool.request()
      .input('workshopId', sql.Int, event.workshopId)
      .input('actorId', sql.Int, event.actorId)
      .input('action', sql.NVarChar(30), event.action)
      .input('note', sql.NVarChar(1000), event.note ?? null)
      .query(`INSERT INTO dbo.WorkshopReviewEvent (workshopId, actorId, action, note) VALUES (@workshopId, @actorId, @action, @note)`);
  }

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
      IF OBJECT_ID(N'dbo.Workshop', N'U') IS NULL
      BEGIN
        CREATE TABLE dbo.Workshop (
          id INT IDENTITY(1,1) PRIMARY KEY,
          ownerId INT NOT NULL,
          title NVARCHAR(200) NOT NULL,
          category NVARCHAR(100) NOT NULL,
          province NVARCHAR(100) NOT NULL,
          location NVARCHAR(200) NOT NULL,
          description NVARCHAR(MAX) NOT NULL,
          requiredCapital DECIMAL(19,0) NOT NULL,
          status NVARCHAR(20) NOT NULL CONSTRAINT DF_Workshop_status DEFAULT N'draft',
          reviewNote NVARCHAR(1000) NULL,
          reviewedAt DATETIME2 NULL,
          createdAt DATETIME2 NOT NULL CONSTRAINT DF_Workshop_createdAt DEFAULT SYSUTCDATETIME(),
          updatedAt DATETIME2 NOT NULL CONSTRAINT DF_Workshop_updatedAt DEFAULT SYSUTCDATETIME(),
          CONSTRAINT FK_Workshop_User FOREIGN KEY (ownerId) REFERENCES dbo.[User](id)
        );
        CREATE INDEX IX_Workshop_status_createdAt ON dbo.Workshop(status, createdAt DESC);
        CREATE INDEX IX_Workshop_ownerId_updatedAt ON dbo.Workshop(ownerId, updatedAt DESC);
      END;
      IF COL_LENGTH(N'dbo.Workshop', N'reviewNote') IS NULL
        ALTER TABLE dbo.Workshop ADD reviewNote NVARCHAR(1000) NULL;
      IF COL_LENGTH(N'dbo.Workshop', N'reviewedAt') IS NULL
        ALTER TABLE dbo.Workshop ADD reviewedAt DATETIME2 NULL;
      IF OBJECT_ID(N'dbo.WorkshopReviewEvent', N'U') IS NULL
      BEGIN
        CREATE TABLE dbo.WorkshopReviewEvent (
          id BIGINT IDENTITY(1,1) PRIMARY KEY,
          workshopId INT NOT NULL,
          actorId INT NOT NULL,
          action NVARCHAR(30) NOT NULL,
          note NVARCHAR(1000) NULL,
          createdAt DATETIME2 NOT NULL CONSTRAINT DF_WorkshopReviewEvent_createdAt DEFAULT SYSUTCDATETIME(),
          CONSTRAINT FK_WorkshopReviewEvent_Workshop FOREIGN KEY (workshopId) REFERENCES dbo.Workshop(id),
          CONSTRAINT FK_WorkshopReviewEvent_User FOREIGN KEY (actorId) REFERENCES dbo.[User](id)
        );
        CREATE INDEX IX_WorkshopReviewEvent_workshopId_createdAt ON dbo.WorkshopReviewEvent(workshopId, createdAt DESC);
      END;
    `);
  }

  async onModuleDestroy() {
    await this.pool.close();
  }
}
