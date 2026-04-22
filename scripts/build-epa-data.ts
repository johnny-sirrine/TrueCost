/**
 * Build-time script: Downloads and preprocesses EPA vehicle data into a compact
 * local JSON asset for runtime lookup.
 *
 * Usage: npx tsx scripts/build-epa-data.ts
 *
 * Input:  EPA vehicles.csv (downloaded from fueleconomy.gov)
 * Output: src/data/epa/epa-vehicles.json (~400KB gzipped)
 *
 * The output uses string pools and tuple encoding for compactness:
 * - Deduplicated string arrays for options, fuels, transmissions, classes, drives
 * - Vehicle configs as numeric tuples referencing pool indices
 * - Indexed by lowercase make > model > year
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { join, dirname } from 'path';

const MIN_YEAR = 1995;
const CSV_URL = 'https://www.fueleconomy.gov/feg/epadata/vehicles.csv.zip';
const OUT_DIR = join(dirname(import.meta.url.replace('file://', '')), '..', 'src', 'data', 'epa');
const OUT_FILE = join(OUT_DIR, 'epa-vehicles.json');
const TMP_ZIP = '/tmp/epa-vehicles.csv.zip';
const TMP_DIR = '/tmp/epa-data';
const TMP_CSV = join(TMP_DIR, 'vehicles.csv');

// --- CSV Parsing ---

function parseCSV(content: string): Record<string, string>[] {
  const lines = content.split('\n');
  const headers = parseCSVLine(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseCSVLine(line);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] ?? '';
    }
    rows.push(row);
  }
  return rows;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

// --- String Pool ---

class StringPool {
  private map = new Map<string, number>();
  private arr: string[] = [];

  index(value: string): number {
    const existing = this.map.get(value);
    if (existing !== undefined) return existing;
    const idx = this.arr.length;
    this.arr.push(value);
    this.map.set(value, idx);
    return idx;
  }

  toArray(): string[] {
    return this.arr;
  }
}

// --- Main ---

function main() {
  // Download if needed
  if (!existsSync(TMP_CSV)) {
    console.log('Downloading EPA vehicles CSV...');
    execSync(`curl -sL "${CSV_URL}" -o "${TMP_ZIP}"`, { stdio: 'inherit' });
    mkdirSync(TMP_DIR, { recursive: true });
    execSync(`unzip -o "${TMP_ZIP}" -d "${TMP_DIR}"`, { stdio: 'inherit' });
  }

  console.log('Parsing CSV...');
  const csvContent = readFileSync(TMP_CSV, 'utf-8');
  const allRows = parseCSV(csvContent);
  console.log(`  Total rows: ${allRows.length}`);

  // Filter to MIN_YEAR+ and non-electric-only (we handle EVs but want meaningful MPG)
  const rows = allRows.filter(r => {
    const year = parseInt(r.year, 10);
    return year >= MIN_YEAR && !isNaN(year);
  });
  console.log(`  After year filter (>=${MIN_YEAR}): ${rows.length}`);

  // Build string pools
  const optPool = new StringPool();
  const fuelPool = new StringPool();
  const transPool = new StringPool();
  const classPool = new StringPool();
  const drivePool = new StringPool();

  // Build vehicle index: make > model > year > configs[]
  // Config tuple: [optIdx, combinedMpg, cityMpg, hwyMpg, cylinders, fuelIdx, transIdx, classIdx, driveIdx]
  const vehicles: Record<string, Record<string, Record<string, number[][]>>> = {};

  for (const row of rows) {
    const make = row.make.trim().toLowerCase();
    const model = row.model.trim().toLowerCase();
    const year = row.year.trim();

    if (!make || !model || !year) continue;

    const combinedMpg = parseInt(row.comb08, 10) || 0;
    const cityMpg = parseInt(row.city08, 10) || 0;
    const hwyMpg = parseInt(row.highway08, 10) || 0;
    const cylinders = parseInt(row.cylinders, 10) || 0;

    // Build option label from transmission + engine info
    const trany = row.trany || '';
    const displ = row.displ || '';
    const opt = [trany, cylinders ? `${cylinders} cyl` : '', displ ? `${displ}L` : '']
      .filter(Boolean)
      .join(', ');

    const config: number[] = [
      optPool.index(opt),
      combinedMpg,
      cityMpg,
      hwyMpg,
      cylinders,
      fuelPool.index(row.fuelType || ''),
      transPool.index(trany),
      classPool.index(row.VClass || ''),
      drivePool.index(row.drive || ''),
    ];

    if (!vehicles[make]) vehicles[make] = {};
    if (!vehicles[make][model]) vehicles[make][model] = {};
    if (!vehicles[make][model][year]) vehicles[make][model][year] = [];
    vehicles[make][model][year].push(config);
  }

  const makeCount = Object.keys(vehicles).length;
  const modelCount = Object.values(vehicles).reduce((s, m) => s + Object.keys(m).length, 0);
  console.log(`  Makes: ${makeCount}, Models: ${modelCount}`);

  // Output
  const output = {
    _meta: {
      source: 'EPA fueleconomy.gov vehicles.csv',
      generated: new Date().toISOString(),
      minYear: MIN_YEAR,
      configShape: '[optIdx, combinedMpg, cityMpg, hwyMpg, cylinders, fuelIdx, transIdx, classIdx, driveIdx]',
    },
    pools: {
      options: optPool.toArray(),
      fuels: fuelPool.toArray(),
      transmissions: transPool.toArray(),
      classes: classPool.toArray(),
      drives: drivePool.toArray(),
    },
    vehicles,
  };

  mkdirSync(OUT_DIR, { recursive: true });
  const json = JSON.stringify(output);
  writeFileSync(OUT_FILE, json);

  const sizeMB = (Buffer.byteLength(json) / 1024 / 1024).toFixed(2);
  console.log(`\nWrote ${OUT_FILE}`);
  console.log(`  Size: ${sizeMB} MB (raw JSON)`);
  console.log(`  String pools: ${optPool.toArray().length} options, ${fuelPool.toArray().length} fuels, ${transPool.toArray().length} transmissions, ${classPool.toArray().length} classes, ${drivePool.toArray().length} drives`);
}

main();
