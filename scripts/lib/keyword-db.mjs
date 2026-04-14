/**
 * 키워드 DB 공용 로더 및 best-match 매핑
 *
 * content-input/keywords/*.json을 전부 로드해서 키워드 → {total, comp, score} 맵 생성
 * 주제/태그 배열을 입력하면 best-match 키워드를 반환한다.
 *
 * 사용:
 *   import { loadKeywordDB, findBestMatchForTopic } from "./lib/keyword-db.mjs";
 *   const db = loadKeywordDB(ROOT);
 *   const match = findBestMatchForTopic(db, { topic, tags, keywords });
 */

import fs from "fs";
import path from "path";

/**
 * @typedef {{keyword:string, total:number, comp:string, score:number, sourceFile:string}} KeywordEntry
 * @typedef {Map<string, KeywordEntry>} KeywordDB
 */

/**
 * content-input/keywords/*.json 전체 로드
 * @param {string} root 프로젝트 루트
 * @returns {KeywordDB}
 */
export function loadKeywordDB(root) {
  const dirPath = path.join(root, "content-input", "keywords");
  const db = new Map();

  if (!fs.existsSync(dirPath)) return db;

  const files = fs.readdirSync(dirPath).filter((f) => f.endsWith(".json"));
  for (const file of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(dirPath, file), "utf-8"));
      const items = data.keywords ?? [];
      for (const kw of items) {
        if (!kw.keyword) continue;
        const entry = {
          keyword: kw.keyword,
          total: Number(kw.total) || 0,
          comp: kw.comp ?? null,
          score: Number(kw.score) || 0,
          sourceFile: file,
        };
        // 중복 시 score 높은 것 유지
        const prev = db.get(kw.keyword);
        if (!prev || prev.score < entry.score) {
          db.set(kw.keyword, entry);
        }
      }
    } catch (err) {
      console.warn(`  [keyword-db] ${file} 파싱 실패: ${err.message.slice(0, 120)}`);
    }
  }
  return db;
}

function normalize(text) {
  return String(text ?? "").toLowerCase().replace(/\s+/g, "");
}

/**
 * 주제/태그 배열에서 DB best-match 키워드를 찾는다.
 * 우선순위: exact(최고 score) > partial(최고 score)
 *
 * @param {KeywordDB} db
 * @param {{topic?: string, tags?: string[], keywords?: string[]}} input
 * @returns {(KeywordEntry & {matchType: "exact"|"partial"|"none", searchedBy?: string}) | null}
 */
export function findBestMatchForTopic(db, input) {
  const { topic = "", tags = [], keywords = [] } = input;
  const titleWords = topic
    .replace(/[—,·–]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !/^[0-9]+$/.test(w));

  const candidates = [...keywords, ...tags, ...titleWords].filter(Boolean);
  if (candidates.length === 0) return null;

  let bestExact = null;
  let bestPartial = null;

  for (const cand of candidates) {
    const normCand = normalize(cand);
    if (normCand.length < 2) continue;

    if (db.has(cand)) {
      const entry = db.get(cand);
      if (!bestExact || entry.score > bestExact.score) {
        bestExact = { ...entry, matchType: "exact", searchedBy: cand };
      }
      continue;
    }

    for (const [dbKey, dbEntry] of db) {
      const normDb = normalize(dbKey);
      if (normDb === normCand) continue;
      // 짧은 쪽이 긴 쪽에 포함되는지
      if (normDb.length >= 2 && normCand.length >= 2) {
        if (normDb.includes(normCand) || normCand.includes(normDb)) {
          if (!bestPartial || dbEntry.score > bestPartial.score) {
            bestPartial = { ...dbEntry, matchType: "partial", searchedBy: cand };
          }
        }
      }
    }
  }

  return bestExact ?? bestPartial ?? null;
}

/**
 * 여러 키워드를 한 번에 매핑 (discover-topics 검증용)
 * @param {KeywordDB} db
 * @param {string[]} keywords
 * @returns {Map<string, KeywordEntry>}
 */
export function lookupKeywords(db, keywords) {
  const result = new Map();
  for (const kw of keywords) {
    if (db.has(kw)) {
      result.set(kw, db.get(kw));
      continue;
    }
    // partial: DB에 "kw"를 포함하는 항목 중 최고 score
    const normKw = normalize(kw);
    let best = null;
    for (const [dbKey, entry] of db) {
      const normDb = normalize(dbKey);
      if (normDb.includes(normKw) || normKw.includes(normDb)) {
        if (!best || entry.score > best.score) best = entry;
      }
    }
    if (best) result.set(kw, best);
  }
  return result;
}
