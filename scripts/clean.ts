/**
 * 清理编译产物
 * 删除 dist/ 目录
 */

const distDir = new URL('../dist/', import.meta.url);

try {
  await Deno.remove(distDir, { recursive: true });
  console.log('已清理 dist/ 目录');
} catch (error) {
  if (error instanceof Deno.errors.NotFound) {
    console.log('dist/ 目录不存在，无需清理');
  } else {
    console.error(`清理失败: ${error}`);
    Deno.exit(1);
  }
}
