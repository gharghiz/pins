// Database models using PostgreSQL
// In production, use an ORM like Prisma or TypeORM

export class Pin {
  constructor(db) {
    this.db = db;
  }

  async create(data) {
    const query = `
      INSERT INTO pins (user_id, title, description, tags, image_url, board_id, status, seo_score, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      RETURNING *
    `;
    const values = [
      data.userId,
      data.title,
      data.description,
      data.tags,
      data.imageUrl,
      data.boardId,
      data.status || 'pending',
      data.seoScore || 0
    ];
    return await this.db.query(query, values);
  }

  async findById(id) {
    return await this.db.query('SELECT * FROM pins WHERE id = $1', [id]);
  }

  async findAll(userId, limit = 50, offset = 0) {
    return await this.db.query(
      'SELECT * FROM pins WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [userId, limit, offset]
    );
  }

  async update(id, data) {
    const fields = Object.keys(data).filter(k => k !== 'id');
    const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
    const query = `UPDATE pins SET ${setClause}, updated_at = NOW() WHERE id = $${fields.length + 1} RETURNING *`;
    const values = [...Object.values(data), id];
    return await this.db.query(query, values);
  }

  async delete(id) {
    return await this.db.query('DELETE FROM pins WHERE id = $1', [id]);
  }
}

export class Job {
  constructor(db) {
    this.db = db;
  }

  async create(data) {
    const query = `
      INSERT INTO jobs (user_id, type, status, progress, result, error, scheduled_at, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      RETURNING *
    `;
    const values = [
      data.userId,
      data.type,
      data.status || 'pending',
      data.progress || 0,
      data.result || null,
      data.error || null,
      data.scheduledAt || null
    ];
    return await this.db.query(query, values);
  }

  async findById(id) {
    return await this.db.query('SELECT * FROM jobs WHERE id = $1', [id]);
  }

  async findAll(userId, limit = 20, offset = 0) {
    return await this.db.query(
      'SELECT * FROM jobs WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [userId, limit, offset]
    );
  }

  async update(id, data) {
    const fields = Object.keys(data).filter(k => k !== 'id');
    const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
    const query = `UPDATE jobs SET ${setClause}, updated_at = NOW() WHERE id = $${fields.length + 1} RETURNING *`;
    const values = [...Object.values(data), id];
    return await this.db.query(query, values);
  }
}

export class Board {
  constructor(db) {
    this.db = db;
  }

  async findAll(userId) {
    return await this.db.query('SELECT * FROM boards WHERE user_id = $1', [userId]);
  }

  async findByPinterestId(userId, pinterestId) {
    return await this.db.query('SELECT * FROM boards WHERE user_id = $1 AND pinterest_id = $2', [userId, pinterestId]);
  }
}

export class Analytics {
  constructor(db) {
    this.db = db;
  }

  async getStats(userId) {
    const result = await this.db.query(`
      SELECT 
        COUNT(*) as total_pins,
        COUNT(CASE WHEN status = 'published' THEN 1 END) as published,
        COUNT(CASE WHEN status = 'error' THEN 1 END) as errors,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '24 hours' THEN 1 END) as today_activity
      FROM pins WHERE user_id = $1
    `, [userId]);
    return result.rows[0];
  }

  async getTopTags(userId) {
    return await this.db.query(`
      SELECT unnest(tags) as tag, COUNT(*) as count
      FROM pins WHERE user_id = $1
      GROUP BY tag
      ORDER BY count DESC
      LIMIT 10
    `, [userId]);
  }
}