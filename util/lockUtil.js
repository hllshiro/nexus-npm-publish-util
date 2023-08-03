const extractResolvedUrls = function (lockfileObj) {
  const resolve = function (obj, resolvedSet) {
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const value = obj[key];
        if (typeof value === "object") {
          if (Array.isArray(value)) {
            for (const item of value) {
              if (typeof item === "object") {
                resolve(item, resolvedSet);
              }
            }
          } else {
            resolve(value, resolvedSet);
          }
        } else if (key === "resolved") {
          resolvedSet.add(value);
        }
      }
    }
  };
  const resolvedUrlsSet = new Set();
  resolve(lockfileObj, resolvedUrlsSet);
  return resolvedUrlsSet;
};

module.exports = {
  extractResolvedUrls
};
