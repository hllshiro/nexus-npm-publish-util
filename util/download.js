const axios = require("axios");
const fs = require("fs");
const path = require("path");

const downloadFile = async function (fileUrl, filePath) {
  try {
    const response = await axios.get(fileUrl, { responseType: "stream" });
    const fileStream = fs.createWriteStream(filePath);
    response.data.pipe(fileStream);

    return new Promise((resolve, reject) => {
      fileStream.on("finish", () => resolve());
      fileStream.on("error", (err) => reject(err));
    });
  } catch (err) {
    console.error(`下载失败: ${err.message}`);
  }
};

const download = async function (urlSet, savePath) {
  if (!fs.existsSync(savePath)) {
    fs.mkdirSync(savePath);
  }
  const downloadPromises = Array.from(urlSet).map(async (url, index) => {
    const fileName = url.substring(url.lastIndexOf("/") + 1);
    const filePath = path.join(savePath, fileName);
    if (!fs.existsSync(filePath)) {
      console.info(`[下载] ${index + 1}. ${fileName}`);
      await downloadFile(url, filePath);
    } else {
      console.info(`[跳过] ${index + 1}. ${fileName}`);
    }
  });

  try {
    await Promise.all(downloadPromises);
    console.info(`下载完成`);
  } catch (err) {
    console.error(`下载失败: ${err.message}`);
  }
};

module.exports = {
  download
};
