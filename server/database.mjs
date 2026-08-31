let pool;
let initialization;

export function isDatabaseConfigured() {
  return Boolean(process.env.MYSQL_HOST && process.env.MYSQL_DATABASE && process.env.MYSQL_USER);
}

export async function getDatabase() {
  if (!isDatabaseConfigured()) return null;
  if (!initialization) {
    initialization = (async () => {
      const { default: mysql } = await import("mysql2/promise");
      pool = mysql.createPool({
        host: process.env.MYSQL_HOST,
        port: Number(process.env.MYSQL_PORT || 3306),
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD || "",
        database: process.env.MYSQL_DATABASE,
        waitForConnections: true,
        connectionLimit: Number(process.env.MYSQL_CONNECTION_LIMIT || 5),
        charset: "utf8mb4"
      });
      await migrateDatabase(pool);
      return pool;
    })().catch((error) => {
      initialization = undefined;
      pool = undefined;
      throw error;
    });
  }
  return initialization;
}

export async function closeDatabase() {
  if (pool) await pool.end();
  pool = undefined;
  initialization = undefined;
}

async function migrateDatabase(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS prompt_collections (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      name VARCHAR(120) NOT NULL,
      description TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_prompt_collections_updated (updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await connection.query(`
    CREATE TABLE IF NOT EXISTS prompts (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      collection_id BIGINT UNSIGNED NULL,
      title VARCHAR(160) NOT NULL,
      category VARCHAR(80) NOT NULL DEFAULT '未分类',
      content TEXT NOT NULL,
      negative_prompt TEXT NULL,
      tags JSON NULL,
      favorite TINYINT(1) NOT NULL DEFAULT 0,
      source ENUM('manual','ai','hotlist') NOT NULL DEFAULT 'manual',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_prompts_collection (collection_id),
      INDEX idx_prompts_category (category),
      INDEX idx_prompts_favorite (favorite),
      CONSTRAINT fk_prompts_collection FOREIGN KEY (collection_id) REFERENCES prompt_collections(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await connection.query(`
    CREATE TABLE IF NOT EXISTS series (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      name VARCHAR(120) NOT NULL,
      description TEXT NULL,
      global_prompt TEXT NULL,
      style_prompt TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_series_updated (updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await connection.query(`
    CREATE TABLE IF NOT EXISTS series_nodes (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      series_id BIGINT UNSIGNED NOT NULL,
      node_order INT UNSIGNED NOT NULL,
      title VARCHAR(160) NOT NULL,
      story_text TEXT NULL,
      prompt TEXT NULL,
      status ENUM('draft','generating','completed','failed') NOT NULL DEFAULT 'draft',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_series_node_order (series_id, node_order),
      INDEX idx_nodes_series (series_id, node_order),
      CONSTRAINT fk_nodes_series FOREIGN KEY (series_id) REFERENCES series(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await connection.query(`
    CREATE TABLE IF NOT EXISTS poetry_projects (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      series_id BIGINT UNSIGNED NOT NULL,
      title VARCHAR(120) NOT NULL,
      poem_text TEXT NOT NULL,
      scene_count INT UNSIGNED NOT NULL DEFAULT 6,
      image_size VARCHAR(30) NOT NULL DEFAULT '1024x1024',
      prompt_supplement TEXT NULL,
      analysis_json JSON NULL,
      style_guide TEXT NULL,
      scenes_json JSON NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_poetry_projects_series (series_id),
      INDEX idx_poetry_projects_updated (updated_at),
      CONSTRAINT fk_poetry_projects_series FOREIGN KEY (series_id) REFERENCES series(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await connection.query(`
    CREATE TABLE IF NOT EXISTS image_records (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      prompt_id BIGINT UNSIGNED NULL,
      series_id BIGINT UNSIGNED NULL,
      node_id BIGINT UNSIGNED NULL,
      title VARCHAR(160) NULL,
      file_name VARCHAR(180) NOT NULL,
      relative_path VARCHAR(420) NOT NULL,
      file_path VARCHAR(900) NOT NULL,
      public_url VARCHAR(900) NOT NULL,
      prompt_snapshot TEXT NOT NULL,
      model VARCHAR(120) NOT NULL,
      size VARCHAR(30) NOT NULL,
      operation ENUM('generate','edit') NOT NULL,
      provider_request_id VARCHAR(180) NULL,
      status ENUM('completed','failed') NOT NULL DEFAULT 'completed',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_images_created (created_at),
      INDEX idx_images_series_node (series_id, node_id),
      CONSTRAINT fk_images_prompt FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE SET NULL,
      CONSTRAINT fk_images_series FOREIGN KEY (series_id) REFERENCES series(id) ON DELETE SET NULL,
      CONSTRAINT fk_images_node FOREIGN KEY (node_id) REFERENCES series_nodes(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await connection.query(`
    CREATE TABLE IF NOT EXISTS image_version_groups (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      series_id BIGINT UNSIGNED NULL,
      node_id BIGINT UNSIGNED NULL,
      title VARCHAR(160) NULL,
      current_delivery_version_id BIGINT UNSIGNED NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_version_groups_series_node (series_id, node_id),
      INDEX idx_version_groups_updated (updated_at),
      CONSTRAINT fk_version_groups_series FOREIGN KEY (series_id) REFERENCES series(id) ON DELETE SET NULL,
      CONSTRAINT fk_version_groups_node FOREIGN KEY (node_id) REFERENCES series_nodes(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await connection.query(`
    CREATE TABLE IF NOT EXISTS image_versions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      group_id BIGINT UNSIGNED NOT NULL,
      parent_version_id BIGINT UNSIGNED NULL,
      image_record_id BIGINT UNSIGNED NOT NULL,
      version_number INT UNSIGNED NOT NULL,
      prompt_snapshot TEXT NOT NULL,
      operation ENUM('generate','edit') NOT NULL,
      is_delivery TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_image_version_number (group_id, version_number),
      INDEX idx_image_versions_group (group_id, created_at),
      CONSTRAINT fk_image_versions_group FOREIGN KEY (group_id) REFERENCES image_version_groups(id) ON DELETE CASCADE,
      CONSTRAINT fk_image_versions_parent FOREIGN KEY (parent_version_id) REFERENCES image_versions(id) ON DELETE SET NULL,
      CONSTRAINT fk_image_versions_record FOREIGN KEY (image_record_id) REFERENCES image_records(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  const [legacyPoetrySeries] = await connection.query(`
    SELECT s.id, s.name, s.global_prompt, s.style_prompt
    FROM series s
    LEFT JOIN poetry_projects p ON p.series_id = s.id
    WHERE s.description = '诗词意境创作合集' AND p.id IS NULL
  `);
  for (const series of legacyPoetrySeries) {
    const [nodes] = await connection.query("SELECT node_order, title, story_text, prompt FROM series_nodes WHERE series_id=? ORDER BY node_order", [series.id]);
    const sourceLines = nodes.map((node) => String(node.story_text || "").trim()).filter(Boolean);
    const poemText = [series.name, ...sourceLines].join("\n");
    const scenes = nodes.map((node) => ({
      sceneOrder: Number(node.node_order),
      title: node.title,
      sourceLine: node.story_text || "",
      mood: "",
      prompt: node.prompt || ""
    }));
    await connection.query(
      "INSERT INTO poetry_projects (series_id, title, poem_text, scene_count, image_size, prompt_supplement, style_guide, scenes_json) VALUES (?, ?, ?, ?, '1024x1024', ?, ?, ?)",
      [series.id, series.name, poemText, Math.min(8, Math.max(3, scenes.length || 6)), series.global_prompt || null, series.style_prompt || null, JSON.stringify(scenes)]
    );
  }
}

function toPrompt(row) {
  return {
    id: row.id,
    collectionId: row.collection_id,
    title: row.title,
    category: row.category,
    content: row.content,
    negativePrompt: row.negative_prompt,
    tags: typeof row.tags === "string" ? JSON.parse(row.tags || "[]") : row.tags || [],
    favorite: Boolean(row.favorite),
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function listPrompts({ search = "", favorite } = {}) {
  const database = await getDatabase();
  if (!database) return [];
  const values = [];
  const clauses = [];
  if (search.trim()) {
    clauses.push("(title LIKE ? OR content LIKE ? OR category LIKE ?)");
    const value = "%" + search.trim() + "%";
    values.push(value, value, value);
  }
  if (favorite === true) clauses.push("favorite = 1");
  const [rows] = await database.query(
    "SELECT * FROM prompts " + (clauses.length ? "WHERE " + clauses.join(" AND ") : "") + " ORDER BY updated_at DESC, id DESC",
    values
  );
  return rows.map(toPrompt);
}

export async function upsertPrompt(input, id = null) {
  const database = await getDatabase();
  if (!database) throw new Error("未配置 MySQL，无法保存提示词。");
  const values = [
    String(input.title || "").trim(),
    String(input.category || "未分类").trim(),
    String(input.content || "").trim(),
    input.negativePrompt ? String(input.negativePrompt).trim() : null,
    JSON.stringify(Array.isArray(input.tags) ? input.tags : []),
    input.favorite ? 1 : 0,
    input.source === "ai" || input.source === "hotlist" ? input.source : "manual",
    input.collectionId || null
  ];
  if (id) {
    await database.query(
      "UPDATE prompts SET title=?, category=?, content=?, negative_prompt=?, tags=?, favorite=?, source=?, collection_id=? WHERE id=?",
      [...values, id]
    );
    const [rows] = await database.query("SELECT * FROM prompts WHERE id=?", [id]);
    return rows[0] ? toPrompt(rows[0]) : null;
  }
  const [result] = await database.query(
    "INSERT INTO prompts (title, category, content, negative_prompt, tags, favorite, source, collection_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    values
  );
  const [rows] = await database.query("SELECT * FROM prompts WHERE id=?", [result.insertId]);
  return toPrompt(rows[0]);
}

export async function deletePrompt(id) {
  const database = await getDatabase();
  if (!database) throw new Error("未配置 MySQL，无法删除提示词。");
  await database.query("DELETE FROM prompts WHERE id=?", [id]);
}

export async function saveGeneratedImage(record) {
  const database = await getDatabase();
  if (!database) return null;
  const [result] = await database.query(
    "INSERT INTO image_records (prompt_id, series_id, node_id, title, file_name, relative_path, file_path, public_url, prompt_snapshot, model, size, operation, provider_request_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed')",
    [
      record.promptId || null,
      record.seriesId || null,
      record.nodeId || null,
      record.title || null,
      record.fileName,
      record.relativePath,
      record.filePath,
      record.publicUrl,
      record.prompt,
      record.model || "gpt-image-2",
      record.size,
      record.operation || "generate",
      record.providerRequestId || null
    ]
  );
  return Number(result.insertId);
}

export async function saveImageVersion(input) {
  const database = await getDatabase();
  if (!database || !Number.isInteger(Number(input.imageRecordId))) return null;
  const connection = await database.getConnection();
  try {
    await connection.beginTransaction();
    let groupId = Number.isInteger(Number(input.versionGroupId)) ? Number(input.versionGroupId) : null;
    let parentVersionId = Number.isInteger(Number(input.parentVersionId)) ? Number(input.parentVersionId) : null;
    let versionNumber = 1;

    if (groupId) {
      const [groups] = await connection.query("SELECT id FROM image_version_groups WHERE id=? FOR UPDATE", [groupId]);
      if (!groups[0]) groupId = null;
    }
    if (!groupId) {
      const [groupResult] = await connection.query(
        "INSERT INTO image_version_groups (series_id, node_id, title) VALUES (?, ?, ?)",
        [input.seriesId || null, input.nodeId || null, input.title || null]
      );
      groupId = Number(groupResult.insertId);

      const sourceImageRecordId = Number.isInteger(Number(input.sourceImageRecordId)) ? Number(input.sourceImageRecordId) : null;
      if (sourceImageRecordId && sourceImageRecordId !== Number(input.imageRecordId)) {
        const [sourceRows] = await connection.query(
          "SELECT id, prompt_snapshot, operation FROM image_records WHERE id=?",
          [sourceImageRecordId]
        );
        if (sourceRows[0]) {
          const [sourceVersionResult] = await connection.query(
            "INSERT INTO image_versions (group_id, image_record_id, version_number, prompt_snapshot, operation) VALUES (?, ?, 1, ?, ?)",
            [groupId, sourceRows[0].id, sourceRows[0].prompt_snapshot, sourceRows[0].operation]
          );
          parentVersionId = sourceVersionResult.insertId;
          versionNumber = 2;
        }
      }
    } else {
      const [maxRows] = await connection.query(
        "SELECT COALESCE(MAX(version_number), 0) AS max_version FROM image_versions WHERE group_id=?",
        [groupId]
      );
      versionNumber = Number(maxRows[0]?.max_version || 0) + 1;
    }

    if (parentVersionId) {
      const [parents] = await connection.query("SELECT id FROM image_versions WHERE id=? AND group_id=?", [parentVersionId, groupId]);
      if (!parents[0]) parentVersionId = null;
    }
    const [versionResult] = await connection.query(
      "INSERT INTO image_versions (group_id, parent_version_id, image_record_id, version_number, prompt_snapshot, operation) VALUES (?, ?, ?, ?, ?, ?)",
      [groupId, parentVersionId, input.imageRecordId, versionNumber, input.prompt || "", input.operation === "edit" ? "edit" : "generate"]
    );
    await connection.query("UPDATE image_version_groups SET updated_at=CURRENT_TIMESTAMP WHERE id=?", [groupId]);
    await connection.commit();
    return { versionId: Number(versionResult.insertId), versionGroupId: groupId, parentVersionId, versionNumber, isDelivery: false };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function markImageVersionDelivered(versionId) {
  const database = await getDatabase();
  if (!database) throw new Error("未配置 MySQL，无法设置交付版本。");
  const connection = await database.getConnection();
  try {
    await connection.beginTransaction();
    const [versions] = await connection.query("SELECT id, group_id FROM image_versions WHERE id=? FOR UPDATE", [Number(versionId)]);
    if (!versions[0]) throw new Error("版本不存在。");
    const groupId = Number(versions[0].group_id);
    await connection.query("UPDATE image_versions SET is_delivery=0 WHERE group_id=?", [groupId]);
    await connection.query("UPDATE image_versions SET is_delivery=1 WHERE id=?", [Number(versionId)]);
    await connection.query("UPDATE image_version_groups SET current_delivery_version_id=?, updated_at=CURRENT_TIMESTAMP WHERE id=?", [Number(versionId), groupId]);
    await connection.commit();
    return { versionId: Number(versionId), versionGroupId: groupId, isDelivery: true };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function listGeneratedImages(limit = 60) {
  const database = await getDatabase();
  if (!database) return [];
  const safeLimit = Math.max(1, Math.min(Number(limit) || 60, 200));
  const [rows] = await database.query(
    "SELECT i.id, i.title, i.file_name, i.relative_path, i.public_url, i.prompt_snapshot, i.operation, i.created_at, i.series_id, s.name AS series_name, i.node_id, n.title AS node_title, n.node_order, v.id AS version_id, v.group_id AS version_group_id, v.version_number, v.parent_version_id, v.is_delivery FROM image_records i LEFT JOIN series s ON s.id = i.series_id LEFT JOIN series_nodes n ON n.id = i.node_id LEFT JOIN image_versions v ON v.image_record_id = i.id LEFT JOIN image_version_groups g ON g.id = v.group_id WHERE i.status='completed' ORDER BY i.created_at DESC, i.id DESC LIMIT " + safeLimit
  );
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    fileName: row.file_name,
    relativePath: row.relative_path,
    image: row.public_url,
    prompt: row.prompt_snapshot,
    kind: row.operation,
    seriesId: row.series_id,
    seriesName: row.series_name,
    nodeId: row.node_id,
    nodeTitle: row.node_title,
    nodeOrder: row.node_order,
    versionId: row.version_id,
    versionGroupId: row.version_group_id,
    versionNumber: row.version_number,
    parentVersionId: row.parent_version_id,
    isDelivery: Boolean(row.is_delivery),
    createdAt: row.created_at
  }));
}

export async function listSeries() {
  const database = await getDatabase();
  if (!database) return [];
  const [rows] = await database.query("SELECT * FROM series ORDER BY updated_at DESC, id DESC");
  return rows;
}

export async function createSeries(input) {
  const database = await getDatabase();
  if (!database) throw new Error("未配置 MySQL，无法保存系列。");
  const [result] = await database.query(
    "INSERT INTO series (name, description, global_prompt, style_prompt) VALUES (?, ?, ?, ?)",
    [String(input.name || "").trim(), input.description || null, input.globalPrompt || null, input.stylePrompt || null]
  );
  const [rows] = await database.query("SELECT * FROM series WHERE id=?", [result.insertId]);
  return rows[0];
}

export async function listSeriesNodes(seriesId) {
  const database = await getDatabase();
  if (!database) return [];
  const [rows] = await database.query("SELECT * FROM series_nodes WHERE series_id=? ORDER BY node_order", [seriesId]);
  return rows;
}

export async function createSeriesNode(seriesId, input) {
  const database = await getDatabase();
  if (!database) throw new Error("未配置 MySQL，无法保存故事节点。");
  const [result] = await database.query(
    "INSERT INTO series_nodes (series_id, node_order, title, story_text, prompt) VALUES (?, ?, ?, ?, ?)",
    [seriesId, Number(input.nodeOrder), String(input.title || "").trim(), input.storyText || null, input.prompt || null]
  );
  const [rows] = await database.query("SELECT * FROM series_nodes WHERE id=?", [result.insertId]);
  return rows[0];
}

export async function createStoryboardNodes(seriesId, nodes) {
  const database = await getDatabase();
  if (!database) throw new Error("未配置 MySQL，无法保存故事分镜。");
  const connection = await database.getConnection();
  try {
    await connection.beginTransaction();
    const [existing] = await connection.query("SELECT COUNT(*) AS count FROM series_nodes WHERE series_id=?", [seriesId]);
    if (Number(existing[0]?.count || 0) > 0) {
      throw new Error("该系列已有故事节点，请新建系列后再自动拆分。");
    }
    for (const node of nodes) {
      await connection.query(
        "INSERT INTO series_nodes (series_id, node_order, title, story_text, prompt) VALUES (?, ?, ?, ?, ?)",
        [seriesId, Number(node.nodeOrder), node.title, node.storyText, node.prompt]
      );
    }
    await connection.commit();
    const [rows] = await connection.query("SELECT * FROM series_nodes WHERE series_id=? ORDER BY node_order", [seriesId]);
    return rows;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function updateSeriesNodeStatus(nodeId, status) {
  const database = await getDatabase();
  if (!database || !Number.isInteger(Number(nodeId))) return;
  await database.query(
    "UPDATE series_nodes SET status=? WHERE id=?",
    [status === "completed" || status === "failed" || status === "generating" ? status : "draft", Number(nodeId)]
  );
}

function parseJsonColumn(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function toPoetryProject(row) {
  return {
    id: Number(row.id),
    seriesId: Number(row.series_id),
    title: row.title,
    poemText: row.poem_text,
    sceneCount: Number(row.scene_count) || 6,
    imageSize: row.image_size || "1024x1024",
    promptSupplement: row.prompt_supplement || "",
    analysis: parseJsonColumn(row.analysis_json, null),
    styleGuide: row.style_guide || "",
    scenes: parseJsonColumn(row.scenes_json, []),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function normalizePoetryProject(input) {
  const title = String(input.title || "").trim().slice(0, 120);
  const poemText = String(input.poemText || "").trim().slice(0, 12000);
  if (!title) throw new Error("诗词项目缺少标题。");
  if (!poemText) throw new Error("诗词项目缺少原文。");
  const sceneCount = Math.min(8, Math.max(3, Number(input.sceneCount) || 6));
  const imageSize = ["1024x1024", "1536x864", "864x1536"].includes(input.imageSize) ? input.imageSize : "1024x1024";
  const scenes = (Array.isArray(input.scenes) ? input.scenes : []).slice(0, 8).map((scene, index) => ({
    sceneOrder: Math.max(1, Number(scene?.sceneOrder) || index + 1),
    title: String(scene?.title || "画面 " + (index + 1)).trim().slice(0, 160),
    sourceLine: String(scene?.sourceLine || "").trim().slice(0, 500),
    mood: String(scene?.mood || "").trim().slice(0, 500),
    prompt: String(scene?.prompt || "").trim().slice(0, 12000)
  }));
  return {
    title,
    poemText,
    sceneCount,
    imageSize,
    promptSupplement: String(input.promptSupplement || "").trim().slice(0, 4000),
    analysis: input.analysis && typeof input.analysis === "object" && !Array.isArray(input.analysis) ? input.analysis : null,
    styleGuide: String(input.styleGuide || "").trim().slice(0, 4000),
    scenes
  };
}

async function readPoetryProject(database, id) {
  const [rows] = await database.query("SELECT * FROM poetry_projects WHERE id=?", [id]);
  return rows[0] ? toPoetryProject(rows[0]) : null;
}

export async function listPoetryProjects() {
  const database = await getDatabase();
  if (!database) return [];
  const [rows] = await database.query("SELECT * FROM poetry_projects ORDER BY updated_at DESC, id DESC");
  return rows.map(toPoetryProject);
}

export async function getPoetryProject(id) {
  const database = await getDatabase();
  if (!database || !Number.isInteger(Number(id))) return null;
  return readPoetryProject(database, Number(id));
}

export async function upsertPoetryProject(input, id = null) {
  const database = await getDatabase();
  if (!database) throw new Error("未配置 MySQL，无法保存诗词项目。");
  const project = normalizePoetryProject(input);
  const connection = await database.getConnection();
  try {
    await connection.beginTransaction();
    let projectId = Number.isInteger(Number(id)) ? Number(id) : null;
    let seriesId;
    if (projectId) {
      const [existing] = await connection.query("SELECT series_id FROM poetry_projects WHERE id=? FOR UPDATE", [projectId]);
      if (!existing[0]) throw new Error("诗词项目不存在。");
      seriesId = Number(existing[0].series_id);
      await connection.query(
        "UPDATE poetry_projects SET title=?, poem_text=?, scene_count=?, image_size=?, prompt_supplement=?, analysis_json=?, style_guide=?, scenes_json=? WHERE id=?",
        [project.title, project.poemText, project.sceneCount, project.imageSize, project.promptSupplement || null, project.analysis ? JSON.stringify(project.analysis) : null, project.styleGuide || null, JSON.stringify(project.scenes), projectId]
      );
      await connection.query(
        "UPDATE series SET name=?, description='诗词意境创作合集', global_prompt=?, style_prompt=? WHERE id=?",
        [project.title, project.promptSupplement || null, project.styleGuide || null, seriesId]
      );
    } else {
      const [seriesResult] = await connection.query(
        "INSERT INTO series (name, description, global_prompt, style_prompt) VALUES (?, '诗词意境创作合集', ?, ?)",
        [project.title, project.promptSupplement || null, project.styleGuide || null]
      );
      seriesId = Number(seriesResult.insertId);
      const [projectResult] = await connection.query(
        "INSERT INTO poetry_projects (series_id, title, poem_text, scene_count, image_size, prompt_supplement, analysis_json, style_guide, scenes_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [seriesId, project.title, project.poemText, project.sceneCount, project.imageSize, project.promptSupplement || null, project.analysis ? JSON.stringify(project.analysis) : null, project.styleGuide || null, JSON.stringify(project.scenes)]
      );
      projectId = Number(projectResult.insertId);
    }

    for (const scene of project.scenes) {
      await connection.query(
        "INSERT INTO series_nodes (series_id, node_order, title, story_text, prompt) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE title=VALUES(title), story_text=VALUES(story_text), prompt=VALUES(prompt)",
        [seriesId, scene.sceneOrder, scene.title, scene.sourceLine || null, scene.prompt || null]
      );
    }
    await connection.commit();
    return readPoetryProject(database, projectId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
