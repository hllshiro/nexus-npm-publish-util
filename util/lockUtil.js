const extractPackageNames = function (packageLock) {
  const packageList = [];

  // TODO lockfileVersion:3 不再需要递归，只需要将第一级packages涉及的包全部记录即可
  function traversePackages(packages) {
    for (const key in packages) {
      if (key !== "") {
        let packageName =
          key.lastIndexOf("node_modules") > -1
            ? key.substring(key.lastIndexOf("node_modules/") + 13)
            : key;
        packageList.push(`${packageName}@${packages[key].version}`);
      }
    }
  }
  traversePackages(packageLock.packages);

  return packageList;
};

const extractPackageNamesDeep = function (packageLock) {
  const packageList = [];

  // TODO lockfileVersion:3 不再需要递归，只需要将第一级packages涉及的包全部记录即可
  function traversePackages(packages) {
    for (const key in packages) {
      let name, version;
      const package = packages[key];
      if (typeof package === "string") {
        // key是名称
        // package是版本号，可能为表达式
        name = key;
        version = formatVersion(package);
      } else {
        // object，优先找name
        // 没有name则key为名称（需要清除前缀node_modules)
        // 此时version均为指定版本
        if (package.name) {
          name = package.name;
        } else {
          name =
            key.lastIndexOf("node_modules") > -1
              ? key.substring(key.lastIndexOf("node_modules/") + 13)
              : key;
        }
        version = package.version;
      }
      if (name && name !== "") {
        if (version.indexOf("||") > -1) {
          version.split("||").forEach((v) => {
            pushPackge(packageList, `${name}@${v}`);
          });
        } else {
          pushPackge(packageList, `${name}@${version}`);
        }
      }

      if (package.dependencies) {
        traversePackages(package.dependencies);
      }
      if (package.devDependencies) {
        traversePackages(package.devDependencies);
      }
      if (package.peerDependencies) {
        traversePackages(package.peerDependencies);
      }
    }
  }
  traversePackages(packageLock.packages);

  return packageList;
};

/**
 * 格式化包名
 * eg: @babel/code-frame@7.14.5 -> babel-code-frame-7.14.5.tgz
 * @param {String} packageName
 * @returns
 */
const formatPackageTgzName = function (packageName) {
  return (
    (packageName.startsWith("@") ? packageName.slice(1) : packageName)
      .replace("@", "-")
      .split("/")
      .join("-") + ".tgz"
  );
};

const formatVersion = function (version) {
  return version.replace(/[\^~>=<\s]/g, "");
};

const pushPackge = function (list, package) {
  if (package.endsWith("*")) {
    package = package.substring(0, package.lastIndexOf("@") - 1);
  }
  if (!list.indexOf(package)) {
    list.push(package);
  }
};

module.exports = {
  extractPackageNames,
  extractPackageNamesDeep,
  formatPackageTgzName,
};
