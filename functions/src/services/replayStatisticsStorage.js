import {createHash} from 'node:crypto';
import {gzipSync, gunzipSync} from 'node:zlib';

const MAX_UNCOMPRESSED_STATISTICS_BYTES = 512 * 1024 * 1024;
const SHA256_HEX = /^[a-f0-9]{64}$/;

/** @param {Buffer | string} bytes */
export function replayArtifactSha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

/**
 * Serialize without changing the statistics payload, then compress its exact UTF-8 bytes.
 * `sha256` always describes bytes at `path`; `uncompressedSha256` describes JSON bytes.
 * @param {unknown} statistics
 */
export function encodeReplayStatistics(statistics) {
  const jsonBytes = Buffer.from(JSON.stringify(statistics), 'utf8');
  if (!jsonBytes.length || jsonBytes.length > MAX_UNCOMPRESSED_STATISTICS_BYTES) {
    throw new Error('Statistics JSON exceeds the maximum uncompressed artifact size.');
  }
  const compressedBytes = gzipSync(jsonBytes);
  return {
    bytes: compressedBytes,
    metadata: {
      format: 'json',
      compression: 'gzip',
      sha256: replayArtifactSha256(compressedBytes),
      bytes: compressedBytes.length,
      uncompressedSha256: replayArtifactSha256(jsonBytes),
      uncompressedBytes: jsonBytes.length,
    },
  };
}

/**
 * Read current gzip and older uncompressed JSON artifacts without guessing from the filename.
 * The stored digest is always checked before decompressing. Gzip artifacts also validate
 * the length and digest of the original JSON bytes before parsing.
 * @param {Buffer} storedBytes
 * @param {{path?: string, sha256?: string, format?: string, compression?: string,
 *          bytes?: number, uncompressedSha256?: string, uncompressedBytes?: number}} metadata
 * @returns {unknown}
 */
export function decodeReplayStatistics(storedBytes, metadata) {
  if (!metadata || !metadata.path || !SHA256_HEX.test(metadata.sha256 ?? '')) {
    throw new Error('Statistics artifact metadata is incomplete.');
  }
  if (metadata.format !== undefined && metadata.format !== 'json') {
    throw new Error('Unsupported statistics artifact format.');
  }
  const compression = metadata.compression ?? 'none';
  if (compression !== 'none' && compression !== 'gzip') {
    throw new Error('Unsupported statistics artifact compression.');
  }
  if (compression === 'gzip') {
    if (!metadata.path.endsWith('.json.gz') || !SHA256_HEX.test(metadata.uncompressedSha256 ?? '') ||
        !Number.isSafeInteger(metadata.uncompressedBytes) || metadata.uncompressedBytes <= 0 ||
        metadata.uncompressedBytes > MAX_UNCOMPRESSED_STATISTICS_BYTES ||
        !Number.isSafeInteger(metadata.bytes) || metadata.bytes <= 0) {
      throw new Error('Compressed statistics artifact metadata is incomplete.');
    }
  }
  if (metadata.bytes !== undefined && metadata.bytes !== storedBytes.length) {
    throw new Error('Stored statistics byte length mismatch.');
  }
  if (replayArtifactSha256(storedBytes) !== metadata.sha256) {
    throw new Error('Stored statistics SHA-256 mismatch.');
  }
  let jsonBytes = storedBytes;
  if (compression === 'gzip') {
    try {
      jsonBytes = gunzipSync(storedBytes, {maxOutputLength: metadata.uncompressedBytes});
    } catch {
      throw new Error('Stored statistics gzip decompression failed.');
    }
    if (jsonBytes.length !== metadata.uncompressedBytes ||
        replayArtifactSha256(jsonBytes) !== metadata.uncompressedSha256) {
      throw new Error('Uncompressed statistics integrity mismatch.');
    }
  }
  try {
    return JSON.parse(jsonBytes.toString('utf8'));
  } catch {
    throw new Error('Stored statistics are not valid JSON.');
  }
}

/**
 * Persist exact bytes without a resumable session, then verify the complete download.
 * @param {{save: Function, download: Function, delete: Function}} file
 * @param {Buffer} bytes
 * @param {string} expectedSha256
 * @param {string} contentType
 */
export async function verifiedReplayArtifactSave(file, bytes, expectedSha256, contentType) {
  if (!SHA256_HEX.test(expectedSha256) || replayArtifactSha256(bytes) !== expectedSha256) {
    throw new Error('Replay evidence source integrity verification failed.');
  }
  await file.save(bytes, {
    resumable: false,
    metadata: {contentType, cacheControl: 'private, no-store'},
  });
  const [stored] = await file.download();
  if (replayArtifactSha256(stored) !== expectedSha256) {
    await file.delete({ignoreNotFound: true});
    throw new Error('Replay evidence persistence verification failed.');
  }
}
