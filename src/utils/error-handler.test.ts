import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { ErrorHandler, ErrorClassifier } from './error-handler.ts';
import { ErrorType, ErrorSeverity } from '@/types/index.ts';

Deno.test('ErrorHandler.formatError: 包含类型和消息', () => {
  const error = ErrorHandler.createError(ErrorType.NETWORK_ERROR, '连接失败');
  const formatted = ErrorHandler.formatError(error);
  assertEquals(formatted.includes('NETWORK_ERROR'), true);
  assertEquals(formatted.includes('连接失败'), true);
});

Deno.test('ErrorHandler.formatError: 包含包名', () => {
  const error = ErrorHandler.createError(ErrorType.UPLOAD_ERROR, '上传失败', 'my-pkg');
  const formatted = ErrorHandler.formatError(error);
  assertEquals(formatted.includes('my-pkg'), true);
});

Deno.test('ErrorHandler.createPackageCheckError: 创建检查错误', () => {
  const error = ErrorHandler.createPackageCheckError(
    ErrorType.REGISTRY_ERROR,
    'HTTP 500',
    'my-pkg',
    '1.0.0',
    'http://localhost/repository/npm/'
  );
  assertEquals(error.type, ErrorType.REGISTRY_ERROR);
  assertEquals(error.message, 'HTTP 500');
  assertEquals(error.packageName, 'my-pkg');
  assertEquals(error.version, '1.0.0');
  assertEquals(error.registryUrl, 'http://localhost/repository/npm/');
});

Deno.test('ErrorHandler.createPackageUploadError: 创建上传错误', () => {
  const error = ErrorHandler.createPackageUploadError(
    ErrorType.UPLOAD_ERROR,
    '上传失败',
    'my-pkg',
    '/path/to/file.tgz',
    'http://localhost/upload',
    500,
    'Internal Server Error'
  );
  assertEquals(error.type, ErrorType.UPLOAD_ERROR);
  assertEquals(error.packageName, 'my-pkg');
  assertEquals(error.filePath, '/path/to/file.tgz');
  assertEquals(error.statusCode, 500);
});

Deno.test('ErrorClassifier.getClassification: 网络错误可重试', () => {
  const classification = ErrorClassifier.getClassification(ErrorType.NETWORK_ERROR);
  assertEquals(classification.retryable, true);
  assertEquals(classification.severity, ErrorSeverity.MEDIUM);
});

Deno.test('ErrorClassifier.getClassification: 认证错误不可重试', () => {
  const classification = ErrorClassifier.getClassification(ErrorType.AUTH_ERROR);
  assertEquals(classification.retryable, false);
  assertEquals(classification.severity, ErrorSeverity.HIGH);
});

Deno.test('ErrorClassifier.isRetryable: 判断可重试性', () => {
  const retryable = { type: ErrorType.TIMEOUT_ERROR, message: 'timeout', packageName: 'pkg' };
  const nonRetryable = { type: ErrorType.AUTH_ERROR, message: 'auth', packageName: 'pkg' };
  assertEquals(ErrorClassifier.isRetryable(retryable), true);
  assertEquals(ErrorClassifier.isRetryable(nonRetryable), false);
});

Deno.test('ErrorClassifier.calculateStatistics: 统计错误', () => {
  const errors = [
    ErrorHandler.createError(ErrorType.NETWORK_ERROR, 'net1'),
    ErrorHandler.createError(ErrorType.NETWORK_ERROR, 'net2'),
    ErrorHandler.createError(ErrorType.AUTH_ERROR, 'auth1'),
  ];
  const stats = ErrorClassifier.calculateStatistics(errors);
  assertEquals(stats.total, 3);
  assertEquals(stats.byType[ErrorType.NETWORK_ERROR], 2);
  assertEquals(stats.byType[ErrorType.AUTH_ERROR], 1);
  assertEquals(stats.retryable, 2);
  assertEquals(stats.nonRetryable, 1);
});

Deno.test('ErrorHandler.sanitizeUrl: 移除认证信息', () => {
  const error = ErrorHandler.createPackageCheckError(
    ErrorType.REGISTRY_ERROR,
    'test',
    'pkg',
    '1.0.0',
    'http://user:pass@localhost/repository/npm/'
  );
  const detailed = ErrorHandler.formatDetailedError(error);
  // 认证信息应被移除
  assertEquals(detailed.includes('user:pass'), false);
});
