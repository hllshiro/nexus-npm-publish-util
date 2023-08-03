/**
 * 将路径 needToUploadFilesDir 下的包发布到私服
 *
 * 上传tgz的目录 needToUploadFilesDir
 * 私服地址 publishRestful
 * 私服用户 nexusUser
 */
let fs = require("fs");
const { exec } = require("child_process");
const axios = require("axios");

const needToUploadFilesDir = "./download"; // 自定义，待上传tgz文件所在目录
const publishRestful =
  "http://nexus.senjone.com/service/rest/v1/components?repository=npm-hosted";
const nexusUser = "xqkj:xqkj";

// 保存nexus仓库已有依赖
const publishLog = {
  exist: 0,
  new: 0,
  success: 0,
  error: 0,
  errorLog: [],
};
// 已存在包列表
const existedPackages = [];

const publishPackages = () => {
  fs.readdir(needToUploadFilesDir, (err, files) => {
    console.log("》》》2.上传tgz《《《");
    // 过滤待上传的包
    const waitForUpload = files.filter((f) => !existedPackages.includes(f));
    let count = 0;
    publishLog.new = waitForUpload.length;

    waitForUpload.forEach((f) => {
      const file = f; // path.resolve(needToUploadFilesDir, f);
      const curlCmd = `curl -u ${nexusUser} -X POST \"${publishRestful}\" -H "Accept: application/json" -H "Content-Type:multipart/form-data" -F "npm.asset=@${file};type=application/x-compressed"`;
      console.log(file);

      exec(curlCmd, { cwd: needToUploadFilesDir }, (error, stdout, stderr) => {
        if (error) {
          publishLog.error++;
          publishLog.errorLog.push(
            `[ERROR] publish error: ${file}, reason` + error
          );
          console.error(file + " publish failed", error);
        } else {
          publishLog.success++;
        }
        if (++count === publishLog.new) {
          fs.writeFile(
            new Date().valueOf() + ".log",
            JSON.stringify(publishLog, null, 2),
            (err) => {
              console.log("publish finished !");
              exec('move /y download\*.tgz downloaded')
            }
          );
        }
      });
    });
  });
};

const getReq = async (continuationToken) => {
  const contiToken = continuationToken
    ? "&continuationToken=" + continuationToken
    : "";
  const result = await axios.get(publishRestful + contiToken);
  if (result.status === 200 && result.data && result.data.items) {
    existedPackages.push(
      ...result.data.items.map((item) => {
        const g = item.group ? item.group + "-" : "";
        const n = item.name + "-";
        const v = item.version + ".tgz";
        return g + n + v;
      })
    );

    if (result.data.continuationToken) {
      await getReq(result.data.continuationToken);
    } else {
      publishLog.exist = existedPackages.length;
      console.log("请求结束时间戳: ", new Date().valueOf());

      // 上传
      publishPackages();
    }
  } else {
    console.log("》》》》请求出现异常《《《");
  }
};

console.log("》》》1.获取仓库中已有依赖，大概需要2~3分钟，请耐心等候..《《《");
console.log("开始请求时间戳: ", new Date().valueOf());
console.log("请求中......");

getReq();
