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
  productName?: string | null;
  currentCapacity?: string | null;
  targetCapacity?: string | null;
  investmentPurpose?: string | null;
  executionMonths?: number | null;
  equipmentAmount?: number | null;
  workingCapitalAmount?: number | null;
  otherCostsAmount?: number | null;
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
    product_name: row.productName ?? null,
    current_capacity: row.currentCapacity ?? null,
    target_capacity: row.targetCapacity ?? null,
    investment_purpose: row.investmentPurpose ?? null,
    execution_months: row.executionMonths ?? null,
    equipment_amount: row.equipmentAmount === null || row.equipmentAmount === undefined ? null : Number(row.equipmentAmount),
    working_capital_amount: row.workingCapitalAmount === null || row.workingCapitalAmount === undefined ? null : Number(row.workingCapitalAmount),
    other_costs_amount: row.otherCostsAmount === null || row.otherCostsAmount === undefined ? null : Number(row.otherCostsAmount),
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
        const result = await new sql.Request(transaction)
          .input('name', sql.NVarChar(200), data.name)
          .input('username', sql.NVarChar(100), data.username)
          .input('passwordHash', sql.NVarChar(100), data.passwordHash)
          .input('role', sql.NVarChar(20), 'user')
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
    findById: async (id: number) => {
      const result = await this.pool.request().input('id', sql.Int, id).query<Pick<User, 'id' | 'name' | 'username' | 'role'>>(`
        SELECT TOP (1) id, name, username, role FROM dbo.[User] WHERE id=@id
      `);
      return result.recordset[0] ?? null;
    },
  };

  readonly workshop = {
    createDocument: async (document: { workshopId: number; ownerId: number; category: string; originalName: string; mediaType: string; byteSize: number; fileKey: string }) => {
      const result = await this.pool.request().input('workshopId', sql.Int, document.workshopId)
        .input('ownerId', sql.Int, document.ownerId).input('category', sql.NVarChar(50), document.category)
        .input('originalName', sql.NVarChar(255), document.originalName).input('mediaType', sql.NVarChar(100), document.mediaType)
        .input('byteSize', sql.Int, document.byteSize).input('fileKey', sql.NVarChar(36), document.fileKey)
        .query(`INSERT INTO dbo.WorkshopDocument(workshopId,ownerId,category,originalName,mediaType,byteSize,fileKey)
          OUTPUT INSERTED.id, INSERTED.category, INSERTED.originalName, INSERTED.mediaType, INSERTED.byteSize, INSERTED.reviewStatus, INSERTED.createdAt
          VALUES(@workshopId,@ownerId,@category,@originalName,@mediaType,@byteSize,@fileKey)`);
      const row = result.recordset[0];
      return { id: row.id, category: row.category, original_name: row.originalName, media_type: row.mediaType,
        byte_size: row.byteSize, review_status: row.reviewStatus, created_at: row.createdAt };
    },
    listOwnedDocuments: async (workshopId: number, ownerId: number) => {
      const result = await this.pool.request().input('workshopId', sql.Int, workshopId).input('ownerId', sql.Int, ownerId)
        .query(`SELECT id,category,originalName,mediaType,byteSize,reviewStatus,reviewNote,createdAt,checkedAt
          FROM dbo.WorkshopDocument WHERE workshopId=@workshopId AND ownerId=@ownerId ORDER BY createdAt DESC`);
      return result.recordset.map((row) => ({ id: row.id, category: row.category, original_name: row.originalName,
        media_type: row.mediaType, byte_size: row.byteSize, review_status: row.reviewStatus,
        review_note: row.reviewNote, created_at: row.createdAt, checked_at: row.checkedAt }));
    },
    findPendingDocuments: async () => {
      const result = await this.pool.request().query(`SELECT d.id,d.workshopId,d.category,d.originalName,d.mediaType,d.byteSize,d.createdAt,
          w.title AS workshopTitle,u.name AS ownerName
        FROM dbo.WorkshopDocument d INNER JOIN dbo.Workshop w ON w.id=d.workshopId
        INNER JOIN dbo.[User] u ON u.id=d.ownerId WHERE d.reviewStatus=N'pending' ORDER BY d.createdAt ASC`);
      return result.recordset.map((row) => ({ id: row.id, workshop_id: row.workshopId, category: row.category,
        original_name: row.originalName, media_type: row.mediaType, byte_size: row.byteSize, created_at: row.createdAt,
        workshop_title: row.workshopTitle, owner_name: row.ownerName }));
    },
    getDocumentForOwner: async (workshopId: number, documentId: number, ownerId: number) => {
      const result = await this.pool.request().input('workshopId', sql.Int, workshopId).input('documentId', sql.Int, documentId)
        .input('ownerId', sql.Int, ownerId).query(`SELECT id,ownerId,originalName,mediaType,byteSize,fileKey
          FROM dbo.WorkshopDocument WHERE id=@documentId AND workshopId=@workshopId AND ownerId=@ownerId`);
      return result.recordset[0] ?? null;
    },
    getDocumentForAdmin: async (workshopId: number, documentId: number) => {
      const result = await this.pool.request().input('workshopId', sql.Int, workshopId).input('documentId', sql.Int, documentId)
        .query(`SELECT id,ownerId,originalName,mediaType,byteSize,fileKey
          FROM dbo.WorkshopDocument WHERE id=@documentId AND workshopId=@workshopId`);
      return result.recordset[0] ?? null;
    },
    checkDocument: async (workshopId: number, documentId: number, actorId: number, status: 'accepted' | 'revision', note: string | null) => {
      const result = await this.pool.request().input('workshopId', sql.Int, workshopId).input('documentId', sql.Int, documentId)
        .input('actorId', sql.Int, actorId).input('status', sql.NVarChar(20), status).input('note', sql.NVarChar(1000), note)
        .query(`UPDATE dbo.WorkshopDocument SET reviewStatus=@status,reviewNote=@note,checkedBy=@actorId,checkedAt=SYSUTCDATETIME()
          OUTPUT INSERTED.id,INSERTED.reviewStatus,INSERTED.reviewNote,INSERTED.checkedAt
          WHERE id=@documentId AND workshopId=@workshopId AND reviewStatus=N'pending'`);
      return result.recordset[0] ?? null;
    },
    findReports: async (workshopId: number, checkedOnly: boolean) => {
      const result = await this.pool.request().input('workshopId', sql.Int, workshopId).query(`
        SELECT id, year, month, quantityUnit, productionQuantity, soldQuantity, salesAmount, operatingCosts,
          salesAmount - operatingCosts AS netProfit, sourceNote, reviewStatus, createdAt, checkedAt
        FROM dbo.WorkshopReport WHERE workshopId=@workshopId ${checkedOnly ? "AND reviewStatus=N'checked'" : ''}
        ORDER BY year DESC, month DESC
      `);
      return result.recordset.map((row) => ({ id: row.id, year: row.year, month: row.month, quantity_unit: row.quantityUnit,
        production_quantity: Number(row.productionQuantity), sold_quantity: Number(row.soldQuantity),
        sales: Number(row.salesAmount), operating_costs: Number(row.operatingCosts), net_profit: Number(row.netProfit),
        source_note: row.sourceNote, review_status: row.reviewStatus, created_at: row.createdAt, checked_at: row.checkedAt }));
    },
    findPendingReports: async () => {
      const result = await this.pool.request().query(`
        SELECT r.id, r.workshopId, w.title AS workshopTitle, u.name AS ownerName, r.year, r.month, r.quantityUnit,
          r.productionQuantity, r.soldQuantity, r.salesAmount, r.operatingCosts, r.sourceNote, r.createdAt
        FROM dbo.WorkshopReport r INNER JOIN dbo.Workshop w ON w.id=r.workshopId
        INNER JOIN dbo.[User] u ON u.id=r.ownerId WHERE r.reviewStatus=N'pending'
        ORDER BY r.createdAt ASC
      `);
      return result.recordset.map((row) => ({ id: row.id, workshop_id: row.workshopId, workshop_title: row.workshopTitle,
        owner_name: row.ownerName, year: row.year, month: row.month, quantity_unit: row.quantityUnit, production_quantity: Number(row.productionQuantity),
        sold_quantity: Number(row.soldQuantity), sales: Number(row.salesAmount), operating_costs: Number(row.operatingCosts),
        source_note: row.sourceNote, created_at: row.createdAt }));
    },
    createReport: async (workshopId: number, ownerId: number, data: { year: number; month: number; quantityUnit: string; productionQuantity: number; soldQuantity: number; salesAmount: number; operatingCosts: number; sourceNote: string }) => {
      try {
        const result = await this.pool.request().input('workshopId', sql.Int, workshopId).input('ownerId', sql.Int, ownerId)
          .input('year', sql.Int, data.year).input('month', sql.Int, data.month).input('quantityUnit', sql.NVarChar(50), data.quantityUnit)
          .input('productionQuantity', sql.Decimal(19, 0), data.productionQuantity).input('soldQuantity', sql.Decimal(19, 0), data.soldQuantity)
          .input('salesAmount', sql.Decimal(19, 0), data.salesAmount).input('operatingCosts', sql.Decimal(19, 0), data.operatingCosts)
          .input('sourceNote', sql.NVarChar(2000), data.sourceNote)
          .query(`INSERT INTO dbo.WorkshopReport(workshopId,ownerId,year,month,quantityUnit,productionQuantity,soldQuantity,salesAmount,operatingCosts,sourceNote)
            OUTPUT INSERTED.id, INSERTED.year, INSERTED.month, INSERTED.quantityUnit, INSERTED.productionQuantity, INSERTED.soldQuantity,
              INSERTED.salesAmount, INSERTED.operatingCosts, INSERTED.sourceNote, INSERTED.reviewStatus, INSERTED.createdAt
            VALUES(@workshopId,@ownerId,@year,@month,@quantityUnit,@productionQuantity,@soldQuantity,@salesAmount,@operatingCosts,@sourceNote)`);
        const row = result.recordset[0];
        return { id: row.id, year: row.year, month: row.month, quantity_unit: row.quantityUnit, production_quantity: Number(row.productionQuantity),
          sold_quantity: Number(row.soldQuantity), sales: Number(row.salesAmount), operating_costs: Number(row.operatingCosts),
          net_profit: Number(row.salesAmount) - Number(row.operatingCosts), source_note: row.sourceNote,
          review_status: row.reviewStatus, created_at: row.createdAt };
      } catch (error) {
        if ((error as { number?: number }).number === 2627 || (error as { number?: number }).number === 2601) return null;
        throw error;
      }
    },
    updateReport: async (workshopId: number, reportId: number, ownerId: number, data: { year: number; month: number; quantityUnit: string; productionQuantity: number; soldQuantity: number; salesAmount: number; operatingCosts: number; sourceNote: string }) => {
      const transaction = new sql.Transaction(this.pool);
      await transaction.begin();
      try {
        const existing = await new sql.Request(transaction)
          .input('workshopId', sql.Int, workshopId).input('reportId', sql.Int, reportId).input('ownerId', sql.Int, ownerId)
          .query(`SELECT * FROM dbo.WorkshopReport WITH (UPDLOCK, ROWLOCK) WHERE id=@reportId AND workshopId=@workshopId AND ownerId=@ownerId`);
        const old = existing.recordset[0];
        if (!old) { await transaction.rollback(); return null; }
        await new sql.Request(transaction)
          .input('reportId', sql.Int, reportId).input('changedBy', sql.Int, ownerId)
          .input('year', sql.Int, old.year).input('month', sql.Int, old.month).input('quantityUnit', sql.NVarChar(50), old.quantityUnit)
          .input('productionQuantity', sql.Decimal(19, 0), old.productionQuantity).input('soldQuantity', sql.Decimal(19, 0), old.soldQuantity)
          .input('salesAmount', sql.Decimal(19, 0), old.salesAmount).input('operatingCosts', sql.Decimal(19, 0), old.operatingCosts)
          .input('sourceNote', sql.NVarChar(2000), old.sourceNote).input('reviewStatus', sql.NVarChar(20), old.reviewStatus)
          .input('priorCheckedBy', sql.Int, old.checkedBy ?? null).input('priorCheckedAt', sql.DateTime2, old.checkedAt ?? null)
          .input('createdAt', sql.DateTime2, old.createdAt)
          .query(`INSERT INTO dbo.WorkshopReportRevision(reportId,changedBy,year,month,quantityUnit,productionQuantity,soldQuantity,salesAmount,operatingCosts,sourceNote,reviewStatus,priorCheckedBy,priorCheckedAt,originalCreatedAt)
            VALUES(@reportId,@changedBy,@year,@month,@quantityUnit,@productionQuantity,@soldQuantity,@salesAmount,@operatingCosts,@sourceNote,@reviewStatus,@priorCheckedBy,@priorCheckedAt,@createdAt)`);
        const updated = await new sql.Request(transaction)
          .input('workshopId', sql.Int, workshopId).input('reportId', sql.Int, reportId).input('ownerId', sql.Int, ownerId)
          .input('year', sql.Int, data.year).input('month', sql.Int, data.month).input('quantityUnit', sql.NVarChar(50), data.quantityUnit)
          .input('productionQuantity', sql.Decimal(19, 0), data.productionQuantity).input('soldQuantity', sql.Decimal(19, 0), data.soldQuantity)
          .input('salesAmount', sql.Decimal(19, 0), data.salesAmount).input('operatingCosts', sql.Decimal(19, 0), data.operatingCosts)
          .input('sourceNote', sql.NVarChar(2000), data.sourceNote)
          .query(`UPDATE dbo.WorkshopReport SET year=@year,month=@month,quantityUnit=@quantityUnit,productionQuantity=@productionQuantity,
            soldQuantity=@soldQuantity,salesAmount=@salesAmount,operatingCosts=@operatingCosts,sourceNote=@sourceNote,
            reviewStatus=N'pending',checkedBy=NULL,checkedAt=NULL
            OUTPUT INSERTED.id,INSERTED.year,INSERTED.month,INSERTED.quantityUnit,INSERTED.productionQuantity,INSERTED.soldQuantity,
              INSERTED.salesAmount,INSERTED.operatingCosts,INSERTED.sourceNote,INSERTED.reviewStatus,INSERTED.createdAt
            WHERE id=@reportId AND workshopId=@workshopId AND ownerId=@ownerId`);
        await transaction.commit();
        const row = updated.recordset[0];
        return row ? { id: row.id, year: row.year, month: row.month, quantity_unit: row.quantityUnit,
          production_quantity: Number(row.productionQuantity), sold_quantity: Number(row.soldQuantity), sales: Number(row.salesAmount),
          operating_costs: Number(row.operatingCosts), net_profit: Number(row.salesAmount) - Number(row.operatingCosts), source_note: row.sourceNote,
          review_status: row.reviewStatus, created_at: row.createdAt } : null;
      } catch (error) { await transaction.rollback(); throw error; }
    },
    findReportRevisions: async (workshopId: number, reportId: number, ownerId: number) => {
      const result = await this.pool.request().input('workshopId', sql.Int, workshopId).input('reportId', sql.Int, reportId).input('ownerId', sql.Int, ownerId)
        .query(`SELECT v.id,v.year,v.month,v.quantityUnit,v.productionQuantity,v.soldQuantity,v.salesAmount,v.operatingCosts,v.sourceNote,v.reviewStatus,v.priorCheckedAt,v.originalCreatedAt,v.createdAt,u.name AS changedByName,checker.name AS priorCheckerName
          FROM dbo.WorkshopReportRevision v INNER JOIN dbo.WorkshopReport r ON r.id=v.reportId INNER JOIN dbo.[User] u ON u.id=v.changedBy
          LEFT JOIN dbo.[User] checker ON checker.id=v.priorCheckedBy
          WHERE r.workshopId=@workshopId AND r.id=@reportId AND r.ownerId=@ownerId ORDER BY v.createdAt DESC,v.id DESC`);
      return result.recordset.map((row) => ({ id: row.id, year: row.year, month: row.month, quantity_unit: row.quantityUnit,
        production_quantity: Number(row.productionQuantity), sold_quantity: Number(row.soldQuantity), sales: Number(row.salesAmount),
        operating_costs: Number(row.operatingCosts), source_note: row.sourceNote, review_status: row.reviewStatus,
        prior_checked_at: row.priorCheckedAt, prior_checked_by: row.priorCheckerName,
        original_created_at: row.originalCreatedAt, changed_at: row.createdAt, changed_by: row.changedByName }));
    },
    checkReport: async (workshopId: number, reportId: number, actorId: number) => {
      const result = await this.pool.request().input('workshopId', sql.Int, workshopId).input('reportId', sql.Int, reportId)
        .input('actorId', sql.Int, actorId).query(`UPDATE dbo.WorkshopReport SET reviewStatus=N'checked', checkedBy=@actorId, checkedAt=SYSUTCDATETIME()
          OUTPUT INSERTED.id, INSERTED.reviewStatus, INSERTED.checkedAt WHERE id=@reportId AND workshopId=@workshopId AND reviewStatus=N'pending'`);
      return result.recordset[0] ?? null;
    },
    findInterests: async (userId: number) => {
      const result = await this.pool.request().input('userId', sql.Int, userId).query(`
        SELECT w.id, w.title, w.category, w.province, w.requiredCapital, i.createdAt AS interestedAt
        FROM dbo.WorkshopInterest i INNER JOIN dbo.Workshop w ON w.id=i.workshopId
        WHERE i.userId=@userId AND w.status=N'published' ORDER BY i.createdAt DESC
      `);
      return result.recordset.map((row) => ({ id: row.id, title: row.title, category: row.category, province: row.province, required_capital: Number(row.requiredCapital), interested_at: row.interestedAt }));
    },
    addInterest: async (workshopId: number, userId: number) => {
      const result = await this.pool.request().input('workshopId', sql.Int, workshopId).input('userId', sql.Int, userId).query(`
        IF EXISTS (SELECT 1 FROM dbo.Workshop WHERE id=@workshopId AND status=N'published')
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM dbo.WorkshopInterest WHERE workshopId=@workshopId AND userId=@userId)
            INSERT INTO dbo.WorkshopInterest(workshopId,userId) VALUES(@workshopId,@userId);
          SELECT CAST(1 AS bit) AS saved;
        END
      `);
      return result.recordset[0] ?? null;
    },
    removeInterest: async (workshopId: number, userId: number) => {
      await this.pool.request().input('workshopId', sql.Int, workshopId).input('userId', sql.Int, userId)
        .query('DELETE FROM dbo.WorkshopInterest WHERE workshopId=@workshopId AND userId=@userId');
      return { removed: true };
    },
    createInquiry: async (workshopId: number, investorId: number, message: string) => {
      try {
        const result = await this.pool.request().input('workshopId', sql.Int, workshopId).input('investorId', sql.Int, investorId)
          .input('message', sql.NVarChar(1500), message)
          .query(`INSERT INTO dbo.WorkshopInquiry(workshopId,investorId,message,consentAt)
            OUTPUT INSERTED.id,INSERTED.workshopId,INSERTED.status,INSERTED.createdAt
            SELECT w.id,@investorId,@message,SYSUTCDATETIME() FROM dbo.Workshop w
            WHERE w.id=@workshopId AND w.status=N'published' AND w.ownerId<>@investorId
              AND NOT EXISTS(SELECT 1 FROM dbo.WorkshopInquiry i WHERE i.workshopId=@workshopId AND i.investorId=@investorId)`);
        return result.recordset[0] ?? null;
      } catch (error) {
        if ([2601, 2627].includes((error as { number?: number }).number ?? 0)) return null;
        throw error;
      }
    },
    listInvestorInquiries: async (investorId: number) => {
      const result = await this.pool.request().input('investorId', sql.Int, investorId).query(`
        SELECT i.id,i.workshopId,w.title AS workshopTitle,w.province,i.message,i.status,i.createdAt,i.updatedAt
        FROM dbo.WorkshopInquiry i INNER JOIN dbo.Workshop w ON w.id=i.workshopId
        WHERE i.investorId=@investorId ORDER BY i.createdAt DESC`);
      return result.recordset.map((row) => ({ id: row.id, workshop_id: row.workshopId, workshop_title: row.workshopTitle,
        province: row.province, message: row.message, status: row.status, created_at: row.createdAt, updated_at: row.updatedAt }));
    },
    listOwnedInquiries: async (workshopId: number, ownerId: number) => {
      const result = await this.pool.request().input('workshopId', sql.Int, workshopId).input('ownerId', sql.Int, ownerId).query(`
        SELECT i.id,i.investorId,u.name AS investorName,u.username AS investorUsername,i.message,i.status,i.consentAt,i.createdAt,i.updatedAt
        FROM dbo.WorkshopInquiry i INNER JOIN dbo.Workshop w ON w.id=i.workshopId INNER JOIN dbo.[User] u ON u.id=i.investorId
        WHERE i.workshopId=@workshopId AND w.ownerId=@ownerId ORDER BY i.createdAt DESC`);
      return result.recordset.map((row) => ({ id: row.id, investor_id: row.investorId, investor_name: row.investorName,
        investor_username: row.investorUsername, message: row.message, status: row.status,
        consent_at: row.consentAt, created_at: row.createdAt, updated_at: row.updatedAt }));
    },
    updateInquiryStatus: async (workshopId: number, inquiryId: number, ownerId: number, status: 'contacted' | 'closed') => {
      const result = await this.pool.request().input('workshopId', sql.Int, workshopId).input('inquiryId', sql.Int, inquiryId)
        .input('ownerId', sql.Int, ownerId).input('status', sql.NVarChar(20), status).query(`
          UPDATE i SET status=@status,updatedAt=SYSUTCDATETIME()
          OUTPUT INSERTED.id,INSERTED.status,INSERTED.updatedAt
          FROM dbo.WorkshopInquiry i INNER JOIN dbo.Workshop w ON w.id=i.workshopId
          WHERE i.id=@inquiryId AND i.workshopId=@workshopId AND w.ownerId=@ownerId`);
      return result.recordset[0] ?? null;
    },
    create: async ({ ownerId, data }: { ownerId: number; data: { title: string; category: string; province: string; location: string; description: string; requiredCapital: number; productName: string; currentCapacity: string; targetCapacity: string; investmentPurpose: string; executionMonths: number; equipmentAmount: number; workingCapitalAmount: number; otherCostsAmount: number } }) => {
      return this.withReviewEvent({ actorId: ownerId, action: 'created' }, async (transaction) => {
      const result = await new sql.Request(transaction)
        .input('ownerId', sql.Int, ownerId)
        .input('title', sql.NVarChar(200), data.title)
        .input('category', sql.NVarChar(100), data.category)
        .input('province', sql.NVarChar(100), data.province)
        .input('location', sql.NVarChar(200), data.location)
        .input('description', sql.NVarChar(sql.MAX), data.description)
        .input('requiredCapital', sql.Decimal(19, 0), data.requiredCapital)
        .input('productName', sql.NVarChar(200), data.productName)
        .input('currentCapacity', sql.NVarChar(200), data.currentCapacity)
        .input('targetCapacity', sql.NVarChar(200), data.targetCapacity)
        .input('investmentPurpose', sql.NVarChar(2000), data.investmentPurpose)
        .input('executionMonths', sql.Int, data.executionMonths)
        .input('equipmentAmount', sql.Decimal(19, 0), data.equipmentAmount)
        .input('workingCapitalAmount', sql.Decimal(19, 0), data.workingCapitalAmount)
        .input('otherCostsAmount', sql.Decimal(19, 0), data.otherCostsAmount)
        .query<WorkshopRow>(`
          INSERT INTO dbo.Workshop (ownerId, title, category, province, location, description, requiredCapital, productName, currentCapacity, targetCapacity, investmentPurpose, executionMonths, equipmentAmount, workingCapitalAmount, otherCostsAmount)
          OUTPUT INSERTED.id, INSERTED.ownerId, INSERTED.title, INSERTED.category, INSERTED.province,
            INSERTED.location, INSERTED.description, INSERTED.requiredCapital, INSERTED.status,
            INSERTED.productName, INSERTED.currentCapacity, INSERTED.targetCapacity, INSERTED.investmentPurpose,
            INSERTED.executionMonths, INSERTED.equipmentAmount, INSERTED.workingCapitalAmount, INSERTED.otherCostsAmount,
            INSERTED.reviewNote, INSERTED.reviewedAt, INSERTED.createdAt, INSERTED.updatedAt
          VALUES (@ownerId, @title, @category, @province, @location, @description, @requiredCapital, @productName, @currentCapacity, @targetCapacity, @investmentPurpose, @executionMonths, @equipmentAmount, @workingCapitalAmount, @otherCostsAmount)
        `);
      const row = result.recordset[0];
      return workshopRecord(row);
      });
    },
    findPublished: async () => {
      const result = await this.pool.request().query<WorkshopRow>(`
        SELECT id, ownerId, title, category, province, location, description, requiredCapital, productName, currentCapacity, targetCapacity, investmentPurpose, executionMonths, equipmentAmount, workingCapitalAmount, otherCostsAmount, status, reviewNote, reviewedAt, createdAt, updatedAt
        FROM dbo.Workshop WHERE status = N'published' ORDER BY createdAt DESC
      `);
      return result.recordset.map(workshopRecord);
    },
    findByOwner: async (ownerId: number) => {
      const result = await this.pool.request().input('ownerId', sql.Int, ownerId).query<WorkshopRow>(`
        SELECT id, ownerId, title, category, province, location, description, requiredCapital, productName, currentCapacity, targetCapacity, investmentPurpose, executionMonths, equipmentAmount, workingCapitalAmount, otherCostsAmount, status, reviewNote, reviewedAt, createdAt, updatedAt
        FROM dbo.Workshop WHERE ownerId = @ownerId ORDER BY updatedAt DESC
      `);
      return result.recordset.map(workshopRecord);
    },
    findPendingReview: async () => {
      const result = await this.pool.request().query<WorkshopRow>(`
        SELECT id, ownerId, title, category, province, location, description, requiredCapital, productName, currentCapacity, targetCapacity, investmentPurpose, executionMonths, equipmentAmount, workingCapitalAmount, otherCostsAmount,
          status, reviewNote, reviewedAt, createdAt, updatedAt
        FROM dbo.Workshop WHERE status = N'submitted' ORDER BY updatedAt ASC
      `);
      return result.recordset.map(workshopRecord);
    },
    findOwned: async (id: number, ownerId: number) => {
      const result = await this.pool.request().input('id', sql.Int, id).input('ownerId', sql.Int, ownerId).query<WorkshopRow>(`
        SELECT id, ownerId, title, category, province, location, description, requiredCapital, productName, currentCapacity, targetCapacity, investmentPurpose, executionMonths, equipmentAmount, workingCapitalAmount, otherCostsAmount, status, reviewNote, reviewedAt, createdAt, updatedAt
        FROM dbo.Workshop WHERE id = @id AND ownerId = @ownerId
      `);
      return result.recordset[0] ? workshopRecord(result.recordset[0]) : null;
    },
    findPublishedById: async (id: number) => {
      const result = await this.pool.request().input('id', sql.Int, id).query<WorkshopRow>(`
        SELECT id, ownerId, title, category, province, location, description, requiredCapital, productName, currentCapacity, targetCapacity, investmentPurpose, executionMonths, equipmentAmount, workingCapitalAmount, otherCostsAmount, status, reviewNote, reviewedAt, createdAt, updatedAt
        FROM dbo.Workshop WHERE id = @id AND status = N'published'
      `);
      return result.recordset[0] ? workshopRecord(result.recordset[0]) : null;
    },
    updateOwned: async ({ id, ownerId, data }: { id: number; ownerId: number; data: { title: string; category: string; province: string; location: string; description: string; requiredCapital: number; productName: string; currentCapacity: string; targetCapacity: string; investmentPurpose: string; executionMonths: number; equipmentAmount: number; workingCapitalAmount: number; otherCostsAmount: number } }) => {
      return this.withReviewEvent({ workshopId: id, actorId: ownerId, action: 'updated' }, async (transaction) => {
      const result = await new sql.Request(transaction)
        .input('id', sql.Int, id).input('ownerId', sql.Int, ownerId)
        .input('title', sql.NVarChar(200), data.title)
        .input('category', sql.NVarChar(100), data.category)
        .input('province', sql.NVarChar(100), data.province)
        .input('location', sql.NVarChar(200), data.location)
        .input('description', sql.NVarChar(sql.MAX), data.description)
        .input('requiredCapital', sql.Decimal(19, 0), data.requiredCapital)
        .input('productName', sql.NVarChar(200), data.productName)
        .input('currentCapacity', sql.NVarChar(200), data.currentCapacity)
        .input('targetCapacity', sql.NVarChar(200), data.targetCapacity)
        .input('investmentPurpose', sql.NVarChar(2000), data.investmentPurpose)
        .input('executionMonths', sql.Int, data.executionMonths)
        .input('equipmentAmount', sql.Decimal(19, 0), data.equipmentAmount)
        .input('workingCapitalAmount', sql.Decimal(19, 0), data.workingCapitalAmount)
        .input('otherCostsAmount', sql.Decimal(19, 0), data.otherCostsAmount)
        .query<WorkshopRow>(`
          UPDATE dbo.Workshop SET title=@title, category=@category, province=@province, location=@location,
            description=@description, requiredCapital=@requiredCapital, productName=@productName,
            currentCapacity=@currentCapacity, targetCapacity=@targetCapacity, investmentPurpose=@investmentPurpose,
            executionMonths=@executionMonths, equipmentAmount=@equipmentAmount,
            workingCapitalAmount=@workingCapitalAmount, otherCostsAmount=@otherCostsAmount, updatedAt=SYSUTCDATETIME()
          OUTPUT INSERTED.id, INSERTED.ownerId, INSERTED.title, INSERTED.category, INSERTED.province,
            INSERTED.location, INSERTED.description, INSERTED.requiredCapital, INSERTED.status,
            INSERTED.productName, INSERTED.currentCapacity, INSERTED.targetCapacity, INSERTED.investmentPurpose,
            INSERTED.executionMonths, INSERTED.equipmentAmount, INSERTED.workingCapitalAmount, INSERTED.otherCostsAmount,
            INSERTED.reviewNote, INSERTED.reviewedAt,
            INSERTED.createdAt, INSERTED.updatedAt
          WHERE id=@id AND ownerId=@ownerId AND status IN (N'draft', N'revision')
        `);
      const row = result.recordset[0];
      return row ? workshopRecord(row) : null;
      });
    },
    publish: async (id: number, actorId: number) => {
      return this.withReviewEvent({ workshopId: id, actorId, action: 'published' }, async (transaction) => {
      const result = await new sql.Request(transaction).input('id', sql.Int, id).query<WorkshopRow>(`
        UPDATE dbo.Workshop SET status=N'published', reviewNote=NULL, reviewedAt=SYSUTCDATETIME(), updatedAt=SYSUTCDATETIME()
        OUTPUT INSERTED.id, INSERTED.ownerId, INSERTED.title, INSERTED.category, INSERTED.province,
          INSERTED.location, INSERTED.description, INSERTED.requiredCapital, INSERTED.status,
          INSERTED.productName, INSERTED.currentCapacity, INSERTED.targetCapacity, INSERTED.investmentPurpose,
          INSERTED.executionMonths, INSERTED.equipmentAmount, INSERTED.workingCapitalAmount, INSERTED.otherCostsAmount,
          INSERTED.reviewNote, INSERTED.reviewedAt, INSERTED.createdAt, INSERTED.updatedAt
        WHERE id=@id AND status=N'submitted'
      `);
      const row = result.recordset[0];
      return row ? workshopRecord(row) : null;
      });
    },
    requestRevision: async (id: number, actorId: number, note: string) => {
      return this.withReviewEvent({ workshopId: id, actorId, action: 'revision_requested', note }, async (transaction) => {
      const result = await new sql.Request(transaction).input('id', sql.Int, id)
        .input('note', sql.NVarChar(1000), note).query<WorkshopRow>(`
          UPDATE dbo.Workshop SET status=N'revision', reviewNote=@note,
            reviewedAt=SYSUTCDATETIME(), updatedAt=SYSUTCDATETIME()
          OUTPUT INSERTED.id, INSERTED.ownerId, INSERTED.title, INSERTED.category, INSERTED.province,
            INSERTED.location, INSERTED.description, INSERTED.requiredCapital, INSERTED.status,
            INSERTED.productName, INSERTED.currentCapacity, INSERTED.targetCapacity, INSERTED.investmentPurpose,
            INSERTED.executionMonths, INSERTED.equipmentAmount, INSERTED.workingCapitalAmount, INSERTED.otherCostsAmount,
            INSERTED.reviewNote, INSERTED.reviewedAt, INSERTED.createdAt, INSERTED.updatedAt
          WHERE id=@id AND status=N'submitted'
        `);
      const row = result.recordset[0];
      return row ? workshopRecord(row) : null;
      });
    },
    submitForReview: async (id: number, ownerId: number) => {
      return this.withReviewEvent({ workshopId: id, actorId: ownerId, action: 'submitted' }, async (transaction) => {
      const result = await new sql.Request(transaction).input('id', sql.Int, id).input('ownerId', sql.Int, ownerId).query<WorkshopRow>(`
        UPDATE dbo.Workshop SET status=N'submitted', reviewNote=NULL, reviewedAt=NULL, updatedAt=SYSUTCDATETIME()
        OUTPUT INSERTED.id, INSERTED.ownerId, INSERTED.title, INSERTED.category, INSERTED.province,
          INSERTED.location, INSERTED.description, INSERTED.requiredCapital, INSERTED.status,
          INSERTED.productName, INSERTED.currentCapacity, INSERTED.targetCapacity, INSERTED.investmentPurpose,
          INSERTED.executionMonths, INSERTED.equipmentAmount, INSERTED.workingCapitalAmount, INSERTED.otherCostsAmount,
          INSERTED.reviewNote, INSERTED.reviewedAt, INSERTED.createdAt, INSERTED.updatedAt
        WHERE id=@id AND ownerId=@ownerId AND status IN (N'draft', N'revision')
      `);
      const row = result.recordset[0];
      return row ? workshopRecord(row) : null;
      });
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

  private async withReviewEvent<T>(event: { workshopId?: number; actorId: number; action: string; note?: string }, mutate: (transaction: sql.Transaction) => Promise<T | null>): Promise<T | null> {
    const transaction = new sql.Transaction(this.pool);
    await transaction.begin();
    try {
      const result = await mutate(transaction);
      if (result !== null) await new sql.Request(transaction)
      .input('workshopId', sql.Int, event.workshopId ?? (result as { id: number }).id)
      .input('actorId', sql.Int, event.actorId)
      .input('action', sql.NVarChar(30), event.action)
      .input('note', sql.NVarChar(1000), event.note ?? null)
      .query(`INSERT INTO dbo.WorkshopReviewEvent (workshopId, actorId, action, note) VALUES (@workshopId, @actorId, @action, @note)`);
      await transaction.commit();
      return result;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
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
      IF COL_LENGTH(N'dbo.Workshop', N'productName') IS NULL ALTER TABLE dbo.Workshop ADD productName NVARCHAR(200) NULL;
      IF COL_LENGTH(N'dbo.Workshop', N'currentCapacity') IS NULL ALTER TABLE dbo.Workshop ADD currentCapacity NVARCHAR(200) NULL;
      IF COL_LENGTH(N'dbo.Workshop', N'targetCapacity') IS NULL ALTER TABLE dbo.Workshop ADD targetCapacity NVARCHAR(200) NULL;
      IF COL_LENGTH(N'dbo.Workshop', N'investmentPurpose') IS NULL ALTER TABLE dbo.Workshop ADD investmentPurpose NVARCHAR(2000) NULL;
      IF COL_LENGTH(N'dbo.Workshop', N'executionMonths') IS NULL ALTER TABLE dbo.Workshop ADD executionMonths INT NULL;
      IF COL_LENGTH(N'dbo.Workshop', N'equipmentAmount') IS NULL ALTER TABLE dbo.Workshop ADD equipmentAmount DECIMAL(19,0) NULL;
      IF COL_LENGTH(N'dbo.Workshop', N'workingCapitalAmount') IS NULL ALTER TABLE dbo.Workshop ADD workingCapitalAmount DECIMAL(19,0) NULL;
      IF COL_LENGTH(N'dbo.Workshop', N'otherCostsAmount') IS NULL ALTER TABLE dbo.Workshop ADD otherCostsAmount DECIMAL(19,0) NULL;
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
      IF OBJECT_ID(N'dbo.WorkshopInterest', N'U') IS NULL
      BEGIN
        CREATE TABLE dbo.WorkshopInterest (
          workshopId INT NOT NULL,
          userId INT NOT NULL,
          createdAt DATETIME2 NOT NULL CONSTRAINT DF_WorkshopInterest_createdAt DEFAULT SYSUTCDATETIME(),
          CONSTRAINT PK_WorkshopInterest PRIMARY KEY(workshopId,userId),
          CONSTRAINT FK_WorkshopInterest_Workshop FOREIGN KEY(workshopId) REFERENCES dbo.Workshop(id),
          CONSTRAINT FK_WorkshopInterest_User FOREIGN KEY(userId) REFERENCES dbo.[User](id)
        );
        CREATE INDEX IX_WorkshopInterest_userId_createdAt ON dbo.WorkshopInterest(userId,createdAt DESC);
      END;
      IF OBJECT_ID(N'dbo.WorkshopInquiry', N'U') IS NULL
      BEGIN
        CREATE TABLE dbo.WorkshopInquiry (
          id INT IDENTITY(1,1) PRIMARY KEY,
          workshopId INT NOT NULL,
          investorId INT NOT NULL,
          message NVARCHAR(1500) NOT NULL,
          consentAt DATETIME2 NOT NULL,
          status NVARCHAR(20) NOT NULL CONSTRAINT DF_WorkshopInquiry_status DEFAULT N'open',
          createdAt DATETIME2 NOT NULL CONSTRAINT DF_WorkshopInquiry_createdAt DEFAULT SYSUTCDATETIME(),
          updatedAt DATETIME2 NOT NULL CONSTRAINT DF_WorkshopInquiry_updatedAt DEFAULT SYSUTCDATETIME(),
          CONSTRAINT UQ_WorkshopInquiry_investor_workshop UNIQUE(investorId,workshopId),
          CONSTRAINT FK_WorkshopInquiry_Workshop FOREIGN KEY(workshopId) REFERENCES dbo.Workshop(id),
          CONSTRAINT FK_WorkshopInquiry_Investor FOREIGN KEY(investorId) REFERENCES dbo.[User](id),
          CONSTRAINT CK_WorkshopInquiry_status CHECK(status IN (N'open',N'contacted',N'closed'))
        );
        CREATE INDEX IX_WorkshopInquiry_workshop_createdAt ON dbo.WorkshopInquiry(workshopId,createdAt DESC);
        CREATE INDEX IX_WorkshopInquiry_investor_createdAt ON dbo.WorkshopInquiry(investorId,createdAt DESC);
      END;
      IF OBJECT_ID(N'dbo.WorkshopReport', N'U') IS NULL
      BEGIN
        CREATE TABLE dbo.WorkshopReport (
          id INT IDENTITY(1,1) PRIMARY KEY,
          workshopId INT NOT NULL,
          ownerId INT NOT NULL,
          year INT NOT NULL,
          month INT NOT NULL,
          quantityUnit NVARCHAR(50) NOT NULL,
          productionQuantity DECIMAL(19,0) NOT NULL,
          soldQuantity DECIMAL(19,0) NOT NULL,
          salesAmount DECIMAL(19,0) NOT NULL,
          operatingCosts DECIMAL(19,0) NOT NULL,
          sourceNote NVARCHAR(2000) NOT NULL,
          reviewStatus NVARCHAR(20) NOT NULL CONSTRAINT DF_WorkshopReport_reviewStatus DEFAULT N'pending',
          checkedBy INT NULL,
          checkedAt DATETIME2 NULL,
          createdAt DATETIME2 NOT NULL CONSTRAINT DF_WorkshopReport_createdAt DEFAULT SYSUTCDATETIME(),
          CONSTRAINT UQ_WorkshopReport_period UNIQUE(workshopId,year,month),
          CONSTRAINT FK_WorkshopReport_Workshop FOREIGN KEY(workshopId) REFERENCES dbo.Workshop(id),
          CONSTRAINT FK_WorkshopReport_Owner FOREIGN KEY(ownerId) REFERENCES dbo.[User](id),
          CONSTRAINT FK_WorkshopReport_Checker FOREIGN KEY(checkedBy) REFERENCES dbo.[User](id),
          CONSTRAINT CK_WorkshopReport_month CHECK(month BETWEEN 1 AND 12),
          CONSTRAINT CK_WorkshopReport_quantities CHECK(productionQuantity >= 0 AND soldQuantity >= 0),
          CONSTRAINT CK_WorkshopReport_amounts CHECK(salesAmount >= 0 AND operatingCosts >= 0),
          CONSTRAINT CK_WorkshopReport_status CHECK(reviewStatus IN (N'pending',N'checked'))
        );
        CREATE INDEX IX_WorkshopReport_status_createdAt ON dbo.WorkshopReport(reviewStatus,createdAt);
      END;
      IF OBJECT_ID(N'dbo.WorkshopReportRevision', N'U') IS NULL
      BEGIN
        CREATE TABLE dbo.WorkshopReportRevision (
          id BIGINT IDENTITY(1,1) PRIMARY KEY,
          reportId INT NOT NULL,
          changedBy INT NOT NULL,
          year INT NOT NULL,
          month INT NOT NULL,
          quantityUnit NVARCHAR(50) NOT NULL,
          productionQuantity DECIMAL(19,0) NOT NULL,
          soldQuantity DECIMAL(19,0) NOT NULL,
          salesAmount DECIMAL(19,0) NOT NULL,
          operatingCosts DECIMAL(19,0) NOT NULL,
          sourceNote NVARCHAR(2000) NOT NULL,
          reviewStatus NVARCHAR(20) NOT NULL,
          priorCheckedBy INT NULL,
          priorCheckedAt DATETIME2 NULL,
          originalCreatedAt DATETIME2 NOT NULL,
          createdAt DATETIME2 NOT NULL CONSTRAINT DF_WorkshopReportRevision_createdAt DEFAULT SYSUTCDATETIME(),
          CONSTRAINT FK_WorkshopReportRevision_Report FOREIGN KEY(reportId) REFERENCES dbo.WorkshopReport(id),
          CONSTRAINT FK_WorkshopReportRevision_User FOREIGN KEY(changedBy) REFERENCES dbo.[User](id),
          CONSTRAINT FK_WorkshopReportRevision_Checker FOREIGN KEY(priorCheckedBy) REFERENCES dbo.[User](id)
        );
        CREATE INDEX IX_WorkshopReportRevision_reportId_createdAt ON dbo.WorkshopReportRevision(reportId,createdAt DESC);
      END;
      IF COL_LENGTH(N'dbo.WorkshopReportRevision', N'priorCheckedBy') IS NULL ALTER TABLE dbo.WorkshopReportRevision ADD priorCheckedBy INT NULL;
      IF COL_LENGTH(N'dbo.WorkshopReportRevision', N'priorCheckedAt') IS NULL ALTER TABLE dbo.WorkshopReportRevision ADD priorCheckedAt DATETIME2 NULL;
      IF COL_LENGTH(N'dbo.WorkshopReport', N'quantityUnit') IS NULL
        ALTER TABLE dbo.WorkshopReport ADD quantityUnit NVARCHAR(50) NOT NULL CONSTRAINT DF_WorkshopReport_quantityUnit DEFAULT N'unit';
      IF OBJECT_ID(N'dbo.WorkshopDocument', N'U') IS NULL
      BEGIN
        CREATE TABLE dbo.WorkshopDocument (
          id INT IDENTITY(1,1) PRIMARY KEY,
          workshopId INT NOT NULL,
          ownerId INT NOT NULL,
          category NVARCHAR(50) NOT NULL,
          originalName NVARCHAR(255) NOT NULL,
          mediaType NVARCHAR(100) NOT NULL,
          byteSize INT NOT NULL,
          fileKey NVARCHAR(36) NOT NULL UNIQUE,
          reviewStatus NVARCHAR(20) NOT NULL CONSTRAINT DF_WorkshopDocument_reviewStatus DEFAULT N'pending',
          reviewNote NVARCHAR(1000) NULL,
          checkedBy INT NULL,
          checkedAt DATETIME2 NULL,
          createdAt DATETIME2 NOT NULL CONSTRAINT DF_WorkshopDocument_createdAt DEFAULT SYSUTCDATETIME(),
          CONSTRAINT FK_WorkshopDocument_Workshop FOREIGN KEY(workshopId) REFERENCES dbo.Workshop(id),
          CONSTRAINT FK_WorkshopDocument_Owner FOREIGN KEY(ownerId) REFERENCES dbo.[User](id),
          CONSTRAINT FK_WorkshopDocument_Checker FOREIGN KEY(checkedBy) REFERENCES dbo.[User](id),
          CONSTRAINT CK_WorkshopDocument_size CHECK(byteSize BETWEEN 1 AND 10485760),
          CONSTRAINT CK_WorkshopDocument_status CHECK(reviewStatus IN (N'pending',N'accepted',N'revision'))
        );
        CREATE INDEX IX_WorkshopDocument_reviewStatus_createdAt ON dbo.WorkshopDocument(reviewStatus,createdAt);
        CREATE INDEX IX_WorkshopDocument_ownerId_workshopId ON dbo.WorkshopDocument(ownerId,workshopId);
      END;
    `);
  }

  async onModuleDestroy() {
    await this.pool.close();
  }
}
