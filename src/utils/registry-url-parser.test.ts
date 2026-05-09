import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { parseRegistryUrl, buildUploadUrl, buildUploadUrlFromRegistry, ensureUrlEndsWithSlash } from './registry-url-parser.ts';

Deno.test('parseRegistryUrl: 正常解析完整URL', () => {
  const result = parseRegistryUrl('http://localhost:8081/repository/npm/');
  assertEquals(result.baseUrl, 'http://localhost:8081/');
  assertEquals(result.repository, 'npm');
  assertEquals(result.fullUrl, 'http://localhost:8081/repository/npm/');
});

Deno.test('parseRegistryUrl: 自动补全末尾斜杠', () => {
  const result = parseRegistryUrl('http://localhost:8081/repository/npm');
  assertEquals(result.baseUrl, 'http://localhost:8081/');
  assertEquals(result.repository, 'npm');
  assertEquals(result.fullUrl, 'http://localhost:8081/repository/npm/');
});

Deno.test('parseRegistryUrl: 支持 https', () => {
  const result = parseRegistryUrl('https://registry.example.com/repository/my-npm/');
  assertEquals(result.baseUrl, 'https://registry.example.com/');
  assertEquals(result.repository, 'my-npm');
});

Deno.test('parseRegistryUrl: 空URL抛出异常', () => {
  let threw = false;
  try {
    parseRegistryUrl('');
  } catch (e) {
    threw = true;
    assertEquals((e as Error).message, 'Registry URL不能为空');
  }
  assertEquals(threw, true);
});

Deno.test('parseRegistryUrl: 格式不匹配抛出异常', () => {
  let threw = false;
  try {
    parseRegistryUrl('http://localhost:8081/invalid/');
  } catch (e) {
    threw = true;
    assertEquals((e as Error).message.includes('Registry URL格式错误'), true);
  }
  assertEquals(threw, true);
});

Deno.test('parseRegistryUrl: 缺少协议抛出异常', () => {
  let threw = false;
  try {
    parseRegistryUrl('localhost:8081/repository/npm/');
  } catch (e) {
    threw = true;
    assertEquals((e as Error).message.includes('应以 http:// 或 https:// 开头'), true);
  }
  assertEquals(threw, true);
});

Deno.test('buildUploadUrl: 正常构建上传URL', () => {
  const result = buildUploadUrl('http://localhost:8081/', 'npm');
  assertEquals(result, 'http://localhost:8081/service/rest/v1/components?repository=npm');
});

Deno.test('buildUploadUrl: 自动补全baseUrl斜杠', () => {
  const result = buildUploadUrl('http://localhost:8081', 'npm');
  assertEquals(result, 'http://localhost:8081/service/rest/v1/components?repository=npm');
});

Deno.test('buildUploadUrl: 空参数抛出异常', () => {
  let threw = false;
  try {
    buildUploadUrl('', 'npm');
  } catch {
    threw = true;
  }
  assertEquals(threw, true);
});

Deno.test('buildUploadUrlFromRegistry: 从registry URL直接构建', () => {
  const result = buildUploadUrlFromRegistry('http://localhost:8081/repository/npm/');
  assertEquals(result, 'http://localhost:8081/service/rest/v1/components?repository=npm');
});

Deno.test('ensureUrlEndsWithSlash: 已有斜杠不变', () => {
  assertEquals(ensureUrlEndsWithSlash('http://example.com/'), 'http://example.com/');
});

Deno.test('ensureUrlEndsWithSlash: 自动补全斜杠', () => {
  assertEquals(ensureUrlEndsWithSlash('http://example.com'), 'http://example.com/');
});

Deno.test('ensureUrlEndsWithSlash: 空URL抛出异常', () => {
  let threw = false;
  try {
    ensureUrlEndsWithSlash('');
  } catch {
    threw = true;
  }
  assertEquals(threw, true);
});
